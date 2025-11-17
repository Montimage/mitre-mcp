"""Tests for MCP tools."""

import pytest

from mitre_mcp.mitre_mcp_server import (
    get_groups,
    get_mitigations,
    get_software,
    get_tactics,
    get_technique_by_id,
    get_techniques,
    get_techniques_by_tactic,
    get_techniques_mitigated_by_mitigation,
    get_techniques_used_by_group,
)


class TestGetTechniques:
    """Test get_techniques tool."""

    def test_get_techniques_basic(self, mock_context):
        """Test basic technique retrieval."""
        result = get_techniques(mock_context, domain="enterprise-attack", limit=20, offset=0)

        assert "techniques" in result
        assert "pagination" in result
        assert isinstance(result["techniques"], list)

    def test_pagination_metadata(self, mock_context):
        """Test pagination metadata."""
        result = get_techniques(mock_context, domain="enterprise-attack", limit=10, offset=0)

        pagination = result["pagination"]
        assert pagination["limit"] == 10
        assert pagination["offset"] == 0
        assert "total" in pagination
        assert "has_more" in pagination
        assert isinstance(pagination["has_more"], bool)

    def test_invalid_domain(self, mock_context):
        """Test invalid domain."""
        result = get_techniques(mock_context, domain="invalid-attack")

        assert "error" in result
        assert "Invalid domain" in result["error"]

    def test_invalid_limit(self, mock_context):
        """Test invalid limit."""
        result = get_techniques(mock_context, domain="enterprise-attack", limit=0)

        assert "error" in result
        assert "must be positive" in result["error"]

    def test_invalid_offset(self, mock_context):
        """Test invalid offset."""
        result = get_techniques(mock_context, domain="enterprise-attack", offset=-1)

        assert "error" in result
        assert "must be non-negative" in result["error"]

    def test_default_limit(self, mock_context):
        """Test default limit is applied."""
        result = get_techniques(mock_context, domain="enterprise-attack")

        # Default should be 20
        assert result["pagination"]["limit"] == 20


class TestGetTechniqueByID:
    """Test get_technique_by_id tool."""

    def test_valid_id(self, mock_context):
        """Test retrieving technique by valid ID."""
        result = get_technique_by_id(mock_context, "T1055")

        assert "technique" in result
        assert result["technique"]["mitre_id"] == "T1055"

    def test_case_insensitive(self, mock_context):
        """Test case insensitive technique ID."""
        result = get_technique_by_id(mock_context, "t1055")

        # Should be normalized to uppercase
        assert "technique" in result

    def test_invalid_format(self, mock_context):
        """Test invalid technique ID format."""
        result = get_technique_by_id(mock_context, "invalid")

        assert "error" in result
        assert "Invalid technique ID format" in result["error"]

    def test_not_found(self, mock_context):
        """Test technique not found."""
        result = get_technique_by_id(mock_context, "T9999")

        assert "error" in result
        assert "not found" in result["error"]

    def test_invalid_domain(self, mock_context):
        """Test invalid domain."""
        result = get_technique_by_id(mock_context, "T1055", domain="bad")

        assert "error" in result
        assert "Invalid domain" in result["error"]


class TestGetTactics:
    """Test get_tactics tool."""

    def test_get_tactics(self, mock_context):
        """Test retrieving tactics."""
        result = get_tactics(mock_context)

        assert "tactics" in result
        assert isinstance(result["tactics"], list)

    def test_invalid_domain(self, mock_context):
        """Test invalid domain."""
        result = get_tactics(mock_context, domain="invalid")

        assert "error" in result


class TestGetGroups:
    """Test get_groups tool."""

    def test_get_groups(self, mock_context):
        """Test retrieving groups."""
        result = get_groups(mock_context)

        assert "groups" in result
        assert isinstance(result["groups"], list)
        assert len(result["groups"]) > 0

    def test_group_structure(self, mock_context):
        """Test group object structure."""
        result = get_groups(mock_context)

        group = result["groups"][0]
        assert "id" in group
        assert "name" in group
        assert "description" in group
        assert "aliases" in group

    def test_invalid_domain(self, mock_context):
        """Test invalid domain."""
        result = get_groups(mock_context, domain="invalid")

        assert "error" in result


class TestGetSoftware:
    """Test get_software tool."""

    def test_get_software(self, mock_context):
        """Test retrieving software."""
        result = get_software(mock_context)

        assert "software" in result
        assert isinstance(result["software"], list)

    def test_invalid_domain(self, mock_context):
        """Test invalid domain."""
        result = get_software(mock_context, domain="invalid")

        assert "error" in result


