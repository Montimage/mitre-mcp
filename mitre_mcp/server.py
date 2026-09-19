"""The MCP server object, its ATT&CK-data lifespan and the info resource.

``mcp`` lives here — not in the entry module — so ``tools`` can register
handlers on it without importing the entry point at module level. The
lifespan resolves its collaborators through ``_entry.load()`` at call time:
the test suite patches ``mitre_mcp.mitre_mcp_server.<name>`` and expects the
lifespan to observe those replacements, and the deferred lookup also keeps
``python -m mitre_mcp.mitre_mcp_server`` free of a re-entrant import.
"""

# Standard library imports
import asyncio
import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

# MCP SDK imports
from mcp.server.mcpserver import MCPServer
from mitreattack.stix20 import MitreAttackData

# Local imports
from . import __version__
from ._entry import load as _entry
from .data import AttackContext, DomainIndices, DomainLists

logger = logging.getLogger(__name__)


def _load_domain(path: str) -> tuple[MitreAttackData, DomainIndices, DomainLists]:
    """Parse one lazily loaded domain and build its lookups (F-PERF-010).

    Runs on a worker thread from ``AttackContext.ensure_domain``. Resolved
    through the entry module so tests patching
    ``mitre_mcp.mitre_mcp_server.{MitreAttackData, build_domain_indices,
    build_domain_lists}`` observe the load exactly like the eager path.
    """
    entry = _entry()
    data = entry.MitreAttackData(path)
    return data, entry.build_domain_indices(data), entry.build_domain_lists(data)


@asynccontextmanager
async def attack_lifespan(server: MCPServer) -> AsyncIterator[AttackContext]:
    """Initialize and manage MITRE ATT&CK data."""
    # Resolved late: the entry module is the patch surface the tests use.
    entry = _entry()
    data_dir = entry.Config.get_data_dir()
    os.makedirs(data_dir, exist_ok=True)
    logger.info("Using data directory: %s", data_dir)

    refresh_task: asyncio.Task | None = None
    try:
        args = entry.get_cli_args()

        paths = entry.attack_data_paths(data_dir)
        if entry.stale_cache_servable(paths, force=args.force_download):
            # F-PERF-010: an expired cache answers the first request from
            # the stale bundles at once; the refresh download runs behind
            # it instead of blocking start-up (the Task 2.7 stale-serve
            # behaviour, moved off the critical path).
            logger.info(
                "ATT&CK cache expired — serving stale data while refreshing in the background"
            )
            refresh_task = asyncio.create_task(entry.download_and_save_attack_data_async(data_dir))
        else:
            paths = await entry.download_and_save_attack_data_async(
                data_dir, force=args.force_download
            )

        logger.info("Initializing MITRE ATT&CK data (enterprise domain)...")
        enterprise_attack = entry.MitreAttackData(paths["enterprise"])
        logger.info("MITRE ATT&CK data initialized successfully.")

        logger.info("Building enterprise lookup indices...")
        # F-PERF-010: only the enterprise domain is built at start-up —
        # every tool defaults to it. Mobile and ICS load on first use via
        # AttackContext.ensure_domain (per-domain lock, exactly once).
        domain_indices = {
            "enterprise-attack": entry.build_domain_indices(enterprise_attack),
        }
        domain_lists = {
            "enterprise-attack": entry.build_domain_lists(enterprise_attack),
        }
        logger.info("Lookup indices and per-domain lists built successfully.")

        entry.emit_startup_banner(args)

        yield AttackContext(
            enterprise_attack=enterprise_attack,
            domain_indices=domain_indices,
            domain_lists=domain_lists,
            domain_paths={
                "enterprise-attack": paths["enterprise"],
                "mobile-attack": paths["mobile"],
                "ics-attack": paths["ics"],
            },
            domain_loader=_load_domain,
        )
    except Exception as e:
        logger.error("Failed to initialize MITRE ATT&CK data: %s", e)
        raise
    finally:
        if refresh_task is not None:
            # Shutdown mid-refresh: cancel and drain the task so its result
            # or exception is always retrieved — the atomic cache writes
            # keep the stale bundles intact either way.
            refresh_task.cancel()
            try:
                await refresh_task
            except asyncio.CancelledError:
                pass
            except Exception as refresh_error:
                logger.warning("Background ATT&CK data refresh failed: %s", refresh_error)


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
        "to select the dataset (default 'enterprise-attack'). Name-, alias- "
        "and ID-indexed lookups are available on every domain."
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
