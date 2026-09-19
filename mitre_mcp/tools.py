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
from .data import AttackContext, DomainIndices, DomainLists
from .models import (
    EntityRef,
    GroupResult,
    GroupsResult,
    GroupTechniquesResult,
    MitigationResult,
    MitigationsResult,
    MitigationTechniquesResult,
    Pagination,
    SoftwareListResult,
    SoftwareResult,
    TacticResult,
    TacticsResult,
    TechniqueResult,
    TechniquesListResult,
    TechniquesPageResult,
    format_relationship_map,
    format_technique,
    truncate_description,
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


def _domain_lists(ctx: Context, domain: str) -> DomainLists | None:
    """Return the precomputed lists for a domain, or None when absent.

    Duck-typed test contexts may not carry ``domain_lists``; those calls
    fall back to the store exactly as before (F-PERF-005).
    """
    lifespan_context = cast(AttackContext, ctx.request_context.lifespan_context)
    lists_by_domain = getattr(lifespan_context, "domain_lists", None)
    if not isinstance(lists_by_domain, dict):
        return None
    return lists_by_domain.get(domain)


def _domain_indices(ctx: Context, domain: str) -> DomainIndices | None:
    """Return the precomputed lookup indices for a domain, or None when absent.

    Built once per domain at load for all three domains, so name, alias
    and ID lookups never scan query results (F-BUG-015, F-PERF-011).
    Duck-typed test contexts may not carry ``domain_indices``; lookups on
    those contexts simply miss.
    """
    lifespan_context = cast(AttackContext, ctx.request_context.lifespan_context)
    indices_by_domain = getattr(lifespan_context, "domain_indices", None)
    if not isinstance(indices_by_domain, dict):
        return None
    return indices_by_domain.get(domain)


def _resolve_paging(limit: int | None, offset: int) -> tuple[int, int]:
    """Apply the get_techniques paging contract shared by every paged tool."""
    try:
        if limit is None:
            limit = Config.DEFAULT_PAGE_SIZE
        limit = validate_limit(limit, Config.MAX_PAGE_SIZE)
        offset = validate_offset(offset)
    except ValidationError as e:
        raise ToolError(str(e)) from e
    return limit, offset


def _paginate(items: list | tuple, limit: int, offset: int) -> tuple[list, Pagination]:
    """Slice one page out of a list and build its pagination metadata."""
    total_count = len(items)
    end_idx = min(offset + limit, total_count) if limit else total_count
    page = list(items[offset:end_idx]) if offset < total_count else []
    return page, {
        "total": total_count,
        "offset": offset,
        "limit": limit,
        "has_more": end_idx < total_count,
    }


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
    except ValidationError as e:
        raise ToolError(str(e)) from e
    limit, offset = _resolve_paging(limit, offset)

    # F-PERF-005: default-argument calls slice the list precomputed at load
    # instead of re-querying the store.
    lists = _domain_lists(ctx, domain)
    if lists is not None and include_subtechniques and not remove_revoked_deprecated:
        techniques = lists.techniques
    else:
        data = _entry().get_attack_data(domain, ctx)
        techniques = data.get_techniques(
            include_subtechniques=include_subtechniques,
            remove_revoked_deprecated=remove_revoked_deprecated,
        )

    # Apply pagination
    paginated_techniques, pagination = _paginate(techniques, limit, offset)

    # Format with consideration for token usage
    formatted_techniques = [
        format_technique(technique, include_description=include_descriptions)
        for technique in paginated_techniques
    ]

    # Return with pagination metadata
    return {
        "techniques": formatted_techniques,
        "pagination": pagination,
    }


@mcp.tool(title="Get Tactics", annotations=READ_ONLY_TOOL)
def get_tactics(
    ctx: Context,
    domain: AttackDomain = "enterprise-attack",
    remove_revoked_deprecated: bool = False,
    limit: int | None = None,
    offset: int = 0,
) -> TacticsResult:
    """Get tactics from the MITRE ATT&CK framework with token-optimized responses.

    Args:
        ctx: FastMCP request context (injected by the server)
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        remove_revoked_deprecated: Remove revoked or deprecated objects
        limit: Maximum number of tactics to return (default: 20)
        offset: Index to start from when returning tactics (for pagination)

    Returns:
        Dictionary containing a list of tactics and pagination metadata
    """
    # Validate inputs
    try:
        domain = validate_domain(domain)
    except ValidationError as e:
        raise ToolError(str(e)) from e
    limit, offset = _resolve_paging(limit, offset)

    # F-PERF-005: default-argument calls slice the precomputed list.
    lists = _domain_lists(ctx, domain)
    if lists is not None and not remove_revoked_deprecated:
        tactics = lists.tactics
    else:
        data = _entry().get_attack_data(domain, ctx)
        tactics = data.get_tactics(remove_revoked_deprecated=remove_revoked_deprecated)

    page, pagination = _paginate(tactics, limit, offset)

    return {
        "tactics": [
            TacticResult(
                id=tactic.get("id", ""),
                name=tactic.get("name", ""),
                shortname=tactic.get("x_mitre_shortname", ""),
                description=truncate_description(tactic.get("description", "")),
            )
            for tactic in page
        ],
        "pagination": pagination,
    }


@mcp.tool(title="Get Groups", annotations=READ_ONLY_TOOL)
def get_groups(
    ctx: Context,
    domain: AttackDomain = "enterprise-attack",
    remove_revoked_deprecated: bool = False,
    limit: int | None = None,
    offset: int = 0,
) -> GroupsResult:
    """Get groups from the MITRE ATT&CK framework with token-optimized responses.

    Args:
        ctx: FastMCP request context (injected by the server)
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        remove_revoked_deprecated: Remove revoked or deprecated objects
        limit: Maximum number of groups to return (default: 20)
        offset: Index to start from when returning groups (for pagination)

    Returns:
        Dictionary containing a list of groups and pagination metadata
    """
    # Validate inputs
    try:
        domain = validate_domain(domain)
    except ValidationError as e:
        raise ToolError(str(e)) from e
    limit, offset = _resolve_paging(limit, offset)

    # F-PERF-005: default-argument calls slice the precomputed list.
    lists = _domain_lists(ctx, domain)
    if lists is not None and not remove_revoked_deprecated:
        groups = lists.groups
    else:
        data = _entry().get_attack_data(domain, ctx)
        groups = data.get_groups(remove_revoked_deprecated=remove_revoked_deprecated)

    page, pagination = _paginate(groups, limit, offset)

    return {
        "groups": [
            GroupResult(
                id=group.get("id", ""),
                name=group.get("name", ""),
                description=truncate_description(group.get("description", "")),
                aliases=group.get("aliases", []),
            )
            for group in page
        ],
        "pagination": pagination,
    }


@mcp.tool(title="Get Software", annotations=READ_ONLY_TOOL)
def get_software(
    ctx: Context,
    domain: AttackDomain = "enterprise-attack",
    remove_revoked_deprecated: bool = False,
    software_types: list[str] | None = None,
    limit: int | None = None,
    offset: int = 0,
) -> SoftwareListResult:
    """Get software from the MITRE ATT&CK framework with token-optimized responses.

    Args:
        ctx: FastMCP request context (injected by the server)
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        remove_revoked_deprecated: Remove revoked or deprecated objects
        software_types: Optional list of ATT&CK object types to include (e.g., ["malware"])
        limit: Maximum number of software to return (default: 20)
        offset: Index to start from when returning software (for pagination)

    Returns:
        Dictionary containing a list of software and pagination metadata
    """
    # Validate inputs
    try:
        domain = validate_domain(domain)
    except ValidationError as e:
        raise ToolError(str(e)) from e
    limit, offset = _resolve_paging(limit, offset)

    # F-PERF-005: default-argument calls slice the precomputed list.
    lists = _domain_lists(ctx, domain)
    if lists is not None and not remove_revoked_deprecated:
        software = list(lists.software)
    else:
        data = _entry().get_attack_data(domain, ctx)
        software = data.get_software(remove_revoked_deprecated=remove_revoked_deprecated)

    if software_types:
        allowed = {stype.lower() for stype in software_types}
        software = [s for s in software if s.get("type", "").lower() in allowed]

    page, pagination = _paginate(software, limit, offset)

    return {
        "software": [
            SoftwareResult(
                id=s.get("id", ""),
                name=s.get("name", ""),
                type=s.get("type", ""),
                description=truncate_description(s.get("description", "")),
            )
            for s in page
        ],
        "pagination": pagination,
    }


@mcp.tool(title="Get Techniques by Tactic", annotations=READ_ONLY_TOOL)
def get_techniques_by_tactic(
    ctx: Context,
    tactic_shortname: str,
    domain: AttackDomain = "enterprise-attack",
    remove_revoked_deprecated: bool = False,
    limit: int | None = None,
    offset: int = 0,
) -> TechniquesListResult:
    """Get techniques by tactic.

    Args:
        ctx: FastMCP request context (injected by the server)
        tactic_shortname: The shortname of the tactic (e.g., 'defense-evasion')
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        remove_revoked_deprecated: Remove revoked or deprecated objects
        limit: Maximum number of techniques to return (default: 20)
        offset: Index to start from when returning techniques (for pagination)

    Returns:
        Dictionary containing a list of techniques and pagination metadata
    """
    # Validate inputs
    try:
        domain = validate_domain(domain)
        tactic_shortname = validate_name(tactic_shortname, "tactic_shortname", 50)
    except ValidationError as e:
        raise ToolError(str(e)) from e
    limit, offset = _resolve_paging(limit, offset)

    data = _entry().get_attack_data(domain, ctx)
    techniques = list(
        data.get_techniques_by_tactic(
            tactic_shortname=tactic_shortname,
            domain=domain,
            remove_revoked_deprecated=remove_revoked_deprecated,
        )
    )

    page, pagination = _paginate(techniques, limit, offset)

    return {
        "techniques": [format_technique(technique) for technique in page],
        "pagination": pagination,
    }


@mcp.tool(title="Get Techniques Used by Group", annotations=READ_ONLY_TOOL)
def get_techniques_used_by_group(
    ctx: Context,
    group_name: str,
    domain: AttackDomain = "enterprise-attack",
    limit: int | None = None,
    offset: int = 0,
) -> GroupTechniquesResult:
    """Get techniques used by a group.

    Args:
        ctx: FastMCP request context (injected by the server)
        group_name: The name of the group
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        limit: Maximum number of techniques to return (default: 20)
        offset: Index to start from when returning techniques (for pagination)

    Returns:
        Dictionary containing the group, a list of techniques and pagination metadata
    """
    # Validate inputs
    try:
        domain = validate_domain(domain)
        group_name = validate_name(group_name, "group_name")
    except ValidationError as e:
        raise ToolError(str(e)) from e
    limit, offset = _resolve_paging(limit, offset)

    data = _entry().get_attack_data(domain, ctx)

    # O(1) index lookup on every domain — names and aliases (F-BUG-015).
    indices = _domain_indices(ctx, domain)
    group = indices.groups.get(group_name.lower()) if indices is not None else None

    if not group:
        raise ToolError(f"Group '{group_name}' not found")

    techniques = list(data.get_techniques_used_by_group(group["id"]))
    page, pagination = _paginate(techniques, limit, offset)

    return {
        "group": EntityRef(id=group.get("id", ""), name=group.get("name", "")),
        "techniques": format_relationship_map(page),
        "pagination": pagination,
    }


@mcp.tool(title="Get Mitigations", annotations=READ_ONLY_TOOL)
def get_mitigations(
    ctx: Context,
    domain: AttackDomain = "enterprise-attack",
    remove_revoked_deprecated: bool = False,
    limit: int | None = None,
    offset: int = 0,
) -> MitigationsResult:
    """Get mitigations from the MITRE ATT&CK framework with token-optimized responses.

    Args:
        ctx: FastMCP request context (injected by the server)
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        remove_revoked_deprecated: Remove revoked or deprecated objects
        limit: Maximum number of mitigations to return (default: 20)
        offset: Index to start from when returning mitigations (for pagination)

    Returns:
        Dictionary containing a list of mitigations and pagination metadata
    """
    # Validate inputs
    try:
        domain = validate_domain(domain)
    except ValidationError as e:
        raise ToolError(str(e)) from e
    limit, offset = _resolve_paging(limit, offset)

    # F-PERF-005: default-argument calls slice the precomputed list.
    lists = _domain_lists(ctx, domain)
    if lists is not None and not remove_revoked_deprecated:
        mitigations = lists.mitigations
    else:
        data = _entry().get_attack_data(domain, ctx)
        mitigations = data.get_mitigations(remove_revoked_deprecated=remove_revoked_deprecated)

    page, pagination = _paginate(mitigations, limit, offset)

    return {
        "mitigations": [
            MitigationResult(
                id=mitigation.get("id", ""),
                name=mitigation.get("name", ""),
                description=truncate_description(mitigation.get("description", "")),
            )
            for mitigation in page
        ],
        "pagination": pagination,
    }


@mcp.tool(title="Get Techniques Mitigated by Mitigation", annotations=READ_ONLY_TOOL)
def get_techniques_mitigated_by_mitigation(
    ctx: Context,
    mitigation_name: str,
    domain: AttackDomain = "enterprise-attack",
    limit: int | None = None,
    offset: int = 0,
) -> MitigationTechniquesResult:
    """Get techniques mitigated by a mitigation.

    Args:
        ctx: FastMCP request context (injected by the server)
        mitigation_name: The name of the mitigation
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        limit: Maximum number of techniques to return (default: 20)
        offset: Index to start from when returning techniques (for pagination)

    Returns:
        Dictionary containing the mitigation, a list of techniques and pagination metadata
    """
    # Validate inputs
    try:
        domain = validate_domain(domain)
        mitigation_name = validate_name(mitigation_name, "mitigation_name")
    except ValidationError as e:
        raise ToolError(str(e)) from e
    limit, offset = _resolve_paging(limit, offset)

    data = _entry().get_attack_data(domain, ctx)

    # O(1) index lookup on every domain (F-PERF-011).
    indices = _domain_indices(ctx, domain)
    mitigation = indices.mitigations.get(mitigation_name.lower()) if indices is not None else None

    if not mitigation:
        raise ToolError(f"Mitigation '{mitigation_name}' not found")

    techniques = list(data.get_techniques_mitigated_by_mitigation(mitigation["id"]))
    page, pagination = _paginate(techniques, limit, offset)

    return {
        "mitigation": EntityRef(id=mitigation.get("id", ""), name=mitigation.get("name", "")),
        "techniques": format_relationship_map(page),
        "pagination": pagination,
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

    # O(1) index lookup on every domain (F-PERF-011).
    indices = _domain_indices(ctx, domain)
    technique = indices.techniques_by_mitre_id.get(technique_id) if indices is not None else None

    if not technique:
        raise ToolError(f"Technique '{technique_id}' not found")

    return {"technique": format_technique(technique, include_description=True)}
