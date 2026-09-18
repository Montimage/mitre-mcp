#!/usr/bin/env python3
"""
Mini MCP Client - A simple client to interact with mitre-mcp server via HTTP.

Built on the official MCP Python SDK (`mcp` package, v2). The SDK handles
protocol-version negotiation, the initialize handshake, SSE framing, the
required Accept header, and session-id propagation; this module only maps
CLI commands to `tools/call` invocations.

Usage:
    python mini-mcp-client.py --help
    python mini-mcp-client.py techniques --tactic initial-access
    python mini-mcp-client.py technique --id T1059.001
    python mini-mcp-client.py group --name APT29
    python mini-mcp-client.py tactics
"""

import argparse
import asyncio
import json
import logging
import sys
from contextlib import AsyncExitStack, suppress
from typing import Any

from mcp import Client, MCPError
from mcp.types import Implementation

# Per-request timeout for tools/call (the SDK also applies its own default).
CALL_TIMEOUT_SECONDS = 30.0


class MitreMCPClient:
    """Simple client for mitre-mcp server, built on the official mcp SDK."""

    def __init__(self, host: str = "localhost", port: int = 8000, debug: bool = False):
        """Initialize the client with server connection details."""
        self.base_url = f"http://{host}:{port}/mcp"
        self.port = port
        self.debug = debug
        self._client: Client | None = None
        self._exit_stack = AsyncExitStack()

    def _debug(self, message: str) -> None:
        if self.debug:
            print(f"🔍 Debug: {message}", file=sys.stderr)

    async def initialize_session(self) -> None:
        """Connect to the server and perform the MCP handshake.

        `Client.__aenter__` runs version negotiation ('auto' probes
        `server/discover` and falls back to the legacy `initialize`
        handshake), sends `notifications/initialized`, and lets the transport
        capture the session header — the steps the previous hand-rolled
        implementation had to do by hand.
        """
        self._debug(f"Initializing session against {self.base_url} ...")
        client = await self._exit_stack.enter_async_context(
            Client(
                self.base_url,
                client_info=Implementation(name="mini-mcp-client", version="1.0.0"),
                read_timeout_seconds=CALL_TIMEOUT_SECONDS,
            )
        )
        self._client = client
        self._debug("Session initialized")

    async def _ensure_connected(self) -> Client:
        if self._client is None:
            await self.initialize_session()
        assert self._client is not None
        return self._client

    async def _reset_session(self) -> None:
        """Drop the current session so the next call re-initializes."""
        if self._client is not None:
            self._client = None
            with suppress(Exception):
                await self._exit_stack.aclose()
            self._exit_stack = AsyncExitStack()

    async def test_connection(self) -> bool:
        """Test if the server is reachable and answers the MCP handshake."""
        if self._client is not None:
            return True
        try:
            async with Client(self.base_url):
                return True
        except Exception:
            return False

    async def close(self) -> None:
        """Close the client, terminating the server-side session if any."""
        await self._reset_session()

    @staticmethod
    def _is_session_terminated_error(exc: Exception) -> bool:
        """Whether the error reports an expired/unknown server-side session."""
        return isinstance(exc, MCPError) and "session terminated" in str(exc.error.message).lower()

    async def call_tool(
        self, tool_name: str, arguments: dict[str, Any] | None = None, _is_retry: bool = False
    ) -> dict[str, Any]:
        """
        Call a mitre-mcp tool via the MCP SDK.

        Args:
            tool_name: Name of the MCP tool to call
            arguments: Dictionary of arguments for the tool

        Returns:
            ``{"result": <CallToolResult>}`` — the same envelope shape the
            previous JSON-RPC implementation produced, so callers can keep
            reading ``result["result"]["content"]`` /
            ``result["result"]["structuredContent"]`` /
            ``result["result"]["isError"]``.

        Raises:
            MCPError: If the server returns a JSON-RPC error
            Exception: If the request fails at the transport level
        """
        try:
            client = await self._ensure_connected()
            self._debug(f"Calling tool: {tool_name} args={arguments or {}}")
            result = await client.call_tool(tool_name, arguments or {})
        except Exception as e:
            # "Session terminated" means the server forgot our session —
            # drop it, re-initialize, and retry exactly once.
            if not _is_retry and self._is_session_terminated_error(e):
                self._debug("Session expired, re-initializing and retrying once")
                await self._reset_session()
                return await self.call_tool(tool_name, arguments, _is_retry=True)
            if isinstance(e, MCPError):
                print(f"❌ MCP Error {e.error.code}: {e.error.message}", file=sys.stderr)
            else:
                print(f"❌ Error: {e}", file=sys.stderr)
                print(
                    "   Make sure mitre-mcp server is running: "
                    f"mitre-mcp --http --port {self.port}",
                    file=sys.stderr,
                )
            raise

        self._debug(f"Tool call completed: isError={result.is_error}")
        return {
            "result": result.model_dump(
                mode="json", by_alias=True, exclude_none=True, exclude={"result_type"}
            )
        }

    def format_output(self, result: dict[str, Any], pretty: bool = True) -> str:
        """Format the result for display."""
        if pretty:
            return json.dumps(result, indent=2)
        return json.dumps(result)


