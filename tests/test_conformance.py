"""MCP 2026-07-28 conformance tests, part 1 (issue #46).

Pins the server identity surface and per-tool metadata exposed through
``server/discover`` and ``tools/list``:

- ``test_server_discover`` — the discover result carries the server name,
  a version equal to the package version, and non-empty instructions.
- ``test_tool_annotations_and_domain_enum`` — every tool advertises a
  title, ``readOnlyHint`` (and friends), a ``domain`` property with an
  enum in its input schema, and (issue #48) an ``outputSchema`` object
  with named properties.
- ``test_structured_content_matches_unstructured`` — call results carry
  ``structuredContent`` identical to the JSON in ``content[0].text``, so
  the observed payload is unchanged.

The download step is patched to feed the committed STIX fixtures, as in
``test_protocol_smoke.py``.
"""

import json
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

# Root properties each tool's outputSchema must name — the success payload keys
# observed on the wire before structured output was added (issue #48), with the
# pagination block added by the issues #83/#84 paging contract.
EXPECTED_OUTPUT_PROPERTIES = {
    "get_techniques": {"techniques", "pagination"},
    "get_tactics": {"tactics", "pagination"},
    "get_groups": {"groups", "pagination"},
    "get_software": {"software", "pagination"},
    "get_techniques_by_tactic": {"techniques", "pagination"},
    "get_techniques_used_by_group": {"group", "techniques", "pagination"},
    "get_mitigations": {"mitigations", "pagination"},
    "get_techniques_mitigated_by_mitigation": {"mitigation", "techniques", "pagination"},
    "get_technique_by_id": {"technique"},
}

# Tools sharing the get_techniques paging contract (issues #83 and #84): the
# four list tools and the three relationship tools. get_technique_by_id
# returns a single object and stays unpaged.
PAGED_TOOLS = {
    "get_techniques",
    "get_tactics",
    "get_groups",
    "get_software",
    "get_mitigations",
    "get_techniques_by_tactic",
    "get_techniques_used_by_group",
    "get_techniques_mitigated_by_mitigation",
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

        output = tool.output_schema
        assert output is not None, f"{tool.name} has no outputSchema"
        assert output.get("type") == "object", tool.name
        expected = EXPECTED_OUTPUT_PROPERTIES[tool.name]
        assert (
            set(output.get("properties", {})) == expected
        ), f"{tool.name} outputSchema properties do not match the observed payload keys"
        assert set(output.get("required", [])) == expected, tool.name

        # Issues #83/#84: the four list tools and three relationship tools
        # carry the get_techniques paging contract in their inputSchema.
        if tool.name in PAGED_TOOLS:
            props = tool.input_schema["properties"]
            assert "limit" in props, f"{tool.name} inputSchema lacks limit"
            assert "offset" in props, f"{tool.name} inputSchema lacks offset"


@pytest.mark.asyncio
async def test_structured_content_matches_unstructured():
    """structuredContent equals the JSON in content[0].text — payload unchanged."""
    with patch.object(
        server_module, "download_and_save_attack_data_async", AsyncMock(return_value=FIXTURE_PATHS)
    ):
        async with Client(mcp) as client:
            calls = [
                ("get_techniques", {"limit": 1}),
                ("get_tactics", {}),
                ("get_technique_by_id", {"technique_id": "T1055"}),
                ("get_techniques_used_by_group", {"group_name": "APT29"}),
            ]
            for tool_name, arguments in calls:
                result = await client.call_tool(tool_name, arguments)
                assert not result.is_error, tool_name
                assert result.structured_content == json.loads(result.content[0].text), tool_name

            # Nested structure is validated against the schema, not stringified.
            paged = await client.call_tool("get_techniques", {"limit": 1})
            pagination = paged.structured_content["pagination"]
            assert set(pagination) == {"total", "offset", "limit", "has_more"}
            assert pagination["limit"] == 1
            assert pagination["total"] >= 1

            by_group = await client.call_tool(
                "get_techniques_used_by_group", {"group_name": "APT29"}
            )
            assert by_group.structured_content["group"]["name"] == "APT29"
            assert by_group.structured_content["group"]["id"].startswith("intrusion-set--")


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
