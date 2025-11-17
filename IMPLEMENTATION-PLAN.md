# MITRE MCP Server - Detailed Implementation Plan

**Version:** 0.1.3 → 0.2.0
**Generated:** 2025-11-17

This document provides detailed implementation steps, code examples, and technical guidance for all improvements identified in the code review.

---

## Table of Contents

1. [Phase 1: Critical Security Fixes](#phase-1-critical-security-fixes)
2. [Phase 2: Performance Optimizations](#phase-2-performance-optimizations)
3. [Phase 3: Code Quality Improvements](#phase-3-code-quality-improvements)
4. [Phase 4: DevOps & CI/CD](#phase-4-devops--cicd)
5. [Phase 5: Advanced Enhancements](#phase-5-advanced-enhancements)

---

## Phase 1: Critical Security Fixes

### Task 1.1: Add Timeout to HTTP Requests

**File:** `mitre_mcp_server.py:88`
**Severity:** HIGH (CWE-400)
**Effort:** 5 minutes

#### Current Code (Line 88):
```python
response = requests.get(url)
```

#### Fixed Code:
```python
DOWNLOAD_TIMEOUT_SECONDS = 30  # Add at top of file

# In download function
response = requests.get(url, timeout=DOWNLOAD_TIMEOUT_SECONDS, verify=True)
```

#### Error Handling:
```python
import requests
from requests.exceptions import Timeout, RequestException

try:
    response = requests.get(url, timeout=DOWNLOAD_TIMEOUT_SECONDS, verify=True)
    response.raise_for_status()
except Timeout:
    logger.error(f"Timeout downloading {domain} data from {url}")
    raise
except RequestException as e:
    logger.error(f"Failed to download {domain} data: {e}")
    raise
```

---

### Task 1.2: Implement Input Validation

**Files:** `mitre_mcp_server.py:391, 462, 502`
**Severity:** MEDIUM (CWE-20)
**Effort:** 2 hours

#### Create Validation Module:

**New File:** `mitre_mcp/validators.py`

```python
"""Input validation for MITRE MCP Server."""
import re
from typing import Optional


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
    pattern = r'^T\d{4}(\.\d{3})?$'
    if not re.match(pattern, technique_id.upper()):
        raise ValidationError(
            f"Invalid technique ID format: '{technique_id}'. "
            "Expected format: T#### or T####.###"
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

    if len(name) > max_length:
        raise ValidationError(
            f"{field_name} too long: {len(name)} chars (max {max_length})"
        )

    # Check for suspicious characters that might indicate injection attempts
    suspicious_chars = ['\x00', '\n', '\r', '\t']
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
            f"Invalid domain: '{domain}'. "
            f"Valid domains: {', '.join(sorted(valid_domains))}"
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
```

#### Update Tool Functions:

**In `mitre_mcp_server.py`:**

```python
from .validators import (
    validate_technique_id,
    validate_name,
    validate_domain,
    validate_limit,
    validate_offset,
    ValidationError
)

# Update get_technique_by_id (line ~500)
@mcp.tool()
def get_technique_by_id(
    ctx: Context,
    technique_id: str,
    domain: str = "enterprise-attack"
) -> Dict[str, Any]:
    """Get a technique by its MITRE ATT&CK ID."""
    try:
        # Validate inputs
        technique_id = validate_technique_id(technique_id)
        domain = validate_domain(domain)
    except ValidationError as e:
        return {"error": str(e)}

    data = get_attack_data(domain, ctx)

    # ... rest of function


# Update get_techniques_used_by_group (line ~388)
@mcp.tool()
def get_techniques_used_by_group(
    ctx: Context,
    group_name: str,
    domain: str = "enterprise-attack"
) -> Dict[str, Any]:
    """Get techniques used by a group."""
    try:
        group_name = validate_name(group_name, "group_name")
        domain = validate_domain(domain)
    except ValidationError as e:
        return {"error": str(e)}

    # ... rest of function


# Update get_techniques (line ~204)
@mcp.tool()
def get_techniques(
    ctx: Context,
    domain: str = "enterprise-attack",
    include_subtechniques: bool = True,
    remove_revoked_deprecated: bool = False,
    include_descriptions: bool = False,
    limit: int = 20,
    offset: int = 0
) -> Dict[str, Any]:
    """Get techniques from the MITRE ATT&CK framework."""
    try:
        domain = validate_domain(domain)
        limit = validate_limit(limit)
        offset = validate_offset(offset)
    except ValidationError as e:
        return {"error": str(e)}

    # ... rest of function
```

---

### Task 1.3: Add Explicit SSL/TLS Verification

**File:** `mitre_mcp_server.py:88`
**Severity:** LOW-MEDIUM (CWE-295)
**Effort:** 5 minutes

#### Implementation:
```python
# Add to all requests.get() calls
response = requests.get(url, timeout=DOWNLOAD_TIMEOUT_SECONDS, verify=True)

# Optional: Add custom CA bundle support
import os

CA_BUNDLE = os.environ.get('MITRE_MCP_CA_BUNDLE', True)  # Path or True
response = requests.get(url, timeout=DOWNLOAD_TIMEOUT_SECONDS, verify=CA_BUNDLE)
```

---

### Task 1.4: Add Disk Space Check

**File:** `mitre_mcp_server.py:84-91`
**Severity:** MEDIUM (CWE-400)
**Effort:** 1 hour

#### Implementation:

```python
import shutil
from pathlib import Path

# Add constants at top
REQUIRED_DISK_SPACE_MB = 200  # 200 MB required
BYTES_PER_MB = 1024 * 1024

def check_disk_space(directory: str, required_mb: int = REQUIRED_DISK_SPACE_MB) -> None:
    """
    Check if sufficient disk space is available.

    Args:
        directory: Directory to check
        required_mb: Required space in megabytes

    Raises:
        RuntimeError: If insufficient space
    """
    try:
        usage = shutil.disk_usage(directory)
        required_bytes = required_mb * BYTES_PER_MB
        available_mb = usage.free / BYTES_PER_MB

        if usage.free < required_bytes:
            raise RuntimeError(
                f"Insufficient disk space in {directory}. "
                f"Required: {required_mb}MB, Available: {available_mb:.1f}MB"
            )

        logger.info(
            f"Disk space check passed: {available_mb:.1f}MB available "
            f"({required_mb}MB required)"
        )
    except Exception as e:
        logger.warning(f"Could not check disk space: {e}")
        # Don't fail if we can't check, but warn


# In download_and_save_attack_data():
def download_and_save_attack_data(data_dir: str, force: bool = False) -> dict:
    """Download and save MITRE ATT&CK data."""

    # Check disk space before downloading
    check_disk_space(data_dir)

    # ... rest of function
```

---

### Task 1.5: Implement JSON Content Validation

**File:** `mitre_mcp_server.py:71-72`
**Severity:** MEDIUM (CWE-502)
**Effort:** 1 hour

#### Implementation:

```python
from typing import TypedDict, List
import json

class Metadata(TypedDict):
    """Type definition for metadata.json."""
    last_update: str
    domains: List[str]


def validate_metadata(metadata: dict) -> Metadata:
    """
    Validate metadata structure.

    Args:
        metadata: Parsed metadata dictionary

    Returns:
        Validated metadata

    Raises:
        ValueError: If metadata is invalid
    """
    if not isinstance(metadata, dict):
        raise ValueError(f"Metadata must be dict, got {type(metadata)}")

    if "last_update" not in metadata:
        raise ValueError("Metadata missing 'last_update' field")

    if "domains" not in metadata:
        raise ValueError("Metadata missing 'domains' field")

    if not isinstance(metadata["domains"], list):
        raise ValueError("Metadata 'domains' must be list")

    # Validate last_update is ISO format
    try:
        datetime.fromisoformat(metadata["last_update"])
    except ValueError as e:
        raise ValueError(f"Invalid last_update format: {e}")

    return metadata  # type: ignore


def load_metadata(metadata_path: str) -> Optional[Metadata]:
    """
    Safely load and validate metadata.

    Args:
        metadata_path: Path to metadata.json

    Returns:
        Validated metadata or None if invalid
    """
    try:
        with open(metadata_path, 'r', encoding='utf-8') as f:
            # Limit file size to prevent memory exhaustion
            # Read max 1MB for metadata file
            content = f.read(1024 * 1024)
            metadata = json.loads(content)
            return validate_metadata(metadata)
    except (json.JSONDecodeError, ValueError, FileNotFoundError) as e:
        logger.warning(f"Invalid or missing metadata file: {e}")
        return None


# Update download_and_save_attack_data():
def download_and_save_attack_data(data_dir: str, force: bool = False) -> dict:
    """Download and save MITRE ATT&CK data."""
    # ...

    if not need_download:
        metadata = load_metadata(paths["metadata"])
        if metadata is None:
            need_download = True
        else:
            last_update = datetime.fromisoformat(metadata["last_update"])
            now = datetime.now(timezone.utc)
            if (now - last_update).days >= CACHE_EXPIRY_DAYS:
                need_download = True
                logger.info(
                    f"MITRE ATT&CK data is {(now - last_update).days} days old. "
                    "Downloading new data..."
                )
            else:
                logger.info(f"Using cached MITRE ATT&CK data from {last_update.isoformat()}")

    # ... rest of function
```

#### Validate Downloaded JSON:

```python
def validate_stix_bundle(content: str, domain: str) -> dict:
    """
    Validate STIX bundle structure.

    Args:
        content: JSON content
        domain: Domain name for logging

    Returns:
        Parsed JSON

    Raises:
        ValueError: If bundle is invalid
    """
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON for {domain}: {e}")

    if not isinstance(data, dict):
        raise ValueError(f"{domain} data must be dict, got {type(data)}")

    if "type" not in data or data["type"] != "bundle":
        raise ValueError(f"{domain} data missing 'type: bundle'")

    if "objects" not in data or not isinstance(data["objects"], list):
        raise ValueError(f"{domain} data missing 'objects' array")

    logger.info(f"Validated {domain} STIX bundle: {len(data['objects'])} objects")
    return data


# In download loop:
for domain, url in urls.items():
    logger.info(f"Downloading {domain.capitalize()} ATT&CK data...")
    response = requests.get(url, timeout=DOWNLOAD_TIMEOUT_SECONDS, verify=True)
    response.raise_for_status()

    # Validate before saving
    validated_data = validate_stix_bundle(response.text, domain)

    with open(paths[domain], 'w', encoding='utf-8') as f:
        json.dump(validated_data, f, indent=2)
```

---

### Task 1.6: Fix Timezone-Naive Datetime

**Files:** `mitre_mcp_server.py:74, 95`
**Severity:** LOW (CWE-367)
**Effort:** 30 minutes

#### Implementation:

```python
from datetime import datetime, timezone

# Replace all datetime.now() with:
now = datetime.now(timezone.utc)

# Replace datetime.fromisoformat() with:
from datetime import datetime, timezone

def parse_timestamp(timestamp_str: str) -> datetime:
    """
    Parse ISO timestamp string to timezone-aware datetime.

    Args:
        timestamp_str: ISO format timestamp

    Returns:
        Timezone-aware datetime
    """
    dt = datetime.fromisoformat(timestamp_str)
    # If naive, assume UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


# In metadata comparison:
metadata = load_metadata(paths["metadata"])
if metadata:
    last_update = parse_timestamp(metadata["last_update"])
    now = datetime.now(timezone.utc)
    age_days = (now - last_update).days

    if age_days >= CACHE_EXPIRY_DAYS:
        need_download = True
        logger.info(f"Cache expired: {age_days} days old (max {CACHE_EXPIRY_DAYS})")


# When saving metadata:
metadata = {
    "last_update": datetime.now(timezone.utc).isoformat(),
    "domains": list(urls.keys())
}
```

---

### Task 1.7: Move Hardcoded URLs to Configuration

**File:** `mitre_mcp_server.py:50-54`
**Severity:** LOW (CWE-1188)
**Effort:** 1 hour

#### Create Configuration Module:

**New File:** `mitre_mcp/config.py`

```python
"""Configuration for MITRE MCP Server."""
import os
from typing import Dict
from pathlib import Path


class Config:
    """Configuration management for MITRE MCP Server."""

    # Data source URLs
    ENTERPRISE_ATTACK_URL = os.getenv(
        "MITRE_ENTERPRISE_URL",
        "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json"
    )

    MOBILE_ATTACK_URL = os.getenv(
        "MITRE_MOBILE_URL",
        "https://raw.githubusercontent.com/mitre/cti/master/mobile-attack/mobile-attack.json"
    )

    ICS_ATTACK_URL = os.getenv(
        "MITRE_ICS_URL",
        "https://raw.githubusercontent.com/mitre/cti/master/ics-attack/ics-attack.json"
    )

    # Timeouts and limits
    DOWNLOAD_TIMEOUT_SECONDS = int(os.getenv("MITRE_DOWNLOAD_TIMEOUT", "30"))
    CACHE_EXPIRY_DAYS = int(os.getenv("MITRE_CACHE_EXPIRY_DAYS", "1"))
    REQUIRED_DISK_SPACE_MB = int(os.getenv("MITRE_REQUIRED_SPACE_MB", "200"))

    # Pagination
    DEFAULT_PAGE_SIZE = int(os.getenv("MITRE_DEFAULT_PAGE_SIZE", "20"))
    MAX_PAGE_SIZE = int(os.getenv("MITRE_MAX_PAGE_SIZE", "1000"))

    # Formatting
    MAX_DESCRIPTION_LENGTH = int(os.getenv("MITRE_MAX_DESC_LENGTH", "500"))

    # Data directory
    DATA_DIR = os.getenv("MITRE_DATA_DIR", None)  # None = auto

    @classmethod
    def get_data_urls(cls) -> Dict[str, str]:
        """Get all data source URLs."""
        return {
            "enterprise": cls.ENTERPRISE_ATTACK_URL,
            "mobile": cls.MOBILE_ATTACK_URL,
            "ics": cls.ICS_ATTACK_URL
        }

    @classmethod
    def get_data_dir(cls) -> str:
        """Get data directory path."""
        if cls.DATA_DIR:
            return cls.DATA_DIR

        # Default: relative to package
        return os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "data"
        )

    @classmethod
    def validate(cls) -> None:
        """Validate configuration."""
        if cls.DOWNLOAD_TIMEOUT_SECONDS < 1:
            raise ValueError("DOWNLOAD_TIMEOUT_SECONDS must be positive")

        if cls.CACHE_EXPIRY_DAYS < 0:
            raise ValueError("CACHE_EXPIRY_DAYS must be non-negative")

        if cls.DEFAULT_PAGE_SIZE < 1 or cls.DEFAULT_PAGE_SIZE > cls.MAX_PAGE_SIZE:
            raise ValueError(
                f"DEFAULT_PAGE_SIZE must be between 1 and {cls.MAX_PAGE_SIZE}"
            )


# Validate on import
Config.validate()
```

#### Update main server file:

```python
from .config import Config

# Replace hardcoded URLs:
urls = Config.get_data_urls()

# Replace magic numbers:
MAX_DESCRIPTION_LENGTH = Config.MAX_DESCRIPTION_LENGTH
DEFAULT_PAGE_SIZE = Config.DEFAULT_PAGE_SIZE
DOWNLOAD_TIMEOUT_SECONDS = Config.DOWNLOAD_TIMEOUT_SECONDS
```

---

## Phase 2: Performance Optimizations

### Task 2.1: Build Lookup Indices

**File:** `mitre_mcp_server.py:23-29`
**Severity:** HIGH
**Effort:** 2 hours

#### Update AttackContext:

```python
from typing import Dict, Optional

@dataclass
class AttackContext:
    """Context for the MITRE ATT&CK MCP server with optimized lookups."""
    enterprise_attack: MitreAttackData
    mobile_attack: MitreAttackData
    ics_attack: MitreAttackData

    # Lookup indices
    groups_index: Dict[str, Dict[str, Any]]
    mitigations_index: Dict[str, Dict[str, Any]]
    techniques_index: Dict[str, Dict[str, Any]]
    techniques_by_mitre_id: Dict[str, Dict[str, Any]]


def build_group_index(data: MitreAttackData) -> Dict[str, Dict[str, Any]]:
    """
    Build case-insensitive group name index.

    Args:
        data: MITRE ATT&CK data

    Returns:
        Dictionary mapping lowercase names to group objects
    """
    index = {}
    groups = data.get_groups()

    for group in groups:
        name = group.get("name", "").lower()
        if name:
            index[name] = group

        # Also index aliases
        for alias in group.get("aliases", []):
            alias_lower = alias.lower()
            if alias_lower not in index:  # Don't overwrite primary names
                index[alias_lower] = group

    logger.info(f"Built group index: {len(index)} entries for {len(groups)} groups")
    return index


def build_mitigation_index(data: MitreAttackData) -> Dict[str, Dict[str, Any]]:
    """Build case-insensitive mitigation name index."""
    index = {}
    mitigations = data.get_mitigations()

    for mitigation in mitigations:
        name = mitigation.get("name", "").lower()
        if name:
            index[name] = mitigation

    logger.info(
        f"Built mitigation index: {len(index)} entries for {len(mitigations)} mitigations"
    )
    return index


def build_technique_index(data: MitreAttackData) -> Dict[str, Dict[str, Any]]:
    """Build MITRE ID to technique index."""
    by_id = {}
    techniques = data.get_techniques()

    for technique in techniques:
        # Index by MITRE ATT&CK ID
        for ref in technique.get("external_references", []):
            if ref.get("source_name") == "mitre-attack":
                mitre_id = ref.get("external_id", "")
                if mitre_id:
                    by_id[mitre_id] = technique
                    break

    logger.info(
        f"Built technique index: {len(by_id)} entries for {len(techniques)} techniques"
    )
    return by_id


@asynccontextmanager
async def attack_lifespan(server: FastMCP) -> AsyncIterator[AttackContext]:
    """Initialize and manage MITRE ATT&CK data with indices."""
    data_dir = Config.get_data_dir()
    os.makedirs(data_dir, exist_ok=True)
    logger.info(f"Using data directory: {data_dir}")

    try:
        import sys
        force_download = "--force-download" in sys.argv

        paths = download_and_save_attack_data(data_dir, force=force_download)

        logger.info("Initializing MITRE ATT&CK data...")
        enterprise_attack = MitreAttackData(paths["enterprise"])
        mobile_attack = MitreAttackData(paths["mobile"])
        ics_attack = MitreAttackData(paths["ics"])
        logger.info("MITRE ATT&CK data initialized successfully.")

        # Build indices
        logger.info("Building lookup indices...")

        # For enterprise domain (most commonly used)
        groups_index = build_group_index(enterprise_attack)
        mitigations_index = build_mitigation_index(enterprise_attack)
        techniques_index = build_technique_index(enterprise_attack)

        logger.info("Lookup indices built successfully.")

        yield AttackContext(
            enterprise_attack=enterprise_attack,
            mobile_attack=mobile_attack,
            ics_attack=ics_attack,
            groups_index=groups_index,
            mitigations_index=mitigations_index,
            techniques_by_mitre_id=techniques_index
        )
    finally:
        pass
```

#### Update tool functions to use indices:

```python
@mcp.tool()
def get_techniques_used_by_group(
    ctx: Context,
    group_name: str,
    domain: str = "enterprise-attack"
) -> Dict[str, Any]:
    """Get techniques used by a group."""
    try:
        group_name = validate_name(group_name, "group_name")
        domain = validate_domain(domain)
    except ValidationError as e:
        return {"error": str(e)}

    data = get_attack_data(domain, ctx)

    # Use index for O(1) lookup (enterprise domain only for now)
    if domain == "enterprise-attack":
        group = ctx.request_context.lifespan_context.groups_index.get(
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
        return {"error": f"Group '{group_name}' not found"}

    techniques = data.get_techniques_used_by_group(group["id"])

    return {
        "group": {
            "id": group.get("id", ""),
            "name": group.get("name", "")
        },
        "techniques": format_relationship_map(techniques)
    }


@mcp.tool()
def get_technique_by_id(
    ctx: Context,
    technique_id: str,
    domain: str = "enterprise-attack"
) -> Dict[str, Any]:
    """Get a technique by its MITRE ATT&CK ID."""
    try:
        technique_id = validate_technique_id(technique_id)
        domain = validate_domain(domain)
    except ValidationError as e:
        return {"error": str(e)}

    # Use index for O(1) lookup (enterprise domain)
    if domain == "enterprise-attack":
        technique = ctx.request_context.lifespan_context.techniques_by_mitre_id.get(
            technique_id
        )
    else:
        # Fallback to linear search
        data = get_attack_data(domain, ctx)
        techniques = data.get_techniques()
        technique = None
        for t in techniques:
            for ref in t.get("external_references", []):
                if (ref.get("source_name") == "mitre-attack" and
                    ref.get("external_id") == technique_id):
                    technique = t
                    break
            if technique:
                break

    if not technique:
        return {"error": f"Technique '{technique_id}' not found"}

    return {
        "technique": format_technique(technique, include_description=True)
    }
```

---

### Task 2.2: Convert to Async I/O

**File:** `mitre_mcp_server.py:39-103`
**Severity:** MEDIUM
**Effort:** 4 hours

#### Update requirements.txt:

```
mitreattack-python>=4.0.2,<5.0.0
mcp[cli]>=0.1.0,<1.0.0
httpx>=0.24.0,<1.0.0
aiofiles>=23.0.0,<24.0.0
```

#### Async download function:

```python
import httpx
import aiofiles
import asyncio
from typing import Dict

async def download_and_save_attack_data_async(
    data_dir: str,
    force: bool = False
) -> Dict[str, str]:
    """
    Download and save MITRE ATT&CK data asynchronously.

    Args:
        data_dir: Directory to save the data
        force: Force download even if data is recent

    Returns:
        Dictionary with paths to the downloaded data files
    """
    urls = Config.get_data_urls()

    paths = {
        "enterprise": os.path.join(data_dir, "enterprise-attack.json"),
        "mobile": os.path.join(data_dir, "mobile-attack.json"),
        "ics": os.path.join(data_dir, "ics-attack.json"),
        "metadata": os.path.join(data_dir, "metadata.json")
    }

    # Check if we need to download
    need_download = force
    if not need_download:
        metadata = load_metadata(paths["metadata"])
        if metadata is None:
            need_download = True
        else:
            last_update = parse_timestamp(metadata["last_update"])
            now = datetime.now(timezone.utc)
            age_days = (now - last_update).days

            if age_days >= Config.CACHE_EXPIRY_DAYS:
                need_download = True
                logger.info(f"Cache expired: {age_days} days old")
            else:
                logger.info(f"Using cached data from {last_update.isoformat()}")

    if need_download:
        check_disk_space(data_dir)
        logger.info("Downloading MITRE ATT&CK data asynchronously...")

        async with httpx.AsyncClient() as client:
            # Download all domains in parallel
            tasks = []
            for domain, url in urls.items():
                tasks.append(download_domain(client, domain, url, paths[domain]))

            await asyncio.gather(*tasks)

        # Save metadata
        metadata = {
            "last_update": datetime.now(timezone.utc).isoformat(),
            "domains": list(urls.keys())
        }

        async with aiofiles.open(paths["metadata"], 'w', encoding='utf-8') as f:
            await f.write(json.dumps(metadata, indent=2))

        logger.info("MITRE ATT&CK data downloaded successfully.")

    return paths


async def download_domain(
    client: httpx.AsyncClient,
    domain: str,
    url: str,
    output_path: str
) -> None:
    """
    Download a single MITRE ATT&CK domain.

    Args:
        client: HTTP client
        domain: Domain name
        url: Download URL
        output_path: Where to save
    """
    logger.info(f"Downloading {domain.capitalize()} ATT&CK data...")

    try:
        response = await client.get(
            url,
            timeout=Config.DOWNLOAD_TIMEOUT_SECONDS,
            follow_redirects=True
        )
        response.raise_for_status()

        # Validate content
        validated_data = validate_stix_bundle(response.text, domain)

        # Save asynchronously
        async with aiofiles.open(output_path, 'w', encoding='utf-8') as f:
            await f.write(json.dumps(validated_data, indent=2))

        logger.info(f"Downloaded {domain}: {len(validated_data['objects'])} objects")

    except httpx.TimeoutException:
        logger.error(f"Timeout downloading {domain} from {url}")
        raise
    except httpx.HTTPError as e:
        logger.error(f"HTTP error downloading {domain}: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to download {domain}: {e}")
        raise


@asynccontextmanager
async def attack_lifespan(server: FastMCP) -> AsyncIterator[AttackContext]:
    """Initialize and manage MITRE ATT&CK data."""
    data_dir = Config.get_data_dir()
    os.makedirs(data_dir, exist_ok=True)
    logger.info(f"Using data directory: {data_dir}")

    try:
        import sys
        force_download = "--force-download" in sys.argv

        # Async download
        paths = await download_and_save_attack_data_async(data_dir, force=force_download)

        # Load data (this is CPU-bound, consider running in executor if slow)
        logger.info("Initializing MITRE ATT&CK data...")
        enterprise_attack = MitreAttackData(paths["enterprise"])
        mobile_attack = MitreAttackData(paths["mobile"])
        ics_attack = MitreAttackData(paths["ics"])
        logger.info("MITRE ATT&CK data initialized successfully.")

        # Build indices
        logger.info("Building lookup indices...")
        groups_index = build_group_index(enterprise_attack)
        mitigations_index = build_mitigation_index(enterprise_attack)
        techniques_index = build_technique_index(enterprise_attack)
        logger.info("Lookup indices built successfully.")

        yield AttackContext(
            enterprise_attack=enterprise_attack,
            mobile_attack=mobile_attack,
            ics_attack=ics_attack,
            groups_index=groups_index,
            mitigations_index=mitigations_index,
            techniques_by_mitre_id=techniques_index
        )
    finally:
        pass
```

---

### Task 2.3: Implement Data Compression

**Files:** `mitre_mcp_server.py:90-91, 123-125`
**Severity:** LOW
**Effort:** 1 hour

#### Implementation:

```python
import gzip
import json

# When saving:
async def save_compressed_json(file_path: str, data: dict) -> None:
    """
    Save JSON data with gzip compression.

    Args:
        file_path: Path to save (will add .gz extension)
        data: Data to save
    """
    compressed_path = f"{file_path}.gz"

    async with aiofiles.open(compressed_path, 'wb') as f:
        compressed = gzip.compress(
            json.dumps(data, indent=2).encode('utf-8'),
            compresslevel=6  # Balance between speed and compression
        )
        await f.write(compressed)

    logger.debug(
        f"Saved compressed JSON: {len(compressed)} bytes "
        f"({len(json.dumps(data))/ len(compressed):.1f}x compression)"
    )


def load_compressed_json(file_path: str) -> dict:
    """
    Load gzip-compressed JSON.

    Args:
        file_path: Path to .gz file

    Returns:
        Parsed JSON data
    """
    compressed_path = f"{file_path}.gz"

    if not os.path.exists(compressed_path):
        # Fall back to uncompressed
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        raise FileNotFoundError(f"No file found: {compressed_path} or {file_path}")

    with gzip.open(compressed_path, 'rt', encoding='utf-8') as f:
        return json.load(f)


# Update paths:
paths = {
    "enterprise": os.path.join(data_dir, "enterprise-attack.json"),  # Will be .json.gz
    "mobile": os.path.join(data_dir, "mobile-attack.json"),
    "ics": os.path.join(data_dir, "ics-attack.json"),
    "metadata": os.path.join(data_dir, "metadata.json")  # Keep metadata uncompressed
}

# When loading MitreAttackData:
# Since MitreAttackData expects file path, decompress to temp file or modify loading
# Option 1: Load to memory then write temp file
# Option 2: Keep data files compressed, decompress on load

# For simplicity with existing library, keep files uncompressed
# but compress old versions for backup
```

---

## Phase 3: Code Quality Improvements

### Task 3.1: Replace Print with Logging

**Files:** Multiple locations in `mitre_mcp_server.py`
**Severity:** MEDIUM
**Effort:** 2 hours

#### Implementation:

```python
import logging
import sys

# Add at top of file, after imports
def setup_logging(level: str = None) -> logging.Logger:
    """
    Set up logging configuration.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR)

    Returns:
        Logger instance
    """
    if level is None:
        level = os.getenv("MITRE_LOG_LEVEL", "INFO")

    logging.basicConfig(
        level=getattr(logging, level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stderr)  # Log to stderr, keep stdout for MCP
        ]
    )

    return logging.getLogger(__name__)


logger = setup_logging()

# Replace all print() statements:

# Line 78: print(f"MITRE ATT&CK data is {(now - last_update).days} days old...")
logger.info(
    "MITRE ATT&CK data is %d days old. Downloading new data...",
    (now - last_update).days
)

# Line 80: print(f"Using cached MITRE ATT&CK data...")
logger.info("Using cached MITRE ATT&CK data from %s", last_update.isoformat())

# Line 85: print("Downloading MITRE ATT&CK data...")
logger.info("Downloading MITRE ATT&CK data...")

# Line 87: print(f"Downloading {domain.capitalize()} ATT&CK data...")
logger.info("Downloading %s ATT&CK data...", domain.capitalize())

# Line 101: print("MITRE ATT&CK data downloaded successfully.")
logger.info("MITRE ATT&CK data downloaded successfully.")

# Line 111: print(f"Using data directory: {data_dir}")
logger.info("Using data directory: %s", data_dir)

# Line 122: print("Initializing MITRE ATT&CK data...")
logger.info("Initializing MITRE ATT&CK data...")

# Line 126: print("MITRE ATT&CK data initialized successfully.")
logger.info("MITRE ATT&CK data initialized successfully.")
```

---

### Task 3.2: Fix Imports (PEP 8)

**File:** `mitre_mcp_server.py:9-37`
**Severity:** LOW
**Effort:** 15 minutes

#### Corrected Import Order:

```python
#!/usr/bin/env python3
"""
MITRE ATT&CK MCP Server

This server provides MCP tools for working with the MITRE ATT&CK framework.
"""

# Standard library imports (alphabetically)
import json
import logging
import os
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# Third-party imports (alphabetically)
import aiofiles
import httpx
from mitreattack import download_stix
from mitreattack.stix20 import MitreAttackData

# MCP SDK imports
from mcp.server.fastmcp import Context, FastMCP

# Local imports
from .config import Config
from .validators import (
    ValidationError,
    validate_domain,
    validate_limit,
    validate_name,
    validate_offset,
    validate_technique_id,
)


# Set up logging
logger = setup_logging()

# Configuration constants
MAX_DESCRIPTION_LENGTH = Config.MAX_DESCRIPTION_LENGTH
DEFAULT_PAGE_SIZE = Config.DEFAULT_PAGE_SIZE
DOWNLOAD_TIMEOUT_SECONDS = Config.DOWNLOAD_TIMEOUT_SECONDS
CACHE_EXPIRY_DAYS = Config.CACHE_EXPIRY_DAYS

# ... rest of code
```

#### Run isort automatically:

```bash
pip install isort
isort mitre_mcp/mitre_mcp_server.py --profile black
```

---

### Task 3.3: Add Complete Type Hints

**Files:** `mitre_mcp_server.py`
**Severity:** LOW
**Effort:** 2 hours

#### Enhanced Type Definitions:

```python
from typing import Any, Dict, List, Optional, TypedDict

class TechniqueDict(TypedDict, total=False):
    """Type definition for formatted technique."""
    id: str
    name: str
    type: str
    mitre_id: str
    description: str


class PaginationDict(TypedDict):
    """Type definition for pagination metadata."""
    total: int
    offset: int
    limit: int
    has_more: bool


class TechniquesResponse(TypedDict):
    """Type definition for get_techniques response."""
    techniques: List[TechniqueDict]
    pagination: PaginationDict


class DataPaths(TypedDict):
    """Type definition for data file paths."""
    enterprise: str
    mobile: str
    ics: str
    metadata: str


# Add return types to all functions:

def format_technique(
    technique: Dict[str, Any],
    include_description: bool = False
) -> TechniqueDict:
    """Format a technique object for output with token optimization."""
    # ... implementation


def format_relationship_map(
    relationship_map: List[Dict[str, Any]],
    include_description: bool = False,
    limit: Optional[int] = None
) -> List[TechniqueDict]:
    """Format a relationship map for output with token optimization."""
    # ... implementation


async def download_and_save_attack_data_async(
    data_dir: str,
    force: bool = False
) -> DataPaths:
    """Download and save MITRE ATT&CK data asynchronously."""
    # ... implementation


@mcp.tool()
def get_techniques(
    ctx: Context,
    domain: str = "enterprise-attack",
    include_subtechniques: bool = True,
    remove_revoked_deprecated: bool = False,
    include_descriptions: bool = False,
    limit: int = 20,
    offset: int = 0
) -> TechniquesResponse:
    """Get techniques from the MITRE ATT&CK framework."""
    # ... implementation
```

---

### Task 3.4: Create Comprehensive Test Suite

**Effort:** 1-2 days

#### Directory Structure:

```
tests/
├── __init__.py
├── conftest.py                    # Pytest configuration and fixtures
├── fixtures/
│   ├── __init__.py
│   ├── sample_technique.json      # Sample technique object
│   ├── sample_group.json          # Sample group object
│   └── sample_stix_bundle.json    # Minimal STIX bundle
├── test_validators.py             # Test input validation
├── test_download.py               # Test data download/caching
├── test_formatting.py             # Test format functions
├── test_tools.py                  # Test all MCP tools
├── test_indices.py                # Test lookup indices
├── test_config.py                 # Test configuration
└── test_integration.py            # Integration tests
```

#### conftest.py:

```python
"""Pytest configuration and shared fixtures."""
import json
import os
import tempfile
from pathlib import Path
from typing import Dict, Any
from unittest.mock import MagicMock

import pytest
from mitreattack.stix20 import MitreAttackData


@pytest.fixture
def sample_technique() -> Dict[str, Any]:
    """Sample technique object."""
    return {
        "id": "attack-pattern--abc123",
        "type": "attack-pattern",
        "name": "Process Injection",
        "description": "Adversaries may inject code into processes...",
        "external_references": [
            {
                "source_name": "mitre-attack",
                "external_id": "T1055",
                "url": "https://attack.mitre.org/techniques/T1055"
            }
        ],
        "kill_chain_phases": [
            {
                "kill_chain_name": "mitre-attack",
                "phase_name": "defense-evasion"
            }
        ]
    }


@pytest.fixture
def sample_group() -> Dict[str, Any]:
    """Sample group object."""
    return {
        "id": "intrusion-set--abc123",
        "type": "intrusion-set",
        "name": "APT28",
        "description": "APT28 is a threat group...",
        "aliases": ["Fancy Bear", "Sofacy"],
        "external_references": [
            {
                "source_name": "mitre-attack",
                "external_id": "G0007"
            }
        ]
    }


@pytest.fixture
def sample_stix_bundle() -> Dict[str, Any]:
    """Minimal valid STIX bundle."""
    return {
        "type": "bundle",
        "id": "bundle--test",
        "spec_version": "2.0",
        "objects": [
            {
                "type": "attack-pattern",
                "id": "attack-pattern--test1",
                "name": "Test Technique",
                "external_references": [
                    {
                        "source_name": "mitre-attack",
                        "external_id": "T1234"
                    }
                ]
            }
        ]
    }


@pytest.fixture
def temp_data_dir():
    """Create temporary directory for test data."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def mock_attack_data(sample_technique, sample_group):
    """Mock MitreAttackData object."""
    mock = MagicMock(spec=MitreAttackData)
    mock.get_techniques.return_value = [sample_technique]
    mock.get_groups.return_value = [sample_group]
    mock.get_tactics.return_value = []
    mock.get_software.return_value = []
    mock.get_mitigations.return_value = []
    return mock


@pytest.fixture
def mock_context(mock_attack_data):
    """Mock FastMCP Context."""
    from dataclasses import dataclass

    @dataclass
    class MockLifespanContext:
        enterprise_attack: Any
        mobile_attack: Any
        ics_attack: Any
        groups_index: Dict[str, Any]
        mitigations_index: Dict[str, Any]
        techniques_by_mitre_id: Dict[str, Any]

    @dataclass
    class MockRequestContext:
        lifespan_context: MockLifespanContext

    @dataclass
    class MockContext:
        request_context: MockRequestContext

    lifespan_ctx = MockLifespanContext(
        enterprise_attack=mock_attack_data,
        mobile_attack=mock_attack_data,
        ics_attack=mock_attack_data,
        groups_index={},
        mitigations_index={},
        techniques_by_mitre_id={}
    )

    request_ctx = MockRequestContext(lifespan_context=lifespan_ctx)
    return MockContext(request_context=request_ctx)
```

#### test_validators.py:

```python
"""Tests for input validation."""
import pytest
from mitre_mcp.validators import (
    ValidationError,
    validate_technique_id,
    validate_name,
    validate_domain,
    validate_limit,
    validate_offset
)


class TestTechniqueIDValidation:
    """Test technique ID validation."""

    def test_valid_technique_id(self):
        """Test valid technique IDs."""
        assert validate_technique_id("T1055") == "T1055"
        assert validate_technique_id("t1055") == "T1055"  # Case insensitive
        assert validate_technique_id("T1055.001") == "T1055.001"

    def test_invalid_format(self):
        """Test invalid technique ID formats."""
        with pytest.raises(ValidationError, match="Invalid technique ID format"):
            validate_technique_id("1055")  # Missing T

        with pytest.raises(ValidationError, match="Invalid technique ID format"):
            validate_technique_id("T55")  # Too short

        with pytest.raises(ValidationError, match="Invalid technique ID format"):
            validate_technique_id("T1055.1")  # Sub-technique wrong format

    def test_empty_id(self):
        """Test empty technique ID."""
        with pytest.raises(ValidationError, match="cannot be empty"):
            validate_technique_id("")

    def test_too_long(self):
        """Test technique ID too long."""
        with pytest.raises(ValidationError, match="too long"):
            validate_technique_id("T" + "1" * 100)


class TestNameValidation:
    """Test name validation."""

    def test_valid_name(self):
        """Test valid names."""
        assert validate_name("APT28") == "APT28"
        assert validate_name("  APT28  ") == "APT28"  # Strips whitespace

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

    def test_suspicious_characters(self):
        """Test names with suspicious characters."""
        with pytest.raises(ValidationError, match="invalid characters"):
            validate_name("APT28\x00")

        with pytest.raises(ValidationError, match="invalid characters"):
            validate_name("APT28\nmalicious")


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


class TestOffsetValidation:
    """Test offset validation."""

    def test_valid_offsets(self):
        """Test valid offsets."""
        assert validate_offset(0) == 0
        assert validate_offset(100) == 100

    def test_negative_offset(self):
        """Test negative offset."""
        with pytest.raises(ValidationError, match="must be non-negative"):
            validate_offset(-1)
```

#### test_formatting.py:

```python
"""Tests for formatting functions."""
import pytest
from mitre_mcp.mitre_mcp_server import format_technique, format_relationship_map


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

    def test_description_truncation(self):
        """Test description truncation."""
        long_technique = {
            "id": "test",
            "name": "Test",
            "type": "attack-pattern",
            "description": "a" * 600,
            "external_references": []
        }

        result = format_technique(long_technique, include_description=True)

        assert len(result["description"]) == 500  # 497 + "..."
        assert result["description"].endswith("...")

    def test_empty_technique(self):
        """Test empty technique."""
        result = format_technique({})

        assert result["id"] == ""
        assert result["name"] == ""
        assert result["type"] == ""


class TestFormatRelationshipMap:
    """Test relationship map formatting."""

    def test_format_relationships(self, sample_technique):
        """Test formatting relationship map."""
        relationship_map = [
            {"object": sample_technique},
            {"object": {**sample_technique, "id": "test2"}}
        ]

        result = format_relationship_map(relationship_map)

        assert len(result) == 2
        assert result[0]["mitre_id"] == "T1055"

    def test_limit_relationships(self, sample_technique):
        """Test limiting relationships."""
        relationship_map = [
            {"object": sample_technique},
            {"object": {**sample_technique, "id": "test2"}},
            {"object": {**sample_technique, "id": "test3"}}
        ]

        result = format_relationship_map(relationship_map, limit=2)

        assert len(result) == 2

    def test_empty_relationships(self):
        """Test empty relationship map."""
        result = format_relationship_map([])

        assert result == []
```

#### test_tools.py:

```python
"""Tests for MCP tools."""
import pytest
from mitre_mcp.mitre_mcp_server import (
    get_techniques,
    get_technique_by_id,
    get_groups,
    get_tactics,
    get_software
)


class TestGetTechniques:
    """Test get_techniques tool."""

    def test_get_techniques_basic(self, mock_context):
        """Test basic technique retrieval."""
        result = get_techniques(
            mock_context,
            domain="enterprise-attack",
            limit=20,
            offset=0
        )

        assert "techniques" in result
        assert "pagination" in result
        assert isinstance(result["techniques"], list)

    def test_pagination(self, mock_context):
        """Test pagination."""
        result = get_techniques(
            mock_context,
            domain="enterprise-attack",
            limit=10,
            offset=0
        )

        pagination = result["pagination"]
        assert pagination["limit"] == 10
        assert pagination["offset"] == 0
        assert "total" in pagination
        assert "has_more" in pagination

    def test_invalid_domain(self, mock_context):
        """Test invalid domain."""
        result = get_techniques(
            mock_context,
            domain="invalid-attack"
        )

        assert "error" in result
        assert "Invalid domain" in result["error"]


class TestGetTechniqueByID:
    """Test get_technique_by_id tool."""

    def test_valid_id(self, mock_context):
        """Test retrieving technique by valid ID."""
        # Set up mock to return technique
        mock_context.request_context.lifespan_context.techniques_by_mitre_id["T1055"] = {
            "id": "attack-pattern--test",
            "name": "Test Technique",
            "type": "attack-pattern",
            "external_references": [
                {"source_name": "mitre-attack", "external_id": "T1055"}
            ]
        }

        result = get_technique_by_id(mock_context, "T1055")

        assert "technique" in result
        assert result["technique"]["mitre_id"] == "T1055"

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
```

---

## Phase 4: DevOps & CI/CD

### Task 4.1: GitHub Actions CI/CD

**Effort:** 4 hours

#### .github/workflows/test.yml:

```yaml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        python-version: ['3.7', '3.8', '3.9', '3.10', '3.11']
        exclude:
          # Exclude some combinations to speed up CI
          - os: macos-latest
            python-version: '3.7'
          - os: macos-latest
            python-version: '3.8'
          - os: windows-latest
            python-version: '3.7'
          - os: windows-latest
            python-version: '3.8'

    steps:
    - uses: actions/checkout@v3

    - name: Set up Python ${{ matrix.python-version }}
      uses: actions/setup-python@v4
      with:
        python-version: ${{ matrix.python-version }}

    - name: Cache pip packages
      uses: actions/cache@v3
      with:
        path: ~/.cache/pip
        key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements*.txt') }}
        restore-keys: |
          ${{ runner.os }}-pip-

    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -e .
        pip install -r requirements-dev.txt

    - name: Run tests
      run: |
        pytest tests/ -v --cov=mitre_mcp --cov-report=xml --cov-report=term

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      if: matrix.os == 'ubuntu-latest' && matrix.python-version == '3.10'
      with:
        file: ./coverage.xml
        flags: unittests
        name: codecov-umbrella
```

#### .github/workflows/lint.yml:

```yaml
name: Lint

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  lint:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.10'

    - name: Cache pip packages
      uses: actions/cache@v3
      with:
        path: ~/.cache/pip
        key: ${{ runner.os }}-pip-lint-${{ hashFiles('**/requirements-dev.txt') }}

    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements-dev.txt

    - name: Run black
      run: |
        black --check mitre_mcp/ tests/

    - name: Run isort
      run: |
        isort --check-only mitre_mcp/ tests/

    - name: Run flake8
      run: |
        flake8 mitre_mcp/ tests/ --max-line-length=88 --extend-ignore=E203

    - name: Run mypy
      run: |
        mypy mitre_mcp/ --strict

    - name: Run bandit (security)
      run: |
        bandit -r mitre_mcp/ -ll

    - name: Run safety (dependencies)
      run: |
        safety check --json
```

#### .github/workflows/release.yml:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.10'

    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install build twine

    - name: Build package
      run: |
        python -m build

    - name: Publish to PyPI
      env:
        TWINE_USERNAME: __token__
        TWINE_PASSWORD: ${{ secrets.PYPI_API_TOKEN }}
      run: |
        twine upload dist/*

    - name: Create GitHub Release
      uses: softprops/action-gh-release@v1
      with:
        files: dist/*
        generate_release_notes: true
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

### Task 4.2: Pre-commit Hooks

**Effort:** 2 hours

#### .pre-commit-config.yaml:

```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.4.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-json
      - id: check-added-large-files
        args: ['--maxkb=1000']
      - id: check-merge-conflict
      - id: debug-statements
      - id: mixed-line-ending

  - repo: https://github.com/psf/black
    rev: 23.3.0
    hooks:
      - id: black
        language_version: python3.10

  - repo: https://github.com/pycqa/isort
    rev: 5.12.0
    hooks:
      - id: isort
        args: ["--profile", "black"]

  - repo: https://github.com/pycqa/flake8
    rev: 6.0.0
    hooks:
      - id: flake8
        args: ['--max-line-length=88', '--extend-ignore=E203']

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.3.0
    hooks:
      - id: mypy
        additional_dependencies: [types-requests]
        args: [--strict, --ignore-missing-imports]

  - repo: https://github.com/PyCQA/bandit
    rev: 1.7.5
    hooks:
      - id: bandit
        args: ['-ll', '-r', 'mitre_mcp/']
```

#### Installation:

```bash
pip install pre-commit
pre-commit install
pre-commit run --all-files  # Test
```

---

### Task 4.3: Mypy Configuration

**Effort:** 1 hour

#### Add to pyproject.toml:

```toml
[tool.mypy]
python_version = "3.7"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
disallow_any_generics = true
check_untyped_defs = true
no_implicit_optional = true
warn_redundant_casts = true
warn_unused_ignores = true
warn_no_return = true
warn_unreachable = true
strict_equality = true

[[tool.mypy.overrides]]
module = "mitreattack.*"
ignore_missing_imports = true

[[tool.mypy.overrides]]
module = "mcp.*"
ignore_missing_imports = true
```

---

## Phase 5: Documentation

### Task 5.1: CONTRIBUTING.md

```markdown
# Contributing to MITRE MCP Server

Thank you for your interest in contributing!

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/montimage/mitre-mcp.git
   cd mitre-mcp
   ```

2. Create virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. Install in development mode:
   ```bash
   pip install -e .
   pip install -r requirements-dev.txt
   ```

4. Install pre-commit hooks:
   ```bash
   pre-commit install
   ```

## Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=mitre_mcp --cov-report=html

# Run specific test file
pytest tests/test_validators.py -v
```

## Code Style

We use:
- **black** for code formatting (line length: 88)
- **isort** for import sorting
- **flake8** for linting
- **mypy** for type checking

Run before committing:
```bash
black mitre_mcp/ tests/
isort mitre_mcp/ tests/
flake8 mitre_mcp/ tests/
mypy mitre_mcp/
```

Or use pre-commit:
```bash
pre-commit run --all-files
```

## Pull Request Process

1. Create a feature branch from `develop`
2. Make your changes
3. Add/update tests
4. Ensure all tests pass
5. Update documentation if needed
6. Submit PR to `develop` branch

## Reporting Issues

Use GitHub Issues with:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Python version)
```

---

## Summary

This implementation plan provides:

1. **Detailed code examples** for every task
2. **Step-by-step instructions** for implementation
3. **Complete test suite structure** with examples
4. **CI/CD configuration** ready to use
5. **Type definitions** for better code quality
6. **Security improvements** with validation
7. **Performance optimizations** with async I/O and indices

**Estimated Total Time:** 7-10 days

**Priority Order:**
1. Phase 1 (Security): 1-2 days - START HERE
2. Phase 4 (CI/CD): 1 day - Sets up automation early
3. Phase 2 (Performance): 2-3 days
4. Phase 3 (Quality): 2-3 days
5. Phase 5 (Docs): 1 day

Ready to start implementation?