async def cmd_techniques(client: MitreMCPClient, args: argparse.Namespace) -> dict[str, Any]:
    """Get techniques, optionally filtered by tactic."""
    if args.tactic:
        return await client.call_tool(
            "get_techniques_by_tactic",
            {
                "tactic_shortname": args.tactic,
                "domain": args.domain,
                "remove_revoked_deprecated": args.no_revoked,
            },
        )
    else:
        return await client.call_tool(
            "get_techniques",
            {
                "domain": args.domain,
                "include_subtechniques": args.subtechniques,
                "include_descriptions": args.descriptions,
                "remove_revoked_deprecated": args.no_revoked,
                "limit": args.limit,
                "offset": args.offset,
            },
        )


async def cmd_technique(client: MitreMCPClient, args: argparse.Namespace) -> dict[str, Any]:
    """Get details for a specific technique by ID."""
    return await client.call_tool(
        "get_technique_by_id",
        {"technique_id": args.id, "domain": args.domain},
    )


async def cmd_tactics(client: MitreMCPClient, args: argparse.Namespace) -> dict[str, Any]:
    """Get all tactics."""
    return await client.call_tool("get_tactics", {"domain": args.domain})


async def cmd_groups(client: MitreMCPClient, args: argparse.Namespace) -> dict[str, Any]:
    """Get all threat groups."""
    return await client.call_tool(
        "get_groups",
        {
            "domain": args.domain,
            "remove_revoked_deprecated": args.no_revoked,
        },
    )


async def cmd_group(client: MitreMCPClient, args: argparse.Namespace) -> dict[str, Any]:
    """Get techniques used by a specific threat group."""
    return await client.call_tool(
        "get_techniques_used_by_group",
        {"group_name": args.name, "domain": args.domain},
    )


async def cmd_software(client: MitreMCPClient, args: argparse.Namespace) -> dict[str, Any]:
    """Get software (malware/tools)."""
    software_types = []
    if args.malware:
        software_types.append("malware")
    if args.tools:
        software_types.append("tool")
    if not software_types:
        software_types = ["malware", "tool"]

    return await client.call_tool(
        "get_software",
        {
            "domain": args.domain,
            "software_types": software_types,
            "remove_revoked_deprecated": args.no_revoked,
        },
    )


async def cmd_mitigations(client: MitreMCPClient, args: argparse.Namespace) -> dict[str, Any]:
    """Get mitigations, optionally for a specific mitigation name."""
    if args.name:
        return await client.call_tool(
            "get_techniques_mitigated_by_mitigation",
            {"mitigation_name": args.name, "domain": args.domain},
        )
    else:
        return await client.call_tool(
            "get_mitigations",
            {
                "domain": args.domain,
                "remove_revoked_deprecated": args.no_revoked,
            },
        )


