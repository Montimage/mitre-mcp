"""MITRE ATT&CK data layer: download, cache validation and lookup indices.

Everything that touches the STIX bundles on disk or the wire lives here —
disk-space checks, metadata and STIX-bundle validation, the parallel
download path, the O(1) lookup indices the tools share, and the immutable
per-domain lists for the paged tools (F-PERF-005), precomputed eagerly
for enterprise and lazily for mobile/ICS (F-PERF-010).
The module is a leaf: it never imports the entry point, the server object
or the tools, so it can be imported first from anywhere.
"""

# Standard library imports
import asyncio
import json
import logging
import os
import shutil
import threading
from collections.abc import Callable
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
    per domain — at start-up for enterprise, on first use for mobile/ICS
    (F-PERF-010) — with the tools' default arguments, so a paged call
    under those defaults slices this list instead of re-querying the
    dataset. Calls with non-default filters still go through the store.
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


# Domain name → context attribute for the lazily loaded domains (F-PERF-010).
_LAZY_DOMAIN_ATTRS = {"mobile-attack": "mobile_attack", "ics-attack": "ics_attack"}


# Define our application context
@dataclass
class AttackContext:
    """Context for the MITRE ATT&CK MCP server with optimized lookups.

    Only enterprise is parsed at start-up (F-PERF-010): every tool
    defaults to it, so the other two domains stay ``None`` until the
    first call that targets them. ``ensure_domain`` then parses the
    cached bundle and builds that domain's indices and precomputed
    lists under a per-domain lock, so racing worker-thread handlers
    load it exactly once.
    """

    enterprise_attack: MitreAttackData
    mobile_attack: MitreAttackData | None = None
    ics_attack: MitreAttackData | None = None
    # O(1) lookup indices, keyed by domain name — one set per domain so
    # name, alias and ID lookups never scan query results (F-PERF-011)
    domain_indices: dict[str, DomainIndices] = field(default_factory=dict)
    # Precomputed per-domain lists, keyed by domain name (F-PERF-005)
    domain_lists: dict[str, DomainLists] = field(default_factory=dict)
    # Cache file backing each lazily loaded domain, keyed by domain name
    domain_paths: dict[str, str] = field(default_factory=dict)
    # path -> (data, indices, lists) triple; the lifespan injects a loader
    # resolved through the entry module so tests keep their patch surface.
    # ``None`` falls back to ``_load_domain_bundle``.
    domain_loader: (
        Callable[[str], tuple[MitreAttackData, "DomainIndices", "DomainLists"]] | None
    ) = field(default=None, repr=False, compare=False)
    # One lock per lazy domain — a mobile load never blocks an ICS one.
    _domain_locks: dict[str, threading.Lock] = field(
        default_factory=lambda: {d: threading.Lock() for d in _LAZY_DOMAIN_ATTRS},
        repr=False,
        compare=False,
    )

    def ensure_domain(self, domain: str) -> MitreAttackData:
        """Return the domain's store, loading mobile/ICS on first use (F-PERF-010).

        Enterprise stays eager and returns immediately. For the other two
        domains the first call parses the bundle, builds the lookup
        indices and the precomputed lists — the same bundle of work
        start-up used to do for all three — inside a per-domain lock whose
        re-check guarantees exactly one load however many tools race in.

        Args:
            domain: Domain name (``mobile-attack`` or ``ics-attack``)

        Returns:
            The domain's ``MitreAttackData`` store

        Raises:
            ValueError: Unknown domain, or no cache file is known for it
        """
        if domain == "enterprise-attack":
            return self.enterprise_attack
        attr = _LAZY_DOMAIN_ATTRS.get(domain)
        if attr is None:
            raise ValueError(f"Invalid domain: {domain}")
        data = getattr(self, attr)
        if data is None:
            with self._domain_locks.setdefault(domain, threading.Lock()):
                data = getattr(self, attr)
                if data is None:
                    path = self.domain_paths.get(domain)
                    if path is None:
                        raise ValueError(f"No cached file for domain: {domain}")
                    load = self.domain_loader or _load_domain_bundle
                    data, indices, lists = load(path)
                    # Publish the lookups before flipping the attribute —
                    # a thread that sees <attr> set sees the whole domain.
                    self.domain_indices[domain] = indices
                    self.domain_lists[domain] = lists
                    setattr(self, attr, data)
        return data


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


