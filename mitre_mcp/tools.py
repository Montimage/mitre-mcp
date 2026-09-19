"""The nine MCP tools plus the shared domain-lookup helper.

Handlers are plain functions decorated onto ``server.mcp``. Two kinds of
names are deliberately resolved differently:

- ``mcp`` comes from ``server`` at module level — the decorators must bind
  the real server object at import time, and ``server`` is a leaf that
  never imports this module.
- ``get_attack_data`` is resolved through ``_entry()`` at call time —
  tests patch ``mitre_mcp.mitre_mcp_server.get_attack_data`` and the spy
  must see tool invocations, so the lookup goes through the entry module's
  namespace rather than this module's own binding.
"""

# Standard library imports
import logging
from typing import Literal, cast

# MCP SDK imports
from mcp.server.mcpserver import Context
from mcp.server.mcpserver.exceptions import ToolError
from mcp.types import ToolAnnotations
from mitreattack.stix20 import MitreAttackData

# Local imports
from ._entry import load as _entry
from .config import Config
from .data import AttackContext
from .models import (
    EntityRef,
    GroupResult,
    GroupsResult,
    GroupTechniquesResult,
    MitigationResult,
    MitigationsResult,
    MitigationTechniquesResult,
    SoftwareListResult,
    SoftwareResult,
    TacticResult,
    TacticsResult,
    TechniqueResult,
    TechniquesListResult,
    TechniquesPageResult,
    format_relationship_map,
    format_technique,
)
from .server import mcp
from .validators import (
    ValidationError,
    validate_domain,
    validate_limit,
    validate_name,
    validate_offset,
    validate_technique_id,
)

logger = logging.getLogger(__name__)

# ATT&CK domain selector shared by every tool's input schema — a
# Literal so the generated inputSchema carries an enum (MCP
# 2026-07-28 conformance), while validate_domain() keeps the same
# runtime rejection for direct calls.
AttackDomain = Literal["enterprise-attack", "mobile-attack", "ics-attack"]

# All tools are pure reads over a static dataset.
READ_ONLY_TOOL = ToolAnnotations(
    read_only_hint=True,
    destructive_hint=False,
    idempotent_hint=True,
    open_world_hint=False,
)


# Helper functions
def get_attack_data(domain: str, ctx: Context) -> MitreAttackData:
    """Get the appropriate MITRE ATT&CK data based on the domain."""
    lifespan_context = cast(AttackContext, ctx.request_context.lifespan_context)
    if domain == "enterprise-attack":
        return lifespan_context.enterprise_attack
    elif domain == "mobile-attack":
        return lifespan_context.mobile_attack
    elif domain == "ics-attack":
        return lifespan_context.ics_attack
    else:
        raise ValueError(f"Invalid domain: {domain}")


# MCP Tools
@mcp.tool(title="Get Techniques", annotations=READ_ONLY_TOOL)
def get_techniques(
    ctx: Context,
    domain: AttackDomain = "enterprise-attack",
    include_subtechniques: bool = True,
    remove_revoked_deprecated: bool = False,
    include_descriptions: bool = False,
    limit: int | None = None,
    offset: int = 0,
) -> TechniquesPageResult:
    """Get techniques from the MITRE ATT&CK framework with token-optimized responses.

    Args:
        ctx: FastMCP request context (injected by the server)
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        include_subtechniques: Include subtechniques in the result
        remove_revoked_deprecated: Remove revoked or deprecated objects
        include_descriptions: Whether to include technique descriptions (uses more tokens)
        limit: Maximum number of techniques to return (default: 20)
        offset: Index to start from when returning techniques (for pagination)

    Returns:
        Dictionary containing a list of techniques and pagination metadata
    """
    # Validate inputs
    try:
        domain = validate_domain(domain)
        if limit is None:
            limit = Config.DEFAULT_PAGE_SIZE
        limit = validate_limit(limit, Config.MAX_PAGE_SIZE)
        offset = validate_offset(offset)
    except ValidationError as e:
        raise ToolError(str(e)) from e

    data = _entry().get_attack_data(domain, ctx)
    techniques = data.get_techniques(
        include_subtechniques=include_subtechniques,
        remove_revoked_deprecated=remove_revoked_deprecated,
    )

    # Apply pagination
    total_count = len(techniques)
    end_idx = min(offset + limit, total_count) if limit else total_count
    paginated_techniques = techniques[offset:end_idx] if offset < total_count else []

    # Format with consideration for token usage
    formatted_techniques = [
        format_technique(technique, include_description=include_descriptions)
        for technique in paginated_techniques
    ]

    # Return with pagination metadata
    return {
        "techniques": formatted_techniques,
        "pagination": {
            "total": total_count,
            "offset": offset,
            "limit": limit,
            "has_more": end_idx < total_count,
        },
    }


