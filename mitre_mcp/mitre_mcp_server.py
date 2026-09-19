#!/usr/bin/env python3
"""MITRE ATT&CK MCP Server.

This server provides MCP tools for working with the MITRE ATT&CK framework
using the mitreattack-python library. Implemented using the official MCP Python SDK.

This module is the console-script entry point (``mitre-mcp`` and
``python -m mitre_mcp.mitre_mcp_server``) and the package's public surface:
everything the implementation and the test suite reach for is re-exported
here. The code itself lives in focused submodules:

- ``data``    — download, cache/STIX validation, lookup indices, AttackContext
- ``models``  — tool result TypedDicts and output formatting
- ``server``  — the ``mcp`` server object, its lifespan, the info resource
- ``tools``   — the nine MCP tools and the shared domain lookup
- ``cli``     — argument parsing and the startup banner
- ``http``    — transport security and the CORS-wrapped ASGI app
- ``_entry``  — late-bound access to this module for those submodules
"""

# Standard library imports
import argparse
import asyncio
import logging
import sys

# Third-party imports
import httpx  # noqa: F401  # patch surface: tests target "...mitre_mcp_server.httpx"
import uvicorn
from mitreattack.stix20 import MitreAttackData

# Local imports — re-exported so mitre_mcp.mitre_mcp_server.<name> stays the
# public API for tests, scripts and the console script.
from .cli import (
    _apply_env_defaults,
    build_config_banner,
    build_parser,
    parse_cli_args,
)
from .config import Config
from .data import (
    AttackContext,
    DomainIndices,
    DomainLists,
    attack_data_paths,
    build_domain_indices,
    build_domain_lists,
    check_disk_space,
    download_and_save_attack_data_async,
    download_domain,
    load_metadata,
    parse_timestamp,
    stale_cache_servable,
    validate_metadata,
    validate_stix_bundle,
)
from .http import build_http_app, build_transport_security, setup_http_server
from .models import (
    EntityRef,
    FormattedTechnique,
    GroupResult,
    GroupsResult,
    GroupTechniquesResult,
    MitigationResult,
    MitigationsResult,
    MitigationTechniquesResult,
    Pagination,
    SoftwareListResult,
    SoftwareResult,
    TacticResult,
    TacticsResult,
    TechniqueResult,
    TechniquesListResult,
    TechniquesPageResult,
    format_relationship_map,
    format_technique,
    truncate_description,
)
from .server import attack_lifespan, get_server_info, mcp
from .tools import (
    READ_ONLY_TOOL,
    AttackDomain,
    get_attack_data,
    get_groups,
    get_mitigations,
    get_software,
    get_tactics,
    get_technique_by_id,
    get_techniques,
    get_techniques_by_tactic,
    get_techniques_mitigated_by_mitigation,
    get_techniques_used_by_group,
)

__all__ = [
    "AttackContext",
    "AttackDomain",
    "Config",
    "DomainIndices",
    "DomainLists",
    "EntityRef",
    "FormattedTechnique",
    "GroupResult",
    "GroupTechniquesResult",
    "GroupsResult",
    "MitreAttackData",
    "MitigationResult",
    "MitigationsResult",
    "MitigationTechniquesResult",
    "Pagination",
    "READ_ONLY_TOOL",
    "SoftwareListResult",
    "SoftwareResult",
    "TacticResult",
    "TacticsResult",
    "TechniqueResult",
    "TechniquesListResult",
    "TechniquesPageResult",
    "attack_data_paths",
    "attack_lifespan",
    "build_config_banner",
    "build_domain_indices",
    "build_domain_lists",
    "build_http_app",
    "build_parser",
    "build_transport_security",
    "check_disk_space",
    "download_and_save_attack_data_async",
    "download_domain",
    "emit_startup_banner",
    "format_relationship_map",
    "format_technique",
    "truncate_description",
    "get_attack_data",
    "get_cli_args",
    "get_groups",
    "get_mitigations",
    "get_server_info",
    "get_software",
    "get_tactics",
    "get_technique_by_id",
    "get_techniques",
    "get_techniques_by_tactic",
    "get_techniques_mitigated_by_mitigation",
    "get_techniques_used_by_group",
    "httpx",
    "load_metadata",
    "main",
    "mcp",
    "parse_cli_args",
    "parse_timestamp",
    "setup_http_server",
    "setup_logging",
    "stale_cache_servable",
    "validate_metadata",
    "validate_stix_bundle",
]


# Set up logging
def setup_logging() -> logging.Logger:
    """Set up logging configuration.

    Returns:
        Logger instance
    """
    logging.basicConfig(
        level=getattr(logging, Config.LOG_LEVEL.upper()),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler(sys.stderr)],  # Log to stderr, keep stdout for MCP
    )
    return logging.getLogger(__name__)


logger = setup_logging()


_parsed_cli_args: argparse.Namespace | None = None


def get_cli_args() -> argparse.Namespace:
    """Return the process's parsed command-line args.

    ``main()`` parses once and stores the namespace here. When the lifespan
    runs without it — embedded ``mcp.run()``, a foreign ASGI host, tests —
    the process argv belongs to the embedder, so a tolerant
    ``parse_known_args`` picks up only this server's own flags.
    """
    if _parsed_cli_args is not None:
        return _parsed_cli_args
    parser = build_parser()
    args, _unknown = parser.parse_known_args()
    return _apply_env_defaults(args, parser)


def emit_startup_banner(args: argparse.Namespace) -> None:
    """Log the ready banner once, and print it to stderr with an immediate flush."""
    message = build_config_banner(http=args.http, host=args.host, port=args.port)
    logger.info(message)
    print(message, file=sys.stderr, flush=True)


def main() -> None:
    """Entry point for the package when installed."""
    global _parsed_cli_args
    # The single parse for this start-up: argparse handles -h/--help
    # (exit 0) and bad input (exit 2 with usage). The namespace is stored
    # so attack_lifespan reads the same args instead of re-parsing argv.
    _parsed_cli_args = parse_cli_args()

    # Signal handling is left to the runtime (F-BUG-029): uvicorn installs
    # its own SIGINT/SIGTERM handlers in HTTP mode, and stdio mode relies
    # on the default KeyboardInterrupt propagation caught below.
    try:
        if _parsed_cli_args.http:
            host, port = _parsed_cli_args.host, _parsed_cli_args.port
            log_level, transport_security = setup_http_server(host, port)

            # Build the ASGI app explicitly (no SDK monkey-patch) and
            # serve it — mirrors run_streamable_http_async in the SDK:
            # app construction here, uvicorn bound from the same settings.
            server = uvicorn.Server(
                uvicorn.Config(
                    build_http_app(host, transport_security),
                    host=host,
                    port=port,
                    log_level=log_level,
                )
            )
            asyncio.run(server.serve())
        else:
            logger.info("Starting MITRE ATT&CK MCP Server (stdio mode)")
            logger.info("Press Ctrl+C to stop the server")
            # Run with default transport (stdio)
            mcp.run()
    except KeyboardInterrupt:
        logger.info("\nKeyboard interrupt received. Shutting down gracefully...")
        sys.exit(0)
    except Exception as e:
        logger.error("Server error: %s", e, exc_info=True)
        sys.exit(1)


# Run the server if executed directly
if __name__ == "__main__":
    main()