def _check_bundle_structure(data: Any, domain: str) -> dict:
    """Check a parsed STIX bundle's shape.

    Shared by ``validate_stix_bundle`` (string in) and
    ``_validate_bundle_file`` (file in) so the downloaded temp file is
    held to exactly the same rules before it may replace the cache.

    Raises:
        ValueError: If the bundle is invalid
    """
    if not isinstance(data, dict):
        raise ValueError(f"{domain} data must be dict, got {type(data)}")

    if "type" not in data or data["type"] != "bundle":
        raise ValueError(f"{domain} data missing 'type: bundle'")

    if "objects" not in data or not isinstance(data["objects"], list):
        raise ValueError(f"{domain} data missing 'objects' array")

    logger.info("Validated %s STIX bundle: %d objects", domain, len(data["objects"]))
    return data


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

    return _check_bundle_structure(data, domain)


def _validate_bundle_file(path: str, domain: str) -> dict:
    """Read a downloaded bundle back and validate its STIX structure.

    Runs inside ``asyncio.to_thread`` from the download path — a ~40 MB
    ``json.load`` is blocking I/O and must stay off the event loop.
    """
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON for {domain}: {e}")

    return _check_bundle_structure(data, domain)


def _unlink_quietly(path: str) -> None:
    """Best-effort removal of a leftover temp file."""
    try:
        os.unlink(path)
    except OSError:
        pass  # Temp file missing or already gone — nothing to clean up.


def _write_json_atomic(path: str, payload: dict) -> None:
    """Serialize *payload* to *path* atomically.

    Writes a sibling temp file and ``os.replace``es it into place, so a
    crash mid-write never leaves a truncated cache file (F-BUG-028).
    """
    tmp_path = f"{path}.tmp"
    try:
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(payload, f)
    except Exception:
        _unlink_quietly(tmp_path)
        raise
    os.replace(tmp_path, path)


def _conditional_headers(validators: dict[str, str] | None) -> dict[str, str]:
    """Build conditional-GET headers from stored cache validators.

    Stored under ``metadata["validators"][domain]`` by the previous
    download; a server that honors them answers 304 and the cached file
    is reused untouched (F-PERF-004).
    """
    headers: dict[str, str] = {}
    if not validators:
        return headers
    if validators.get("etag"):
        headers["If-None-Match"] = validators["etag"]
    if validators.get("last_modified"):
        headers["If-Modified-Since"] = validators["last_modified"]
    return headers


