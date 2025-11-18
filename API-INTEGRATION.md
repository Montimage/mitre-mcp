# MITRE ATT&CK MCP Server - API Integration Guide

This guide covers programmatic integration with the `mitre-mcp` server via HTTP API for automation, custom integrations, and batch processing.

## Overview

The `mitre-mcp` server exposes a Model Context Protocol (MCP) over HTTP, allowing you to integrate MITRE ATT&CK data into your applications, scripts, and automation workflows.

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

The server will start on `http://localhost:8000` by default.

**Environment variables:**
- `MITRE_HTTP_HOST` - Override default host (default: `0.0.0.0`)
- `MITRE_HTTP_PORT` - Override default port (default: `8000`)
- `MITRE_ENABLE_CORS` - Enable/disable CORS (default: enabled)

Example with custom port:
```bash
MITRE_HTTP_PORT=8080 mitre-mcp --http
```

### Step 2: Connect from Your Application

You can use our reference implementations or build your own client following the MCP HTTP protocol.

## Reference Implementations

We provide production-ready clients in multiple languages:

### Python Client

**Location:** [`clients/python/mini-mcp-client.py`](clients/python/mini-mcp-client.py)

**Install dependencies:**
```bash
cd clients/python
pip install -r requirements.txt
```

**Use as a library:**
```python
from mini_mcp_client import MitreMCPClient

async def main():
    client = MitreMCPClient(host="localhost", port=8000)

    # Get all tactics
    result = await client.call_tool("get_tactics", {"domain": "enterprise-attack"})
    print(result)

    # Get techniques for a tactic
    result = await client.call_tool(
        "get_techniques_by_tactic",
        {"tactic_shortname": "initial-access", "domain": "enterprise-attack"}
    )
    print(result)

import asyncio
asyncio.run(main())
```

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
const { MitreMCPClient } = require('./mini-mcp-client');

async function main() {
  const client = new MitreMCPClient('localhost', 8000);

  // Get all tactics
  const result = await client.callTool('get_tactics', { domain: 'enterprise-attack' });
  console.log(result);

  // Get techniques for a tactic
  const techniques = await client.callTool('get_techniques_by_tactic', {
    tactic_shortname: 'initial-access',
    domain: 'enterprise-attack'
  });
  console.log(techniques);
}

main();
```

**Use as a CLI:**
```bash
node clients/nodejs/mini-mcp-client.js tactics
node clients/nodejs/mini-mcp-client.js techniques --tactic initial-access
node clients/nodejs/mini-mcp-client.js technique --id T1059.001
node clients/nodejs/mini-mcp-client.js group --name APT29
```

**Documentation:** [clients/nodejs/README.md](clients/nodejs/README.md)

## Building Your Own Client

If you need to implement a client in another language, follow the MCP HTTP protocol requirements:

### Critical Protocol Requirements

⚠️ **Three critical requirements for HTTP clients:**

1. **Headers** - Include both MIME types in the Accept header:
   ```
   Accept: application/json, text/event-stream
   ```

2. **Session Management** - Initialize session before tool calls:
   - Send an `initialize` request first
   - Extract `mcp-session-id` from response headers
   - Include session ID in all subsequent requests

3. **Response Parsing** - Handle Server-Sent Events (SSE) format:
   - Check `content-type` header
   - Parse lines starting with `data: `
   - Extract JSON from SSE wrapper

### Python Example (Simplified)

```python
import httpx
import asyncio
import json

class SimpleMCPClient:
    def __init__(self, host="localhost", port=8000):
        self.base_url = f"http://{host}:{port}/mcp"
        self.session_id = None
        self.request_id = 0

    async def initialize(self):
        """Initialize MCP session."""
        self.request_id += 1
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.base_url,
                json={
                    "jsonrpc": "2.0",
                    "id": self.request_id,
                    "method": "initialize",
                    "params": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {},
                        "clientInfo": {"name": "client", "version": "1.0"}
                    }
                },
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json, text/event-stream"  # Both required!
                }
            )
            self.session_id = response.headers.get("mcp-session-id")

    def parse_sse(self, text):
        """Parse SSE response format."""
        for line in text.split('\n'):
            if line.startswith('data: '):
                return json.loads(line[6:])
        return {}

    async def call_tool(self, tool_name: str, arguments: dict):
        """Call an MCP tool."""
        if not self.session_id:
            await self.initialize()

        self.request_id += 1
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.base_url,
                json={
                    "jsonrpc": "2.0",
                    "id": self.request_id,
                    "method": "tools/call",
                    "params": {"name": tool_name, "arguments": arguments}
                },
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json, text/event-stream",
                    "mcp-session-id": self.session_id
                }
            )
            return self.parse_sse(response.text)

