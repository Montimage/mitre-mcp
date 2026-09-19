"""MITRE ATT&CK data layer: download, cache validation and lookup indices.

Everything that touches the STIX bundles on disk or the wire lives here —
disk-space checks, metadata and STIX-bundle validation, the parallel
download path, the O(1) lookup indices the tools share, and the immutable
per-domain lists precomputed at load for the paged tools (F-PERF-005).
The module is a leaf: it never imports the entry point, the server object
or the tools, so it can be imported first from anywhere.
"""

# Standard library imports
import asyncio
import json
import logging
import os
import shutil
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

# Third-party imports
import httpx
from mitreattack.stix20 import MitreAttackData

# Local imports
from . import __version__
from .config import Config

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DomainLists:
    """Precomputed, immutable per-domain object lists (F-PERF-005).

    Each tuple holds the store's own objects in store order, captured once
    at load with the tools' default arguments, so a paged call under those
    defaults slices this list instead of re-querying the dataset. Calls
    with non-default filters still go through the store.
    """

    techniques: tuple[dict[str, Any], ...]
    tactics: tuple[dict[str, Any], ...]
    groups: tuple[dict[str, Any], ...]
    software: tuple[dict[str, Any], ...]
    mitigations: tuple[dict[str, Any], ...]


@dataclass(frozen=True)
class DomainIndices:
    """Precomputed O(1) lookup indices for one domain (F-BUG-015, F-PERF-011).

    Built once per domain at load by ``build_domain_indices`` so the
    name/alias/ID lookups never fall back to scanning query results:

    - ``groups`` maps lowercase names AND aliases to group objects
    - ``mitigations`` maps lowercase names to mitigation objects
    - ``techniques_by_mitre_id`` maps MITRE ATT&CK IDs to techniques
    """

    groups: dict[str, dict[str, Any]]
    mitigations: dict[str, dict[str, Any]]
    techniques_by_mitre_id: dict[str, dict[str, Any]]


# Define our application context
@dataclass
class AttackContext:
    """Context for the MITRE ATT&CK MCP server with optimized lookups."""

    enterprise_attack: MitreAttackData
    mobile_attack: MitreAttackData
    ics_attack: MitreAttackData
    # O(1) lookup indices, keyed by domain name — one set per domain so
    # name, alias and ID lookups never scan query results (F-PERF-011)
    domain_indices: dict[str, DomainIndices] = field(default_factory=dict)
    # Precomputed per-domain lists, keyed by domain name (F-PERF-005)
    domain_lists: dict[str, DomainLists] = field(default_factory=dict)


def check_disk_space(directory: str, required_mb: int | None = None) -> None:
    """Check if sufficient disk space is available.

    Args:
        directory: Directory to check
        required_mb: Required space in megabytes

    Raises:
        RuntimeError: If insufficient space
    """
    if required_mb is None:
        required_mb = Config.REQUIRED_DISK_SPACE_MB

    try:
        usage = shutil.disk_usage(directory)
    except Exception as e:
        logger.warning("Could not check disk space: %s", e)
        # Don't fail if we can't check, but warn
        return

    required_bytes = required_mb * 1024 * 1024
    available_mb = usage.free / (1024 * 1024)

    if usage.free < required_bytes:
        raise RuntimeError(
            f"Insufficient disk space in {directory}. "
            f"Required: {required_mb}MB, Available: {available_mb:.1f}MB"
        )

    logger.info(
        "Disk space check passed: %.1fMB available (%dMB required)", available_mb, required_mb
    )


def parse_timestamp(timestamp_str: str) -> datetime:
    """Parse ISO timestamp string to timezone-aware datetime.

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


def validate_metadata(metadata: dict) -> dict[str, Any]:
    """Validate metadata structure.

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
        parse_timestamp(metadata["last_update"])
    except ValueError as e:
        raise ValueError(f"Invalid last_update format: {e}")

    return metadata