@mcp.tool(title="Get Tactics", annotations=READ_ONLY_TOOL)
def get_tactics(
    ctx: Context,
    domain: AttackDomain = "enterprise-attack",
    remove_revoked_deprecated: bool = False,
) -> TacticsResult:
    """Get all tactics from the MITRE ATT&CK framework.

    Args:
        ctx: FastMCP request context (injected by the server)
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        remove_revoked_deprecated: Remove revoked or deprecated objects

    Returns:
        Dictionary containing a list of tactics
    """
    # Validate inputs
    try:
        domain = validate_domain(domain)
    except ValidationError as e:
        raise ToolError(str(e)) from e

    data = _entry().get_attack_data(domain, ctx)
    tactics = data.get_tactics(remove_revoked_deprecated=remove_revoked_deprecated)

    return {
        "tactics": [
            TacticResult(
                id=tactic.get("id", ""),
                name=tactic.get("name", ""),
                shortname=tactic.get("x_mitre_shortname", ""),
                description=tactic.get("description", ""),
            )
            for tactic in tactics
        ]
    }


@mcp.tool(title="Get Groups", annotations=READ_ONLY_TOOL)
def get_groups(
    ctx: Context,
    domain: AttackDomain = "enterprise-attack",
    remove_revoked_deprecated: bool = False,
) -> GroupsResult:
    """Get all groups from the MITRE ATT&CK framework.

    Args:
        ctx: FastMCP request context (injected by the server)
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        remove_revoked_deprecated: Remove revoked or deprecated objects

    Returns:
        Dictionary containing a list of groups
    """
    # Validate inputs
    try:
        domain = validate_domain(domain)
    except ValidationError as e:
        raise ToolError(str(e)) from e

    data = _entry().get_attack_data(domain, ctx)
    groups = data.get_groups(remove_revoked_deprecated=remove_revoked_deprecated)

    return {
        "groups": [
            GroupResult(
                id=group.get("id", ""),
                name=group.get("name", ""),
                description=group.get("description", ""),
                aliases=group.get("aliases", []),
            )
            for group in groups
        ]
    }


@mcp.tool(title="Get Software", annotations=READ_ONLY_TOOL)
def get_software(
    ctx: Context,
    domain: AttackDomain = "enterprise-attack",
    remove_revoked_deprecated: bool = False,
    software_types: list[str] | None = None,
) -> SoftwareListResult:
    """Get all software from the MITRE ATT&CK framework.

    Args:
        ctx: FastMCP request context (injected by the server)
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        remove_revoked_deprecated: Remove revoked or deprecated objects
        software_types: Optional list of ATT&CK object types to include (e.g., ["malware"])

    Returns:
        Dictionary containing a list of software
    """
    # Validate inputs
    try:
        domain = validate_domain(domain)
    except ValidationError as e:
        raise ToolError(str(e)) from e

    data = _entry().get_attack_data(domain, ctx)
    software = data.get_software(remove_revoked_deprecated=remove_revoked_deprecated)

    if software_types:
        allowed = {stype.lower() for stype in software_types}
        software = [s for s in software if s.get("type", "").lower() in allowed]

    return {
        "software": [
            SoftwareResult(
                id=s.get("id", ""),
                name=s.get("name", ""),
                type=s.get("type", ""),
                description=s.get("description", ""),
            )
            for s in software
        ]
    }


@mcp.tool(title="Get Techniques by Tactic", annotations=READ_ONLY_TOOL)
def get_techniques_by_tactic(
    ctx: Context,
    tactic_shortname: str,
    domain: AttackDomain = "enterprise-attack",
    remove_revoked_deprecated: bool = False,
) -> TechniquesListResult:
    """Get techniques by tactic.

    Args:
        ctx: FastMCP request context (injected by the server)
        tactic_shortname: The shortname of the tactic (e.g., 'defense-evasion')
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        remove_revoked_deprecated: Remove revoked or deprecated objects

    Returns:
        Dictionary containing a list of techniques
    """
    # Validate inputs
    try:
        domain = validate_domain(domain)
        tactic_shortname = validate_name(tactic_shortname, "tactic_shortname", 50)
    except ValidationError as e:
        raise ToolError(str(e)) from e

    data = _entry().get_attack_data(domain, ctx)
    techniques = data.get_techniques_by_tactic(
        tactic_shortname=tactic_shortname,
        domain=domain,
        remove_revoked_deprecated=remove_revoked_deprecated,
    )

    return {"techniques": [format_technique(technique) for technique in techniques]}


