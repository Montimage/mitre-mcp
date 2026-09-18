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

import httpx
from mcp.server.transport_security import TransportSecurityMiddleware
from starlette.applications import Starlette
from starlette.requests import HTTPConnection
from starlette.responses import JSONResponse
from starlette.routing import Route

from mitre_mcp.mitre_mcp_server import (
    AttackContext,
    add_cors_middleware_to_mcp,
    build_transport_security,
    download_and_save_attack_data_async,
    format_relationship_map,
    format_technique,
    get_attack_data,
    get_cors_middleware,
    get_server_info,
    mcp,
    setup_http_server,
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


class TestCorsConfiguration(unittest.TestCase):
    """Test cases for CORS configuration in HTTP mode."""

    @patch("mitre_mcp.mitre_mcp_server.Config")
    def test_cors_wildcard_explicit(self, mock_config):
        """Test CORS with explicit wildcard origin (opt-in)."""
        # Set explicit wildcard CORS config
        mock_config.CORS_ORIGINS = "*"

        # Call get_cors_middleware
        middleware_list = get_cors_middleware()

        # Verify middleware was created
        self.assertEqual(len(middleware_list), 1)
        middleware = middleware_list[0]

        # Verify regex pattern for all origins (explicit opt-in, no credentials)
        self.assertEqual(middleware.kwargs["allow_origin_regex"], r".*")
        self.assertEqual(middleware.kwargs["allow_credentials"], False)
        self.assertEqual(middleware.kwargs["allow_methods"], ["*"])
        self.assertEqual(middleware.kwargs["allow_headers"], ["*"])

    @patch("mitre_mcp.mitre_mcp_server.Config")
    def test_cors_specific_origins(self, mock_config):
        """Test CORS with specific origins."""
        # Set specific CORS origins
        mock_config.CORS_ORIGINS = "https://example.com,http://localhost:3000"

        # Call get_cors_middleware
        middleware_list = get_cors_middleware()

        # Verify middleware was created
        self.assertEqual(len(middleware_list), 1)
        middleware = middleware_list[0]

        # Verify specific origins
        self.assertEqual(
            middleware.kwargs["allow_origins"],
            ["https://example.com", "http://localhost:3000"],
        )
        # Credentials are never allowed, even with specific origins
        self.assertEqual(middleware.kwargs["allow_credentials"], False)
        self.assertEqual(middleware.kwargs["allow_methods"], ["*"])
        self.assertEqual(middleware.kwargs["allow_headers"], ["*"])

    @patch("mitre_mcp.mitre_mcp_server.Config")
    def test_cors_single_origin(self, mock_config):
        """Test CORS with a single specific origin."""
        # Set single CORS origin
        mock_config.CORS_ORIGINS = "https://myapp.example.com"

        # Call get_cors_middleware
        middleware_list = get_cors_middleware()

        # Verify middleware was created
        self.assertEqual(len(middleware_list), 1)
        middleware = middleware_list[0]

        # Verify single origin
        self.assertEqual(middleware.kwargs["allow_origins"], ["https://myapp.example.com"])
        self.assertEqual(middleware.kwargs["allow_credentials"], False)

    @patch("mitre_mcp.mitre_mcp_server.Config")
    def test_cors_origins_with_spaces(self, mock_config):
        """Test CORS origins parsing handles spaces correctly."""
        # Set CORS origins with spaces
        mock_config.CORS_ORIGINS = (
            "https://example.com , http://localhost:3000 , https://app.test.com"
        )

        # Call get_cors_middleware
        middleware_list = get_cors_middleware()

        # Get middleware kwargs
        middleware = middleware_list[0]

        # Verify origins are trimmed
        expected = ["https://example.com", "http://localhost:3000", "https://app.test.com"]
        self.assertEqual(middleware.kwargs["allow_origins"], expected)

    @patch("mitre_mcp.mitre_mcp_server.mcp")
    def test_setup_http_server_no_crash(self, mock_mcp):
        """Test setup_http_server runs without crashing."""
        mock_mcp.settings = MagicMock()

        # This should not raise an exception
        setup_http_server("localhost", 8000)

        # Verify settings were updated
        self.assertEqual(mock_mcp.settings.host, "localhost")
        self.assertEqual(mock_mcp.settings.port, 8000)

    @patch("mitre_mcp.mitre_mcp_server.mcp")
    @patch("mitre_mcp.mitre_mcp_server.Config")
    def test_add_cors_middleware_patches_mcp(self, mock_config, mock_mcp):
        """Test add_cors_middleware_to_mcp patches the streamable_http_app method."""
        mock_config.CORS_ORIGINS = "*"
        mock_app = MagicMock()
        original_method = MagicMock(return_value=mock_app)
        mock_mcp.streamable_http_app = original_method

        # Call the function to patch
        add_cors_middleware_to_mcp()

        # The method should be replaced
        self.assertNotEqual(mock_mcp.streamable_http_app, original_method)

        # Call the patched method
        mock_mcp.streamable_http_app()

        # The original method should have been called
        original_method.assert_called_once()
        # CORS middleware should have been added
        mock_app.add_middleware.assert_called_once()

    @patch("mitre_mcp.mitre_mcp_server.mcp")
    @patch("mitre_mcp.mitre_mcp_server.Config")
    def test_add_cors_middleware_with_specific_origins(self, mock_config, mock_mcp):
        """Test add_cors_middleware_to_mcp with specific origins."""
        mock_config.CORS_ORIGINS = "https://example.com,http://localhost:3000"
        mock_app = MagicMock()
        original_method = MagicMock(return_value=mock_app)
        mock_mcp.streamable_http_app = original_method

        # Call the function to patch
        add_cors_middleware_to_mcp()

        # Call the patched method
        mock_mcp.streamable_http_app()

        # Check the middleware was added with correct origins
        call_args = mock_app.add_middleware.call_args
        self.assertEqual(
            call_args[1]["allow_origins"],
            ["https://example.com", "http://localhost:3000"],
        )
        self.assertEqual(call_args[1]["allow_credentials"], False)

    def test_cors_default_localhost_no_credentials(self):
        """With no env override, CORS allows only localhost origins, no credentials."""
        saved = os.environ.pop("MITRE_CORS_ORIGINS", None)
        try:
            from importlib import reload
            from urllib.parse import urlparse

            from mitre_mcp import config as config_module

            reload(config_module)

            origins = [
                origin.strip()
                for origin in config_module.Config.CORS_ORIGINS.split(",")
                if origin.strip()
            ]
            self.assertTrue(origins)
            self.assertNotEqual(config_module.Config.CORS_ORIGINS.strip(), "*")
            for origin in origins:
                self.assertIn(urlparse(origin).hostname, ("localhost", "127.0.0.1"))

            with patch("mitre_mcp.mitre_mcp_server.Config", config_module.Config):
                middleware_list = get_cors_middleware()

            middleware = middleware_list[0]
            self.assertEqual(middleware.kwargs["allow_origins"], origins)
            self.assertFalse(middleware.kwargs["allow_credentials"])
        finally:
            if saved is not None:
                os.environ["MITRE_CORS_ORIGINS"] = saved
            from importlib import reload

            from mitre_mcp import config as config_module

            reload(config_module)

    @patch("mitre_mcp.mitre_mcp_server.Config")
    def test_cors_expose_headers_includes_session_id(self, mock_config):
        """CORS response carries Access-Control-Expose-Headers: Mcp-Session-Id."""
        mock_config.CORS_ORIGINS = "https://ui.example"

        async def ok(request):
            return JSONResponse({"ok": True})

        app = Starlette(
            routes=[Route("/mcp", ok, methods=["POST"])],
            middleware=get_cors_middleware(),
        )

        async def run():
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(
                transport=transport, base_url="http://localhost:8000"
            ) as client:
                return await client.post("/mcp", headers={"Origin": "https://ui.example"}, json={})

        response = asyncio.run(run())
        expose = response.headers.get("access-control-expose-headers", "")
        self.assertIn("mcp-session-id", expose.lower())


class TestTransportSecurity(unittest.TestCase):
    """Tests for DNS-rebinding transport security settings (F-BUG-002)."""

    @staticmethod
    def _conn(host: str, origin: str | None) -> HTTPConnection:
        headers = [(b"host", host.encode())]
        if origin is not None:
            headers.append((b"origin", origin.encode()))
        return HTTPConnection({"type": "http", "method": "GET", "path": "/mcp", "headers": headers})

    @patch("mitre_mcp.mitre_mcp_server.Config")
    def test_transport_security_configured_origin_accepted(self, mock_config):
        """--host 0.0.0.0 + MITRE_CORS_ORIGINS=https://ui.example accepts the
        listed Origin and answers an unlisted Origin with HTTP 403."""
        mock_config.CORS_ORIGINS = "https://ui.example"

        settings = build_transport_security("0.0.0.0", 8000)
        middleware = TransportSecurityMiddleware(settings)

        accepted = asyncio.run(
            middleware.validate_request(self._conn("localhost:8000", "https://ui.example"))
        )
        self.assertIsNone(accepted)

        rejected = asyncio.run(
            middleware.validate_request(self._conn("localhost:8000", "https://evil.example"))
        )
        self.assertIsNotNone(rejected)
        self.assertEqual(rejected.status_code, 403)

    @patch("mitre_mcp.mitre_mcp_server.Config")
    def test_transport_security_wired_from_setup(self, mock_config):
        """setup_http_server derives transport_security from --host + origins."""
        from mitre_mcp import mitre_mcp_server as server_module

        mock_config.CORS_ORIGINS = "https://ui.example"
        with patch.object(server_module.mcp, "settings", MagicMock()):
            server_module.setup_http_server("0.0.0.0", 8000)
            settings = server_module.mcp.settings.transport_security

        self.assertTrue(settings.enable_dns_rebinding_protection)
        self.assertIn("0.0.0.0:*", settings.allowed_hosts)
        self.assertIn("https://ui.example", settings.allowed_origins)

    @patch("mitre_mcp.mitre_mcp_server.Config")
    def test_transport_security_loopback_bind(self, mock_config):
        """Loopback bind keeps the loopback Host list; configured origins allowed."""
        mock_config.CORS_ORIGINS = "http://localhost:5173"

        settings = build_transport_security("127.0.0.1", 8000)

        self.assertTrue(settings.enable_dns_rebinding_protection)
        self.assertIn("localhost:*", settings.allowed_hosts)
        self.assertNotIn("0.0.0.0:*", settings.allowed_hosts)
        self.assertIn("http://localhost:5173", settings.allowed_origins)

    @patch("mitre_mcp.mitre_mcp_server.Config")
    def test_transport_security_wildcard_disables(self, mock_config):
        """Explicit '*' in MITRE_CORS_ORIGINS disables the protection."""
        mock_config.CORS_ORIGINS = "*"

        settings = build_transport_security("0.0.0.0", 8000)

        self.assertFalse(settings.enable_dns_rebinding_protection)


if __name__ == "__main__":
    unittest.main()
