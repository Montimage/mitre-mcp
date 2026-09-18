# MITRE ATT&CK MCP Server - API Integration Guide

This guide covers programmatic integration with the `mitre-mcp` server over HTTP using the official MCP SDKs — the Python `mcp` package and the TypeScript `@modelcontextprotocol/client` package — for automation, custom integrations, and batch processing.

## Overview

The `mitre-mcp` server exposes the Model Context Protocol (MCP) over the streamable-HTTP transport at `http://localhost:8000/mcp`, letting you integrate MITRE ATT&CK data into your applications, scripts, and automation workflows.

You do not need to hand-roll JSON-RPC envelopes, Server-Sent Events (SSE) parsing, or session headers: the official SDK clients perform the initialize handshake, protocol-version negotiation, SSE framing, the required `Accept` header, and session-id propagation for you.

**Best for:**

- Automation and batch processing
- Custom integrations and tooling
- Backend services and APIs
- Data pipelines and ETL workflows

## Quick Start

### Step 1: Start the Server

Start the server in HTTP mode:

```bash
mitre-mcp --http
```

The server binds to `localhost:8000` by default and serves MCP at `http://localhost:8000/mcp`.

**Configuration:**

- `--host` / `--port` — CLI flags (HTTP mode only)
- `FASTMCP_SERVER_HOST` — bind host (default: `localhost`)
- `FASTMCP_SERVER_PORT` — bind port (default: `8000`)
- `MITRE_CORS_ORIGINS` — comma-separated browser origins allowed by CORS and DNS-rebinding protection (defaults to localhost dev origins)

Examples:

```bash
mitre-mcp --http --port 8080
FASTMCP_SERVER_PORT=8080 mitre-mcp --http
```

### Step 2: Connect with an SDK Client

Point an official MCP SDK client at the `/mcp` endpoint — the snippets below are all you need. Full reference implementations ship in [`clients/`](clients/).

**Python** (`pip install "mcp>=2.2,<3"`):

```python
import asyncio
from mcp import Client

async def main():
    async with Client("http://localhost:8000/mcp") as client:
        result = await client.call_tool(
            "get_tactics", {"domain": "enterprise-attack"}
        )
        print(result.structured_content)

asyncio.run(main())
```

**Node.js** (`npm install @modelcontextprotocol/client`):

```javascript
const {
  Client,
  StreamableHTTPClientTransport,
} = require("@modelcontextprotocol/client");

async function main() {
  const transport = new StreamableHTTPClientTransport(
    new URL("http://localhost:8000/mcp"),
  );
  const client = new Client({ name: "my-app", version: "1.0.0" });
  await client.connect(transport);

  const result = await client.callTool({
    name: "get_tactics",
    arguments: { domain: "enterprise-attack" },
  });
  console.log(result.structuredContent);

  await client.close();
}

main();
```

## Reference Implementations

We provide production-ready clients in multiple languages — both built on the official SDKs and usable as CLIs or as libraries:

### Python Client

**Location:** [`clients/python/mini-mcp-client.py`](clients/python/mini-mcp-client.py)

**Install dependencies:**

```bash
cd clients/python
pip install -r requirements.txt
```

**Use as a library** — the file is hyphenated, so import it via `importlib` (or copy it to `mini_mcp_client.py` for a plain `from mini_mcp_client import MitreMCPClient`):

```python
import asyncio
import importlib

MitreMCPClient = importlib.import_module("mini-mcp-client").MitreMCPClient

async def main():
    client = MitreMCPClient(host="localhost", port=8000)

    # Get all tactics
    result = await client.call_tool("get_tactics", {"domain": "enterprise-attack"})
    print(result["result"]["structuredContent"])

    # Get techniques for a tactic
    result = await client.call_tool(
        "get_techniques_by_tactic",
        {"tactic_shortname": "initial-access", "domain": "enterprise-attack"}
    )
    print(result["result"]["isError"])

    await client.close()

asyncio.run(main())
```

`call_tool` returns `{"result": <CallToolResult>}` — the serialized SDK result, so `result["result"]["content"]`, `result["result"]["structuredContent"]`, and `result["result"]["isError"]` are all available.

**Use as a CLI:**

