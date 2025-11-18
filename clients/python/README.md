# Mini MCP Client

A simple, standalone Python client demonstrating how to integrate with the mitre-mcp server via HTTP/JSON-RPC. This client serves as both a practical tool and a reference implementation for building your own integrations.

## ⚡ Quick Reference

**Critical requirement for MCP HTTP integration:**

```python
import httpx

async def call_mcp_tool(tool_name: str, arguments: dict):
    """Call an MCP tool via HTTP/JSON-RPC."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/mcp",
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {"name": tool_name, "arguments": arguments}
            },
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream"  # ⚠️ BOTH required!
            }
        )
        return response.json()

# Example usage
result = await call_mcp_tool("get_tactics", {"domain": "enterprise-attack"})
```

**Key point:** The MCP server requires `Accept: application/json, text/event-stream` - omitting either will result in 406 errors.

## Features

- ✅ **Complete CLI** - Command-line interface for all mitre-mcp tools
- ✅ **HTTP/JSON-RPC** - Uses the recommended HTTP transport mode with proper MCP headers
- ✅ **Error Handling** - Proper error messages and connection troubleshooting
- ✅ **Pretty Output** - JSON formatting with optional pretty-printing
- ✅ **All Tools Supported** - Covers all 9 MCP tools
- ✅ **Configurable** - Customize host, port, and domain
- ✅ **Lightweight** - Only requires `httpx` and Python 3.10+
- ✅ **Debug Mode** - Detailed request/response logging for troubleshooting

## Prerequisites

1. Python 3.10 or higher
2. The `httpx` library
3. A running mitre-mcp server in HTTP mode

## Installation

```bash
# Install httpx if not already installed
pip install httpx

# Make the script executable (optional)
chmod +x mini-mcp-client.py
```

## Quick Start

**Step 1:** Start the mitre-mcp server in HTTP mode:

```bash
mitre-mcp --http --port 8000
```

**Step 2:** Run the mini-mcp-client:

```bash
# Get help
python mini-mcp-client.py --help

# Get all tactics
python mini-mcp-client.py tactics

# Get techniques for initial-access tactic
python mini-mcp-client.py techniques --tactic initial-access
```

## Available Commands

### 1. **tactics** - Get all tactics

```bash
python mini-mcp-client.py tactics
python mini-mcp-client.py tactics --domain mobile-attack
```

### 2. **techniques** - Get techniques (all or by tactic)

```bash
# Get all techniques (paginated)
python mini-mcp-client.py techniques

# Get techniques with subtechniques
python mini-mcp-client.py techniques --subtechniques

# Get techniques with descriptions
python mini-mcp-client.py techniques --descriptions

# Get techniques for a specific tactic
python mini-mcp-client.py techniques --tactic initial-access

# Pagination
python mini-mcp-client.py techniques --limit 50 --offset 100

# Exclude revoked/deprecated
python mini-mcp-client.py techniques --no-revoked
```

### 3. **technique** - Get details for a specific technique

```bash
python mini-mcp-client.py technique --id T1059.001
python mini-mcp-client.py technique --id T1003 --domain enterprise-attack
```

### 4. **groups** - Get all threat groups

```bash
python mini-mcp-client.py groups
python mini-mcp-client.py groups --no-revoked
```

### 5. **group** - Get techniques used by a threat group

```bash
python mini-mcp-client.py group --name APT29
python mini-mcp-client.py group --name "Lazarus Group"
python mini-mcp-client.py group --name APT41 --domain enterprise-attack
```

### 6. **software** - Get software (malware/tools)

```bash
# Get all software
python mini-mcp-client.py software

# Get only malware
python mini-mcp-client.py software --malware

# Get only tools
python mini-mcp-client.py software --tools

# Exclude revoked
python mini-mcp-client.py software --no-revoked
```

### 7. **mitigations** - Get mitigations

