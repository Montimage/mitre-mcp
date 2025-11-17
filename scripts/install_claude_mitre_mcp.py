#!/usr/bin/env python3
"""
Automate mitre-mcp installation and Claude Desktop MCP registration on macOS.

This script will:
1. Create (or reuse) a dedicated Python virtual environment.
2. Install the current mitre-mcp source tree in editable mode.
3. Update Claude Desktop's config.json so the MCP server is available.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict

DEFAULT_VENV = Path.home() / ".mitre-mcp-claude"
CLAUDE_CONFIG = Path.home() / "Library/Application Support/Claude/claude_desktop_config.json"
SERVER_NAME = "mitreattack"


def run(cmd: list[str], **kwargs: Any) -> None:
    """Run a subprocess command with logging."""
    print(f"→ {' '.join(cmd)}")
    subprocess.check_call(cmd, **kwargs)


def ensure_venv(venv_path: Path) -> Path:
    """Create the virtual environment if it does not exist and return python path."""
    python_bin = venv_path / "bin" / "python"

    if not python_bin.exists():
        print(f"Creating virtualenv at {venv_path}")
        run([sys.executable, "-m", "venv", str(venv_path)])
    else:
        print(f"Using existing virtualenv at {venv_path}")

    return python_bin


def install_package(python_bin: Path, repo_root: Path) -> None:
    """Install mitre-mcp (editable) along with build tooling."""
    run([str(python_bin), "-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"])
    run([str(python_bin), "-m", "pip", "install", "-e", str(repo_root)])
    # Ensure MCP SDK is available even if editable install was already satisfied
    run([str(python_bin), "-m", "pip", "install", "mcp[cli]>=0.1.0,<1.0.0"])
    # Quick sanity check to fail fast if the module cannot be imported later
    run(
        [
            str(python_bin),
            "-c",
            "from mcp.server.fastmcp import FastMCP; print('Verified mcp.server.fastmcp')",
        ]
    )


def ensure_config_directory(config_path: Path) -> None:
    """Ensure the directory for Claude configuration exists."""
    config_path.parent.mkdir(parents=True, exist_ok=True)


def load_config(config_path: Path) -> dict[str, Any]:
    """Load Claude config JSON if present, otherwise return minimal structure."""
    if config_path.exists():
        with config_path.open("r", encoding="utf-8") as handle:
            try:
                data = json.load(handle)
                if not isinstance(data, dict):
                    raise ValueError("Root JSON must be an object")
                return data
            except json.JSONDecodeError:
                raise RuntimeError(f"Claude config at {config_path} is not valid JSON.")
    return {}


def write_config(config_path: Path, config: dict[str, Any]) -> None:
    """Write Claude configuration to disk with indentation."""
    ensure_config_directory(config_path)
    with config_path.open("w", encoding="utf-8") as handle:
        json.dump(config, handle, indent=2)
        handle.write("\n")


def update_claude_config(config_path: Path, python_bin: Path) -> None:
    """Register the mitre-mcp server with Claude Desktop."""
    config = load_config(config_path)
    servers = config.get("mcpServers")
    if not isinstance(servers, dict):
        servers = {}
    config["mcpServers"] = servers

    servers[SERVER_NAME] = {
        "command": str(python_bin),
        "args": ["-m", "mitre_mcp.mitre_mcp_server"],
    }

    write_config(config_path, config)
    print(f"Claude config updated at {config_path}")


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments for overriding defaults."""
    parser = argparse.ArgumentParser(description="Install mitre-mcp and configure Claude Desktop.")
    parser.add_argument(
        "--venv",
        type=Path,
        default=DEFAULT_VENV,
        help=f"Path to virtual environment (default: {DEFAULT_VENV})",
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=CLAUDE_CONFIG,
        help=f"Claude Desktop config.json path (default: {CLAUDE_CONFIG})",
    )
    return parser.parse_args()


def main() -> None:
    """Entry point."""
    if platform.system() != "Darwin":
        raise SystemExit("This helper is intended for macOS (Darwin) only.")

    repo_root = Path(__file__).resolve().parents[1]
    args = parse_args()

    python_bin = ensure_venv(args.venv)
    install_package(python_bin, repo_root)
    update_claude_config(args.config, python_bin)

    print("\nDone! Restart Claude Desktop to load the updated MCP server list.")
    print("Run `mitre-mcp --force-download` once inside the virtualenv to warm the cache.")


if __name__ == "__main__":
    main()
