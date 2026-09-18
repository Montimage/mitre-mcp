"""Concurrency semantics contract tests for the MCP SDK v2 server (issue #45).

Two guarantees are pinned here:

- F-PERF-001: the streamable-HTTP session manager enters ``attack_lifespan``
  exactly once per server process — connecting sessions no longer re-parse
  ~46MB of STIX per session as they did under SDK v1.
- F-PERF-003: synchronous ``def`` tool handlers run on an anyio worker
  thread instead of blocking the event loop; the lookup indices they share
  are precomputed inside the lifespan (the "guarded by precompute" option),
  so concurrent handlers only read immutable state.

The download step is patched to feed the committed STIX fixtures, as in
``test_protocol_smoke.py``.
"""

import asyncio
import json
import os
import socket
import threading
from unittest.mock import AsyncMock, patch

import pytest
import uvicorn
from mcp.client import Client

import mitre_mcp.mitre_mcp_server as server_module
from mitre_mcp.mitre_mcp_server import build_transport_security, mcp

FIXTURE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
FIXTURE_PATHS = {
    "enterprise": os.path.join(FIXTURE_DIR, "enterprise-attack.json"),
    "mobile": os.path.join(FIXTURE_DIR, "mobile-attack.json"),
    "ics": os.path.join(FIXTURE_DIR, "ics-attack.json"),
}


@pytest.mark.asyncio
async def test_lifespan_once_across_two_http_sessions():
    """Two streamable-HTTP sessions on one server share one lifespan entry."""
    download = AsyncMock(return_value=FIXTURE_PATHS)
    with patch.object(server_module, "download_and_save_attack_data_async", download):
        # Pre-bind the socket so the port is known without a bind race.
        sock = socket.socket()
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]

        app = mcp.streamable_http_app(
            host="127.0.0.1",
            transport_security=build_transport_security("127.0.0.1", port),
        )
        server = uvicorn.Server(uvicorn.Config(app, log_level="error"))
        serve_task = asyncio.create_task(server.serve(sockets=[sock]))
        while not server.started:
            if serve_task.done():
                serve_task.result()  # re-raise a startup failure
            await asyncio.sleep(0.01)

        # The session manager has already entered the lifespan once at
        # startup, before any session existed.
        assert download.call_count == 1

        try:
            async with asyncio.timeout(30):
                async with Client(f"http://127.0.0.1:{port}/mcp") as client1:
                    result = await client1.list_tools()
                    assert len(result.tools) == 9

                async with Client(f"http://127.0.0.1:{port}/mcp") as client2:
                    call = await client2.call_tool("get_tactics", {"domain": "enterprise-attack"})
                    assert not call.is_error
                    payload = json.loads(call.content[0].text)
                    names = {t["name"] for t in payload["tactics"]}
                    assert {"Persistence", "Lateral Movement"} <= names
        finally:
            server.should_exit = True
            await serve_task

        # A second session must not have re-entered the lifespan body:
        # one download call total means the ~46MB parse happened once.
        assert download.call_count == 1


@pytest.mark.asyncio
async def test_sync_tool_runs_on_worker_thread():
    """Sync `def` handlers execute off the event-loop thread (worker thread)."""
    loop_thread = threading.get_ident()
    seen_threads = []
    original_get_attack_data = server_module.get_attack_data

    def spy_get_attack_data(domain, ctx):
        seen_threads.append(threading.get_ident())
        return original_get_attack_data(domain, ctx)

    download = AsyncMock(return_value=FIXTURE_PATHS)
    with (
        patch.object(server_module, "download_and_save_attack_data_async", download),
        patch.object(server_module, "get_attack_data", spy_get_attack_data),
    ):
        async with Client(mcp) as client:
            call = await client.call_tool("get_tactics", {"domain": "enterprise-attack"})

    assert not call.is_error
    assert seen_threads, "spy was never invoked"
    assert all(t != loop_thread for t in seen_threads)


@pytest.mark.asyncio
async def test_lifespan_once_indices_precomputed():
    """Lookup indices are built once at load and shared read-only by handlers."""
    original_build = server_module.build_group_index
    build_calls = []

    def counting_build(data):
        build_calls.append(threading.get_ident())
        return original_build(data)

    download = AsyncMock(return_value=FIXTURE_PATHS)
    with (
        patch.object(server_module, "download_and_save_attack_data_async", download),
        patch.object(server_module, "build_group_index", counting_build),
    ):
        async with Client(mcp) as client:
            # Concurrent calls force parallel worker threads to read the
            # shared index; a lazy rebuild would show up as build_calls > 1.
            calls = await asyncio.gather(
                *[
                    client.call_tool(
                        "get_techniques_used_by_group",
                        {"group_name": "APT29", "domain": "enterprise-attack"},
                    )
                    for _ in range(3)
                ]
            )

    assert all(not c.is_error for c in calls)
    assert len(build_calls) == 1
