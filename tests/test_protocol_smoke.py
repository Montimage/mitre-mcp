"""Protocol-level smoke test: drive the real server through a real MCP client.

Uses the SDK's in-process `Client(server)` so tool registration, input
schemas, and invocation are exercised end-to-end without any network
access. The download step is patched to feed the committed STIX fixture
as data.

If the `mcp` SDK import fails this module errors at collection — that is
the signal this test exists to provide (see F-DEP-001 history).
"""

import json
import os
from unittest.mock import AsyncMock, patch

import pytest
from mcp.client import Client

from mitre_mcp.mitre_mcp_server import mcp

FIXTURE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
FIXTURE_PATHS = {
    "enterprise": os.path.join(FIXTURE_DIR, "enterprise-attack.json"),
    "mobile": os.path.join(FIXTURE_DIR, "mobile-attack.json"),
    "ics": os.path.join(FIXTURE_DIR, "ics-attack.json"),
}

EXPECTED_TOOLS = {
    "get_groups",
    "get_mitigations",
    "get_software",
    "get_tactics",
    "get_technique_by_id",
    "get_techniques",
    "get_techniques_by_tactic",
    "get_techniques_mitigated_by_mitigation",
    "get_techniques_used_by_group",
}


@pytest.mark.asyncio
async def test_tools_list_returns_exactly_the_nine_registered_tools():
    with patch(
        "mitre_mcp.mitre_mcp_server.download_and_save_attack_data_async",
        new=AsyncMock(return_value=FIXTURE_PATHS),
    ):
        async with Client(mcp) as client:
            result = await client.list_tools()
            assert len(result.tools) == 9
            assert {tool.name for tool in result.tools} == EXPECTED_TOOLS


@pytest.mark.asyncio
async def test_tools_call_returns_non_error_result_with_fixture_data():
    with patch(
        "mitre_mcp.mitre_mcp_server.download_and_save_attack_data_async",
        new=AsyncMock(return_value=FIXTURE_PATHS),
    ):
        async with Client(mcp) as client:
            call = await client.call_tool("get_tactics", {"domain": "enterprise-attack"})
            assert not call.is_error
            payload = json.loads(call.content[0].text)
            tactic_names = {tactic["name"] for tactic in payload["tactics"]}
            assert {"Persistence", "Lateral Movement"} <= tactic_names
