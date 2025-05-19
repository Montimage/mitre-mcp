# mitre-mcp: MITRE ATT&CK MCP Server

A Model Context Protocol (MCP) server that provides tools for working with the MITRE ATT&CK framework using the mitreattack-python library and the official MCP Python SDK.

## Introduction

### About Montimage

[Montimage](https://www.montimage.eu) is a cybersecurity company specializing in network monitoring, security analysis, and AI-driven threat detection solutions. We develop innovative tools that help organizations protect their digital assets and ensure the security of their networks. The `mitre-mcp` server is part of our suite of security tools designed to enhance threat intelligence capabilities.

### MITRE ATT&CK Framework

The [MITRE ATT&CK®](https://attack.mitre.org/) framework is a globally-accessible knowledge base of adversary tactics and techniques based on real-world observations. It provides a common language for describing cyber adversary behavior and helps security professionals understand attack methodologies, improve defensive capabilities, and assess organizational risk.

Key components of the framework include:
- **Techniques**: Specific methods used by adversaries to achieve tactical goals
- **Tactics**: Categories representing the adversary's tactical goals during an attack
- **Groups**: Known threat actors and their associated techniques
- **Software**: Malware and tools used by threat actors
- **Mitigations**: Security measures to counter specific techniques

### Objective of the MCP Server

The `mitre-mcp` server bridges the gap between the MITRE ATT&CK knowledge base and AI-driven workflows by providing a Model Context Protocol (MCP) interface. This enables Large Language Models (LLMs) and other AI systems to directly query and utilize MITRE ATT&CK data for threat intelligence, security analysis, and defensive planning.

Key objectives include:
- Providing seamless access to MITRE ATT&CK data for AI assistants and LLMs
- Enabling real-time threat intelligence lookups during security conversations
- Supporting security professionals in understanding attack techniques and appropriate mitigations
- Facilitating threat modeling and security analysis workflows

## MCP Server & LLM Support

mitre-mcp is designed for seamless integration with Model Context Protocol (MCP) compatible clients (e.g., Claude, Windsurf, Cursor) for real-time MITRE ATT&CK framework lookups in LLM workflows.

### Available MCP Tools

| Tool Name | Description |
|-----------|-------------|
| `get_techniques` | Get all techniques from the MITRE ATT&CK framework. Supports filtering by domain and includes options for subtechniques and handling revoked/deprecated items. |
| `get_tactics` | Get all tactics from the MITRE ATT&CK framework. Returns tactical categories that techniques are organized into. |
| `get_groups` | Get all threat groups from the MITRE ATT&CK framework. These are known threat actors and APT groups. |
| `get_software` | Get all software from the MITRE ATT&CK framework. Can filter by software type (malware, tool) and domain. |
| `get_techniques_by_tactic` | Get techniques associated with a specific tactic (e.g., 'defense-evasion', 'persistence'). |
| `get_techniques_used_by_group` | Get techniques used by a specific threat group (e.g., 'APT29', 'Lazarus Group'). |
| `get_mitigations` | Get all mitigations from the MITRE ATT&CK framework. These are security measures to counter techniques. |
| `get_techniques_mitigated_by_mitigation` | Get techniques that can be mitigated by a specific mitigation strategy. |
| `get_technique_by_id` | Look up a specific technique by its MITRE ATT&CK ID (e.g., 'T1055' for Process Injection). |

## Features

- Comprehensive access to MITRE ATT&CK framework data including techniques, tactics, groups, and software
- Support for all MITRE ATT&CK domains: Enterprise, Mobile, and ICS
- Automatic caching of MITRE ATT&CK data to improve performance
- Python API for easy integration into your applications
- Built-in MCP server support for LLM/AI integrations
- Command-line interface for direct usage

## Installation

```bash
pip install mitre-mcp
```

## Usage via CLI

1. Create and activate a virtual environment (recommended):
```bash
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate.bat
```

2. Install the package:
```bash
pip install mitre-mcp
```

3. Start the MCP server with stdio transport (for direct integration with clients):
```bash
mitre-mcp
```

4. Or start the MCP server as an HTTP server:
```bash
mitre-mcp --http
```

5. Use the `--force-download` option to force a fresh download of MITRE ATT&CK data:
```bash
mitre-mcp --force-download
```

## Usage via MCP Client

To run mitre-mcp as an MCP server for AI-driven clients (e.g., Claude, Windsurf, Cursor):

1. Create a virtual environment:
```bash
python3 -m venv .venv
```

2. Activate the virtual environment:
```bash
source .venv/bin/activate  # On Windows: .venv\Scripts\activate.bat
```

3. Install mitre-mcp:
```bash
pip install mitre-mcp
```

4. Configure your MCP client (e.g., Claude, Windsurf, Cursor) with:
```json
{
  "mcpServers": {
    "mitreattack": {
      "command": "/absolute/path/to/.venv/bin/python",
      "args": ["-m", "mitre_mcp_server"]
    }
  }
}
```

Important:
- Use the absolute path to the Python executable in your virtual environment.
- For Windows, the path might look like: `C:\path\to\.venv\Scripts\python.exe`

The mitre-mcp tools should now be available in your MCP client.

## HTTP Server Mode

When running in HTTP mode with `mitre-mcp --http`, the server provides:

1. A JSON-RPC endpoint at `http://localhost:8000/jsonrpc` for MCP protocol communication
2. The MCP Inspector UI at the root URL (`http://localhost:8000/`)

The HTTP mode is useful for:
- Debugging with the MCP Inspector UI
- Integration with web-based clients
- Allowing multiple clients to connect to the same server instance
- Network-based integrations where stdio isn't practical

## Data Caching

The server automatically caches MITRE ATT&CK data in a `data/` folder to improve performance and reduce unnecessary downloads. The caching behavior works as follows:

1. On first run, the server downloads the latest MITRE ATT&CK data and stores it in the `data/` folder
2. On subsequent runs, the server checks if the cached data is less than 1 day old
   - If the data is recent (less than 1 day old), it uses the cached data
   - If the data is older than 1 day, it automatically downloads fresh data
3. You can force a fresh download regardless of the cache age using the `--force-download` option

## Usage via API (Python)

1. Create and activate a virtual environment (recommended):
```bash
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate.bat
```

2. Install in your project:
```bash
pip install mitre-mcp
```

3. Import and use the MCP client:
```python
from mcp.client.client import Client
from mcp.client.transports import StdioTransport

async with Client(transport=StdioTransport("mitre-mcp")) as client:
    # Get all tactics
    tactics = await client.call_tool("get_tactics", {
        "domain": "enterprise-attack"
    })
    
    # Get techniques used by a specific group
    group_techniques = await client.call_tool("get_techniques_used_by_group", {
        "group_name": "APT29",
        "domain": "enterprise-attack"
    })
    
    # Access a resource
    server_info = await client.read_resource("mitre-attack://info")
```

## Resources

The server provides the following resources:

```
mitre-attack://info
```

Get information about the MITRE ATT&CK MCP server, including available domains and tools.

## MCP Server Configuration

You can add this MCP server to any MCP client by including it in the client's configuration:

```json
{
  "mcpServers": {
    "mitreattack": {
      "command": "/absolute/path/to/.venv/bin/python",
      "args": ["-m", "mitre_mcp_server"]
    }
  }
}
```

Important:
- Use the absolute path to the Python executable in your virtual environment.
- For Windows, the path might look like: `C:\path\to\.venv\Scripts\python.exe`

### Claude Desktop Integration

To integrate with Claude Desktop, add the server to your Claude Desktop configuration file located at:
- **macOS**: `~/Library/Application Support/Claude Desktop/config.json`
- **Windows**: `%APPDATA%\Claude Desktop\config.json`
- **Linux**: `~/.config/Claude Desktop/config.json`

## Development

Clone the repository and install in development mode:

```bash
git clone https://github.com/montimage/mitre-mcp.git
cd mitre-mcp
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

## License

MIT

## About Montimage

mitre-mcp is developed and maintained by [Montimage](https://www.montimage.eu), a company specializing in cybersecurity and network monitoring solutions. Montimage provides innovative security tools and services to help organizations protect their digital assets and ensure the security of their networks.

For questions or support, please contact us at [contact@montimage.eu](mailto:contact@montimage.eu).