async def download_domain(
    client: httpx.AsyncClient,
    domain: str,
    url: str,
    output_path: str,
    conditional_headers: dict[str, str] | None = None,
) -> dict[str, str] | None:
    """Stream a single MITRE ATT&CK domain to disk, atomically.

    The body lands in a sibling temp file chunk by chunk — bounded memory,
    no parse/re-serialize round-trip (F-PERF-004) — and is swapped into
    place with ``os.replace`` only after it validates, so a failed
    download never truncates a good cache file (F-BUG-028).

    Args:
        client: HTTP client
        domain: Domain name
        url: Download URL
        output_path: Where to save
        conditional_headers: ``If-None-Match``/``If-Modified-Since`` values
            stored by the previous download, for a conditional refresh

    Returns:
        The response's cache validators (``etag``/``last_modified``) on a
        200 download, or ``None`` when the server answers 304 and the
        existing cache file is left untouched.
    """
    logger.info("Downloading %s ATT&CK data...", domain.capitalize())

    tmp_path = f"{output_path}.tmp"
    try:
        async with client.stream(
            "GET",
            url,
            headers=conditional_headers,
            timeout=Config.DOWNLOAD_TIMEOUT_SECONDS,
            follow_redirects=True,
        ) as response:
            if response.status_code == httpx.codes.NOT_MODIFIED:
                logger.info("%s data unchanged (304) — keeping cached file", domain.capitalize())
                return None
            response.raise_for_status()

            # Stream the body to the temp file: file I/O goes through
            # to_thread so no blocking open()/write() runs on the loop.
            tmp = await asyncio.to_thread(open, tmp_path, "wb")
            try:
                async for chunk in response.aiter_bytes():
                    await asyncio.to_thread(tmp.write, chunk)
            finally:
                await asyncio.to_thread(tmp.close)

        # Validate the temp file before it may replace the cache, then
        # swap it in atomically — a corrupt download keeps the old file.
        validated = await asyncio.to_thread(_validate_bundle_file, tmp_path, domain)
        await asyncio.to_thread(os.replace, tmp_path, output_path)

        logger.info("Downloaded %s: %d objects", domain, len(validated["objects"]))
        return {
            "etag": response.headers.get("etag", ""),
            "last_modified": response.headers.get("last-modified", ""),
        }

    except httpx.TimeoutException:
        _unlink_quietly(tmp_path)
        logger.error("Timeout downloading %s data from %s", domain, url)
        raise
    except httpx.HTTPError as e:
        _unlink_quietly(tmp_path)
        logger.error("HTTP error downloading %s: %s", domain, e)
        raise
    except Exception as e:
        _unlink_quietly(tmp_path)
        logger.error("Failed to download %s: %s", domain, e)
        raise


def attack_data_paths(data_dir: str) -> dict[str, str]:
    """Return the on-disk layout of the ATT&CK cache under *data_dir*.

    Keys are the short domain names (``enterprise``, ``mobile``, ``ics``)
    plus ``metadata`` — the same mapping the download path fills.
    """
    return {
        "enterprise": os.path.join(data_dir, "enterprise-attack.json"),
        "mobile": os.path.join(data_dir, "mobile-attack.json"),
        "ics": os.path.join(data_dir, "ics-attack.json"),
        "metadata": os.path.join(data_dir, "metadata.json"),
    }


def stale_cache_servable(paths: dict[str, str], force: bool = False) -> bool:
    """Decide if start-up may serve the cache and refresh it in the background.

    F-PERF-010: an expired cache no longer blocks the first request — the
    stale bundles answer it while a background task re-downloads. Serving
    stale needs every domain file on disk, the same completeness rule the
    download-failure fallback uses; a missing or invalid metadata file
    still counts as refresh-due since the bundles themselves are usable.
    ``force`` (``--force-download``) stays blocking — the caller asked for
    fresh bytes before serving.

    Args:
        paths: Cache layout from ``attack_data_paths``
        force: Force-download flag from the CLI args

    Returns:
        True when the on-disk cache is complete AND refresh-due
    """
    if force:
        return False
    if not all(os.path.exists(paths[domain]) for domain in Config.get_data_urls()):
        return False
    metadata = load_metadata(paths["metadata"])
    if metadata is None:
        return True
    age_days = (datetime.now(timezone.utc) - parse_timestamp(metadata["last_update"])).days
    return age_days >= Config.CACHE_EXPIRY_DAYS


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
    paths = attack_data_paths(data_dir)

    # Check if we need to download new data
    need_download = force
    metadata: dict[str, Any] | None = None
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
            # The default data dir is per-user now — create it when the
            # download path runs outside the server lifespan (scripts).
            await asyncio.to_thread(os.makedirs, data_dir, exist_ok=True)

            # Check disk space before downloading
            check_disk_space(data_dir)

            # Conditional-refresh inputs (F-PERF-004): the validators the
            # previous download stored, sent only when the cached file is
            # still there — a missing file needs an unconditional fetch,
            # and --force-download always fetches fresh bytes.
            old_validators: dict[str, dict[str, str]] = {}
            if not force:
                old_validators = (metadata or {}).get("validators", {})

            logger.info("Downloading MITRE ATT&CK data in parallel...")

            # Create async HTTP client
            async with httpx.AsyncClient(
                headers={"User-Agent": f"mitre-mcp/{__version__}"},
                verify=True,
                timeout=Config.DOWNLOAD_TIMEOUT_SECONDS,
            ) as client:
                # Download all domains in parallel
                download_tasks = [
                    download_domain(
                        client,
                        domain,
                        url,
                        paths[domain],
                        conditional_headers=(
                            _conditional_headers(old_validators.get(domain))
                            if os.path.exists(paths[domain])
                            else None
                        ),
                    )
                    for domain, url in urls.items()
                ]

                # Wait for all downloads to complete
                results = await asyncio.gather(*download_tasks)

            # Merge validators: fresh ones from 200 responses, kept ones
            # from 304s — then write metadata atomically like the bundles.
            new_validators = {
                domain: (result if result is not None else old_validators.get(domain, {}))
                for domain, result in zip(urls, results)
            }
            metadata = {
                "last_update": datetime.now(timezone.utc).isoformat(),
                "domains": list(urls.keys()),
                "validators": new_validators,
            }
            await asyncio.to_thread(_write_json_atomic, paths["metadata"], metadata)

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


