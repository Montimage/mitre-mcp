"""Smoke test for the Python sample client (clients/python/mini-mcp-client.py).

Offline checks — no mitre-mcp server required: the module must load, the
client must construct and format/derive state correctly, and ``--help`` must
exit 0. Run with ``pytest clients/python/`` (not collected by the main suite,
whose testpaths is ``tests/``).
"""

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest
from mcp import MCPError

CLIENT_PATH = Path(__file__).with_name("mini-mcp-client.py")


def _load_module():
    """Load the hyphenated script as a module."""
    spec = importlib.util.spec_from_file_location("mini_mcp_client", CLIENT_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def client_module():
    return _load_module()


def test_module_loads_and_exposes_client(client_module):
    assert hasattr(client_module, "MitreMCPClient")


def test_constructor_derives_mcp_url(client_module):
    client = client_module.MitreMCPClient(host="localhost", port=8000)
    assert client.base_url == "http://localhost:8000/mcp"
    assert client.port == 8000
    assert client._client is None


def test_format_output_pretty_and_compact(client_module):
    client = client_module.MitreMCPClient()
    payload = {"result": {"isError": False}}
    assert json.loads(client.format_output(payload, pretty=True)) == payload
    assert client.format_output(payload, pretty=False) == '{"result": {"isError": false}}'


def test_session_terminated_error_detection(client_module):
    assert client_module.MitreMCPClient._is_session_terminated_error(
        MCPError(code=-32000, message="Session terminated")
    )
    assert not client_module.MitreMCPClient._is_session_terminated_error(
        MCPError(code=-32000, message="method not found")
    )
    assert not client_module.MitreMCPClient._is_session_terminated_error(ValueError("x"))


def test_help_exits_zero_without_server():
    proc = subprocess.run(
        [sys.executable, str(CLIENT_PATH), "--help"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert proc.returncode == 0
    assert "techniques" in proc.stdout
    assert "tactics" in proc.stdout