def load_metadata(metadata_path: str) -> dict[str, Any] | None:
    """Safely load and validate metadata.

    Args:
        metadata_path: Path to metadata.json

    Returns:
        Validated metadata or None if invalid
    """
    try:
        with open(metadata_path, encoding="utf-8") as f:
            # Limit file size to prevent memory exhaustion
            # Read max 1MB for metadata file
            content = f.read(1024 * 1024)
            metadata = json.loads(content)
            return validate_metadata(metadata)
    except (json.JSONDecodeError, ValueError, FileNotFoundError) as e:
        logger.warning("Invalid or missing metadata file: %s", e)
        return None


def validate_stix_bundle(content: str, domain: str) -> dict:
    """Validate STIX bundle structure.

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

    logger.info("Validated %s STIX bundle: %d objects", domain, len(data["objects"]))
    return data


async def download_domain(
    client: httpx.AsyncClient, domain: str, url: str, output_path: str
) -> None:
    """Download a single MITRE ATT&CK domain asynchronously.

    Args:
        client: HTTP client
        domain: Domain name
        url: Download URL
        output_path: Where to save
    """
    logger.info("Downloading %s ATT&CK data...", domain.capitalize())

    try:
        response = await client.get(
            url, timeout=Config.DOWNLOAD_TIMEOUT_SECONDS, follow_redirects=True
        )
        response.raise_for_status()

        # Validate content
        validated_data = validate_stix_bundle(response.text, domain)

        # Save to file
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(validated_data, f, indent=2)

        logger.info("Downloaded %s: %d objects", domain, len(validated_data["objects"]))

    except httpx.TimeoutException:
        logger.error("Timeout downloading %s data from %s", domain, url)
        raise
    except httpx.HTTPError as e:
        logger.error("HTTP error downloading %s: %s", domain, e)
        raise
    except Exception as e:
        logger.error("Failed to download %s: %s", domain, e)
        raise


async def download_and_save_attack_data_async(data_dir: str, force: bool = False) -> dict:
    """Download and save MITRE ATT&CK data asynchronously with parallel downloads.

    Args:
        data_dir: Directory to save the data
        force: Force download even if data is recent

    Returns:
        Dictionary with paths to the downloaded data files
    """
    # URLs for the MITRE ATT&CK STIX data
    urls = Config.get_data_urls()

    # File paths
    paths = {
        "enterprise": os.path.join(data_dir, "enterprise-attack.json"),
        "mobile": os.path.join(data_dir, "mobile-attack.json"),
        "ics": os.path.join(data_dir, "ics-attack.json"),
        "metadata": os.path.join(data_dir, "metadata.json"),
    }

    # Check if we need to download new data
    need_download = force
    if not need_download:
        metadata = load_metadata(paths["metadata"])
        if metadata is None:
            need_download = True
        else:
            last_update = parse_timestamp(metadata["last_update"])
            now = datetime.now(timezone.utc)
            age_days = (now - last_update).days

            # Download if data is more than configured days old
            if age_days >= Config.CACHE_EXPIRY_DAYS:
                need_download = True
                logger.info("MITRE ATT&CK data is %d days old. Downloading new data...", age_days)
            else:
                logger.info("Using cached MITRE ATT&CK data from %s", last_update.isoformat())

    if need_download:
        try:
            # Check disk space before downloading
            check_disk_space(data_dir)

            logger.info("Downloading MITRE ATT&CK data in parallel...")

            # Create async HTTP client
            async with httpx.AsyncClient(
                headers={"User-Agent": f"mitre-mcp/{__version__}"},
                verify=True,
                timeout=Config.DOWNLOAD_TIMEOUT_SECONDS,
            ) as client:
                # Download all domains in parallel
                download_tasks = [
                    download_domain(client, domain, url, paths[domain])
                    for domain, url in urls.items()
                ]

                # Wait for all downloads to complete
                await asyncio.gather(*download_tasks)

            # Save metadata
            metadata = {
                "last_update": datetime.now(timezone.utc).isoformat(),
                "domains": list(urls.keys()),
            }
            with open(paths["metadata"], "w", encoding="utf-8") as f:
                json.dump(metadata, f, indent=2)

            logger.info("MITRE ATT&CK data downloaded successfully.")
        except Exception as e:
            # A refresh failure must not kill startup when usable cached
            # data is already on disk — serve it and warn loudly instead.
            if all(os.path.exists(paths[domain]) for domain in urls):
                logger.warning(
                    "Failed to refresh MITRE ATT&CK data (%s); "
                    "serving stale cached data — it may be outdated",
                    e,
                )
            else:
                raise

    return paths


def build_domain_indices(data: MitreAttackData) -> DomainIndices:
    """Build one domain's O(1) lookup indices (F-BUG-015, F-PERF-011).

    Called once per domain at load — every domain gets the same index
    coverage, so group, mitigation and technique-ID lookups on mobile and
    ICS use the index exactly like enterprise instead of scanning query
    results. The group index keys lowercase names AND aliases (aliases
    never overwrite a primary name); the mitigation index keys lowercase
    names; the technique index keys the MITRE ATT&CK external ID.

    Args:
        data: MITRE ATT&CK data for one domain

    Returns:
        The domain's lookup indices
    """
    # Case-insensitive group index — primary names and aliases.
    groups: dict[str, dict[str, Any]] = {}
    group_list = data.get_groups()
    for group in group_list:
        name = group.get("name", "").lower()
        if name:
            groups[name] = group
        for alias in group.get("aliases", []):
            alias_lower = alias.lower()
            if alias_lower not in groups:  # Don't overwrite primary names
                groups[alias_lower] = group

    # Case-insensitive mitigation index.
    mitigations: dict[str, dict[str, Any]] = {}
    mitigation_list = data.get_mitigations()
    for mitigation in mitigation_list:
        name = mitigation.get("name", "").lower()
        if name:
            mitigations[name] = mitigation

    # MITRE ATT&CK ID to technique index.
    techniques: dict[str, dict[str, Any]] = {}
    technique_list = data.get_techniques()
    for technique in technique_list:
        for ref in technique.get("external_references", []):
            if ref.get("source_name") == "mitre-attack":
                mitre_id = ref.get("external_id", "")
                if mitre_id:
                    techniques[mitre_id] = technique
                    break

    indices = DomainIndices(
        groups=groups,
        mitigations=mitigations,
        techniques_by_mitre_id=techniques,
    )
    logger.info(
        "Built domain indices: %d group keys (%d groups), %d mitigations, %d techniques",
        len(indices.groups),
        len(group_list),
        len(indices.mitigations),
        len(indices.techniques_by_mitre_id),
    )
    return indices


def build_domain_lists(data: MitreAttackData) -> DomainLists:
    """Precompute a domain's immutable object lists (F-PERF-005).

    Called once per domain at load. Each list is captured exactly as the
    store returns it under the tools' default arguments — subtechniques
    included, revoked/deprecated objects kept — so default-argument calls
    can slice the snapshot and skip the store query entirely.
    """
    lists = DomainLists(
        techniques=tuple(
            data.get_techniques(include_subtechniques=True, remove_revoked_deprecated=False)
        ),
        tactics=tuple(data.get_tactics(remove_revoked_deprecated=False)),
        groups=tuple(data.get_groups(remove_revoked_deprecated=False)),
        software=tuple(data.get_software(remove_revoked_deprecated=False)),
        mitigations=tuple(data.get_mitigations(remove_revoked_deprecated=False)),
    )
    logger.info(
        "Built domain lists: %d techniques, %d tactics, %d groups, %d software, %d mitigations",
        len(lists.techniques),
        len(lists.tactics),
        len(lists.groups),
        len(lists.software),
        len(lists.mitigations),
    )
    return lists
