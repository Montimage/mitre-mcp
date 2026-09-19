"""The MCP server object, its ATT&CK-data lifespan and the info resource.

``mcp`` lives here — not in the entry module — so ``tools`` can register
handlers on it without importing the entry point at module level. The
lifespan resolves its collaborators through ``_entry.load()`` at call time:
the test suite patches ``mitre_mcp.mitre_mcp_server.<name>`` and expects the
lifespan to observe those replacements, and the deferred lookup also keeps
``python -m mitre_mcp.mitre_mcp_server`` free of a re-entrant import.
"""

# Standard library imports
import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

# MCP SDK imports
from mcp.server.mcpserver import MCPServer

# Local imports
from . import __version__
from ._entry import load as _entry
from .data import AttackContext

logger = logging.getLogger(__name__)


@asynccontextmanager
async def attack_lifespan(server: MCPServer) -> AsyncIterator[AttackContext]:
    """Initialize and manage MITRE ATT&CK data."""
    # Resolved late: the entry module is the patch surface the tests use.
    entry = _entry()
    data_dir = entry.Config.get_data_dir()
    os.makedirs(data_dir, exist_ok=True)
    logger.info("Using data directory: %s", data_dir)

    try:
        args = entry.get_cli_args()

        paths = await entry.download_and_save_attack_data_async(data_dir, force=args.force_download)

        logger.info("Initializing MITRE ATT&CK data...")
        enterprise_attack = entry.MitreAttackData(paths["enterprise"])
        mobile_attack = entry.MitreAttackData(paths["mobile"])
        ics_attack = entry.MitreAttackData(paths["ics"])
        logger.info("MITRE ATT&CK data initialized successfully.")

        logger.info("Building lookup indices...")
        groups_index = entry.build_group_index(enterprise_attack)
        mitigations_index = entry.build_mitigation_index(enterprise_attack)
        techniques_index = entry.build_technique_index(enterprise_attack)
        logger.info("Lookup indices built successfully.")

        entry.emit_startup_banner(args)

        yield AttackContext(
            enterprise_attack=enterprise_attack,
            mobile_attack=mobile_attack,
            ics_attack=ics_attack,
            groups_index=groups_index,
            mitigations_index=mitigations_index,
            techniques_by_mitre_id=techniques_index,
        )
    except Exception as e:
        logger.error("Failed to initialize MITRE ATT&CK data: %s", e)
        raise


# Create MCP server with lifespan
mcp = MCPServer(
    "MITRE ATT&CK Server",
    title="MITRE ATT&CK",
    description=(
        "MCP server exposing MITRE ATT&CK data — groups, tactics, "
        "techniques, software, and mitigations — across the Enterprise, "
        "Mobile, and ICS domains."
    ),
    instructions=(
        "Query MITRE ATT&CK with the provided tools. Pass the 'domain' "
        "argument as 'enterprise-attack', 'mobile-attack', or 'ics-attack' "
        "to select the dataset (default 'enterprise-attack'). Name- and "
        "ID-indexed lookups are fastest on the enterprise domain."
    ),
    version=__version__,
    lifespan=attack_lifespan,
)


# Define a resource to get information about the server
@mcp.resource("mitre-attack://info")
async def get_server_info() -> str:
    """Get information about the MITRE ATT&CK MCP server."""
    tools = await mcp.list_tools()
    tool_lines = "\n".join(f"    - {t.name}: {t.description}" for t in tools)
    return f"""
    MITRE ATT&CK MCP Server

    This server provides tools for working with the MITRE ATT&CK framework
    using the mitreattack-python library.

    Available domains:
    - enterprise-attack: Enterprise ATT&CK
    - mobile-attack: Mobile ATT&CK
    - ics-attack: ICS ATT&CK

    Available tools:
{tool_lines}
    """
