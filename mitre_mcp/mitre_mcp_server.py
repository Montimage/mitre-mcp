#!/usr/bin/env python3
"""
MITRE ATT&CK MCP Server.

This server provides MCP tools for working with the MITRE ATT&CK framework
using the mitreattack-python library. Implemented using the official MCP Python SDK.
"""

# Standard library imports
import asyncio
import json
import logging
import os
import shutil
import signal
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

# Third-party imports
import httpx

# MCP SDK imports
from mcp.server.fastmcp import Context, FastMCP
from mitreattack.stix20 import MitreAttackData
from starlette.middleware.cors import CORSMiddleware

# Local imports
from . import __version__
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
def setup_logging() -> logging.Logger:
    """
    Set up logging configuration.

    Returns:
        Logger instance
    """
    logging.basicConfig(
        level=getattr(logging, Config.LOG_LEVEL.upper()),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler(sys.stderr)],  # Log to stderr, keep stdout for MCP
    )
    return logging.getLogger(__name__)


logger = setup_logging()


# Define our application context
@dataclass
class AttackContext:
    """Context for the MITRE ATT&CK MCP server with optimized lookups."""

    enterprise_attack: MitreAttackData
    mobile_attack: MitreAttackData
    ics_attack: MitreAttackData
    # Lookup indices for O(1) searches
    groups_index: dict[str, dict[str, Any]]
    mitigations_index: dict[str, dict[str, Any]]
    techniques_by_mitre_id: dict[str, dict[str, Any]]


# Metadata type definition
class Metadata(dict[str, Any]):
    """Type for metadata.json structure."""

    pass


def check_disk_space(directory: str, required_mb: int | None = None) -> None:
    """
    Check if sufficient disk space is available.

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
        parse_timestamp(metadata["last_update"])
    except ValueError as e:
        raise ValueError(f"Invalid last_update format: {e}")

    return Metadata(metadata)


def load_metadata(metadata_path: str) -> Metadata | None:
    """
    Safely load and validate metadata.

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

    logger.info("Validated %s STIX bundle: %d objects", domain, len(data["objects"]))
    return data


