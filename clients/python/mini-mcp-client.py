#!/usr/bin/env python3
"""
Mini MCP Client - A simple client to interact with mitre-mcp server via HTTP.

This demonstrates how to integrate mitre-mcp into your Python applications.
For production use, consider adding proper error handling, logging, and retries.

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
import sys
from typing import Any, Dict, Optional

import httpx


class MitreMCPClient:
    """Simple HTTP client for mitre-mcp server."""

    def __init__(self, host: str = "localhost", port: int = 8000, debug: bool = False):
        """Initialize the client with server connection details."""
        self.base_url = f"http://{host}:{port}/mcp"
        self.request_id = 0
        self.debug = debug
        self.session_id: Optional[str] = None
        self.http_client: Optional[httpx.AsyncClient] = None

    async def test_connection(self) -> bool:
        """Test if the server is reachable."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                # Try a simple GET to see if server responds
                response = await client.get(f"http://{self.base_url.split('/')[2]}")
                return response.status_code < 500
        except Exception:
            return False

    async def initialize_session(self) -> None:
        """Initialize an MCP session with the server."""
        self.request_id += 1

        init_payload = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "mini-mcp-client",
                    "version": "1.0.0"
                }
            }
        }

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }

        if self.debug:
            print(f"🔍 Debug: Initializing session...", file=sys.stderr)
            print(f"🔍 Debug: Init payload: {json.dumps(init_payload, indent=2)}", file=sys.stderr)

        if not self.http_client:
            self.http_client = httpx.AsyncClient(timeout=30.0)

        response = await self.http_client.post(
            self.base_url,
            json=init_payload,
            headers=headers
        )

        # Extract session ID from response headers
        self.session_id = response.headers.get("mcp-session-id")

        if self.debug:
            print(f"🔍 Debug: Session initialized", file=sys.stderr)
            print(f"🔍 Debug: Session ID: {self.session_id}", file=sys.stderr)
            print(f"🔍 Debug: Init response: {response.text[:500]}", file=sys.stderr)

        response.raise_for_status()

    async def close(self) -> None:
        """Close the HTTP client."""
        if self.http_client:
            await self.http_client.aclose()
            self.http_client = None

    def _parse_sse_response(self, sse_text: str) -> Dict[str, Any]:
        """
        Parse Server-Sent Events (SSE) response format.

        SSE format:
            event: message
            data: {"jsonrpc":"2.0","id":1,"result":{...}}

        """
        lines = sse_text.strip().split('\n')
        data_lines = []

        for line in lines:
            if line.startswith('data: '):
                # Extract the JSON data after "data: "
                data_lines.append(line[6:])  # Skip "data: " prefix

        # Join all data lines (in case data is split across multiple lines)
        json_data = ''.join(data_lines)

        if self.debug:
            print(f"🔍 Debug: Extracted SSE data: {json_data[:500]}", file=sys.stderr)

        return json.loads(json_data)

    async def call_tool(
        self, tool_name: str, arguments: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Call a mitre-mcp tool via HTTP/JSON-RPC.

        Important: The MCP HTTP server requires the Accept header to include
        both "application/json" and "text/event-stream" for proper protocol
        support (even though JSON-RPC calls return JSON).

        Args:
            tool_name: Name of the MCP tool to call
            arguments: Dictionary of arguments for the tool

        Returns:
            JSON-RPC response from the server

        Raises:
            httpx.HTTPError: If the HTTP request fails
            ValueError: If the JSON-RPC response contains an error
        """
        self.request_id += 1

        payload = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments or {}},
        }

        try:
            # Initialize session if not already done
            if not self.session_id:
                await self.initialize_session()

            # MCP HTTP server requires both content types and session ID
            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
            }

            # Add session ID to headers
            if self.session_id:
                headers["mcp-session-id"] = self.session_id

            if self.debug:
                print(f"🔍 Debug: Sending request to {self.base_url}", file=sys.stderr)
                print(f"🔍 Debug: Payload: {json.dumps(payload, indent=2)}", file=sys.stderr)
                print(f"🔍 Debug: Headers: {headers}", file=sys.stderr)

            if not self.http_client:
                self.http_client = httpx.AsyncClient(timeout=30.0)

            response = await self.http_client.post(
                self.base_url,
                json=payload,
                headers=headers
            )

            if self.debug:
                print(f"🔍 Debug: Response status: {response.status_code}", file=sys.stderr)
                print(f"🔍 Debug: Response headers: {dict(response.headers)}", file=sys.stderr)
                print(f"🔍 Debug: Response body: {response.text[:500]}", file=sys.stderr)

            response.raise_for_status()

            # Check if response is SSE format (text/event-stream)
            content_type = response.headers.get("content-type", "")
            if "text/event-stream" in content_type:
                # Parse SSE format
                result = self._parse_sse_response(response.text)
            else:
                # Regular JSON response
                result = response.json()

            # Check for JSON-RPC errors
            if "error" in result:
                error = result["error"]
                raise ValueError(
                    f"JSON-RPC Error {error.get('code')}: {error.get('message')}"
                )

            return result

        except httpx.HTTPError as e:
            print(f"❌ HTTP Error: {e}", file=sys.stderr)
            print(
                f"   Make sure mitre-mcp server is running: mitre-mcp --http --port {self.base_url.split(':')[-1].split('/')[0]}",
                file=sys.stderr,
            )
            if self.debug:
                print(f"🔍 Debug: Full exception: {type(e).__name__}: {e}", file=sys.stderr)
            raise
        except Exception as e:
            print(f"❌ Error: {e}", file=sys.stderr)
            raise

    def format_output(self, result: Dict[str, Any], pretty: bool = True) -> str:
        """Format the result for display."""
        if pretty:
            return json.dumps(result, indent=2)
        return json.dumps(result)


async def cmd_techniques(
    client: MitreMCPClient, args: argparse.Namespace
) -> Dict[str, Any]:
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


async def cmd_technique(
    client: MitreMCPClient, args: argparse.Namespace
) -> Dict[str, Any]:
    """Get details for a specific technique by ID."""
    return await client.call_tool(
        "get_technique_by_id",
        {"technique_id": args.id, "domain": args.domain},
    )


async def cmd_tactics(
    client: MitreMCPClient, args: argparse.Namespace
) -> Dict[str, Any]:
    """Get all tactics."""
    return await client.call_tool("get_tactics", {"domain": args.domain})


async def cmd_groups(
    client: MitreMCPClient, args: argparse.Namespace
) -> Dict[str, Any]:
    """Get all threat groups."""
    return await client.call_tool(
        "get_groups",
        {
            "domain": args.domain,
            "remove_revoked_deprecated": args.no_revoked,
        },
    )


async def cmd_group(
    client: MitreMCPClient, args: argparse.Namespace
) -> Dict[str, Any]:
    """Get techniques used by a specific threat group."""
    return await client.call_tool(
        "get_techniques_used_by_group",
        {"group_name": args.name, "domain": args.domain},
    )


async def cmd_software(
    client: MitreMCPClient, args: argparse.Namespace
) -> Dict[str, Any]:
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


async def cmd_mitigations(
    client: MitreMCPClient, args: argparse.Namespace
) -> Dict[str, Any]:
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
    technique_parser.add_argument(
        "--id", required=True, help="Technique ID (e.g., T1059.001)"
    )
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
    group_parser = subparsers.add_parser(
        "group", help="Get techniques used by a threat group"
    )
    add_common_args(group_parser)
    group_parser.add_argument(
        "--name", required=True, help="Group name (e.g., APT29, Lazarus Group)"
    )
    group_parser.set_defaults(func=cmd_group)

    # Software command
    software_parser = subparsers.add_parser(
        "software", help="Get software (malware/tools)"
    )
    add_common_args(software_parser)
    software_parser.add_argument(
        "--malware", action="store_true", help="Include only malware"
    )
    software_parser.add_argument(
        "--tools", action="store_true", help="Include only tools"
    )
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
