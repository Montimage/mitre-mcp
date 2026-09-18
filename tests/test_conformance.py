"""MCP 2026-07-28 conformance tests, part 1 (issue #46).

Pins the server identity surface and per-tool metadata exposed through
``server/discover`` and ``tools/list``:

- ``test_server_discover`` — the discover result carries the server name,
  a version equal to the package version, and non-empty instructions.
- ``test_tool_annotations_and_domain_enum`` — every tool advertises a
  title, ``readOnlyHint`` (and friends), and a ``domain`` property with an
  enum in its input schema.

The download step is patched to feed the committed STIX fixtures, as in
``test_protocol_smoke.py``.
"""

import os
from unittest.mock import AsyncMock, patch

import pytest
from mcp.client import Client

import mitre_mcp
import mitre_mcp.mitre_mcp_server as server_module
from mitre_mcp.mitre_mcp_server import mcp

FIXTURE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
FIXTURE_PATHS = {
    "enterprise": os.path.join(FIXTURE_DIR, "enterprise-attack.json"),
    "mobile": os.path.join(FIXTURE_DIR, "mobile-attack.json"),
    "ics": os.path.join(FIXTURE_DIR, "ics-attack.json"),
}


@pytest.mark.asyncio
async def test_server_discover():
    """server/discover exposes name, package version, and instructions."""
    with patch.object(
        server_module, "download_and_save_attack_data_async", AsyncMock(return_value=FIXTURE_PATHS)
    ):
        async with Client(mcp) as client:
            info = client.server_info
            assert info is not None
            assert info.name == "MITRE ATT&CK Server"
            assert info.version == mitre_mcp.__version__
            assert client.instructions


@pytest.mark.asyncio
async def test_tool_annotations_and_domain_enum():
    """Every tool has a title, read-only annotations, and a domain enum."""
    with patch.object(
        server_module, "download_and_save_attack_data_async", AsyncMock(return_value=FIXTURE_PATHS)
    ):
        async with Client(mcp) as client:
            result = await client.list_tools()

    assert len(result.tools) == 9
    for tool in result.tools:
        assert tool.title, f"{tool.name} has no title"
        assert tool.annotations is not None, f"{tool.name} has no annotations"
        assert tool.annotations.read_only_hint is True, tool.name
        domain = tool.input_schema["properties"]["domain"]
        assert "enum" in domain, f"{tool.name} domain property lacks enum"
        assert set(domain["enum"]) == {
            "enterprise-attack",
            "mobile-attack",
            "ics-attack",
        }, tool.name


@pytest.mark.asyncio
async def test_tool_failures_report_is_error():
    """Failures surface as MCP tool errors (isError), not success payloads."""
    with patch.object(
        server_module, "download_and_save_attack_data_async", AsyncMock(return_value=FIXTURE_PATHS)
    ):
        async with Client(mcp) as client:
            bad_domain = await client.call_tool("get_tactics", {"domain": "bogus-domain"})
            assert bad_domain.is_error

            unknown_id = await client.call_tool("get_technique_by_id", {"technique_id": "T9999"})
            assert unknown_id.is_error
            assert "not found" in unknown_id.content[0].text