async def main():
    """Main entry point for the mini-mcp-client."""
    parser = argparse.ArgumentParser(
        description="Mini MCP Client - Simple client for mitre-mcp server",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Get all tactics
  python mini-mcp-client.py tactics

  # Get techniques for initial-access tactic
  python mini-mcp-client.py techniques --tactic initial-access

  # Get details for a specific technique
  python mini-mcp-client.py technique --id T1059.001

  # Get techniques used by APT29
  python mini-mcp-client.py group --name APT29

  # Get all threat groups
  python mini-mcp-client.py groups

  # Get software (malware and tools)
  python mini-mcp-client.py software --malware

  # Get mitigations
  python mini-mcp-client.py mitigations

  # Get techniques mitigated by a specific mitigation
  python mini-mcp-client.py mitigations --name "Multi-factor Authentication"

Make sure the mitre-mcp server is running:
  mitre-mcp --http --port 8000
        """,
    )

    parser.add_argument(
        "--host",
        default="localhost",
        help="mitre-mcp server host (default: localhost)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="mitre-mcp server port (default: 8000)",
    )
    parser.add_argument(
        "--no-pretty",
        action="store_true",
        help="Disable pretty printing",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug output",
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # Common arguments
    def add_common_args(subparser):
        subparser.add_argument(
            "--domain",
            default="enterprise-attack",
            choices=["enterprise-attack", "mobile-attack", "ics-attack"],
            help="ATT&CK domain (default: enterprise-attack)",
        )
        subparser.add_argument(
            "--no-revoked",
            action="store_true",
            help="Exclude revoked/deprecated items",
        )

    # Techniques command
    techniques_parser = subparsers.add_parser(
        "techniques", help="Get techniques (all or by tactic)"
    )
    add_common_args(techniques_parser)
    techniques_parser.add_argument(
        "--tactic",
        help="Filter by tactic shortname (e.g., initial-access, persistence)",
    )
    techniques_parser.add_argument(
        "--subtechniques", action="store_true", help="Include sub-techniques"
    )
    techniques_parser.add_argument(
        "--descriptions", action="store_true", help="Include descriptions"
    )
    techniques_parser.add_argument(
        "--limit", type=int, default=20, help="Limit results (default: 20)"
    )
    techniques_parser.add_argument(
        "--offset", type=int, default=0, help="Offset for pagination (default: 0)"
    )
    techniques_parser.set_defaults(func=cmd_techniques)

    # Technique command (singular)
    technique_parser = subparsers.add_parser(
        "technique", help="Get details for a specific technique"
    )
    add_common_args(technique_parser)
    technique_parser.add_argument("--id", required=True, help="Technique ID (e.g., T1059.001)")
    technique_parser.set_defaults(func=cmd_technique)

    # Tactics command
    tactics_parser = subparsers.add_parser("tactics", help="Get all tactics")
    add_common_args(tactics_parser)
    tactics_parser.set_defaults(func=cmd_tactics)

    # Groups command
    groups_parser = subparsers.add_parser("groups", help="Get all threat groups")
    add_common_args(groups_parser)
    groups_parser.set_defaults(func=cmd_groups)

    # Group command (singular)
    group_parser = subparsers.add_parser("group", help="Get techniques used by a threat group")
    add_common_args(group_parser)
    group_parser.add_argument(
        "--name", required=True, help="Group name (e.g., APT29, Lazarus Group)"
    )
    group_parser.set_defaults(func=cmd_group)

    # Software command
    software_parser = subparsers.add_parser("software", help="Get software (malware/tools)")
    add_common_args(software_parser)
    software_parser.add_argument("--malware", action="store_true", help="Include only malware")
    software_parser.add_argument("--tools", action="store_true", help="Include only tools")
    software_parser.set_defaults(func=cmd_software)

    # Mitigations command
    mitigations_parser = subparsers.add_parser("mitigations", help="Get mitigations")
    add_common_args(mitigations_parser)
    mitigations_parser.add_argument(
        "--name",
        help="Get techniques mitigated by this mitigation (e.g., 'Multi-factor Authentication')",
    )
    mitigations_parser.set_defaults(func=cmd_mitigations)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    if args.debug:
        # Surface the SDK's protocol logs (negotiation, session, SSE frames).
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(logging.Formatter("🔍 %(name)s: %(message)s"))
        mcp_logger = logging.getLogger("mcp")
        mcp_logger.setLevel(logging.DEBUG)
        mcp_logger.addHandler(handler)

    # Create client and execute command
    client = MitreMCPClient(host=args.host, port=args.port, debug=args.debug)

    try:
        result = await args.func(client, args)
        print(client.format_output(result, pretty=not args.no_pretty))
    except Exception as e:
        print(f"\n❌ Failed to execute command: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        # Clean up the client
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())