```bash
python clients/python/mini-mcp-client.py tactics
python clients/python/mini-mcp-client.py techniques --tactic initial-access
python clients/python/mini-mcp-client.py technique --id T1059.001
python clients/python/mini-mcp-client.py group --name APT29
```

**Documentation:** [clients/python/README.md](clients/python/README.md)

### Node.js Client

**Location:** [`clients/nodejs/mini-mcp-client.js`](clients/nodejs/mini-mcp-client.js)

**Install dependencies:**

```bash
cd clients/nodejs
npm install
```

**Use as a module:**

```javascript
const { MitreMCPClient } = require("./mini-mcp-client");

async function main() {
  const client = new MitreMCPClient("localhost", 8000);

  // Get all tactics
  const result = await client.callTool("get_tactics", {
    domain: "enterprise-attack",
  });
  console.log(result.result.structuredContent);

  // Get techniques for a tactic
  const techniques = await client.callTool("get_techniques_by_tactic", {
    tactic_shortname: "initial-access",
    domain: "enterprise-attack",
  });
  console.log(techniques.result.isError);

  await client.close();
}

main();
```

`callTool` returns `{ result: <CallToolResult> }` — the SDK result object, so `result.result.content`, `result.result.structuredContent`, and `result.result.isError` are all available.

**Use as a CLI:**

```bash
node clients/nodejs/mini-mcp-client.js tactics
node clients/nodejs/mini-mcp-client.js techniques --tactic initial-access
node clients/nodejs/mini-mcp-client.js technique --id T1059.001
node clients/nodejs/mini-mcp-client.js group --name APT29
```

**Documentation:** [clients/nodejs/README.md](clients/nodejs/README.md)

## What the SDK Handles for You

Earlier revisions of this guide walked through the raw streamable-HTTP protocol by hand. That is no longer necessary — the official SDKs implement every step:

- **Initialize handshake** — `connect()`/`__aenter__` sends `initialize` plus the `notifications/initialized` notification.
- **Protocol-version negotiation** — in `auto` mode the SDK probes `server/discover` and falls back to the legacy `initialize` handshake for older servers.
- **Required headers** — the transports send `Accept: application/json, text/event-stream` on every request; omitting it is what used to cause `406 Not Acceptable`.
- **SSE framing** — event-stream responses are parsed inside the transport and surfaced as typed result objects.
- **Session management** — the `mcp-session-id` response header is captured at connect time and propagated on subsequent requests. In the Node SDK you can inspect it via `transport.sessionId` (absent when the server runs stateless).
- **Timeouts** — per-request timeouts are configurable (the Python reference client passes `read_timeout_seconds=30.0`; the Node client passes `{ timeout: 30000 }` to `callTool`).

### Session expiry and retry

If the server forgets a session (restart, eviction), the next request fails with HTTP 404 / a "session terminated" error. The reference clients detect this, drop the stale session, re-initialize, and retry exactly once — see `MitreMCPClient.call_tool` in [clients/python/mini-mcp-client.py](clients/python/mini-mcp-client.py) and `MitreMCPClient.callTool` in [clients/nodejs/mini-mcp-client.js](clients/nodejs/mini-mcp-client.js) if you need the same pattern.

## Building Your Own Client

For languages other than Python or Node.js, build on the official MCP SDK for that language rather than hand-rolling the transport. Your client only needs to:

1. Open a streamable-HTTP connection to `http://<host>:<port>/mcp`.
2. Call `tools/call` (Python `client.call_tool(name, arguments)`, TypeScript `client.callTool({ name, arguments })`) with the tool names below.
3. Optionally call `tools/list` (`client.list_tools()` / `client.listTools()`) to discover the live tool surface.

The SDK takes care of headers, the handshake, SSE, and session ids. See [`clients/README.md`](clients/README.md) for the checklist used by the bundled clients.

## Available Tools

The following MCP tools are available for API calls:

