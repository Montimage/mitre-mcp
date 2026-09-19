"""HTTP transport: DNS-rebinding protection and the CORS-wrapped ASGI app.

``mcp`` and ``Config`` are bound from the entry module at call time via
``_entry()`` rather than imported here: the test suite patches
``mitre_mcp.mitre_mcp_server.mcp`` / ``.Config`` and expects these
functions to observe the replacements, and a module-level import of the
entry point would create an import cycle.
"""

# Standard library imports
import logging
from typing import Any
from urllib.parse import urlparse

# MCP SDK imports
from mcp.server.transport_security import TransportSecuritySettings
from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware

# Local imports
from ._entry import load as _entry

logger = logging.getLogger(__name__)


def build_transport_security(host: str, port: int) -> TransportSecuritySettings:
    """Build DNS-rebinding protection settings for HTTP mode.

    Derives the Host and Origin allow-lists in exactly one place from the
    requested bind host and Config.CORS_ORIGINS:

    - Loopback Host/Origin values are always allowed, matching the SDK
      default.
    - Configured MITRE_CORS_ORIGINS entries are always allowed as Origins,
      and their hostnames are allowed as Host targets for same-host
      deployments.
    - A non-loopback bind host (e.g. 0.0.0.0) is added to the Host list.
    - An explicit "*" in MITRE_CORS_ORIGINS disables the protection,
      mirroring the allow-all CORS opt-in.
    """
    Config = _entry().Config

    loopback_hosts = ["127.0.0.1:*", "localhost:*", "[::1]:*"]
    loopback_origins = [
        "http://127.0.0.1:*",
        "http://localhost:*",
        "http://[::1]:*",
    ]

    configured_origins = [
        origin.strip() for origin in Config.CORS_ORIGINS.split(",") if origin.strip()
    ]

    if "*" in configured_origins:
        enable = False
        allowed_hosts: list[str] = []
        allowed_origins: list[str] = []
        logger.warning(
            "MITRE_CORS_ORIGINS='*': DNS rebinding protection disabled for HTTP transport"
        )
    else:
        enable = True
        allowed_hosts = list(loopback_hosts)
        allowed_origins = loopback_origins + configured_origins

        if host not in ("127.0.0.1", "localhost", "::1"):
            allowed_hosts.append(f"{host}:*")

        for origin in configured_origins:
            netloc = urlparse(origin).netloc
            if netloc:
                allowed_hosts.append(netloc if ":" in netloc else f"{netloc}:*")

        allowed_hosts = list(dict.fromkeys(allowed_hosts))

    return TransportSecuritySettings(
        enable_dns_rebinding_protection=enable,
        allowed_hosts=allowed_hosts,
        allowed_origins=allowed_origins,
    )


def setup_http_server(host: str, port: int) -> tuple[str, TransportSecuritySettings]:
    """Configure and display HTTP server information.

    Single access site for ``mcp.settings`` — callers use the return
    value instead of touching settings themselves.

    Args:
        host: Server host address
        port: Server port number

    Returns:
        ``(log_level, transport_security)`` — the configured MCPServer
        log level (lowercase) for uvicorn, and the DNS-rebinding
        settings to hand to ``streamable_http_app()``.
    """
    mcp = _entry().mcp

    logger.info("Starting MITRE ATT&CK MCP Server (HTTP mode on %s:%d)", host, port)
    logger.info("Press Ctrl+C to stop the server")

    # Derive DNS-rebinding transport security from the bind host and the
    # configured CORS origins — the SDK auto-enables a localhost-only
    # default inside streamable_http_app() when none is passed, so it
    # must be built here or remote clients are always rejected.
    transport_security = build_transport_security(host, port)

    # The configuration banner is emitted once, by the lifespan, when the
    # server is actually ready — not here, before uvicorn starts.
    return mcp.settings.log_level.lower(), transport_security


def build_http_app(host: str, transport_security: TransportSecuritySettings) -> Starlette:
    """Build the streamable-HTTP ASGI app with CORS middleware.

    Calls the SDK's streamable_http_app() once with the transport
    parameters that v2 moved off the constructor/settings, then adds
    CORSMiddleware configured from ``Config.CORS_ORIGINS`` to the
    returned app — the same stack the former monkey-patch produced,
    built explicitly so SDK internals stay untouched. Credentials are
    never allowed; ``"*"`` is an explicit opt-in that reflects any
    origin without credentials.
    """
    entry = _entry()

    app: Starlette = entry.mcp.streamable_http_app(host=host, transport_security=transport_security)

    cors_config = entry.Config.CORS_ORIGINS.strip()
    cors_kwargs: dict[str, Any] = {
        "allow_credentials": False,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
        "expose_headers": ["Mcp-Session-Id"],
    }
    if cors_config == "*":
        # Explicit "*" opt-in: reflect all origins but never with credentials
        logger.info("CORS middleware enabled for all origins (no credentials)")
        cors_kwargs["allow_origin_regex"] = r".*"
    else:
        # Parse comma-separated list of specific origins
        allowed_origins = [origin.strip() for origin in cors_config.split(",") if origin.strip()]
        logger.info("CORS middleware enabled for: %s", ", ".join(allowed_origins))
        cors_kwargs["allow_origins"] = allowed_origins

    app.add_middleware(CORSMiddleware, **cors_kwargs)
    return app
