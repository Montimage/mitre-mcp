<!-- mcp-name: io.github.luongnv89/mitre-mcp -->
# mitre-mcp: MITRE ATT&CK MCP Server

<a href="https://pepy.tech/projects/mitre-mcp"><img src="https://static.pepy.tech/badge/mitre-mcp" alt="PyPI Downloads"></a>

[![PyPI version](https://img.shields.io/pypi/v/mitre-mcp.svg?label=PyPI&logo=pypi)](https://pypi.org/project/mitre-mcp/)
[![Python versions](https://img.shields.io/pypi/pyversions/mitre-mcp.svg?logo=python&logoColor=white)](https://pypi.org/project/mitre-mcp/)
[![Test status](https://github.com/montimage/mitre-mcp/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/montimage/mitre-mcp/actions/workflows/test.yml)
[![License](https://img.shields.io/github/license/montimage/mitre-mcp.svg)](LICENSE)
[![Coverage](https://img.shields.io/badge/coverage-66%25-green.svg)](pytest.ini)
[![Code style: black](https://img.shields.io/badge/code%20style-black-000000.svg)](https://github.com/psf/black)
[![Pre-commit](https://img.shields.io/badge/pre--commit-enabled-brightgreen?logo=pre-commit)](https://github.com/pre-commit/pre-commit)

Production-ready Model Context Protocol (MCP) server that exposes the MITRE ATT&CK framework to LLMs, MCP clients, and automation workflows using the mitreattack-python library and the official MCP Python SDK.

## Highlights

- **LLM-native experience** – ships with MCP tools, resources, and inspector support for Claude, Windsurf, Cursor, and any client that speaks MCP.
- **Secure-by-default** – validated inputs, TLS verification, disk-space checks, and structured error handling prevent common misuse.
- **Fast responses** – enterprise technique lookups leverage O(1) indices (80–95% faster) and cached STIX bundles to minimize latency.
- **Flexible transports** – run over stdio for local co-pilots or enable the built-in HTTP/JSON-RPC server with a single flag.

## Table of Contents

- [Introduction](#introduction)
- [Quick Start](#quick-start)
- [MCP Server & LLM Support](#mcp-server--llm-support)
- [Available MCP Tools](#available-mcp-tools)
- [Features](#features)
- [Available Playbooks](#available-playbooks)
- [Usage via MCP Client](#usage-via-mcp-client)
- [HTTP Server Mode](#http-server-mode)
- [Data Caching](#data-caching)
- [Performance Benchmarks](#performance-benchmarks)
- [Configuration Reference](#configuration-reference)
- [Usage via API (Python)](#usage-via-api-python)
- [Resources](#resources)
- [MCP Server Configuration](#mcp-server-configuration)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [License](#license)
- [About Montimage](#about-montimage)

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

| Tool Name                                | Description                                                                                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_techniques`                         | Get all techniques from the MITRE ATT&CK framework. Supports filtering by domain and includes options for subtechniques and handling revoked/deprecated items. |
| `get_tactics`                            | Get all tactics from the MITRE ATT&CK framework. Returns tactical categories that techniques are organized into.                                               |
| `get_groups`                             | Get all threat groups from the MITRE ATT&CK framework. These are known threat actors and APT groups.                                                           |
| `get_software`                           | Get all software from the MITRE ATT&CK framework. Can filter by software type (malware, tool) and domain.                                                      |
| `get_techniques_by_tactic`               | Get techniques associated with a specific tactic (e.g., 'defense-evasion', 'persistence').                                                                     |
| `get_techniques_used_by_group`           | Get techniques used by a specific threat group (e.g., 'APT29', 'Lazarus Group').                                                                               |
| `get_mitigations`                        | Get all mitigations from the MITRE ATT&CK framework. These are security measures to counter techniques.                                                        |
| `get_techniques_mitigated_by_mitigation` | Get techniques that can be mitigated by a specific mitigation strategy.                                                                                        |
| `get_technique_by_id`                    | Look up a specific technique by its MITRE ATT&CK ID (e.g., 'T1055' for Process Injection).                                                                     |

## Features

- **Comprehensive MITRE ATT&CK Coverage** - Access to all techniques, tactics, groups, software, and mitigations
- **Multi-Domain Support** - Enterprise, Mobile, and ICS ATT&CK domains
- **Intelligent Caching** - Automatic caching with configurable expiry (default: 24 hours)
- **Performance Optimized** - O(1) lookups using pre-built indices (80-95% faster)
- **Dual Transport Modes** - stdio for local clients, HTTP for web-based integrations
- **CORS-Enabled HTTP Server** - Support for async notifications and cross-origin requests
- **Comprehensive Testing** - 114 tests with 66% code coverage
- **Pre-commit Quality Checks** - Automated formatting, linting, type checking, and security scanning
- **Input Validation** - Secure-by-default with validated inputs and sanitized responses
- **Python API** - Easy integration into Python applications
- **CLI Interface** - Command-line tool for direct usage

## Quick Start

Install from PyPI and bring the MCP server online in minutes:

1. Create and activate a virtual environment (recommended):

```bash
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate.bat
```

2. Install the package:

```bash
pip install mitre-mcp
```

After installing `mitre-mcp`, you should be able to execute the following command:

```bash
mitre-mcp --help
```

_Expected output_

```bash
(.venv) root@5ded11443fe0:/test_mitre_mcp# mitre-mcp --help
MITRE ATT&CK MCP Server
Usage: mitre-mcp [options]

Options:
  --http               Run as HTTP server with streamable HTTP transport
  --host HOST          Host to bind to (default: localhost, only with --http)
  --port PORT          Port to bind to (default: 8000, only with --http)
  --force-download     Force download of MITRE ATT&CK data even if it's recent
  -h, --help           Show this help message and exit
```

3. Start the MCP server with stdio transport (for direct integration with clients):

```bash
mitre-mcp
```

_Expected result_

```bash
(.venv) root@5ded11443fe0:/test_mitre_mcp# mitre-mcp
2025-11-17 22:37:37,087 - mitre_mcp.mitre_mcp_server - INFO - Starting MITRE ATT&CK MCP Server (stdio mode)
2025-11-17 22:37:37,087 - mitre_mcp.mitre_mcp_server - INFO - Press Ctrl+C to stop the server
2025-11-17 22:37:37,091 - mitre_mcp.mitre_mcp_server - INFO - Using data directory: /test_mitre_mcp/.venv/lib/python3.10/site-packages/mitre_mcp/data
2025-11-17 22:37:37,091 - mitre_mcp.mitre_mcp_server - WARNING - Invalid or missing metadata file: [Errno 2] No such file or directory: '/test_mitre_mcp/.venv/lib/python3.10/site-packages/mitre_mcp/data/metadata.json'
2025-11-17 22:37:37,091 - mitre_mcp.mitre_mcp_server - INFO - Disk space check passed: 16458.0MB available (200MB required)
2025-11-17 22:37:37,091 - mitre_mcp.mitre_mcp_server - INFO - Downloading MITRE ATT&CK data in parallel...
2025-11-17 22:37:37,131 - mitre_mcp.mitre_mcp_server - INFO - Downloading Enterprise ATT&CK data...
2025-11-17 22:37:37,132 - mitre_mcp.mitre_mcp_server - INFO - Downloading Mobile ATT&CK data...
2025-11-17 22:37:37,132 - mitre_mcp.mitre_mcp_server - INFO - Downloading Ics ATT&CK data...
2025-11-17 22:37:37,272 - httpx - INFO - HTTP Request: GET https://raw.githubusercontent.com/mitre/cti/master/mobile-attack/mobile-attack.json "HTTP/1.1 200 OK"
2025-11-17 22:37:37,279 - httpx - INFO - HTTP Request: GET https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json "HTTP/1.1 200 OK"
2025-11-17 22:37:37,281 - httpx - INFO - HTTP Request: GET https://raw.githubusercontent.com/mitre/cti/master/ics-attack/ics-attack.json "HTTP/1.1 200 OK"
2025-11-17 22:37:37,348 - mitre_mcp.mitre_mcp_server - INFO - Validated ics STIX bundle: 1825 objects
2025-11-17 22:37:37,381 - mitre_mcp.mitre_mcp_server - INFO - Downloaded ics: 1825 objects
2025-11-17 22:37:37,401 - mitre_mcp.mitre_mcp_server - INFO - Validated mobile STIX bundle: 2535 objects
2025-11-17 22:37:37,447 - mitre_mcp.mitre_mcp_server - INFO - Downloaded mobile: 2535 objects
2025-11-17 22:37:37,853 - mitre_mcp.mitre_mcp_server - INFO - Validated enterprise STIX bundle: 24771 objects
2025-11-17 22:37:38,291 - mitre_mcp.mitre_mcp_server - INFO - Downloaded enterprise: 24771 objects
2025-11-17 22:37:38,302 - mitre_mcp.mitre_mcp_server - INFO - MITRE ATT&CK data downloaded successfully.
2025-11-17 22:37:38,302 - mitre_mcp.mitre_mcp_server - INFO - Initializing MITRE ATT&CK data...
2025-11-17 22:37:41,898 - mitre_mcp.mitre_mcp_server - INFO - MITRE ATT&CK data initialized successfully.
2025-11-17 22:37:41,898 - mitre_mcp.mitre_mcp_server - INFO - Building lookup indices...
2025-11-17 22:37:41,924 - mitre_mcp.mitre_mcp_server - INFO - Built group index: 580 entries for 187 groups
2025-11-17 22:37:41,949 - mitre_mcp.mitre_mcp_server - INFO - Built mitigation index: 268 entries for 268 mitigations
2025-11-17 22:37:41,975 - mitre_mcp.mitre_mcp_server - INFO - Built technique index: 835 entries for 835 techniques
2025-11-17 22:37:41,976 - mitre_mcp.mitre_mcp_server - INFO - Lookup indices built successfully.
2025-11-17 22:37:41,976 - mitre_mcp.mitre_mcp_server - INFO -
======================================================================
MITRE ATT&CK MCP Server is ready (stdio mode)

Add this to your MCP client configuration:
{
  "mcpServers": {
    "mitreattack": {
      "command": "/test_mitre_mcp/.venv/bin/python3",
      "args": [
        "-m",
        "mitre_mcp.mitre_mcp_server"
      ]
    }
  }
}
======================================================================

======================================================================
MITRE ATT&CK MCP Server is ready (stdio mode)

Add this to your MCP client configuration:
{
  "mcpServers": {
    "mitreattack": {
      "command": "/test_mitre_mcp/.venv/bin/python3",
      "args": [
        "-m",
        "mitre_mcp.mitre_mcp_server"
      ]
    }
  }
}
======================================================================
```

_Add to a MCP Client_

At the end of the log, you should see the real configuration, just copy - paste into your favorite mcp client. For example for the above server:

```json
{
  "mcpServers": {
    "mitreattack": {
      "command": "/test_mitre_mcp/.venv/bin/python3",
      "args": ["-m", "mitre_mcp.mitre_mcp_server"]
    }
  }
}
```

4. Or start the MCP server as an HTTP server:

```bash
mitre-mcp --http
```

_Expected result_

```bash
(.venv) root@5ded11443fe0:/test_mitre_mcp# mitre-mcp --http --host 0.0.0.0 --port 8088
2025-11-17 22:40:10,991 - mitre_mcp.mitre_mcp_server - INFO - Starting MITRE ATT&CK MCP Server (HTTP mode on 0.0.0.0:8088)
2025-11-17 22:40:10,991 - mitre_mcp.mitre_mcp_server - INFO - Press Ctrl+C to stop the server

======================================================================
MCP Client Configuration (Streamable HTTP Transport)
Server URL: http://0.0.0.0:8088
MCP Endpoint: http://0.0.0.0:8088/mcp

Add this to your MCP client configuration:
{
  "mcpServers": {
    "mitreattack": {
      "url": "http://0.0.0.0:8088/mcp"
    }
  }
}
======================================================================

2025-11-17 22:40:10,992 - mitre_mcp.mitre_mcp_server - INFO - CORS middleware enabled for async notifications
INFO:     Started server process [3172]
INFO:     Waiting for application startup.
2025-11-17 22:40:11,005 - mcp.server.streamable_http_manager - INFO - StreamableHTTP session manager started
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8088 (Press CTRL+C to quit)
```

_Add to a MCP Client_

At the end of the log, you should see the real configuration, just copy - paste into your favorite mcp client. For example for the above server:

```json
"mitreattack": {
      "url": "http://0.0.0.0:8088/mcp"
    }
```

Note that the address `0.0.0.0` should be the public address of the machine in which you start the server.

_Screenshots of adding `mitre-mcp` in VSCode_

Configure mcp server

![Configure](screenshot-01.png)

Make a query and see the Github Copilot request to call tools from `mitre-mcp`

![Tool call](screenshot-02.png)

The LLM show the final result with the information collected from `mitre-mcp`

![Result](screenshot-03.png)

5. Use the `--force-download` option to force a fresh download of MITRE ATT&CK data:

```bash
mitre-mcp --force-download
```

## Available Playbooks

We provide two playbooks to help you get started with mitre-mcp, tailored to different experience levels:

### 1. Beginner's Guide

For those new to MITRE ATT&CK or cybersecurity, check out our [Beginner's Guide](Beginner-Playbook.md). This guide uses simple language and practical examples to help you understand and use MITRE ATT&CK concepts.

**Ideal for:**

- Non-technical users
- Security awareness training
- Basic threat intelligence
- General cybersecurity education

### 2. Advanced Playbook

For security professionals and technical users, our [Advanced Playbook](Playbook.md) provides in-depth examples and command-line usage for leveraging mitre-mcp's full capabilities.

**Ideal for:**

- Security analysts
- Threat hunters
- Incident responders
- Security engineers

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

1. **MCP Endpoint** at `http://localhost:8000/mcp` for streamable HTTP transport
2. **CORS Support** - Enabled by default for async notifications and cross-origin requests
3. **Configurable Host/Port** - Use `--host` and `--port` flags to customize binding

**Starting the HTTP server:**

```bash
# Default (localhost:8000)
mitre-mcp --http

# Custom host and port
mitre-mcp --http --host 127.0.0.1 --port 8080
```

**MCP Client Configuration:**

```json
{
  "mcpServers": {
    "mitreattack": {
      "url": "http://localhost:8000/mcp"
    }
  }
}
```

**HTTP mode is useful for:**

- Integration with web-based MCP clients
- Async notifications support
- Multiple clients connecting to the same server instance
- Network-based integrations where stdio isn't practical
- Development and debugging with proper CORS support

## Data Caching

The server automatically caches MITRE ATT&CK data in a `data/` folder to improve performance and reduce unnecessary downloads. The caching behavior works as follows:

1. On first run, the server downloads the latest MITRE ATT&CK data and stores it in the `data/` folder
2. On subsequent runs, the server checks if the cached data is less than 1 day old
   - If the data is recent (less than 1 day old), it uses the cached data
   - If the data is older than 1 day, it automatically downloads fresh data
3. You can force a fresh download regardless of the cache age using the `--force-download` option

## Performance Benchmarks

| Scenario                    | Observed Improvement | Notes                                                                                                |
| --------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------- |
| Enterprise technique lookup | **80–95% faster**    | Uses pre-built O(1) indices for groups, mitigations, and techniques during server startup.           |
| ATT&CK data downloads       | **20–40% faster**    | HTTP connection pooling reuses TLS sessions across requests; configurable timeout prevents hangs.    |
| Warm cache startup          | **\<2s cold start**  | Cached bundles younger than 24h are reused, so LLM prompts can query the framework almost instantly. |

Benchmarks were collected on macOS 14 / Apple M3 Pro with Python 3.11. Performance varies with disk speed and network conditions; rerun with `MITRE_LOG_LEVEL=DEBUG` to view timing logs.

## Configuration Reference

Set any of the following environment variables before starting `mitre-mcp` to customize behavior (see `mitre_mcp/config.py` for validation logic):

| Variable                                                    | Default                        | Purpose                                                                                       |
| ----------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------- |
| `MITRE_ENTERPRISE_URL`, `MITRE_MOBILE_URL`, `MITRE_ICS_URL` | Official MITRE CTI GitHub URLs | Override ATT&CK bundle locations or point to an internal mirror.                              |
| `MITRE_DATA_DIR`                                            | `mitre_mcp/data`               | Store cached bundles in a custom directory (useful for shared volumes or read-only installs). |
| `MITRE_DOWNLOAD_TIMEOUT`                                    | `30`                           | HTTP timeout in seconds for bundle downloads.                                                 |
| `MITRE_CACHE_EXPIRY_DAYS`                                   | `1`                            | Maximum age before cached data is refreshed.                                                  |
| `MITRE_REQUIRED_SPACE_MB`                                   | `200`                          | Disk space threshold checked before downloading data.                                         |
| `MITRE_DEFAULT_PAGE_SIZE` / `MITRE_MAX_PAGE_SIZE`           | `20` / `1000`                  | Default and maximum number of records returned by list-style tools.                           |
| `MITRE_MAX_DESC_LENGTH`                                     | `500`                          | Trimmed description length in formatted responses.                                            |
| `MITRE_LOG_LEVEL`                                           | `INFO`                         | Logging verbosity (`DEBUG`, `INFO`, `WARNING`, etc.).                                         |

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

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude Desktop\config.json`
- **Linux**: `~/.config/Claude Desktop/config.json`

#### macOS automation script

Run the helper script to provision a dedicated virtualenv and update the Claude config automatically:

```bash
python scripts/install_claude_mitre_mcp.py
```

What it does:

- Creates (or reuses) a virtualenv at `~/.mitre-mcp-claude`
- Installs the current repository in editable mode inside that environment
- Installs/validates the official MCP SDK (`mcp[cli]`) so `mcp.server.fastmcp` is always available
- Adds an `mcpServers.mitreattack` entry pointing at that interpreter in `~/Library/Application Support/Claude/claude_desktop_config.json`

Optional flags:

- `--venv /custom/path` – override the virtualenv location
- `--config /custom/config.json` – override the Claude config path

After the script finishes, restart Claude Desktop and start the MCP server from that environment (`~/.mitre-mcp-claude/bin/mitre-mcp --force-download` the first time to warm the cache).

## Development

Clone the repository and install in development mode:

```bash
git clone https://github.com/montimage/mitre-mcp.git
cd mitre-mcp
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### Install & Test from Source

Follow this workflow when you need to modify the codebase and validate the changes locally:

1. **Clone and create a clean environment**
   ```bash
   git clone https://github.com/montimage/mitre-mcp.git
   cd mitre-mcp
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate.bat
   ```
2. **Install dependencies in editable mode**
   ```bash
   pip install -e ".[dev]"
   ```
   This pulls in mitre-mcp plus developer tooling (pytest, coverage, lint, etc.).
3. **Install pre-commit hooks**
   ```bash
   pre-commit install
   ```
   This sets up automatic code quality checks that run before each commit.
4. **Run the server from source**
   ```bash
   mitre-mcp --force-download
   ```
   Confirm the prompt prints cache/download logs, then connect your MCP client to this working tree (the console script points at your editable install).
5. **Modify the source files** under `mitre_mcp/` (or add tests in `tests/`), then rerun:
   ```bash
   pytest                      # full test suite with coverage
   pre-commit run --all-files  # run all quality checks
   ```
6. **Iterate quickly** by leaving the virtualenv active; every edit is picked up immediately because of the editable install (`-e`). When satisfied, run `pip install -e .` again to ensure entry points are updated and commit your changes.

### Code Quality Tools

The project uses pre-commit hooks for automated code quality checks:

**Formatting:**

- **black** - Python code formatter
- **isort** - Import statement organizer
- **prettier** - YAML/JSON/Markdown formatter

**Linting & Type Checking:**

- **flake8** - Python linter with plugins (bugbear, comprehensions, simplify)
- **mypy** - Static type checker
- **pyupgrade** - Automatic Python syntax upgrades
- **pydocstyle** - Docstring style checker

**Security & Validation:**

- **bandit** - Security vulnerability scanner
- **File validators** - YAML, JSON, TOML, detect private keys, etc.

**Testing:**

- **pytest** - Automatically runs all 114 tests before commit
- **Installation test** - Verifies package can be installed
- **Import verification** - Ensures all modules are importable
- **CLI test** - Validates command-line entry point

**Run quality checks manually:**

```bash
pre-commit run --all-files  # Run all hooks
pre-commit run pytest       # Run only tests
black mitre_mcp/           # Format code
pytest tests/              # Run test suite
```

## Troubleshooting

- **Download fails with "Insufficient disk space"** – Free at least `MITRE_REQUIRED_SPACE_MB` (default 200 MB) in the data directory or move the cache by setting `MITRE_DATA_DIR=/path/to/storage`.
- **Data never updates** – Cached bundles older than `MITRE_CACHE_EXPIRY_DAYS` refresh automatically, but you can run `mitre-mcp --force-download` or delete the `data/` folder to fetch a clean copy immediately.
- **Tool calls return `{"error": ...}`** – Ensure technique IDs follow the `T####` or `T####.###` format and that names/tactics are under 100 characters; the validator sanitizes other inputs for safety.
- **MCP client cannot discover the server** – Confirm the client configuration points to your venv’s Python, then run `mitre-mcp` manually and call `read_resource("mitre-attack://info")` to verify connectivity before re-enabling automations.
- **Claude log shows `ModuleNotFoundError: mcp.server.fastmcp`** – Run the helper script again or execute `pip install "mcp[cli]"` inside the environment referenced by Claude (e.g., `~/.mitre-mcp-claude/bin/python -m pip install "mcp[cli]"`) so the MCP SDK is available.

## FAQ

- **Does mitre-mcp work offline?** Yes. Once the bundles are cached locally, the server can answer queries without an internet connection until the cache expires.
- **Which Python versions are supported?** Python 3.10 through 3.14 (see `pyproject.toml`). Older versions are not tested and might miss async dependencies.
- **How often is data refreshed?** By default every 24 hours. Adjust `MITRE_CACHE_EXPIRY_DAYS` or manually refresh with `--force-download`.
- **Is HTTP mode safe for production?** HTTP mode serves JSON-RPC over localhost:8000 by default. Keep it behind a firewall or reverse proxy if exposing it beyond your workstation.

## License

MIT

## About Montimage

mitre-mcp is developed and maintained by [Montimage](https://www.montimage.eu), a company specializing in cybersecurity and network monitoring solutions. Montimage provides innovative security tools and services to help organizations protect their digital assets and ensure the security of their networks.

For questions or support, please contact us at [luong.nguyen@montimage.eu](mailto:luong.nguyen@montimage.eu).