| Tool                                     | Description                    | Parameters                                                                                                |
| ---------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `get_tactics`                            | List all tactics               | `domain`, `remove_revoked_deprecated`                                                                     |
| `get_techniques`                         | List techniques with filtering | `domain`, `include_subtechniques`, `remove_revoked_deprecated`, `include_descriptions`, `limit`, `offset` |
| `get_technique_by_id`                    | Get specific technique details | `technique_id`, `domain`                                                                                  |
| `get_techniques_by_tactic`               | Filter techniques by tactic    | `tactic_shortname`, `domain`, `remove_revoked_deprecated`                                                 |
| `get_groups`                             | List threat actor groups       | `domain`, `remove_revoked_deprecated`                                                                     |
| `get_techniques_used_by_group`           | Map groups to techniques       | `group_name`, `domain`                                                                                    |
| `get_software`                           | List malware and tools         | `domain`, `remove_revoked_deprecated`, `software_types`                                                   |
| `get_mitigations`                        | List mitigations               | `domain`, `remove_revoked_deprecated`                                                                     |
| `get_techniques_mitigated_by_mitigation` | Map mitigations to techniques  | `mitigation_name`, `domain`                                                                               |

`domain` accepts `enterprise-attack` (default), `mobile-attack`, or `ics-attack`. Results are returned as `CallToolResult` objects: `content` holds human-readable text blocks and `structuredContent` holds the typed JSON payload.

### Debug Mode

Both reference clients support debug mode:

```bash
# Python — surfaces the SDK's protocol logs plus client debug prints
python clients/python/mini-mcp-client.py --debug tactics

# Node.js — prints session id and per-call details to stderr
node clients/nodejs/mini-mcp-client.js --debug tactics
```

## Troubleshooting

### Common Errors

**Connection refused / fetch failed:**

- The server is not running, or the client is pointing at the wrong host/port
- Fix: start `mitre-mcp --http` and connect to `http://<host>:<port>/mcp` (note the `/mcp` path)

**Tool calls fail after a server restart:**

- The server forgot your session; the next request returns HTTP 404 / "session terminated"
- Fix: re-initialize the client and retry — the reference clients already do this once automatically

**Tool returns `isError: true`:**

- The server rejected the arguments (unknown technique id, invalid domain, etc.)
- Fix: inspect `result.content` for the error message and check the parameter names in the tool table above

**Browser/client blocked by CORS or DNS-rebinding protection:**

- The origin is not in the allow-list
- Fix: add it to `MITRE_CORS_ORIGINS` (comma-separated) and restart the server

See [TROUBLESHOOTING-MCP-HTTP.md](TROUBLESHOOTING-MCP-HTTP.md) for raw-protocol symptoms such as `406 Not Acceptable` — those only appear when bypassing the SDK.

### Debug Checklist

- [ ] Server is running (`mitre-mcp --http`)
- [ ] Client URL includes the `/mcp` path
- [ ] SDK client connected (`connect()` / `async with Client(...)`) before tool calls
- [ ] Tool names and argument names match the table above
- [ ] `--debug` output checked for negotiation/session errors

## Alternative: stdio Transport

For local-only integrations, the same SDKs also speak stdio — the Python SDK accepts `StdioServerParameters` directly:

```python
import asyncio
from mcp import Client, StdioServerParameters

async def main():
    params = StdioServerParameters(
        command="/path/to/.venv/bin/python",
        args=["-m", "mitre_mcp.mitre_mcp_server"],
    )
    async with Client(params) as client:
        result = await client.call_tool(
            "get_techniques_by_tactic",
            {"tactic_shortname": "initial-access", "domain": "enterprise-attack"},
        )
        print(result.structured_content)

asyncio.run(main())
```

**Note:** stdio mode is limited to a single client connection and requires absolute paths. HTTP mode is recommended for most use cases.

## Additional Resources

- **[clients/README.md](clients/README.md)** - Overview of available clients
- **[clients/python/README.md](clients/python/README.md)** - Python client documentation
- **[clients/nodejs/README.md](clients/nodejs/README.md)** - Node.js client documentation
- **[TROUBLESHOOTING-MCP-HTTP.md](TROUBLESHOOTING-MCP-HTTP.md)** - Raw-protocol errors and solutions
- **[docs/migrations/ts-mcp-client-choice.md](docs/migrations/ts-mcp-client-choice.md)** - Why the project uses the official TypeScript SDK

## Contributing

To add a client in another language:

1. Build on the official MCP SDK for that language — it provides headers, session management, and SSE parsing
2. Add to `clients/<language>/` directory
3. Include a README with usage examples
4. Update this guide with a link to your implementation

See [clients/README.md](clients/README.md) for contribution guidelines.
