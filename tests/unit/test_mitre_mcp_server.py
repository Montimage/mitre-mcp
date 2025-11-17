"""
Unit tests for mitre_mcp_server.py
"""
import unittest
from unittest.mock import patch, MagicMock, AsyncMock
import json
import os
from pathlib import Path
import datetime

from mitre_mcp.mitre_mcp_server import (
    download_and_save_attack_data,
    get_attack_data,
    format_technique,
    format_relationship_map,
    health_check,
    get_server_info,
    AttackContext,
    mcp
)

class TestMitreMcpServer(unittest.TestCase):
    """Test cases for mitre_mcp_server.py"""
    
    def setUp(self):
        """Set up test fixtures."""
        self.test_data_dir = "/tmp/mitre_test_data"
        os.makedirs(self.test_data_dir, exist_ok=True)
        
        # Create a minimal test context
        self.ctx = MagicMock()
        self.ctx.state = AttackContext(
            enterprise_attack=MagicMock(),
            mobile_attack=MagicMock(),
            ics_attack=MagicMock()
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
            "external_references": [
                {
                    "source_name": "mitre-attack",
                    "external_id": "T1234"
                }
            ]
        }
        
        # Sample relationship data
        self.sample_relationships = [
            {
                "type": "relationship",
                "id": "relationship--12345678-1234-1234-1234-1234567890ab",
                "relationship_type": "mitigates",
                "source_ref": "course-of-action--12345678-1234-1234-1234-1234567890ab",
                "target_ref": "attack-pattern--12345678-1234-1234-1234-1234567890ab"
            }
        ]

    def tearDown(self):
        """Clean up after tests."""
        # Clean up test data directory
        import shutil
        if os.path.exists(self.test_data_dir):
            shutil.rmtree(self.test_data_dir)
    
    @patch('mitre_mcp.mitre_mcp_server.requests.get')
    @patch('mitre_mcp.mitre_mcp_server.os.path.exists')
    @patch('mitre_mcp.mitre_mcp_server.json.load')
    @patch('mitre_mcp.mitre_mcp_server.json.dump')
    @patch('builtins.open', new_callable=unittest.mock.mock_open)
    def test_download_and_save_attack_data_force_download(
        self, mock_open, mock_json_dump, mock_json_load, 
        mock_exists, mock_requests_get
    ):
        """Test download_and_save_attack_data with force download."""
        # Mock the response
        mock_response = MagicMock()
        mock_response.text = '{"objects": []}'
        mock_requests_get.return_value = mock_response
        
        # Mock file existence
        mock_exists.return_value = False
        
        # Call the function
        result = download_and_save_attack_data(self.test_data_dir, force=True)
        
        # Assertions
        self.assertEqual(mock_requests_get.call_count, 3)  # Called for each domain
        self.assertIn('enterprise', result)
        self.assertIn('mobile', result)
        self.assertIn('ics', result)
    
    @patch('mitre_mcp.mitre_mcp_server.MitreAttackData')
    def test_get_attack_data_enterprise(self, mock_mitre_attack_data):
        """Test get_attack_data with enterprise domain."""
        # Setup
        mock_attack = MagicMock()
        self.ctx.state.enterprise_attack = mock_attack
        
        # Call
        result = get_attack_data("enterprise-attack", self.ctx)
        
        # Assert
        self.assertEqual(result, mock_attack)
    
    def test_format_technique_basic(self):
        """Test format_technique with basic options."""
        # Call
        result = format_technique(self.sample_technique, include_description=False)
        
        # Assert
        self.assertIn('name', result)
        self.assertIn('T1234', result['id'])
        self.assertNotIn('description', result)
    
    def test_format_technique_with_description(self):
        """Test format_technique with description included."""
        # Call
        result = format_technique(self.sample_technique, include_description=True)
        
        # Assert
        self.assertIn('description', result)
    
    def test_format_relationship_map(self):
        """Test format_relationship_map."""
        # Call
        result = format_relationship_map(self.sample_relationships)
        
        # Assert
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 1)
        self.assertIn('source_ref', result[0])
        self.assertIn('target_ref', result[0])
    
    def test_health_check(self):
        """Test health_check endpoint."""
        # Call
        result = health_check()
        
        # Assert
        self.assertIn('status', result)
        self.assertEqual(result['status'], 'ok')
        self.assertIn('version', result)
    
    def test_get_server_info(self):
        """Test get_server_info endpoint."""
        # Call
        result = get_server_info()
        
        # Assert
        self.assertIn('name', result)
        self.assertIn('version', result)
        self.assertIn('tools', result)
        self.assertGreater(len(result['tools']), 0)


if __name__ == '__main__':
    unittest.main()
