#!/usr/bin/env python3
"""
Setup script for mitre-mcp package.
"""

import os
import re

from setuptools import find_packages, setup

# Read version from __init__.py
with open(os.path.join("mitre_mcp", "__init__.py"), encoding="utf-8") as f:
    version = re.search(r'^__version__ = ["\']([^"\']+)["\']', f.read(), re.MULTILINE).group(1)

# Read README
with open("README.md", encoding="utf-8") as fh:
    long_description = fh.read()

# Read requirements from requirements.txt
with open("requirements.txt", encoding="utf-8") as f:
    requirements = [line.strip() for line in f if line.strip() and not line.startswith("#")]

setup(
    name="mitre-mcp",
    version=version,
    author="Montimage",
    author_email="info@montimage.com",
    description="MITRE ATT&CK MCP Server for working with the MITRE ATT&CK framework",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/montimage/mitre-mcp",
    packages=find_packages(),
    include_package_data=True,
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Intended Audience :: Information Technology",
        "Intended Audience :: Science/Research",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Programming Language :: Python :: 3.13",
        "Programming Language :: Python :: 3.14",
        "Topic :: Security",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
    ],
    python_requires=">=3.10",
    install_requires=requirements,
    entry_points={
        "console_scripts": [
            "mitre-mcp=mitre_mcp.mitre_mcp_server:main",
        ],
    },
)
