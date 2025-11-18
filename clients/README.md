# MCP Client Examples

Reference implementations for integrating with the mitre-mcp server via HTTP.

## Available Clients

### 🐍 Python Client
**Location:** [`python/`](python/)

A complete Python implementation with CLI and library support.

**Features:**
- Complete CLI with all MCP tools
- Session management
- SSE response parsing
- Debug mode
- Error handling
- Can be used as a library

**Quick Start:**
```bash
cd clients/python
pip install -r requirements.txt
python mini-mcp-client.py --help
```

**Documentation:** [python/README.md](python/README.md)

---

### 🟢 Node.js Client
**Location:** [`nodejs/`](nodejs/)

A complete Node.js/JavaScript implementation with CLI and module export.

**Features:**
- Complete CLI with all MCP tools
- Session management
- SSE response parsing
- Debug mode
- Error handling
- Module export for use in Node.js apps

**Quick Start:**
```bash
cd clients/nodejs
npm install
node mini-mcp-client.js --help
```

**Documentation:** [nodejs/README.md](nodejs/README.md)

---

## Choosing a Client

| Use Case | Python | Node.js |
|----------|--------|---------|
| **Quick CLI usage** | ✅ | ✅ |
| **Data science/analysis** | ✅ Best choice | ⚠️ Possible |
| **Web applications** | ⚠️ Possible | ✅ Best choice |
| **Automation scripts** | ✅ | ✅ |
| **API backends** | ✅ | ✅ Best choice |
| **Serverless functions** | ✅ | ✅ Best choice |
| **Desktop apps** | ✅ | ⚠️ Possible |

## Common Usage

Both clients provide the same commands:

```bash
# Get all tactics
mini-mcp-client tactics

# Get techniques for a tactic
mini-mcp-client techniques --tactic initial-access

# Get technique details
mini-mcp-client technique --id T1059.001

# Get group's techniques
mini-mcp-client group --name APT29

# Get all groups
mini-mcp-client groups

# Get software
mini-mcp-client software --malware

# Get mitigations
mini-mcp-client mitigations
```

## Using as Libraries

### Python

```python
from mini_mcp_client import MitreMCPClient

client = MitreMCPClient(host="localhost", port=8000)
result = await client.call_tool("get_tactics", {"domain": "enterprise-attack"})
```

### Node.js

```javascript
const { MitreMCPClient } = require('./mini-mcp-client');

const client = new MitreMCPClient('localhost', 8000);
const result = await client.callTool('get_tactics', { domain: 'enterprise-attack' });
```

## MCP Protocol Implementation

Both clients correctly implement the MCP HTTP protocol:

1. **✅ Headers** - Include both `application/json` and `text/event-stream` in Accept header
2. **✅ Session Management** - Initialize session before tool calls
3. **✅ SSE Parsing** - Extract JSON from Server-Sent Events format
4. **✅ Error Handling** - Proper handling of 406 and 400 errors

## Testing

Both clients include debug mode for troubleshooting:

```bash
# Python
python mini-mcp-client.py --debug tactics

# Node.js
node mini-mcp-client.js --debug tactics
```

## Documentation

- **API Integration Guide:** [../API-INTEGRATION.md](../API-INTEGRATION.md)
- **Troubleshooting:** [../TROUBLESHOOTING-MCP-HTTP.md](../TROUBLESHOOTING-MCP-HTTP.md)
- **Diagnostic Tool:** [../test-mcp-connection.py](../test-mcp-connection.py)
- **Main Playbook:** [../Playbook.md](../Playbook.md)

## Contributing

To add a client in another language:

1. Create a new directory: `clients/<language>/`
2. Implement the three key requirements:
   - Proper HTTP headers
   - Session management
   - SSE response parsing
3. Add comprehensive README
4. Add example usage
5. Update this README

## Requirements

### Python Client
- Python 3.10+
- httpx
- See [python/requirements.txt](python/requirements.txt)

### Node.js Client
- Node.js 14.0+
- node-fetch
- commander
- See [nodejs/package.json](nodejs/package.json)

## License

MIT License - See main project LICENSE file
