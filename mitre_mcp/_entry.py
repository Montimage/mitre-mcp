"""Late-bound access to the :mod:`mitre_mcp.mitre_mcp_server` entry module.

The entry module is the package's public patch surface: the test suite
replaces ``mitre_mcp.mitre_mcp_server.<name>`` and expects every internal
call to observe the replacement. Submodules resolve shared names through
this loader at call time instead of importing them at module level — a
module-level import would create an import cycle (the entry module itself
imports the submodules) and would re-execute the entry file under its real
name when it is already running as ``__main__`` via
``python -m mitre_mcp.mitre_mcp_server``.
"""

import importlib
from typing import Any


def load() -> Any:
    """Return the fully-initialized ``mitre_mcp.mitre_mcp_server`` module."""
    return importlib.import_module("mitre_mcp.mitre_mcp_server")