```bash
# Get all mitigations
python mini-mcp-client.py mitigations

# Get techniques mitigated by a specific mitigation
python mini-mcp-client.py mitigations --name "Multi-factor Authentication"
python mini-mcp-client.py mitigations --name "Network Segmentation"
```

## Global Options

All commands support these global options:

- `--host HOST` - Server host (default: localhost)
- `--port PORT` - Server port (default: 8000)
- `--no-pretty` - Disable pretty JSON formatting
- `--domain DOMAIN` - ATT&CK domain (enterprise-attack, mobile-attack, ics-attack)
- `--no-revoked` - Exclude revoked/deprecated items

## Examples

### Example 1: Threat Intelligence Workflow

```bash
# 1. Get all threat groups
python mini-mcp-client.py groups --no-revoked

# 2. Get techniques used by APT29
python mini-mcp-client.py group --name APT29

# 3. Get details for a specific technique
python mini-mcp-client.py technique --id T1059.001
```

### Example 2: Detection Engineering

```bash
# 1. Get all persistence techniques
python mini-mcp-client.py techniques --tactic persistence --no-revoked

# 2. Get all mitigations
python mini-mcp-client.py mitigations

# 3. Check what a specific mitigation addresses
python mini-mcp-client.py mitigations --name "Application Developer Guidance"
```

### Example 3: Red Team Planning

```bash
# 1. Get techniques for lateral movement
python mini-mcp-client.py techniques --tactic lateral-movement --descriptions

# 2. Get tools available
python mini-mcp-client.py software --tools

# 3. Check what a specific group uses
python mini-mcp-client.py group --name FIN7
```

### Example 4: Using Different Server Configuration

```bash
# Connect to remote server
python mini-mcp-client.py --host 192.168.1.100 --port 8080 tactics

# Use mobile domain
python mini-mcp-client.py techniques --domain mobile-attack

# Disable pretty printing (for piping to jq)
python mini-mcp-client.py tactics --no-pretty | jq '.result'
```

## Integration Examples

### Using as a Library

You can import and use the `MitreMCPClient` class in your own scripts:

```python
import asyncio
from mini_mcp_client import MitreMCPClient

async def my_analysis():
    client = MitreMCPClient(host="localhost", port=8000)

    # Get tactics
    tactics = await client.call_tool("get_tactics", {
        "domain": "enterprise-attack"
    })

    # Get techniques for a tactic
    techniques = await client.call_tool("get_techniques_by_tactic", {
        "tactic_shortname": "initial-access",
        "domain": "enterprise-attack"
    })

    print(client.format_output(tactics))
    print(client.format_output(techniques))

asyncio.run(my_analysis())
```

### Building Custom Workflows

```python
import asyncio
from mini_mcp_client import MitreMCPClient

async def analyze_apt_group(group_name: str):
    """Analyze techniques used by an APT group."""
    client = MitreMCPClient()

    # Get group's techniques
    result = await client.call_tool("get_techniques_used_by_group", {
        "group_name": group_name,
        "domain": "enterprise-attack"
    })

    # Process results
    if "result" in result:
        techniques = result["result"]["content"][0]["text"]
        print(f"Techniques used by {group_name}:")
        print(techniques)

    return result

# Run analysis
asyncio.run(analyze_apt_group("APT29"))
```

## Troubleshooting

### 406 Not Acceptable Error

If you see this error:

```
❌ HTTP Error: Client error '406 Not Acceptable'
```

**Cause:** The MCP HTTP server requires the `Accept` header to include both `application/json` and `text/event-stream`.

**Solution:** This is already fixed in the current version. The client now sends:
```python
headers = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream"
}
```

If you're implementing your own client, make sure to include both MIME types in the Accept header.

### Server Connection Issues

If you see connection errors:

```
❌ HTTP Error: ConnectError
   Make sure mitre-mcp server is running: mitre-mcp --http --port 8000
```

**Solution:**
1. Check if the mitre-mcp server is running
2. Verify the host and port match your server configuration
3. Ensure no firewall is blocking the connection
4. Run the diagnostic script: `python test-mcp-connection.py localhost 8000`