async def download_domain(
    client: httpx.AsyncClient, domain: str, url: str, output_path: str
) -> None:
    """
    Download a single MITRE ATT&CK domain asynchronously.

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
    """
    Download and save MITRE ATT&CK data asynchronously with parallel downloads.

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
                download_domain(client, domain, url, paths[domain]) for domain, url in urls.items()
            ]

            # Wait for all downloads to complete
            await asyncio.gather(*download_tasks)

        # Save metadata
        metadata = Metadata(
            {
                "last_update": datetime.now(timezone.utc).isoformat(),
                "domains": list(urls.keys()),
            }
        )
        with open(paths["metadata"], "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        logger.info("MITRE ATT&CK data downloaded successfully.")

    return paths


def build_group_index(data: MitreAttackData) -> dict[str, dict[str, Any]]:
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

    logger.info("Built group index: %d entries for %d groups", len(index), len(groups))
    return index


def build_mitigation_index(data: MitreAttackData) -> dict[str, dict[str, Any]]:
    """Build case-insensitive mitigation name index."""
    index = {}
    mitigations = data.get_mitigations()

    for mitigation in mitigations:
        name = mitigation.get("name", "").lower()
        if name:
            index[name] = mitigation

    logger.info(
        "Built mitigation index: %d entries for %d mitigations", len(index), len(mitigations)
    )
    return index


def build_technique_index(data: MitreAttackData) -> dict[str, dict[str, Any]]:
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

    logger.info("Built technique index: %d entries for %d techniques", len(by_id), len(techniques))
    return by_id


@asynccontextmanager
async def attack_lifespan(server: FastMCP) -> AsyncIterator[AttackContext]:
    """Initialize and manage MITRE ATT&CK data."""
    # Create data directory if it doesn't exist
    data_dir = Config.get_data_dir()
    os.makedirs(data_dir, exist_ok=True)
    logger.info("Using data directory: %s", data_dir)

    try:
        # Get command line arguments
        force_download = "--force-download" in sys.argv

        # Download and save MITRE ATT&CK data asynchronously with parallel downloads
        paths = await download_and_save_attack_data_async(data_dir, force=force_download)

        # Initialize on startup
        logger.info("Initializing MITRE ATT&CK data...")
        enterprise_attack = MitreAttackData(paths["enterprise"])
        mobile_attack = MitreAttackData(paths["mobile"])
        ics_attack = MitreAttackData(paths["ics"])
        logger.info("MITRE ATT&CK data initialized successfully.")

        # Build lookup indices
        logger.info("Building lookup indices...")
        groups_index = build_group_index(enterprise_attack)
        mitigations_index = build_mitigation_index(enterprise_attack)
        techniques_index = build_technique_index(enterprise_attack)
        logger.info("Lookup indices built successfully.")

        # Show appropriate configuration based on transport mode
        if "--http" in sys.argv:
            # Parse host and port from command line
            host = "localhost"
            port = 8000
            for i, arg in enumerate(sys.argv):
                if arg == "--host" and i + 1 < len(sys.argv):
                    host = sys.argv[i + 1]
                elif arg == "--port" and i + 1 < len(sys.argv):
                    try:  # noqa: SIM105
                        port = int(sys.argv[i + 1])
                    except ValueError:
                        pass  # Will use default

            # Streamable HTTP transport configuration
            server_url = f"http://{host}:{port}"
            config_snippet: dict[str, Any] = {
                "mcpServers": {"mitreattack": {"url": f"{server_url}/mcp"}}
            }

            # Log the configuration
            config_message = (
                "\n"
                + "=" * 70
                + "\n"
                + "MITRE ATT&CK MCP Server is ready (Streamable HTTP mode)\n"
                + f"Server URL: {server_url}\n"
                + f"MCP Endpoint: {server_url}/mcp\n"
                + "\n"
                + "Add this to your MCP client configuration:\n"
                + json.dumps(config_snippet, indent=2)
                + "\n"
                + "=" * 70
            )
            logger.info(config_message)

            # Also print directly to stderr with immediate flush to ensure visibility
            print(config_message, file=sys.stderr, flush=True)
        else:
            # stdio transport configuration
            config_snippet = {
                "mcpServers": {
                    "mitreattack": {
                        "command": sys.executable,
                        "args": ["-m", "mitre_mcp.mitre_mcp_server"],
                    }
                }
            }

            # Log the configuration
            config_message = (
                "\n"
                + "=" * 70
                + "\n"
                + "MITRE ATT&CK MCP Server is ready (stdio mode)\n"
                + "\n"
                + "Add this to your MCP client configuration:\n"
                + json.dumps(config_snippet, indent=2)
                + "\n"
                + "=" * 70
            )
            logger.info(config_message)

            # Also print directly to stderr with immediate flush to ensure visibility
            print(config_message, file=sys.stderr, flush=True)

        yield AttackContext(
            enterprise_attack=enterprise_attack,
            mobile_attack=mobile_attack,
            ics_attack=ics_attack,
            groups_index=groups_index,
            mitigations_index=mitigations_index,
            techniques_by_mitre_id=techniques_index,
        )
    except Exception as e:
        logger.error("Failed to initialize MITRE ATT&CK data: %s", e)
        raise


# Create MCP server with lifespan
mcp = FastMCP("MITRE ATT&CK Server", lifespan=attack_lifespan)


# Helper functions
def get_attack_data(domain: str, ctx: Context) -> MitreAttackData:
    """Get the appropriate MITRE ATT&CK data based on the domain."""
    if domain == "enterprise-attack":
        return ctx.request_context.lifespan_context.enterprise_attack
    elif domain == "mobile-attack":
        return ctx.request_context.lifespan_context.mobile_attack
    elif domain == "ics-attack":
        return ctx.request_context.lifespan_context.ics_attack
    else:
        raise ValueError(f"Invalid domain: {domain}")


def format_technique(
    technique: dict[str, Any], include_description: bool = False
) -> dict[str, Any]:
    """Format a technique object for output with token optimization."""
    if technique is None:
        return {}

    # Start with minimal information
    result = {
        "id": technique.get("id", ""),
        "name": technique.get("name", ""),
        "type": technique.get("type", ""),
    }

    # Only include description if explicitly requested
    if include_description:
        description = technique.get("description", "")
        # Truncate long descriptions to save tokens
        if len(description) > Config.MAX_DESCRIPTION_LENGTH:
            result["description"] = description[: Config.MAX_DESCRIPTION_LENGTH - 3] + "..."
        else:
            result["description"] = description

    # Add MITRE ATT&CK ID if available
    for ref in technique.get("external_references", []):
        if ref.get("source_name") == "mitre-attack":
            result["mitre_id"] = ref.get("external_id", "")
            break

    return result


def format_relationship_map(
    relationship_map: list[dict[str, Any]],
    include_description: bool = False,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """Format a relationship map for output with token optimization."""
    if not relationship_map:
        return []

    result = []
    for item in relationship_map:
        obj = item.get("object", {})
        formatted_obj = format_technique(obj, include_description=include_description)
        if formatted_obj:
            result.append(formatted_obj)
            # Limit number of returned items to save tokens
            if limit and len(result) >= limit:
                break

    return result


# MCP Tools
@mcp.tool()
def get_techniques(
    ctx: Context,
    domain: str = "enterprise-attack",
    include_subtechniques: bool = True,
    remove_revoked_deprecated: bool = False,
    include_descriptions: bool = False,
    limit: int | None = None,
    offset: int = 0,
) -> dict[str, Any]:
    """
    Get techniques from the MITRE ATT&CK framework with token-optimized responses.

    Args:
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
        return {"error": str(e)}

    data = get_attack_data(domain, ctx)
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


@mcp.tool()
def get_tactics(
    ctx: Context, domain: str = "enterprise-attack", remove_revoked_deprecated: bool = False
) -> dict[str, Any]:
    """
    Get all tactics from the MITRE ATT&CK framework.

    Args:
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        remove_revoked_deprecated: Remove revoked or deprecated objects

    Returns:
        Dictionary containing a list of tactics
    """
    # Validate inputs
    try:
        domain = validate_domain(domain)
    except ValidationError as e:
        return {"error": str(e)}

    data = get_attack_data(domain, ctx)
    tactics = data.get_tactics(remove_revoked_deprecated=remove_revoked_deprecated)

    return {
        "tactics": [
            {
                "id": tactic.get("id", ""),
                "name": tactic.get("name", ""),
                "shortname": tactic.get("x_mitre_shortname", ""),
                "description": tactic.get("description", ""),
            }
            for tactic in tactics
        ]
    }


@mcp.tool()
def get_groups(
    ctx: Context, domain: str = "enterprise-attack", remove_revoked_deprecated: bool = False
) -> dict[str, Any]:
    """
    Get all groups from the MITRE ATT&CK framework.

    Args:
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        remove_revoked_deprecated: Remove revoked or deprecated objects

    Returns:
        Dictionary containing a list of groups
    """
    # Validate inputs
    try:
        domain = validate_domain(domain)
    except ValidationError as e:
        return {"error": str(e)}

    data = get_attack_data(domain, ctx)
    groups = data.get_groups(remove_revoked_deprecated=remove_revoked_deprecated)

    return {
        "groups": [
            {
                "id": group.get("id", ""),
                "name": group.get("name", ""),
                "description": group.get("description", ""),
                "aliases": group.get("aliases", []),
            }
            for group in groups
        ]
    }


@mcp.tool()
def get_software(
    ctx: Context,
    domain: str = "enterprise-attack",
    remove_revoked_deprecated: bool = False,
    software_types: list[str] | None = None,
) -> dict[str, Any]:
    """
    Get all software from the MITRE ATT&CK framework.

    Args:
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
        return {"error": str(e)}

    data = get_attack_data(domain, ctx)
    software = data.get_software(remove_revoked_deprecated=remove_revoked_deprecated)

    if software_types:
        allowed = {stype.lower() for stype in software_types}
        software = [s for s in software if s.get("type", "").lower() in allowed]

    return {
        "software": [
            {
                "id": s.get("id", ""),
                "name": s.get("name", ""),
                "type": s.get("type", ""),
                "description": s.get("description", ""),
            }
            for s in software
        ]
    }


@mcp.tool()
def get_techniques_by_tactic(
    ctx: Context,
    tactic_shortname: str,
    domain: str = "enterprise-attack",
    remove_revoked_deprecated: bool = False,
) -> dict[str, Any]:
    """
    Get techniques by tactic.

    Args:
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
        return {"error": str(e)}

    data = get_attack_data(domain, ctx)
    techniques = data.get_techniques_by_tactic(
        tactic_shortname=tactic_shortname,
        domain=domain,
        remove_revoked_deprecated=remove_revoked_deprecated,
    )

    return {"techniques": [format_technique(technique) for technique in techniques]}


@mcp.tool()
def get_techniques_used_by_group(
    ctx: Context, group_name: str, domain: str = "enterprise-attack"
) -> dict[str, Any]:
    """
    Get techniques used by a group.

    Args:
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
        return {"error": str(e)}

    data = get_attack_data(domain, ctx)

    # Use index for O(1) lookup (enterprise domain only)
    if domain == "enterprise-attack":
        group = ctx.request_context.lifespan_context.groups_index.get(group_name.lower())
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
        "group": {"id": group.get("id", ""), "name": group.get("name", "")},
        "techniques": format_relationship_map(techniques),
    }


@mcp.tool()
def get_mitigations(
    ctx: Context, domain: str = "enterprise-attack", remove_revoked_deprecated: bool = False
) -> dict[str, Any]:
    """
    Get all mitigations from the MITRE ATT&CK framework.

    Args:
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        remove_revoked_deprecated: Remove revoked or deprecated objects

    Returns:
        Dictionary containing a list of mitigations
    """
    # Validate inputs
    try:
        domain = validate_domain(domain)
    except ValidationError as e:
        return {"error": str(e)}

    data = get_attack_data(domain, ctx)
    mitigations = data.get_mitigations(remove_revoked_deprecated=remove_revoked_deprecated)

    return {
        "mitigations": [
            {
                "id": mitigation.get("id", ""),
                "name": mitigation.get("name", ""),
                "description": mitigation.get("description", ""),
            }
            for mitigation in mitigations
        ]
    }


@mcp.tool()
def get_techniques_mitigated_by_mitigation(
    ctx: Context, mitigation_name: str, domain: str = "enterprise-attack"
) -> dict[str, Any]:
    """
    Get techniques mitigated by a mitigation.

    Args:
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
        return {"error": str(e)}

    data = get_attack_data(domain, ctx)

    # Use index for O(1) lookup (enterprise domain only)
    if domain == "enterprise-attack":
        mitigation = ctx.request_context.lifespan_context.mitigations_index.get(
            mitigation_name.lower()
        )
    else:
        # Fallback to linear search for other domains
        mitigations = data.get_mitigations()
        mitigation = None
        for m in mitigations:
            if m.get("name", "").lower() == mitigation_name.lower():
                mitigation = m
                break

    if not mitigation:
        return {"error": f"Mitigation '{mitigation_name}' not found"}

    techniques = data.get_techniques_mitigated_by_mitigation(mitigation["id"])

    return {
        "mitigation": {"id": mitigation.get("id", ""), "name": mitigation.get("name", "")},
        "techniques": format_relationship_map(techniques),
    }


@mcp.tool()
def get_technique_by_id(
    ctx: Context, technique_id: str, domain: str = "enterprise-attack"
) -> dict[str, Any]:
    """
    Get a technique by its MITRE ATT&CK ID.

    Args:
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
        return {"error": str(e)}

    # Use index for O(1) lookup (enterprise domain)
    if domain == "enterprise-attack":
        technique = ctx.request_context.lifespan_context.techniques_by_mitre_id.get(technique_id)
    else:
        # Fallback to linear search for other domains
        data = get_attack_data(domain, ctx)
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
        return {"error": f"Technique '{technique_id}' not found"}

    return {"technique": format_technique(technique, include_description=True)}


# Define a resource to get information about the server
@mcp.resource("mitre-attack://info")
def get_server_info() -> str:
    """Get information about the MITRE ATT&CK MCP server."""
    return """
    MITRE ATT&CK MCP Server

    This server provides tools for working with the MITRE ATT&CK framework
    using the mitreattack-python library.

    Available domains:
    - enterprise-attack: Enterprise ATT&CK
    - mobile-attack: Mobile ATT&CK
    - ics-attack: ICS ATT&CK

    Available tools:
    - get_techniques: Get all techniques
    - get_tactics: Get all tactics
    - get_groups: Get all groups
    - get_software: Get all software
    - get_techniques_by_tactic: Get techniques by tactic
    - get_techniques_used_by_group: Get techniques used by a group
    - get_mitigations: Get all mitigations
    - get_techniques_mitigated_by_mitigation: Get mitigations for a technique
    - get_technique_by_id: Get a technique by its MITRE ATT&CK ID
    """


def signal_handler(signum: int, frame: Any) -> None:
    """Handle shutdown signals gracefully."""
    sig_name = signal.Signals(signum).name
    logger.info("\n%s received. Shutting down gracefully...", sig_name)
    sys.exit(0)


def print_help() -> None:
    """Print help message and exit."""
    print("MITRE ATT&CK MCP Server")
    print("Usage: mitre-mcp [options]")
    print("\nOptions:")
    print("  --http               Run as HTTP server with streamable HTTP transport")
    print("  --host HOST          Host to bind to (default: localhost, only with --http)")
    print("  --port PORT          Port to bind to (default: 8000, only with --http)")
    print("  --force-download     Force download of MITRE ATT&CK data even if it's recent")
    print("  -h, --help           Show this help message and exit")
    sys.exit(0)


def parse_http_args() -> tuple[str, int]:
    """Parse HTTP host and port from command line arguments.

    Returns:
        Tuple of (host, port)
    """
    host = os.getenv("FASTMCP_SERVER_HOST", "localhost")
    port = int(os.getenv("FASTMCP_SERVER_PORT", "8000"))

    for i, arg in enumerate(sys.argv):
        if arg == "--host" and i + 1 < len(sys.argv):
            host = sys.argv[i + 1]
        elif arg == "--port" and i + 1 < len(sys.argv):
            try:
                port = int(sys.argv[i + 1])
            except ValueError:
                logger.error("Invalid port number: %s", sys.argv[i + 1])
                sys.exit(1)

    return host, port


def setup_http_server(host: str, port: int) -> None:
    """Configure and display HTTP server information.

    Args:
        host: Server host address
        port: Server port number
    """
    logger.info("Starting MITRE ATT&CK MCP Server (HTTP mode on %s:%d)", host, port)
    logger.info("Press Ctrl+C to stop the server")

    # Configure FastMCP settings for HTTP mode
    mcp.settings.host = host
    mcp.settings.port = port

    # Show configuration for HTTP mode
    server_url = f"http://{host}:{port}"
    config_snippet = {"mcpServers": {"mitreattack": {"url": f"{server_url}/mcp"}}}
    config_message = (
        "\n"
        + "=" * 70
        + "\n"
        + "MCP Client Configuration (Streamable HTTP Transport)\n"
        + f"Server URL: {server_url}\n"
        + f"MCP Endpoint: {server_url}/mcp\n"
        + "\n"
        + "Add this to your MCP client configuration:\n"
        + json.dumps(config_snippet, indent=2)
        + "\n"
        + "=" * 70
        + "\n"
    )
    # Print to stderr with immediate flush
    print(config_message, file=sys.stderr, flush=True)

    # Add CORS middleware to support async notifications from MCP clients
    # Get the streamable HTTP app and add CORS middleware
    app = mcp.streamable_http_app()
    if app:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],  # Allow all origins for development
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        logger.info("CORS middleware enabled for async notifications")


def main() -> None:
    """Entry point for the package when installed."""
    # Print help message if requested
    if "--help" in sys.argv or "-h" in sys.argv:
        print_help()

    # Set up signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        if "--http" in sys.argv:
            host, port = parse_http_args()
            setup_http_server(host, port)
            # Run as HTTP server with streamable HTTP transport
            mcp.run(transport="streamable-http", mount_path="/mcp")
        else:
            logger.info("Starting MITRE ATT&CK MCP Server (stdio mode)")
            logger.info("Press Ctrl+C to stop the server")
            # Run with default transport (stdio)
            mcp.run()
    except KeyboardInterrupt:
        logger.info("\nKeyboard interrupt received. Shutting down gracefully...")
        sys.exit(0)
    except Exception as e:
        logger.error("Server error: %s", e, exc_info=True)
        sys.exit(1)


# Run the server if executed directly
if __name__ == "__main__":
    main()
