#!/usr/bin/env python3
"""
Download MITRE ATT&CK data for testing.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import requests


def download_attack_data(data_dir: str = "tests/data", force: bool = False) -> dict:
    """Download MITRE ATT&CK data to the specified directory.

    Args:
        data_dir: Directory to save the data
        force: Force download even if data is recent

    Returns:
        Dictionary with paths to the downloaded data files
    """
    # Create the data directory if it doesn't exist
    os.makedirs(data_dir, exist_ok=True)

    # URLs for the MITRE ATT&CK STIX data
    urls = {
        "enterprise": "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json",
        "mobile": "https://raw.githubusercontent.com/mitre/cti/master/mobile-attack/mobile-attack.json",
        "ics": "https://raw.githubusercontent.com/mitre/cti/master/ics-attack/ics-attack.json",
    }

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
        if not os.path.exists(paths["metadata"]):
            need_download = True
        else:
            try:
                with open(paths["metadata"]) as f:
                    metadata = json.load(f)
                last_update = datetime.fromisoformat(metadata["last_update"])
                now = datetime.now(timezone.utc)
                # Download if data is more than 1 day old
                if (now - last_update).days >= 1:
                    need_download = True
                    print(
                        f"MITRE ATT&CK data is {(now - last_update).days} days old. Downloading new data..."
                    )
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
            with open(paths[domain], "w") as f:
                f.write(response.text)

        # Save metadata
        metadata = {
            "last_update": datetime.now(timezone.utc).isoformat(),
            "domains": list(urls.keys()),
        }
        with open(paths["metadata"], "w") as f:
            json.dump(metadata, f, indent=2)

        print("MITRE ATT&CK data downloaded successfully!")

    return paths


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Download MITRE ATT&CK data for testing")
    parser.add_argument(
        "--force", action="store_true", help="Force download even if data is recent"
    )
    parser.add_argument("--data-dir", default="tests/data", help="Directory to save the data")

    args = parser.parse_args()
    download_attack_data(data_dir=args.data_dir, force=args.force)
