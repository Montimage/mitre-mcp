"""
Integration tests for MCP tools with MITRE ATT&CK data.
"""
import unittest
import os
import json
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime, timezone

from mitre_mcp.mitre_mcp_server import (
    get_techniques,
    get_tactics,
    get_groups,
    get_software,
    get_techniques_by_tactic,
    get_techniques_used_by_group,
    get_mitigations,
    get_techniques_mitigated_by_mitigation,
    get_technique_by_id,
    AttackContext,
    mcp
)
from mitreattack.stix20 import MitreAttackData

class TestMcpToolsIntegration(unittest.IsolatedAsyncioTestCase):
    """Integration tests for MCP tools with MITRE ATT&CK data."""
    
    @classmethod
    def setUpClass(cls):
        """Set up test fixtures once before all tests."""
        # Get the path to the test data directory
        data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
        
        # Initialize MITRE ATT&CK data with the downloaded files
        cls.enterprise_attack = MitreAttackData(os.path.join(data_dir, "enterprise-attack.json"))
        cls.mobile_attack = MitreAttackData(os.path.join(data_dir, "mobile-attack.json"))
        cls.ics_attack = MitreAttackData(os.path.join(data_dir, "ics-attack.json"))
        
        # Create a test context
        cls.ctx = MagicMock()
        cls.ctx.state = AttackContext(
            enterprise_attack=cls.enterprise_attack,
            mobile_attack=cls.mobile_attack,
            ics_attack=cls.ics_attack
        )
    
    def test_get_techniques(self):
        """Test get_techniques with default parameters."""
        # Call
        result = get_techniques(
            self.ctx,
            domain="enterprise-attack",
            limit=5,
            offset=0
        )
        
        # Assert
        self.assertIn('techniques', result)
        self.assertLessEqual(len(result['techniques']), 5)
        self.assertIn('pagination', result)
        self.assertIn('total', result['pagination'])
        self.assertGreater(result['pagination']['total'], 0)
    
    def test_get_tactics(self):
        """Test get_tactics with default parameters."""
        # Call
        result = get_tactics(
            self.ctx,
            domain="enterprise-attack"
        )
        
        # Assert
        self.assertIn('tactics', result)
        self.assertGreater(len(result['tactics']), 0)
        
        # Check if common tactics exist
        tactic_names = [t['name'] for t in result['tactics']]
        self.assertIn('Persistence', tactic_names)
        self.assertIn('Lateral Movement', tactic_names)
    
    def test_get_groups(self):
        """Test get_groups with default parameters."""
        # Call
        result = get_groups(
            self.ctx,
            domain="enterprise-attack"
        )
        
        # Assert
        self.assertIn('groups', result)
        self.assertGreater(len(result['groups']), 0)
    
    def test_get_software(self):
        """Test get_software with default parameters."""
        # Call
        result = get_software(
            self.ctx,
            domain="enterprise-attack"
        )
        
        # Assert
        self.assertIn('software', result)
        self.assertGreater(len(result['software']), 0)
    
    def test_get_techniques_by_tactic(self):
        """Test get_techniques_by_tactic with a known tactic."""
        # Call with persistence tactic
        result = get_techniques_by_tactic(
            self.ctx,
            tactic_shortname="persistence",
            domain="enterprise-attack"
        )
        
        # Assert
        self.assertIn('tactic', result)
        self.assertIn('techniques', result)
        self.assertGreater(len(result['techniques']), 0)
    
    def test_get_techniques_used_by_group(self):
        """Test get_techniques_used_by_group with a known group."""
        # Call with APT29 group (known to exist in the dataset)
        result = get_techniques_used_by_group(
            self.ctx,
            group_name="APT29",
            domain="enterprise-attack"
        )
        
        # Assert
        self.assertIn('group', result)
        self.assertIn('techniques', result)
        # Some groups might not have techniques in the test dataset
        # So we just check the structure, not the content
    
    def test_get_mitigations(self):
        """Test get_mitigations with default parameters."""
        # Call
        result = get_mitigations(
            self.ctx,
            domain="enterprise-attack"
        )
        
        # Assert
        self.assertIn('mitigations', result)
        self.assertGreater(len(result['mitigations']), 0)
    
    def test_get_techniques_mitigated_by_mitigation(self):
        """Test get_techniques_mitigated_by_mitigation with a known mitigation."""
        # First get some mitigations
        mitigations = get_mitigations(
            self.ctx,
            domain="enterprise-attack"
        )
        
        if not mitigations or 'mitigations' not in mitigations or not mitigations['mitigations']:
            self.skipTest("No mitigations found in the dataset")
            
        # Use the first mitigation
        mitigation_name = mitigations['mitigations'][0]['name']
        
        # Call
        result = get_techniques_mitigated_by_mitigation(
            self.ctx,
            mitigation_name=mitigation_name,
            domain="enterprise-attack"
        )
        
        # Assert
        self.assertIn('mitigation', result)
        self.assertIn('techniques', result)
        # Some mitigations might not have techniques in the test dataset
        # So we just check the structure, not the content
    
    def test_get_technique_by_id(self):
        """Test get_technique_by_id with a known technique ID."""
        # Use T1055 (Process Injection) which should exist in the dataset
        result = get_technique_by_id(
            self.ctx,
            technique_id="T1055",
            domain="enterprise-attack"
        )
        
        # Assert
        self.assertIn('technique', result)
        self.assertEqual(result['technique']['id'], 'T1055')
        self.assertEqual(result['technique']['name'], 'Process Injection')


if __name__ == '__main__':
    unittest.main()
