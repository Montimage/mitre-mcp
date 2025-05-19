#!/usr/bin/env python3
"""
MITRE ATT&CK MCP Server

This server provides MCP tools for working with the MITRE ATT&CK framework using the mitreattack-python library.
Implemented using the official MCP Python SDK.
"""

from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from mitreattack.stix20 import MitreAttackData
from mitreattack import download_stix

from mcp.server.fastmcp import FastMCP, Context

# Create an MCP server
mcp = FastMCP("MITRE ATT&CK Server")


# Define our application context
@dataclass
class AttackContext:
    """Context for the MITRE ATT&CK MCP server."""
    enterprise_attack: MitreAttackData
    mobile_attack: MitreAttackData
    ics_attack: MitreAttackData


import os
import json
import requests
import datetime
import time
from pathlib import Path

def download_and_save_attack_data(data_dir: str, force: bool = False) -> dict:
    """Download and save MITRE ATT&CK data to the specified directory.
    
    Args:
        data_dir: Directory to save the data
        force: Force download even if data is recent
        
    Returns:
        Dictionary with paths to the downloaded data files
    """
    # URLs for the MITRE ATT&CK STIX data
    urls = {
        "enterprise": "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json",
        "mobile": "https://raw.githubusercontent.com/mitre/cti/master/mobile-attack/mobile-attack.json",
        "ics": "https://raw.githubusercontent.com/mitre/cti/master/ics-attack/ics-attack.json"
    }
    
    # File paths
    paths = {
        "enterprise": os.path.join(data_dir, "enterprise-attack.json"),
        "mobile": os.path.join(data_dir, "mobile-attack.json"),
        "ics": os.path.join(data_dir, "ics-attack.json"),
        "metadata": os.path.join(data_dir, "metadata.json")
    }
    
    # Check if we need to download new data
    need_download = force
    if not need_download:
        if not os.path.exists(paths["metadata"]):
            need_download = True
        else:
            try:
                with open(paths["metadata"], 'r') as f:
                    metadata = json.load(f)
                last_update = datetime.datetime.fromisoformat(metadata["last_update"])
                now = datetime.datetime.now()
                # Download if data is more than 1 day old
                if (now - last_update).days >= 1:
                    need_download = True
                    print(f"MITRE ATT&CK data is {(now - last_update).days} days old. Downloading new data...")
                else:
                    print(f"Using cached MITRE ATT&CK data from {last_update.isoformat()}")
            except (json.JSONDecodeError, KeyError, ValueError):
                need_download = True
    
    if need_download:
        print("Downloading MITRE ATT&CK data...")
        for domain, url in urls.items():
            print(f"Downloading {domain.capitalize()} ATT&CK data...")
            response = requests.get(url)
            response.raise_for_status()
            with open(paths[domain], 'w') as f:
                f.write(response.text)
        
        # Save metadata
        metadata = {
            "last_update": datetime.datetime.now().isoformat(),
            "domains": list(urls.keys())
        }
        with open(paths["metadata"], 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print("MITRE ATT&CK data downloaded successfully.")
    
    return paths

@asynccontextmanager
async def attack_lifespan(server: FastMCP) -> AsyncIterator[AttackContext]:
    """Initialize and manage MITRE ATT&CK data."""
    # Create data directory if it doesn't exist
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
    os.makedirs(data_dir, exist_ok=True)
    print(f"Using data directory: {data_dir}")
    
    try:
        # Get command line arguments
        import sys
        force_download = "--force-download" in sys.argv
        
        # Download and save MITRE ATT&CK data
        paths = download_and_save_attack_data(data_dir, force=force_download)
        
        # Initialize on startup
        print("Initializing MITRE ATT&CK data...")
        enterprise_attack = MitreAttackData(paths["enterprise"])
        mobile_attack = MitreAttackData(paths["mobile"])
        ics_attack = MitreAttackData(paths["ics"])
        print("MITRE ATT&CK data initialized successfully.")
    
        yield AttackContext(
            enterprise_attack=enterprise_attack,
            mobile_attack=mobile_attack,
            ics_attack=ics_attack
        )
    finally:
        # No cleanup needed for persistent data directory
        pass


# Pass lifespan to server
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


def format_technique(technique: Dict[str, Any], include_description: bool = False) -> Dict[str, Any]:
    """Format a technique object for output with token optimization."""
    if not technique:
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
        if len(description) > 500:
            result["description"] = description[:497] + "..."
        else:
            result["description"] = description
    
    # Add MITRE ATT&CK ID if available
    for ref in technique.get("external_references", []):
        if ref.get("source_name") == "mitre-attack":
            result["mitre_id"] = ref.get("external_id", "")
            break
    
    return result


def format_relationship_map(relationship_map: List[Dict[str, Any]], include_description: bool = False, limit: int = None) -> List[Dict[str, Any]]:
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
    limit: int = 20,
    offset: int = 0
) -> Dict[str, Any]:
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
    data = get_attack_data(domain, ctx)
    techniques = data.get_techniques(
        include_subtechniques=include_subtechniques,
        remove_revoked_deprecated=remove_revoked_deprecated
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
            "has_more": end_idx < total_count
        }
    }


