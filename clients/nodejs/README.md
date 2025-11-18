# Mini MCP Client (Node.js)

A simple, standalone Node.js client for interacting with the mitre-mcp server via HTTP/JSON-RPC. This client serves as both a practical tool and a reference implementation for building your own JavaScript/Node.js integrations.

## Features

- ✅ **Complete CLI** - Command-line interface for all mitre-mcp tools
- ✅ **HTTP/JSON-RPC** - Uses the recommended HTTP transport mode with proper MCP headers
- ✅ **Error Handling** - Proper error messages and connection troubleshooting
- ✅ **Pretty Output** - JSON formatting with optional pretty-printing
- ✅ **All Tools Supported** - Covers all 9 MCP tools
- ✅ **Configurable** - Customize host, port, and domain
- ✅ **Lightweight** - Only requires `node-fetch` and `commander`
- ✅ **Debug Mode** - Detailed request/response logging for troubleshooting
- ✅ **Module Export** - Use as a library in your Node.js apps

## Prerequisites

1. Node.js 14.0 or higher
2. npm or yarn
3. A running mitre-mcp server in HTTP mode

## Installation

```bash
# Install dependencies
npm install

# Or install globally (optional)
npm install -g

# Make executable (Unix/Linux/macOS)
chmod +x mini-mcp-client.js
```

## Quick Start

**Step 1:** Start the mitre-mcp server in HTTP mode:

```bash
mitre-mcp --http --port 8000
```

**Step 2:** Run the mini-mcp-client:

```bash
# Get help
node mini-mcp-client.js --help

# Get all tactics
node mini-mcp-client.js tactics

# Get techniques for initial-access tactic
node mini-mcp-client.js techniques --tactic initial-access
```

## Available Commands

### 1. **tactics** - Get all tactics

```bash
node mini-mcp-client.js tactics
node mini-mcp-client.js tactics --domain mobile-attack
```

### 2. **techniques** - Get techniques (all or by tactic)

```bash
# Get all techniques (paginated)
node mini-mcp-client.js techniques

# Get techniques with subtechniques
node mini-mcp-client.js techniques --subtechniques

# Get techniques with descriptions
node mini-mcp-client.js techniques --descriptions

# Get techniques for a specific tactic
node mini-mcp-client.js techniques --tactic initial-access

# Pagination
node mini-mcp-client.js techniques --limit 50 --offset 100

# Exclude revoked/deprecated
node mini-mcp-client.js techniques --no-revoked
```

### 3. **technique** - Get details for a specific technique

```bash
node mini-mcp-client.js technique --id T1059.001
node mini-mcp-client.js technique --id T1003 --domain enterprise-attack
```

### 4. **groups** - Get all threat groups

```bash
node mini-mcp-client.js groups
node mini-mcp-client.js groups --no-revoked
```

### 5. **group** - Get techniques used by a threat group

```bash
node mini-mcp-client.js group --name APT29
node mini-mcp-client.js group --name "Lazarus Group"
node mini-mcp-client.js group --name APT41 --domain enterprise-attack
```

### 6. **software** - Get software (malware/tools)

```bash
# Get all software
node mini-mcp-client.js software

# Get only malware
node mini-mcp-client.js software --malware

# Get only tools
node mini-mcp-client.js software --tools

# Exclude revoked
node mini-mcp-client.js software --no-revoked
```

### 7. **mitigations** - Get mitigations

```bash
# Get all mitigations
node mini-mcp-client.js mitigations

# Get techniques mitigated by a specific mitigation
node mini-mcp-client.js mitigations --name "Multi-factor Authentication"
node mini-mcp-client.js mitigations --name "Network Segmentation"
```

## Global Options

All commands support these global options:

- `--host <host>` - Server host (default: localhost)
- `--port <port>` - Server port (default: 8000)
- `--no-pretty` - Disable pretty JSON formatting
- `--domain <domain>` - ATT&CK domain (enterprise-attack, mobile-attack, ics-attack)
- `--no-revoked` - Exclude revoked/deprecated items
- `--debug` - Enable debug output

## Using as a Library

Import the `MitreMCPClient` class in your Node.js applications:

```javascript
const { MitreMCPClient } = require('./mini-mcp-client');

async function example() {
  const client = new MitreMCPClient('localhost', 8000);

  try {
    // Get all tactics
    const tactics = await client.callTool('get_tactics', {
      domain: 'enterprise-attack'
    });

    console.log(client.formatOutput(tactics));

    // Get techniques for a tactic
    const techniques = await client.callTool('get_techniques_by_tactic', {
      tactic_shortname: 'initial-access',
      domain: 'enterprise-attack'
    });

    console.log(client.formatOutput(techniques));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

example();
```

## Integration Examples

### Example 1: Express.js API Endpoint

```javascript
const express = require('express');
const { MitreMCPClient } = require('./mini-mcp-client');

const app = express();
const client = new MitreMCPClient('localhost', 8000);

app.get('/api/tactics', async (req, res) => {
  try {
    const result = await client.callTool('get_tactics', {
      domain: req.query.domain || 'enterprise-attack'
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/techniques/:tactic', async (req, res) => {
  try {
    const result = await client.callTool('get_techniques_by_tactic', {
      tactic_shortname: req.params.tactic,
      domain: req.query.domain || 'enterprise-attack'
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('API server running on http://localhost:3000');
});
```

### Example 2: Batch Processing