### JSON-RPC Errors

If you see JSON-RPC errors:

```
❌ Error: JSON-RPC Error -32602: Invalid params
```

**Solution:**
1. Check your command syntax with `--help`
2. Verify technique IDs follow the format `T####` or `T####.###`
3. Ensure group names and mitigation names are correct

### Timeout Issues

If requests timeout:

```
❌ HTTP Error: TimeoutException
```

**Solution:**
1. The server might be downloading data (first run)
2. Increase timeout in the code (currently 30 seconds)
3. Check server logs for issues

## Code Structure

```
mini-mcp-client.py
├── MitreMCPClient          # HTTP client class
│   ├── __init__()          # Initialize with host/port
│   ├── call_tool()         # Call MCP tools via JSON-RPC
│   └── format_output()     # Format JSON output
│
├── Command Functions       # One per MCP tool
│   ├── cmd_tactics()
│   ├── cmd_techniques()
│   ├── cmd_technique()
│   ├── cmd_groups()
│   ├── cmd_group()
│   ├── cmd_software()
│   └── cmd_mitigations()
│
└── main()                  # CLI argument parsing & execution
```

## Best Practices

1. **Error Handling**: Always wrap calls in try/except blocks
2. **Timeouts**: Set appropriate timeouts for your use case
3. **Pagination**: Use --limit and --offset for large datasets
4. **Filtering**: Use --no-revoked to exclude outdated entries
5. **Caching**: Consider caching results for frequently accessed data
6. **Async**: Use async/await for concurrent requests

## Extending the Client

### Adding a New Command

```python
async def cmd_my_command(
    client: MitreMCPClient, args: argparse.Namespace
) -> Dict[str, Any]:
    """Your custom command."""
    return await client.call_tool(
        "your_tool_name",
        {
            "param1": args.param1,
            "param2": args.param2
        }
    )

# Add to argparse subparsers in main()
my_parser = subparsers.add_parser("mycommand", help="My custom command")
my_parser.add_argument("--param1", required=True)
my_parser.set_defaults(func=cmd_my_command)
```

### Adding Response Processing

```python
def format_output(self, result: Dict[str, Any], pretty: bool = True) -> str:
    """Enhanced output formatting."""
    if pretty:
        # Extract specific fields
        if "result" in result:
            content = result["result"].get("content", [])
            if content:
                text = content[0].get("text", "")
                # Custom formatting here
                return self.format_custom(text)

        return json.dumps(result, indent=2)
    return json.dumps(result)
```

## Performance Tips

1. **Use --no-pretty** when piping to other tools
2. **Set appropriate --limit** to reduce response size
3. **Use --no-revoked** to filter out deprecated entries
4. **Cache frequently accessed data** in your application
5. **Run server and client on same machine** for lowest latency

## Security Considerations

1. **HTTP Transport**: Not encrypted by default
   - For production, use HTTPS or run on localhost only
   - Don't expose the server to untrusted networks

2. **Input Validation**: The client validates inputs
   - Server also validates for defense in depth
   - Don't disable client-side validation

3. **Credentials**: Currently no authentication
   - Add authentication if exposing over network
   - Use firewall rules to restrict access

## Contributing

To improve this client:

1. Add more output formatting options
2. Implement response caching
3. Add batch processing capabilities
4. Create interactive mode
5. Add progress bars for large requests

## License

This mini-mcp-client is part of the mitre-mcp project and follows the same MIT license.

## Support

For issues or questions:
- Check the main [mitre-mcp README](README.md)
- Review the [Playbook](Playbook.md) for usage examples
- Open an issue on the GitHub repository

## Related Documentation

- [Main README](README.md) - mitre-mcp server documentation
- [Playbook](Playbook.md) - Advanced usage scenarios
- [Beginner's Guide](Beginner-Playbook.md) - Getting started guide
