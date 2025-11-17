"""Tests for input validation."""

import pytest

from mitre_mcp.validators import (
    ValidationError,
    validate_domain,
    validate_limit,
    validate_name,
    validate_offset,
    validate_technique_id,
)


class TestTechniqueIDValidation:
    """Test technique ID validation."""

    def test_valid_technique_id(self):
        """Test valid technique IDs."""
        assert validate_technique_id("T1055") == "T1055"
        assert validate_technique_id("t1055") == "T1055"  # Case insensitive
        assert validate_technique_id("T1055.001") == "T1055.001"
        assert validate_technique_id("t1234.567") == "T1234.567"

    def test_invalid_format_no_t(self):
        """Test technique ID without T prefix."""
        with pytest.raises(ValidationError, match="Invalid technique ID format"):
            validate_technique_id("1055")

    def test_invalid_format_too_short(self):
        """Test technique ID with too few digits."""
        with pytest.raises(ValidationError, match="Invalid technique ID format"):
            validate_technique_id("T55")

    def test_invalid_format_subtechnique(self):
        """Test technique ID with wrong sub-technique format."""
        with pytest.raises(ValidationError, match="Invalid technique ID format"):
            validate_technique_id("T1055.1")  # Sub-technique must be 3 digits

    def test_empty_id(self):
        """Test empty technique ID."""
        with pytest.raises(ValidationError, match="cannot be empty"):
            validate_technique_id("")

    def test_too_long(self):
        """Test technique ID too long."""
        with pytest.raises(ValidationError, match="too long"):
            validate_technique_id("T" + "1" * 100)

    def test_invalid_characters(self):
        """Test technique ID with invalid characters."""
        with pytest.raises(ValidationError, match="Invalid technique ID format"):
            validate_technique_id("T1055.ABC")


class TestNameValidation:
    """Test name validation."""

    def test_valid_name(self):
        """Test valid names."""
        assert validate_name("APT28") == "APT28"
        assert validate_name("  APT28  ") == "APT28"  # Strips whitespace
        assert validate_name("Application Isolation") == "Application Isolation"

    def test_empty_name(self):
        """Test empty names."""
        with pytest.raises(ValidationError, match="cannot be empty"):
            validate_name("")

        with pytest.raises(ValidationError, match="cannot be empty"):
            validate_name("   ")  # Whitespace only

    def test_too_long(self):
        """Test names that are too long."""
        with pytest.raises(ValidationError, match="too long"):
            validate_name("a" * 101)

    def test_custom_max_length(self):
        """Test custom max length."""
        with pytest.raises(ValidationError, match="too long"):
            validate_name("test name", max_length=5)

    def test_suspicious_characters_null(self):
        """Test names with null character."""
        with pytest.raises(ValidationError, match="invalid characters"):
            validate_name("APT28\x00")

    def test_suspicious_characters_newline(self):
        """Test names with newline."""
        with pytest.raises(ValidationError, match="invalid characters"):
            validate_name("APT28\nmalicious")

    def test_suspicious_characters_tab(self):
        """Test names with tab."""
        with pytest.raises(ValidationError, match="invalid characters"):
            validate_name("APT28\tmalicious")

    def test_custom_field_name(self):
        """Test custom field name in error message."""
        with pytest.raises(ValidationError, match="group_name cannot be empty"):
            validate_name("", field_name="group_name")


class TestDomainValidation:
    """Test domain validation."""

    def test_valid_domains(self):
        """Test valid domains."""
        assert validate_domain("enterprise-attack") == "enterprise-attack"
        assert validate_domain("mobile-attack") == "mobile-attack"
        assert validate_domain("ics-attack") == "ics-attack"

    def test_invalid_domain(self):
        """Test invalid domain."""
        with pytest.raises(ValidationError, match="Invalid domain"):
            validate_domain("invalid-attack")

        with pytest.raises(ValidationError, match="Invalid domain"):
            validate_domain("enterprise")

        with pytest.raises(ValidationError, match="Invalid domain"):
            validate_domain("")

    def test_error_message_shows_valid_options(self):
        """Test error message includes valid domains."""
        with pytest.raises(ValidationError, match="enterprise-attack, ics-attack, mobile-attack"):
            validate_domain("bad-domain")


class TestLimitValidation:
    """Test limit validation."""

    def test_valid_limits(self):
        """Test valid limits."""
        assert validate_limit(1) == 1
        assert validate_limit(100) == 100
        assert validate_limit(1000) == 1000

    def test_negative_limit(self):
        """Test negative limit."""
        with pytest.raises(ValidationError, match="must be positive"):
            validate_limit(0)

        with pytest.raises(ValidationError, match="must be positive"):
            validate_limit(-1)

    def test_too_large(self):
        """Test limit too large."""
        with pytest.raises(ValidationError, match="too large"):
            validate_limit(10000)

    def test_custom_max_limit(self):
        """Test custom max limit."""
        with pytest.raises(ValidationError, match="too large"):
            validate_limit(101, max_limit=100)

        assert validate_limit(50, max_limit=100) == 50


class TestOffsetValidation:
    """Test offset validation."""

    def test_valid_offsets(self):
        """Test valid offsets."""
        assert validate_offset(0) == 0
        assert validate_offset(100) == 100
        assert validate_offset(1000) == 1000

    def test_negative_offset(self):
        """Test negative offset."""
        with pytest.raises(ValidationError, match="must be non-negative"):
            validate_offset(-1)

        with pytest.raises(ValidationError, match="must be non-negative"):
            validate_offset(-100)
