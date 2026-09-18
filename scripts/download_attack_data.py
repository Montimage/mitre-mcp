#!/usr/bin/env python3
"""Download MITRE ATT&CK data for testing.

Delegates to the package downloader so the source URLs, cache-expiry
rules, STIX validation and metadata handling live in one place
(``mitre_mcp``) instead of being re-implemented here.
"""

import asyncio

from mitre_mcp.mitre_mcp_server import download_and_save_attack_data_async


def download_attack_data(data_dir: str = "tests/data", force: bool = False) -> dict:
    """Download MITRE ATT&CK data to the specified directory.

    Args:
        data_dir: Directory to save the data
        force: Force download even if data is recent

    Returns:
        Dictionary with paths to the downloaded data files
    """
    return asyncio.run(download_and_save_attack_data_async(data_dir, force=force))


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Download MITRE ATT&CK data for testing")
    parser.add_argument(
        "--force", action="store_true", help="Force download even if data is recent"
    )
    parser.add_argument("--data-dir", default="tests/data", help="Directory to save the data")

    args = parser.parse_args()
    download_attack_data(data_dir=args.data_dir, force=args.force)