def _group_name_lookup(group_list: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Case-insensitive group index — primary names and aliases.

    Aliases never overwrite a primary name already in the index.
    """
    groups: dict[str, dict[str, Any]] = {}
    for group in group_list:
        name = group.get("name", "").lower()
        if name:
            groups[name] = group
        for alias in group.get("aliases", []):
            alias_lower = alias.lower()
            if alias_lower not in groups:  # Don't overwrite primary names
                groups[alias_lower] = group
    return groups


def _mitigation_name_lookup(
    mitigation_list: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Case-insensitive mitigation index keyed by lowercase name."""
    mitigations: dict[str, dict[str, Any]] = {}
    for mitigation in mitigation_list:
        name = mitigation.get("name", "").lower()
        if name:
            mitigations[name] = mitigation
    return mitigations


def _technique_mitre_id_lookup(
    technique_list: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """MITRE ATT&CK external ID to technique index."""
    techniques: dict[str, dict[str, Any]] = {}
    for technique in technique_list:
        for ref in technique.get("external_references", []):
            if ref.get("source_name") == "mitre-attack":
                mitre_id = ref.get("external_id", "")
                if mitre_id:
                    techniques[mitre_id] = technique
                    break
    return techniques


def build_domain_indices(data: MitreAttackData) -> DomainIndices:
    """Build one domain's O(1) lookup indices (F-BUG-015, F-PERF-011).

    Called once per domain — at start-up for enterprise, on first use for
    mobile/ICS (F-PERF-010) — and every domain gets the same index
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
    group_list = data.get_groups()
    indices = DomainIndices(
        groups=_group_name_lookup(group_list),
        mitigations=_mitigation_name_lookup(data.get_mitigations()),
        techniques_by_mitre_id=_technique_mitre_id_lookup(data.get_techniques()),
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

    Called once per domain — at start-up for enterprise, on first use for
    mobile/ICS (F-PERF-010). Each list is captured exactly as the
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


def _load_domain_bundle(path: str) -> tuple[MitreAttackData, DomainIndices, DomainLists]:
    """Parse one cached bundle and build its lookups (F-PERF-010).

    The fallback ``AttackContext.domain_loader``, used when the context
    was built outside the lifespan — scripts and hand-made test contexts —
    so no loader was injected. It resolves this module's own names, so it
    deliberately bypasses the entry patch surface; the lifespan injects a
    loader that goes through it instead.
    """
    data = MitreAttackData(path)
    return data, build_domain_indices(data), build_domain_lists(data)