```javascript
const { MitreMCPClient } = require('./mini-mcp-client');

async function analyzeGroups(groupNames) {
  const client = new MitreMCPClient('localhost', 8000);
  const results = [];

  for (const groupName of groupNames) {
    try {
      const techniques = await client.callTool('get_techniques_used_by_group', {
        group_name: groupName,
        domain: 'enterprise-attack'
      });

      results.push({
        group: groupName,
        techniques: techniques.result.structuredContent.techniques || []
      });
    } catch (error) {
      console.error(`Error analyzing ${groupName}:`, error.message);
    }
  }

  return results;
}

// Usage
analyzeGroups(['APT29', 'APT28', 'Lazarus Group']).then(results => {
  console.log(JSON.stringify(results, null, 2));
});
```

### Example 3: Threat Intelligence Dashboard

```javascript
const { MitreMCPClient } = require('./mini-mcp-client');

class ThreatIntelligence {
  constructor(host = 'localhost', port = 8000) {
    this.client = new MitreMCPClient(host, port);
  }

  async getDashboardData() {
    // Get all data in parallel
    const [tactics, groups, mitigations] = await Promise.all([
      this.client.callTool('get_tactics', { domain: 'enterprise-attack' }),
      this.client.callTool('get_groups', {
        domain: 'enterprise-attack',
        remove_revoked_deprecated: true
      }),
      this.client.callTool('get_mitigations', {
        domain: 'enterprise-attack',
        remove_revoked_deprecated: true
      })
    ]);

    return {
      tacticsCount: tactics.result.structuredContent.tactics.length,
      groupsCount: groups.result.structuredContent.groups.length,
      mitigationsCount: mitigations.result.structuredContent.mitigations.length,
      lastUpdated: new Date().toISOString()
    };
  }

  async getGroupProfile(groupName) {
    const techniques = await this.client.callTool('get_techniques_used_by_group', {
      group_name: groupName,
      domain: 'enterprise-attack'
    });

    return {
      group: groupName,
      techniqueCount: techniques.result.structuredContent.techniques.length,
      techniques: techniques.result.structuredContent.techniques
    };
  }
}

// Usage
const intel = new ThreatIntelligence();
intel.getDashboardData().then(data => console.log(data));
intel.getGroupProfile('APT29').then(profile => console.log(profile));
```

## Troubleshooting

### Connection Errors

If you see connection errors:

```
❌ HTTP Error: connect ECONNREFUSED
```

**Solution:**
1. Check if the mitre-mcp server is running
2. Verify the host and port match your server configuration
3. Ensure no firewall is blocking the connection

### 406 Not Acceptable

**Cause:** Missing required headers

**Solution:** This is already fixed in the client. The client includes:
```javascript
headers: {
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/event-stream'  // Both required!
}
```

### 400 Bad Request: Missing session ID

**Cause:** Server requires session initialization

**Solution:** The client automatically handles this. Session is initialized on first tool call.

### JSON Parsing Errors

**Cause:** SSE response format not being parsed

**Solution:** The client automatically detects and parses SSE format responses.

## NPM Scripts

Use the predefined npm scripts for common operations:

```bash
# Start with default command
npm start

# Get all tactics
npm run tactics

# Run a test command
npm test
```

## Development

### Running with Debug Mode

```bash
node mini-mcp-client.js --debug tactics
```

This will show:
- Request payloads
- Response headers
- Response bodies
- Session IDs

### Testing Different Servers

```bash
# Local server on different port
node mini-mcp-client.js --host localhost --port 8090 tactics

# Remote server
node mini-mcp-client.js --host 192.168.1.100 --port 8000 tactics
```

## Comparison with Python Client

| Feature | Node.js | Python |
|---------|---------|--------|
| Session Management | ✅ | ✅ |
| SSE Parsing | ✅ | ✅ |
| All Tools Support | ✅ | ✅ |
| CLI Interface | ✅ (commander) | ✅ (argparse) |
| Debug Mode | ✅ | ✅ |
| Error Handling | ✅ | ✅ |
| Module Export | ✅ | ✅ |
| Package Manager | npm | pip |

## MCP Protocol Details

The client correctly implements the MCP HTTP protocol:

1. **Headers** - Includes both `application/json` and `text/event-stream`
2. **Session** - Initializes session before tool calls
3. **SSE Parsing** - Extracts JSON from Server-Sent Events format

See [../../API-INTEGRATION.md](../../API-INTEGRATION.md) for protocol details.

## Examples

### Get Initial Access Techniques

```bash
node mini-mcp-client.js techniques --tactic initial-access --limit 10
```

### Analyze APT29

```bash
node mini-mcp-client.js group --name APT29
```

### Check Mitigation Coverage

```bash
node mini-mcp-client.js mitigations --name "Multi-factor Authentication"
```

### Export to File

```bash
node mini-mcp-client.js tactics > tactics.json
node mini-mcp-client.js groups --no-pretty | jq '.result.structuredContent.groups[].name'
```

## Related Documentation

- [../python/mini-mcp-client.py](../python/mini-mcp-client.py) - Python implementation
- [../python/README.md](../python/README.md) - Python client guide
- [../../API-INTEGRATION.md](../../API-INTEGRATION.md) - API integration guide
- [../../TROUBLESHOOTING-MCP-HTTP.md](../../TROUBLESHOOTING-MCP-HTTP.md) - Common issues
- [../../test-mcp-connection.py](../../test-mcp-connection.py) - Diagnostic tool

## License

MIT License - See main project LICENSE file

## Support

For issues or questions:
- Check the [Playbook](Playbook.md) for usage examples
- Review [TROUBLESHOOTING-MCP-HTTP.md](TROUBLESHOOTING-MCP-HTTP.md)
- Open an issue on the GitHub repository
