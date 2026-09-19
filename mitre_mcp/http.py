"""HTTP transport: DNS-rebinding protection and the CORS-wrapped ASGI app.

``mcp`` and ``Config`` are bound from the entry module at call time via
``_entry()`` rather than imported here: the test suite patches
``mitre_mcp.mitre_mcp_server.mcp`` / ``.Config`` and expects these
functions to observe the replacements, and a module-level import of the
entry point would create an import cycle.
"""

# Standard library imports
import hmac
import ipaddress
import logging
from typing import Any
from urllib.parse import urlparse

# MCP SDK imports
from mcp.server.transport_security import TransportSecuritySettings
from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import HTTPConnection
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

# Local imports
from ._entry import load as _entry

logger = logging.getLogger(__name__)


class BearerAuthMiddleware:
    """Require ``Authorization: Bearer <token>`` on every HTTP request.

    Installed by ``build_http_app`` only when ``MITRE_HTTP_AUTH_TOKEN``
    is set (F-SEC-005). The check covers every HTTP path the app serves —
    the SDK app mounts only the MCP endpoint — and sits *inside* the CORS
    middleware so unauthenticated requests are rejected while preflight
    ``OPTIONS`` requests are still answered. Non-HTTP scopes (lifespan)
    pass straight through. The token comparison is timing-safe; the
    scheme name is matched case-insensitively per RFC 7235.
    """

    def __init__(self, app: ASGIApp, token: str) -> None:
        self.app = app
        self._token = token.encode("utf-8")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """ASGI entry point: gate HTTP requests on the bearer token."""
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        parts = HTTPConnection(scope).headers.get("authorization", "").split(None, 1)
        authorized = (
            len(parts) == 2
            and parts[0].lower() == "bearer"
            and hmac.compare_digest(parts[1].encode("utf-8"), self._token)
        )
        if authorized:
            await self.app(scope, receive, send)
            return

        response = JSONResponse(
            {"detail": "Unauthorized"},
            status_code=401,
            headers={"WWW-Authenticate": "Bearer"},
        )
        await response(scope, receive, send)


def _is_loopback_host(host: str) -> bool:
    """True when *host* binds loopback only — ``localhost``, ::1, 127.0.0.0/8."""
    if host.lower() == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        # A DNS name (e.g. an intranet hostname) is treated as
        # non-loopback: the warning is the safe default.
        return False


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

    When ``Config.HTTP_AUTH_TOKEN`` (``MITRE_HTTP_AUTH_TOKEN``) is set,
    ``BearerAuthMiddleware`` is wrapped inside the CORS layer so every
    request must carry ``Authorization: Bearer <token>`` (F-SEC-005).
    Binding a non-loopback host without the token logs a warning.
    """
    entry = _entry()

    app: Starlette = entry.mcp.streamable_http_app(host=host, transport_security=transport_security)

    # Optional bearer auth (F-SEC-005). A non-str value can only come
    # from a patched/mocked Config — treated as unset, never a token.
    token = getattr(entry.Config, "HTTP_AUTH_TOKEN", None)
    if not isinstance(token, str) or not token:
        token = None

    if token is not None:
        # Added before CORSMiddleware: Starlette builds the last-registered
        # user middleware outermost, so CORS stays outside and keeps
        # answering preflight OPTIONS while auth guards the endpoint.
        app.add_middleware(BearerAuthMiddleware, token=token)
        logger.info("Bearer-token authentication enabled (MITRE_HTTP_AUTH_TOKEN)")
    elif not _is_loopback_host(host):
        logger.warning(
            "MITRE_HTTP_AUTH_TOKEN is unset while binding to non-loopback "
            "host %r: the MCP endpoint accepts unauthenticated requests "
            "from the network — an open CPU and memory amplifier. Set "
            "MITRE_HTTP_AUTH_TOKEN or place an authenticating reverse "
            "proxy in front of the server.",
            host,
        )

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
