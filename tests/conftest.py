"""Pytest configuration and shared fixtures."""

import json
import os
import tempfile
from pathlib import Path
from typing import Any, Dict
from unittest.mock import MagicMock

import pytest
from mitreattack.stix20 import MitreAttackData


@pytest.fixture
def sample_technique() -> dict[str, Any]:
    """Sample technique object."""
    return {
        "id": "attack-pattern--abc123",
        "type": "attack-pattern",
        "name": "Process Injection",
        "description": (
            "Adversaries may inject code into processes in order to "
            "evade process-based defenses."
        ),
        "external_references": [
            {
                "source_name": "mitre-attack",
                "external_id": "T1055",
                "url": "https://attack.mitre.org/techniques/T1055",
            }
        ],
        "kill_chain_phases": [{"kill_chain_name": "mitre-attack", "phase_name": "defense-evasion"}],
    }


@pytest.fixture
def sample_long_technique() -> dict[str, Any]:
    """Sample technique with long description for truncation testing."""
    return {
        "id": "attack-pattern--xyz789",
        "type": "attack-pattern",
        "name": "Test Technique",
        "description": "a" * 600,  # Long description to test truncation
        "external_references": [{"source_name": "mitre-attack", "external_id": "T1234"}],
    }


@pytest.fixture
def sample_group() -> dict[str, Any]:
    """Sample group object."""
    return {
        "id": "intrusion-set--abc123",
        "type": "intrusion-set",
        "name": "APT28",
        "description": (
            "APT28 is a threat group that has been attributed to "
            "Russia's General Staff Main Intelligence Directorate."
        ),
        "aliases": ["Fancy Bear", "Sofacy", "Sednit"],
        "external_references": [{"source_name": "mitre-attack", "external_id": "G0007"}],
    }


@pytest.fixture
def sample_mitigation() -> dict[str, Any]:
    """Sample mitigation object."""
    return {
        "id": "course-of-action--abc123",
        "type": "course-of-action",
        "name": "Application Isolation and Sandboxing",
        "description": (
            "Restrict execution of code to a virtual environment on or "
            "in transit to an endpoint system."
        ),
    }


@pytest.fixture
def sample_stix_bundle() -> dict[str, Any]:
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
                "external_references": [{"source_name": "mitre-attack", "external_id": "T1234"}],
            },
            {
                "type": "intrusion-set",
                "id": "intrusion-set--test1",
                "name": "Test Group",
                "aliases": ["TestGroup"],
            },
        ],
    }


@pytest.fixture
def temp_data_dir():
    """Create temporary directory for test data."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def sample_metadata() -> dict[str, Any]:
    """Sample metadata.json content."""
    return {"last_update": "2025-11-17T12:00:00+00:00", "domains": ["enterprise", "mobile", "ics"]}


@pytest.fixture
def mock_attack_data(sample_technique, sample_group, sample_mitigation):
    """Mock MitreAttackData object."""
    mock = MagicMock(spec=MitreAttackData)
    mock.get_techniques.return_value = [sample_technique]
    mock.get_groups.return_value = [sample_group]
    mock.get_tactics.return_value = []
    mock.get_software.return_value = []
    mock.get_mitigations.return_value = [sample_mitigation]
    mock.get_techniques_used_by_group.return_value = [
        {"object": sample_technique, "relationship": {}}
    ]
    mock.get_techniques_mitigated_by_mitigation.return_value = [
        {"object": sample_technique, "relationship": {}}
    ]
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
        groups_index: dict[str, Any]
        mitigations_index: dict[str, Any]
        techniques_by_mitre_id: dict[str, Any]

    @dataclass
    class MockRequestContext:
        lifespan_context: MockLifespanContext

    @dataclass
    class MockContext:
        request_context: MockRequestContext

    # Build simple indices
    groups_index = {"apt28": mock_attack_data.get_groups()[0]}
    mitigations_index = {
        "application isolation and sandboxing": mock_attack_data.get_mitigations()[0]
    }
    techniques_index = {"T1055": mock_attack_data.get_techniques()[0]}

    lifespan_ctx = MockLifespanContext(
        enterprise_attack=mock_attack_data,
        mobile_attack=mock_attack_data,
        ics_attack=mock_attack_data,
        groups_index=groups_index,
        mitigations_index=mitigations_index,
        techniques_by_mitre_id=techniques_index,
    )

    request_ctx = MockRequestContext(lifespan_context=lifespan_ctx)
    return MockContext(request_context=request_ctx)