@mcp.tool(title="Get Techniques Used by Group", annotations=READ_ONLY_TOOL)
def get_techniques_used_by_group(
    ctx: Context, group_name: str, domain: AttackDomain = "enterprise-attack"
) -> GroupTechniquesResult:
    """Get techniques used by a group.

    Args:
        ctx: FastMCP request context (injected by the server)
        group_name: The name of the group
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)

    Returns:
        Dictionary containing the group and a list of techniques
    """
    # Validate inputs
    try:
        domain = validate_domain(domain)
        group_name = validate_name(group_name, "group_name")
    except ValidationError as e:
        raise ToolError(str(e)) from e

    data = _entry().get_attack_data(domain, ctx)

    # Use index for O(1) lookup (enterprise domain only)
    if domain == "enterprise-attack":
        group = cast(AttackContext, ctx.request_context.lifespan_context).groups_index.get(
            group_name.lower()
        )
    else:
        # Fallback to linear search for other domains
        groups = data.get_groups()
        group = None
        for g in groups:
            if g.get("name", "").lower() == group_name.lower():
                group = g
                break

    if not group:
        raise ToolError(f"Group '{group_name}' not found")

    techniques = data.get_techniques_used_by_group(group["id"])

    return {
        "group": EntityRef(id=group.get("id", ""), name=group.get("name", "")),
        "techniques": format_relationship_map(techniques),
    }


@mcp.tool(title="Get Mitigations", annotations=READ_ONLY_TOOL)
def get_mitigations(
    ctx: Context,
    domain: AttackDomain = "enterprise-attack",
    remove_revoked_deprecated: bool = False,
) -> MitigationsResult:
    """Get all mitigations from the MITRE ATT&CK framework.

    Args:
        ctx: FastMCP request context (injected by the server)
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        remove_revoked_deprecated: Remove revoked or deprecated objects

    Returns:
        Dictionary containing a list of mitigations
    """
    # Validate inputs
    try:
        domain = validate_domain(domain)
    except ValidationError as e:
        raise ToolError(str(e)) from e

    data = _entry().get_attack_data(domain, ctx)
    mitigations = data.get_mitigations(remove_revoked_deprecated=remove_revoked_deprecated)

    return {
        "mitigations": [
            MitigationResult(
                id=mitigation.get("id", ""),
                name=mitigation.get("name", ""),
                description=mitigation.get("description", ""),
            )
            for mitigation in mitigations
        ]
    }


@mcp.tool(title="Get Techniques Mitigated by Mitigation", annotations=READ_ONLY_TOOL)
def get_techniques_mitigated_by_mitigation(
    ctx: Context, mitigation_name: str, domain: AttackDomain = "enterprise-attack"
) -> MitigationTechniquesResult:
    """Get techniques mitigated by a mitigation.

    Args:
        ctx: FastMCP request context (injected by the server)
        mitigation_name: The name of the mitigation
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)

    Returns:
        Dictionary containing the mitigation and a list of techniques
    """
    # Validate inputs
    try:
        domain = validate_domain(domain)
        mitigation_name = validate_name(mitigation_name, "mitigation_name")
    except ValidationError as e:
        raise ToolError(str(e)) from e

    data = _entry().get_attack_data(domain, ctx)

    # Use index for O(1) lookup (enterprise domain only)
    if domain == "enterprise-attack":
        mitigation = cast(
            AttackContext, ctx.request_context.lifespan_context
        ).mitigations_index.get(mitigation_name.lower())
    else:
        # Fallback to linear search for other domains
        mitigations = data.get_mitigations()
        mitigation = None
        for m in mitigations:
            if m.get("name", "").lower() == mitigation_name.lower():
                mitigation = m
                break

    if not mitigation:
        raise ToolError(f"Mitigation '{mitigation_name}' not found")

    techniques = data.get_techniques_mitigated_by_mitigation(mitigation["id"])

    return {
        "mitigation": EntityRef(id=mitigation.get("id", ""), name=mitigation.get("name", "")),
        "techniques": format_relationship_map(techniques),
    }


@mcp.tool(title="Get Technique by ID", annotations=READ_ONLY_TOOL)
def get_technique_by_id(
    ctx: Context, technique_id: str, domain: AttackDomain = "enterprise-attack"
) -> TechniqueResult:
    """Get a technique by its MITRE ATT&CK ID.

    Args:
        ctx: FastMCP request context (injected by the server)
        technique_id: The MITRE ATT&CK ID of the technique (e.g., 'T1055')
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)

    Returns:
        Dictionary containing the technique
    """
    # Validate inputs
    try:
        technique_id = validate_technique_id(technique_id)
        domain = validate_domain(domain)
    except ValidationError as e:
        raise ToolError(str(e)) from e

    # Use index for O(1) lookup (enterprise domain)
    if domain == "enterprise-attack":
        technique = cast(
            AttackContext, ctx.request_context.lifespan_context
        ).techniques_by_mitre_id.get(technique_id)
    else:
        # Fallback to linear search for other domains
        data = _entry().get_attack_data(domain, ctx)
        techniques = data.get_techniques()
        technique = None
        for t in techniques:
            for ref in t.get("external_references", []):
                if (
                    ref.get("source_name") == "mitre-attack"
                    and ref.get("external_id") == technique_id
                ):
                    technique = t
                    break
            if technique:
                break

    if not technique:
        raise ToolError(f"Technique '{technique_id}' not found")

    return {"technique": format_technique(technique, include_description=True)}
