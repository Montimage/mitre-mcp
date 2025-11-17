"""
Unit tests for mitre_mcp_server.py
"""

import asyncio
import datetime
import json
import os
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from mitre_mcp.mitre_mcp_server import (
    AttackContext,
    download_and_save_attack_data_async,
    format_relationship_map,
    format_technique,
    get_attack_data,
    get_server_info,
    mcp,
)


class TestMitreMcpServer(unittest.TestCase):
    """Test cases for mitre_mcp_server.py"""

    def setUp(self):
        """Set up test fixtures."""
        self.test_data_dir = "/tmp/mitre_test_data"
        os.makedirs(self.test_data_dir, exist_ok=True)

        # Create a minimal test context
        self.ctx = MagicMock()
        self.ctx.request_context = MagicMock()
        self.ctx.request_context.lifespan_context = AttackContext(
            enterprise_attack=MagicMock(),
            mobile_attack=MagicMock(),
            ics_attack=MagicMock(),
            groups_index={},
            mitigations_index={},
            techniques_by_mitre_id={},
        )

        # Sample technique data
        self.sample_technique = {
            "type": "attack-pattern",
            "id": "attack-pattern--12345678-1234-1234-1234-1234567890ab",
            "name": "Sample Technique",
            "description": "This is a sample technique for testing purposes.",
            "x_mitre_domains": ["enterprise-attack"],
            "x_mitre_platforms": ["Windows", "macOS", "Linux"],
            "x_mitre_data_sources": ["Process monitoring", "Command monitoring"],
            "x_mitre_is_subtechnique": False,
            "external_references": [{"source_name": "mitre-attack", "external_id": "T1234"}],
        }

        # Sample relationship data
        self.sample_relationships = [
            {
                "type": "relationship",
                "id": "relationship--12345678-1234-1234-1234-1234567890ab",
                "relationship_type": "mitigates",
                "source_ref": "course-of-action--12345678-1234-1234-1234-1234567890ab",
                "target_ref": "attack-pattern--12345678-1234-1234-1234-1234567890ab",
            }
        ]

    def tearDown(self):
        """Clean up after tests."""
        # Clean up test data directory
        import shutil

        if os.path.exists(self.test_data_dir):
            shutil.rmtree(self.test_data_dir)

    @patch("mitre_mcp.mitre_mcp_server.httpx.AsyncClient")
    @patch("mitre_mcp.mitre_mcp_server.load_metadata")
    @patch("builtins.open", new_callable=unittest.mock.mock_open)
    def test_download_and_save_attack_data_force_download(
        self, mock_open, mock_load_metadata, mock_async_client
    ):
        """Test download_and_save_attack_data_async with force download."""
        # Mock load_metadata to return None (no cached data)
        mock_load_metadata.return_value = None

        # Mock HTTP client and response
        mock_response = AsyncMock()
        mock_response.text = '{"type": "bundle", "objects": []}'
        mock_response.raise_for_status = MagicMock()

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=None)
        mock_async_client.return_value = mock_client_instance

        # Call the async function
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                download_and_save_attack_data_async(self.test_data_dir, force=True)
            )
        finally:
            loop.close()

        # Assertions
        self.assertIn("enterprise", result)
        self.assertIn("mobile", result)
        self.assertIn("ics", result)
        self.assertIn("metadata", result)

    def test_get_attack_data_enterprise(self):
        """Test get_attack_data with enterprise domain."""
        # Setup
        mock_attack = MagicMock()
        self.ctx.request_context.lifespan_context.enterprise_attack = mock_attack

        # Call
        result = get_attack_data("enterprise-attack", self.ctx)

        # Assert
        self.assertEqual(result, mock_attack)

    def test_get_attack_data_mobile(self):
        """Test get_attack_data with mobile domain."""
        # Setup
        mock_attack = MagicMock()
        self.ctx.request_context.lifespan_context.mobile_attack = mock_attack

        # Call
        result = get_attack_data("mobile-attack", self.ctx)

        # Assert
        self.assertEqual(result, mock_attack)

    def test_get_attack_data_ics(self):
        """Test get_attack_data with ics domain."""
        # Setup
        mock_attack = MagicMock()
        self.ctx.request_context.lifespan_context.ics_attack = mock_attack

        # Call
        result = get_attack_data("ics-attack", self.ctx)

        # Assert
        self.assertEqual(result, mock_attack)

    def test_format_technique_basic(self):
        """Test format_technique with basic options."""
        # Call
        result = format_technique(self.sample_technique, include_description=False)

        # Assert
        self.assertIn("name", result)
        self.assertIn("mitre_id", result)
        self.assertEqual(result["mitre_id"], "T1234")
        self.assertNotIn("description", result)

    def test_format_technique_with_description(self):
        """Test format_technique with description included."""
        # Call
        result = format_technique(self.sample_technique, include_description=True)

        # Assert
        self.assertIn("description", result)

    def test_format_relationship_map(self):
        """Test format_relationship_map."""
        # Create relationship map with technique objects
        relationship_map = [
            {
                "object": self.sample_technique,
                "relationship": {"type": "relationship", "relationship_type": "mitigates"},
            }
        ]

        # Call
        result = format_relationship_map(relationship_map)

        # Assert
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 1)
        self.assertIn("name", result[0])
        self.assertIn("mitre_id", result[0])

    def test_get_server_info(self):
        """Test get_server_info endpoint."""
        # Call
        result = get_server_info()

        # Assert
        self.assertIsInstance(result, str)
        self.assertIn("MITRE ATT&CK MCP Server", result)
        self.assertIn("enterprise-attack", result)
        self.assertIn("get_techniques", result)


if __name__ == "__main__":
    unittest.main()
