"""Command-line surface: the argparse parser and the startup banner.

One parser (``build_parser``) is shared by the strict ``parse_cli_args``
used by ``main()`` and the tolerant ``parse_known_args`` inside the entry
module's ``get_cli_args``. ``build_config_banner`` is the single producer of
the ready banner text. This module is a leaf — it imports nothing from the
rest of the package.
"""

# Standard library imports
import argparse
import json
import logging
import os
import sys
from typing import Any

logger = logging.getLogger(__name__)


def build_parser() -> argparse.ArgumentParser:
    """The one command-line parser for the mitre-mcp entry point.

    ``-h``/``--help`` is argparse's built-in action, so help text, usage
    and the exit-0/exit-2 semantics all come from this definition — there
    is no hand-rolled help printer or argv scan anywhere else.
    """
    parser = argparse.ArgumentParser(
        prog="mitre-mcp",
        description="MITRE ATT&CK MCP Server",
        epilog=(
            "Environment variables (HTTP mode):\n"
            "  MITRE_CORS_ORIGINS   CORS allowed origins (default: localhost origins)\n"
            "                       use a comma-separated list for specific domains,\n"
            '                       e.g. "https://example.com,http://localhost:5173"\n'
            "  FASTMCP_SERVER_HOST  default bind host (overridden by --host)\n"
            "  FASTMCP_SERVER_PORT  default bind port (overridden by --port)"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--http",
        action="store_true",
        help="run as HTTP server with streamable HTTP transport",
    )
    parser.add_argument(
        "--host",
        metavar="HOST",
        help="host to bind to (only with --http; default: FASTMCP_SERVER_HOST or localhost)",
    )
    parser.add_argument(
        "--port",
        metavar="PORT",
        type=int,
        help="port to bind to (only with --http; default: FASTMCP_SERVER_PORT or 8000)",
    )
    parser.add_argument(
        "--force-download",
        action="store_true",
        help="force download of MITRE ATT&CK data even if it's recent",
    )
    return parser


def _apply_env_defaults(
    args: argparse.Namespace, parser: argparse.ArgumentParser
) -> argparse.Namespace:
    """Fold FASTMCP_SERVER_HOST/PORT into --host/--port left unset on the CLI."""
    if args.host is None:
        args.host = os.getenv("FASTMCP_SERVER_HOST", "localhost")
    if args.port is None:
        env_port = os.getenv("FASTMCP_SERVER_PORT", "8000")
        try:
            args.port = int(env_port)
        except ValueError:
            parser.error(f"invalid FASTMCP_SERVER_PORT value: {env_port!r}")
    return args


def parse_cli_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Strictly parse the mitre-mcp command line for ``main()``.

    Bad input (unknown flag, missing value, non-integer port) exits 2 with
    a usage message; ``-h``/``--help`` prints help and exits 0.
    """
    parser = build_parser()
    return _apply_env_defaults(parser.parse_args(argv), parser)


def build_config_banner(*, http: bool, host: str, port: int) -> str:
    """Build the startup configuration banner for the active transport.

    The single producer of the banner text — called once per start-up via
    ``emit_startup_banner``.
    """
    if http:
        server_url = f"http://{host}:{port}"
        headline = (
            "MITRE ATT&CK MCP Server is ready (Streamable HTTP mode)\n"
            f"Server URL: {server_url}\n"
            f"MCP Endpoint: {server_url}/mcp\n"
        )
        config_snippet: dict[str, Any] = {
            "mcpServers": {"mitreattack": {"url": f"{server_url}/mcp"}}
        }
    else:
        headline = "MITRE ATT&CK MCP Server is ready (stdio mode)\n"
        config_snippet = {
            "mcpServers": {
                "mitreattack": {
                    "command": sys.executable,
                    "args": ["-m", "mitre_mcp.mitre_mcp_server"],
                }
            }
        }

    return (
        "\n"
        + "=" * 70
        + "\n"
        + headline
        + "\n"
        + "Add this to your MCP client configuration:\n"
        + json.dumps(config_snippet, indent=2)
        + "\n"
        + "=" * 70
    )
