"""Tests for formatting functions."""

import pytest

from mitre_mcp.mitre_mcp_server import format_relationship_map, format_technique


class TestFormatTechnique:
    """Test technique formatting."""

    def test_format_basic(self, sample_technique):
        """Test basic technique formatting."""
        result = format_technique(sample_technique, include_description=False)

        assert result["id"] == "attack-pattern--abc123"
        assert result["name"] == "Process Injection"
        assert result["type"] == "attack-pattern"
        assert result["mitre_id"] == "T1055"
        assert "description" not in result

    def test_format_with_description(self, sample_technique):
        """Test formatting with description."""
        result = format_technique(sample_technique, include_description=True)

        assert "description" in result
        assert result["description"].startswith("Adversaries may inject")
        assert len(result["description"]) <= 500

    def test_description_truncation(self, sample_long_technique):
        """Test description truncation."""
        result = format_technique(sample_long_technique, include_description=True)

        assert "description" in result
        assert len(result["description"]) == 500  # MAX_DESCRIPTION_LENGTH
        assert result["description"].endswith("...")
        # First 497 characters should be 'a', last 3 should be '...'
        assert result["description"][:497] == "a" * 497

    def test_empty_technique(self):
        """Test empty technique."""
        result = format_technique({})

        assert result["id"] == ""
        assert result["name"] == ""
        assert result["type"] == ""
        assert "mitre_id" not in result

    def test_none_technique(self):
        """Test None technique."""
        result = format_technique(None)

        assert result == {}

    def test_technique_without_external_refs(self):
        """Test technique without external references."""
        technique = {
            "id": "test",
            "name": "Test",
            "type": "attack-pattern",
            "external_references": [],
        }

        result = format_technique(technique)

        assert "mitre_id" not in result
        assert result["id"] == "test"

    def test_technique_with_multiple_refs(self):
        """Test technique with multiple external references."""
        technique = {
            "id": "test",
            "name": "Test",
            "type": "attack-pattern",
            "external_references": [
                {"source_name": "other", "external_id": "OTHER-1"},
                {"source_name": "mitre-attack", "external_id": "T9999"},
                {"source_name": "capec", "external_id": "CAPEC-1"},
            ],
        }

        result = format_technique(technique)

        # Should use first mitre-attack reference
        assert result["mitre_id"] == "T9999"


class TestFormatRelationshipMap:
    """Test relationship map formatting."""

    def test_format_relationships(self, sample_technique):
        """Test formatting relationship map."""
        relationship_map = [
            {"object": sample_technique},
            {"object": {**sample_technique, "id": "test2"}},
        ]

        result = format_relationship_map(relationship_map)

        assert len(result) == 2
        assert result[0]["mitre_id"] == "T1055"
        assert result[1]["id"] == "test2"

    def test_limit_relationships(self, sample_technique):
        """Test limiting relationships."""
        relationship_map = [
            {"object": sample_technique},
            {"object": {**sample_technique, "id": "test2"}},
            {"object": {**sample_technique, "id": "test3"}},
        ]

        result = format_relationship_map(relationship_map, limit=2)

        assert len(result) == 2

    def test_empty_relationships(self):
        """Test empty relationship map."""
        result = format_relationship_map([])

        assert result == []

    def test_none_relationships(self):
        """Test None relationship map."""
        result = format_relationship_map(None)

        assert result == []

    def test_relationships_with_description(self, sample_technique):
        """Test relationships with descriptions."""
        relationship_map = [{"object": sample_technique}]

        result = format_relationship_map(relationship_map, include_description=True)

        assert len(result) == 1
        assert "description" in result[0]

    def test_relationships_with_empty_objects(self):
        """Test relationships with empty objects."""
        relationship_map = [{"object": {}}, {"object": None}, {"object": {"id": "test"}}]

        result = format_relationship_map(relationship_map)

        # Should handle gracefully
        assert isinstance(result, list)
