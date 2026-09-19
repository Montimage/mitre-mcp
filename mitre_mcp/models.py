"""Tool result models and token-optimized output formatting.

The TypedDicts give each tool a real outputSchema with named properties;
tools keep returning plain dicts, so the unstructured content payload is
unchanged while structuredContent is validated against these. The
``format_*`` helpers shape STIX objects into those models.
"""

from typing import Any

from typing_extensions import TypedDict

from .config import Config


# Tool result models.
class FormattedTechnique(TypedDict, total=False):
    """Token-optimized technique object emitted by format_technique."""

    id: str
    name: str
    type: str
    mitre_id: str
    description: str


class Pagination(TypedDict):
    """Pagination metadata returned alongside paged list results."""

    total: int
    offset: int
    limit: int
    has_more: bool


# Tool option models — internal call signatures, never wire payloads.
class GetTechniquesOptions(TypedDict):
    """get_techniques inputs packed for the internal implementation.

    F-CLEAN-007: the public tool keeps its per-parameter signature (the
    published inputSchema is generated from it); the implementation takes
    this single options object instead of seven parameters.
    """

    domain: str
    include_subtechniques: bool
    remove_revoked_deprecated: bool
    include_descriptions: bool
    limit: int | None
    offset: int


class TacticResult(TypedDict):
    """Single tactic entry in get_tactics results."""

    id: str
    name: str
    shortname: str
    description: str


class GroupResult(TypedDict):
    """Single group entry in get_groups results."""

    id: str
    name: str
    description: str
    aliases: list[str]


class SoftwareResult(TypedDict):
    """Single software entry in get_software results."""

    id: str
    name: str
    type: str
    description: str


class MitigationResult(TypedDict):
    """Single mitigation entry in get_mitigations results."""

    id: str
    name: str
    description: str


class EntityRef(TypedDict):
    """Minimal id/name reference to a group or mitigation."""

    id: str
    name: str


class TechniquesPageResult(TypedDict):
    """get_techniques result: paged technique list plus pagination metadata."""

    techniques: list[FormattedTechnique]
    pagination: Pagination


class TacticsResult(TypedDict):
    """get_tactics result."""

    tactics: list[TacticResult]
    pagination: Pagination


class GroupsResult(TypedDict):
    """get_groups result."""

    groups: list[GroupResult]
    pagination: Pagination


class SoftwareListResult(TypedDict):
    """get_software result."""

    software: list[SoftwareResult]
    pagination: Pagination


class TechniquesListResult(TypedDict):
    """Result for tools returning a flat formatted technique list."""

    techniques: list[FormattedTechnique]
    pagination: Pagination


class GroupTechniquesResult(TypedDict):
    """get_techniques_used_by_group result."""

    group: EntityRef
    techniques: list[FormattedTechnique]
    pagination: Pagination


class MitigationsResult(TypedDict):
    """get_mitigations result."""

    mitigations: list[MitigationResult]
    pagination: Pagination


class MitigationTechniquesResult(TypedDict):
    """get_techniques_mitigated_by_mitigation result."""

    mitigation: EntityRef
    techniques: list[FormattedTechnique]
    pagination: Pagination


class TechniqueResult(TypedDict):
    """get_technique_by_id result."""

    technique: FormattedTechnique


def truncate_description(description: str) -> str:
    """Truncate a description to Config.MAX_DESCRIPTION_LENGTH.

    Same rule format_technique has always applied: a value longer than the
    cap is cut at cap-3 and suffixed with "...".
    """
    if len(description) > Config.MAX_DESCRIPTION_LENGTH:
        return description[: Config.MAX_DESCRIPTION_LENGTH - 3] + "..."
    return description


def format_technique(
    technique: dict[str, Any], include_description: bool = False
) -> FormattedTechnique:
    """Format a technique object for output with token optimization."""
    if technique is None:
        return {}

    # Start with minimal information
    result: FormattedTechnique = {
        "id": technique.get("id", ""),
        "name": technique.get("name", ""),
        "type": technique.get("type", ""),
    }

    # Only include description if explicitly requested
    if include_description:
        result["description"] = truncate_description(technique.get("description", ""))

    # Add MITRE ATT&CK ID if available
    for ref in technique.get("external_references", []):
        if ref.get("source_name") == "mitre-attack":
            result["mitre_id"] = ref.get("external_id", "")
            break

    return result


def format_relationship_map(
    relationship_map: list[dict[str, Any]],
    include_description: bool = False,
) -> list[FormattedTechnique]:
    """Format a relationship map for output with token optimization."""
    if not relationship_map:
        return []

    result: list[FormattedTechnique] = []
    for item in relationship_map:
        obj = item.get("object", {})
        formatted_obj = format_technique(obj, include_description=include_description)
        if formatted_obj:
            result.append(formatted_obj)

    return result