class TestGetTechniquesByTactic:
    """Test get_techniques_by_tactic tool."""

    def test_valid_tactic(self, mock_context):
        """Test retrieving techniques by tactic."""
        result = get_techniques_by_tactic(mock_context, tactic_shortname="defense-evasion")

        assert "techniques" in result
        assert isinstance(result["techniques"], list)

    def test_invalid_tactic_name(self, mock_context):
        """Test invalid tactic name (too long)."""
        result = get_techniques_by_tactic(mock_context, tactic_shortname="x" * 100)

        assert "error" in result
        assert "too long" in result["error"]

    def test_invalid_domain(self, mock_context):
        """Test invalid domain."""
        result = get_techniques_by_tactic(
            mock_context, tactic_shortname="defense-evasion", domain="invalid"
        )

        assert "error" in result


class TestGetTechniquesUsedByGroup:
    """Test get_techniques_used_by_group tool."""

    def test_valid_group(self, mock_context):
        """Test retrieving techniques used by group."""
        result = get_techniques_used_by_group(mock_context, group_name="APT28")

        assert "group" in result
        assert "techniques" in result
        assert result["group"]["name"] == "APT28"

    def test_case_insensitive_group_name(self, mock_context):
        """Test case insensitive group name lookup."""
        result = get_techniques_used_by_group(mock_context, group_name="apt28")

        # Should find group (index is lowercase)
        assert "group" in result
        assert result["group"]["name"] == "APT28"

    def test_group_not_found(self, mock_context):
        """Test group not found."""
        # Use mock that doesn't have this group in index
        result = get_techniques_used_by_group(mock_context, group_name="NonexistentGroup")

        assert "error" in result
        assert "not found" in result["error"]

    def test_invalid_group_name(self, mock_context):
        """Test invalid group name."""
        result = get_techniques_used_by_group(mock_context, group_name="")

        assert "error" in result
        assert "cannot be empty" in result["error"]

    def test_invalid_domain(self, mock_context):
        """Test invalid domain."""
        result = get_techniques_used_by_group(mock_context, group_name="APT28", domain="invalid")

        assert "error" in result


class TestGetMitigations:
    """Test get_mitigations tool."""

    def test_get_mitigations(self, mock_context):
        """Test retrieving mitigations."""
        result = get_mitigations(mock_context)

        assert "mitigations" in result
        assert isinstance(result["mitigations"], list)

    def test_mitigation_structure(self, mock_context):
        """Test mitigation object structure."""
        result = get_mitigations(mock_context)

        if result["mitigations"]:
            mitigation = result["mitigations"][0]
            assert "id" in mitigation
            assert "name" in mitigation
            assert "description" in mitigation

    def test_invalid_domain(self, mock_context):
        """Test invalid domain."""
        result = get_mitigations(mock_context, domain="invalid")

        assert "error" in result


class TestGetTechniquesMitigatedByMitigation:
    """Test get_techniques_mitigated_by_mitigation tool."""

    def test_valid_mitigation(self, mock_context):
        """Test retrieving techniques mitigated by mitigation."""
        result = get_techniques_mitigated_by_mitigation(
            mock_context, mitigation_name="Application Isolation and Sandboxing"
        )

        assert "mitigation" in result
        assert "techniques" in result

    def test_case_insensitive_mitigation_name(self, mock_context):
        """Test case insensitive mitigation name lookup."""
        result = get_techniques_mitigated_by_mitigation(
            mock_context, mitigation_name="application isolation and sandboxing"
        )

        # Should find mitigation (index is lowercase)
        assert "mitigation" in result

    def test_mitigation_not_found(self, mock_context):
        """Test mitigation not found."""
        result = get_techniques_mitigated_by_mitigation(
            mock_context, mitigation_name="Nonexistent Mitigation"
        )

        assert "error" in result
        assert "not found" in result["error"]

    def test_invalid_mitigation_name(self, mock_context):
        """Test invalid mitigation name."""
        result = get_techniques_mitigated_by_mitigation(mock_context, mitigation_name="")

        assert "error" in result
        assert "cannot be empty" in result["error"]

    def test_invalid_domain(self, mock_context):
        """Test invalid domain."""
        result = get_techniques_mitigated_by_mitigation(
            mock_context, mitigation_name="Application Isolation and Sandboxing", domain="invalid"
        )

        assert "error" in result