@mcp.tool()
def get_tactics(
    ctx: Context,
    domain: str = "enterprise-attack",
    remove_revoked_deprecated: bool = False
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Get all tactics from the MITRE ATT&CK framework.
    
    Args:
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        remove_revoked_deprecated: Remove revoked or deprecated objects
        
    Returns:
        Dictionary containing a list of tactics
    """
    data = get_attack_data(domain, ctx)
    tactics = data.get_tactics(remove_revoked_deprecated=remove_revoked_deprecated)
    
    return {
        "tactics": [
            {
                "id": tactic.get("id", ""),
                "name": tactic.get("name", ""),
                "shortname": tactic.get("x_mitre_shortname", ""),
                "description": tactic.get("description", "")
            }
            for tactic in tactics
        ]
    }


@mcp.tool()
def get_groups(
    ctx: Context,
    domain: str = "enterprise-attack",
    remove_revoked_deprecated: bool = False
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Get all groups from the MITRE ATT&CK framework.
    
    Args:
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        remove_revoked_deprecated: Remove revoked or deprecated objects
        
    Returns:
        Dictionary containing a list of groups
    """
    data = get_attack_data(domain, ctx)
    groups = data.get_groups(remove_revoked_deprecated=remove_revoked_deprecated)
    
    return {
        "groups": [
            {
                "id": group.get("id", ""),
                "name": group.get("name", ""),
                "description": group.get("description", ""),
                "aliases": group.get("aliases", [])
            }
            for group in groups
        ]
    }


@mcp.tool()
def get_software(
    ctx: Context,
    domain: str = "enterprise-attack",
    software_type: Optional[str] = None,
    remove_revoked_deprecated: bool = False
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Get all software from the MITRE ATT&CK framework.
    
    Args:
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        software_type: Type of software to query (malware, tool, or None for both)
        remove_revoked_deprecated: Remove revoked or deprecated objects
        
    Returns:
        Dictionary containing a list of software
    """
    data = get_attack_data(domain, ctx)
    software = data.get_software(
        software_type=software_type,
        remove_revoked_deprecated=remove_revoked_deprecated
    )
    
    return {
        "software": [
            {
                "id": s.get("id", ""),
                "name": s.get("name", ""),
                "type": s.get("type", ""),
                "description": s.get("description", "")
            }
            for s in software
        ]
    }


@mcp.tool()
def get_techniques_by_tactic(
    ctx: Context,
    tactic_shortname: str,
    domain: str = "enterprise-attack",
    remove_revoked_deprecated: bool = False
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Get techniques by tactic.
    
    Args:
        tactic_shortname: The shortname of the tactic (e.g., 'defense-evasion')
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        remove_revoked_deprecated: Remove revoked or deprecated objects
        
    Returns:
        Dictionary containing a list of techniques
    """
    data = get_attack_data(domain, ctx)
    techniques = data.get_techniques_by_tactic(
        tactic_shortname=tactic_shortname,
        domain=domain,
        remove_revoked_deprecated=remove_revoked_deprecated
    )
    
    return {
        "techniques": [format_technique(technique) for technique in techniques]
    }


@mcp.tool()
def get_techniques_used_by_group(
    ctx: Context,
    group_name: str,
    domain: str = "enterprise-attack"
) -> Dict[str, Any]:
    """
    Get techniques used by a group.
    
    Args:
        group_name: The name of the group
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        
    Returns:
        Dictionary containing the group and a list of techniques
    """
    data = get_attack_data(domain, ctx)
    
    # Find the group by name
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
def get_mitigations(
    ctx: Context,
    domain: str = "enterprise-attack",
    remove_revoked_deprecated: bool = False
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Get all mitigations from the MITRE ATT&CK framework.
    
    Args:
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        remove_revoked_deprecated: Remove revoked or deprecated objects
        
    Returns:
        Dictionary containing a list of mitigations
    """
    data = get_attack_data(domain, ctx)
    mitigations = data.get_mitigations(remove_revoked_deprecated=remove_revoked_deprecated)
    
    return {
        "mitigations": [
            {
                "id": mitigation.get("id", ""),
                "name": mitigation.get("name", ""),
                "description": mitigation.get("description", "")
            }
            for mitigation in mitigations
        ]
    }


@mcp.tool()
def get_techniques_mitigated_by_mitigation(
    ctx: Context,
    mitigation_name: str,
    domain: str = "enterprise-attack"
) -> Dict[str, Any]:
    """
    Get techniques mitigated by a mitigation.
    
    Args:
        mitigation_name: The name of the mitigation
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        
    Returns:
        Dictionary containing the mitigation and a list of techniques
    """
    data = get_attack_data(domain, ctx)
    
    # Find the mitigation by name
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
        "mitigation": {
            "id": mitigation.get("id", ""),
            "name": mitigation.get("name", "")
        },
        "techniques": format_relationship_map(techniques)
    }


@mcp.tool()
def get_technique_by_id(
    ctx: Context,
    technique_id: str,
    domain: str = "enterprise-attack"
) -> Dict[str, Any]:
    """
    Get a technique by its MITRE ATT&CK ID.
    
    Args:
        technique_id: The MITRE ATT&CK ID of the technique (e.g., 'T1055')
        domain: Domain to query (enterprise-attack, mobile-attack, or ics-attack)
        
    Returns:
        Dictionary containing the technique
    """
    data = get_attack_data(domain, ctx)
    
    # Find the technique by MITRE ATT&CK ID
    techniques = data.get_techniques()
    technique = None
    for t in techniques:
        for ref in t.get("external_references", []):
            if ref.get("source_name") == "mitre-attack" and ref.get("external_id") == technique_id:
                technique = t
                break
        if technique:
            break
    
    if not technique:
        return {"error": f"Technique '{technique_id}' not found"}
    
    return {
        "technique": format_technique(technique)
    }


# Define a resource to get information about the server
@mcp.resource("mitre-attack://info")
def get_server_info() -> str:
    """Get information about the MITRE ATT&CK MCP server."""
    return """
    MITRE ATT&CK MCP Server
    
    This server provides tools for working with the MITRE ATT&CK framework using the mitreattack-python library.
    
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
    - get_techniques_mitigated_by_mitigation: Get techniques mitigated by a mitigation
    - get_technique_by_id: Get a technique by its MITRE ATT&CK ID
    """


def main():
    """Entry point for the package when installed."""
    import sys
    
    # Print help message if requested
    if "--help" in sys.argv or "-h" in sys.argv:
        print("MITRE ATT&CK MCP Server")
        print("Usage: mitre-mcp [options]")
        print("\nOptions:")
        print("  --http               Run as HTTP server with streamable HTTP transport")
        print("  --force-download     Force download of MITRE ATT&CK data even if it's recent")
        print("  -h, --help           Show this help message and exit")
        sys.exit(0)
    
    if "--http" in sys.argv:
        # Run as HTTP server with streamable HTTP transport
        mcp.run(transport="streamable-http")
    else:
        # Run with default transport (stdio)
        mcp.run()

# Run the server if executed directly
if __name__ == "__main__":
    main()
