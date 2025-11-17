"""Input validation for MITRE MCP Server."""

import re


class ValidationError(ValueError):
    """Raised when input validation fails."""

    pass


def validate_technique_id(technique_id: str) -> str:
    """
    Validate MITRE ATT&CK technique ID format.

    Args:
        technique_id: Technique ID (e.g., 'T1055' or 'T1055.001')

    Returns:
        Normalized technique ID

    Raises:
        ValidationError: If ID format is invalid
    """
    if not technique_id:
        raise ValidationError("Technique ID cannot be empty")

    if len(technique_id) > 10:
        raise ValidationError(f"Technique ID too long: {len(technique_id)} chars (max 10)")

    # Match T#### or T####.###
    pattern = r"^T\d{4}(\.\d{3})?$"
    if not re.match(pattern, technique_id.upper()):
        raise ValidationError(
            f"Invalid technique ID format: '{technique_id}'. " "Expected format: T#### or T####.###"
        )

    return technique_id.upper()


def validate_name(name: str, field_name: str = "name", max_length: int = 100) -> str:
    """
    Validate entity name (group, mitigation, etc.).

    Args:
        name: Name to validate
        field_name: Field name for error messages
        max_length: Maximum allowed length

    Returns:
        Stripped name

    Raises:
        ValidationError: If name is invalid
    """
    if not name:
        raise ValidationError(f"{field_name} cannot be empty")

    name = name.strip()

    if not name:
        raise ValidationError(f"{field_name} cannot be empty")

    if len(name) > max_length:
        raise ValidationError(f"{field_name} too long: {len(name)} chars (max {max_length})")

    # Check for suspicious characters that might indicate injection attempts
    suspicious_chars = ["\x00", "\n", "\r", "\t"]
    if any(char in name for char in suspicious_chars):
        raise ValidationError(f"{field_name} contains invalid characters")

    return name


def validate_domain(domain: str) -> str:
    """
    Validate MITRE ATT&CK domain.

    Args:
        domain: Domain name

    Returns:
        Validated domain

    Raises:
        ValidationError: If domain is invalid
    """
    valid_domains = {"enterprise-attack", "mobile-attack", "ics-attack"}

    if domain not in valid_domains:
        raise ValidationError(
            f"Invalid domain: '{domain}'. " f"Valid domains: {', '.join(sorted(valid_domains))}"
        )

    return domain


def validate_limit(limit: int, max_limit: int = 1000) -> int:
    """
    Validate pagination limit.

    Args:
        limit: Requested limit
        max_limit: Maximum allowed limit

    Returns:
        Validated limit

    Raises:
        ValidationError: If limit is invalid
    """
    if limit < 1:
        raise ValidationError(f"Limit must be positive, got: {limit}")

    if limit > max_limit:
        raise ValidationError(f"Limit too large: {limit} (max {max_limit})")

    return limit


def validate_offset(offset: int) -> int:
    """
    Validate pagination offset.

    Args:
        offset: Requested offset

    Returns:
        Validated offset

    Raises:
        ValidationError: If offset is invalid
    """
    if offset < 0:
        raise ValidationError(f"Offset must be non-negative, got: {offset}")

    return offset