# Example usage
async def main():
    client = SimpleMCPClient()
    result = await client.call_tool(
        "get_techniques_by_tactic",
        {"tactic_shortname": "initial-access", "domain": "enterprise-attack"}
    )
    print(result)

asyncio.run(main())
```

### TypeScript Example (Simplified)

```typescript
class SimpleMCPClient {
  private baseUrl: string;
  private sessionId: string | null = null;
  private requestId: number = 0;

  constructor(host: string = 'localhost', port: number = 8000) {
    this.baseUrl = `http://${host}:${port}/mcp`;
  }

  async initialize(): Promise<void> {
    this.requestId++;
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'  // Both required!
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: this.requestId,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'client', version: '1.0' }
        }
      })
    });
    this.sessionId = response.headers.get('mcp-session-id');
  }

  parseSSE(text: string): any {
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        return JSON.parse(line.substring(6));
      }
    }
    return {};
  }

  async callTool(toolName: string, args: object): Promise<any> {
    if (!this.sessionId) {
      await this.initialize();
    }

    this.requestId++;
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'mcp-session-id': this.sessionId!
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: this.requestId,
        method: 'tools/call',
        params: { name: toolName, arguments: args }
      })
    });

    const text = await response.text();
    return this.parseSSE(text);
  }
}

// Example usage
const client = new SimpleMCPClient('localhost', 8000);
const result = await client.callTool('get_technique_by_id', {
  technique_id: 'T1059.001',
  domain: 'enterprise-attack'
});
console.log(result);
```

## Available Tools

The following MCP tools are available for API calls:

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_tactics` | List all tactics | `domain` |
| `get_techniques` | List techniques with filtering | `domain`, `include_subtechniques`, `include_descriptions`, `limit`, `offset`, `remove_revoked_deprecated` |
| `get_technique_by_id` | Get specific technique details | `technique_id`, `domain` |
| `get_techniques_by_tactic` | Filter techniques by tactic | `tactic_shortname`, `domain`, `remove_revoked_deprecated` |
| `get_groups` | List threat actor groups | `domain`, `remove_revoked_deprecated` |
| `get_techniques_used_by_group` | Map groups to techniques | `group_name`, `domain` |
| `get_software` | List malware and tools | `domain`, `software_types`, `remove_revoked_deprecated` |
| `get_mitigations` | List mitigations | `domain`, `remove_revoked_deprecated` |
| `get_techniques_mitigated_by_mitigation` | Map mitigations to techniques | `mitigation_name`, `domain` |

### Debug Mode

Both reference clients support debug mode:

```bash
# Python
python clients/python/mini-mcp-client.py --debug tactics

# Node.js
node clients/nodejs/mini-mcp-client.js --debug tactics
```

Debug mode shows:
- Request payloads
- Response headers
- Session IDs
- SSE parsing steps

## Troubleshooting

### Common Errors

**406 Not Acceptable:**
- Missing `text/event-stream` in Accept header
- Fix: Include both `application/json, text/event-stream`

**400 Bad Request - Missing session ID:**
- Calling tools without initializing session
- Fix: Call `initialize()` before any tool calls

**JSON parse errors:**
- Trying to parse SSE responses as plain JSON
- Fix: Implement SSE parser to extract `data:` lines

### Debug Checklist

- [ ] Server is running (`mitre-mcp --http`)
- [ ] Accept header includes both MIME types
- [ ] Session initialized before tool calls
- [ ] Session ID extracted from response headers
- [ ] Session ID included in subsequent requests
- [ ] SSE response format handled correctly

## Alternative: MCP SDK with stdio

For local-only integrations that require stdio transport:

```python
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

server_params = StdioServerParameters(
    command="/path/to/.venv/bin/python",
    args=["-m", "mitre_mcp.mitre_mcp_server"]
)

async with stdio_client(server_params) as (read, write):
    async with ClientSession(read, write) as session:
        await session.initialize()
        result = await session.call_tool(
            "get_techniques_by_tactic",
            arguments={
                "tactic_shortname": "initial-access",
                "domain": "enterprise-attack"
            }
        )
```

**Note:** stdio mode is limited to single client connections and requires absolute path configuration. HTTP mode is recommended for most use cases.

## Additional Resources

- **[clients/README.md](clients/README.md)** - Overview of available clients
- **[clients/python/README.md](clients/python/README.md)** - Python client documentation
- **[clients/nodejs/README.md](clients/nodejs/README.md)** - Node.js client documentation
- **[TROUBLESHOOTING-MCP-HTTP.md](TROUBLESHOOTING-MCP-HTTP.md)** - Common errors and solutions

## Contributing

To add a client in another language:

1. Implement the three critical requirements (headers, session, SSE)
2. Add to `clients/<language>/` directory
3. Include README with usage examples
4. Update this guide with a link to your implementation

See [clients/README.md](clients/README.md) for contribution guidelines.
