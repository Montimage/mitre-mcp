"""Tests for configuration module."""

import os
import subprocess
import sys

import pytest

from mitre_mcp.config import Config


class TestConfig:
    """Test Config class."""

    def test_default_values(self):
        """Test default configuration values."""
        assert Config.DOWNLOAD_TIMEOUT_SECONDS == 120
        assert Config.CACHE_EXPIRY_DAYS == 14
        assert Config.REQUIRED_DISK_SPACE_MB == 200
        assert Config.DEFAULT_PAGE_SIZE == 20
        assert Config.MAX_PAGE_SIZE == 200
        assert Config.MAX_DESCRIPTION_LENGTH == 500

    def test_get_data_urls(self):
        """Test getting data URLs."""
        urls = Config.get_data_urls()

        assert "enterprise" in urls
        assert "mobile" in urls
        assert "ics" in urls
        assert all(url.startswith("https://") for url in urls.values())
        assert all("mitre/cti" in url for url in urls.values())

    def test_get_data_dir_default(self, monkeypatch):
        """Test default data directory."""
        monkeypatch.setattr(Config, "DATA_DIR", None)
        monkeypatch.delenv("XDG_CACHE_HOME", raising=False)

        data_dir = Config.get_data_dir()
        assert data_dir.endswith("mitre-mcp")
        assert os.path.isabs(data_dir)

    def test_get_data_dir_default_outside_package(self, monkeypatch):
        """F-BUG-014: the default cache dir lives outside the installed
        package, so read-only installs work and reinstalls keep the cache."""
        monkeypatch.setattr(Config, "DATA_DIR", None)
        monkeypatch.delenv("XDG_CACHE_HOME", raising=False)

        from mitre_mcp import config as config_module

        package_dir = os.path.dirname(os.path.abspath(config_module.__file__))
        data_dir = os.path.abspath(Config.get_data_dir())

        assert not data_dir.startswith(package_dir + os.sep)
        assert data_dir != package_dir

    def test_get_data_dir_default_xdg_cache_home(self, monkeypatch):
        """XDG_CACHE_HOME is honored for the per-user cache location."""
        monkeypatch.setattr(Config, "DATA_DIR", None)
        monkeypatch.setenv("XDG_CACHE_HOME", os.path.join("tmp", "xdg-cache-test"))

        assert Config.get_data_dir() == os.path.join("tmp", "xdg-cache-test", "mitre-mcp")

    def test_get_data_dir_default_home_cache(self, monkeypatch):
        """Without XDG_CACHE_HOME the default is ~/.cache/mitre-mcp."""
        monkeypatch.setattr(Config, "DATA_DIR", None)
        monkeypatch.delenv("XDG_CACHE_HOME", raising=False)

        expected = os.path.join(os.path.expanduser("~"), ".cache", "mitre-mcp")
        assert Config.get_data_dir() == expected

    def test_get_data_dir_custom(self, monkeypatch):
        """Test custom data directory from environment."""
        custom_dir = "/custom/data/path"
        monkeypatch.setenv("MITRE_DATA_DIR", custom_dir)

        # Need to reload config to pick up new env var
        from importlib import reload

        from mitre_mcp import config as config_module

        reload(config_module)

        assert config_module.Config.get_data_dir() == custom_dir

    def test_validate_success(self):
        """Test successful validation."""
        # Should not raise
        Config.validate()

    def test_env_var_timeout(self, monkeypatch):
        """Test timeout from environment variable."""
        monkeypatch.setenv("MITRE_DOWNLOAD_TIMEOUT", "60")

        from importlib import reload

        from mitre_mcp import config as config_module

        reload(config_module)

        assert config_module.Config.DOWNLOAD_TIMEOUT_SECONDS == 60

    def test_env_var_cache_expiry(self, monkeypatch):
        """Test cache expiry from environment variable."""
        monkeypatch.setenv("MITRE_CACHE_EXPIRY_DAYS", "7")

        from importlib import reload

        from mitre_mcp import config as config_module

        reload(config_module)

        assert config_module.Config.CACHE_EXPIRY_DAYS == 7

    def test_env_var_page_size(self, monkeypatch):
        """Test page size from environment variable."""
        monkeypatch.setenv("MITRE_DEFAULT_PAGE_SIZE", "50")

        from importlib import reload

        from mitre_mcp import config as config_module

        reload(config_module)

        assert config_module.Config.DEFAULT_PAGE_SIZE == 50

    def test_cors_origins_default(self, monkeypatch):
        """Test default CORS origins are localhost-only (no wildcard)."""
        monkeypatch.delenv("MITRE_CORS_ORIGINS", raising=False)

        from importlib import reload
        from urllib.parse import urlparse

        from mitre_mcp import config as config_module

        reload(config_module)

        origins = [
            origin.strip()
            for origin in config_module.Config.CORS_ORIGINS.split(",")
            if origin.strip()
        ]
        assert origins
        assert config_module.Config.CORS_ORIGINS.strip() != "*"
        assert all(urlparse(origin).hostname in ("localhost", "127.0.0.1") for origin in origins)

    def test_cors_origins_custom_single(self, monkeypatch):
        """Test custom single CORS origin from environment variable."""
        monkeypatch.setenv("MITRE_CORS_ORIGINS", "https://example.com")

        from importlib import reload

        from mitre_mcp import config as config_module

        reload(config_module)

        assert config_module.Config.CORS_ORIGINS == "https://example.com"

    def test_cors_origins_custom_multiple(self, monkeypatch):
        """Test custom multiple CORS origins from environment variable."""
        origins = "https://example.com,http://localhost:3000,https://app.example.org"
        monkeypatch.setenv("MITRE_CORS_ORIGINS", origins)

        from importlib import reload

        from mitre_mcp import config as config_module

        reload(config_module)

        assert config_module.Config.CORS_ORIGINS == origins


class TestConfigEnvValidation:
    """F-BUG-030: invalid ``MITRE_*`` values fail start-up with a one-line
    error naming the variable — never a raw traceback."""

    def _import_server(self, env_overrides):
        """Import the entry module in a fresh interpreter with the given env."""
        env = {**os.environ, **env_overrides}
        return subprocess.run(
            [sys.executable, "-c", "import mitre_mcp.mitre_mcp_server"],
            env=env,
            capture_output=True,
            text=True,
        )

    def test_invalid_int_env_var_names_variable(self):
        """``MITRE_MAX_PAGE_SIZE=abc`` → one-line error naming the variable."""
        proc = self._import_server({"MITRE_MAX_PAGE_SIZE": "abc"})

        assert proc.returncode != 0
        lines = [line for line in proc.stderr.splitlines() if line.strip()]
        assert len(lines) == 1
        assert "MITRE_MAX_PAGE_SIZE" in lines[0]
        assert "Traceback" not in proc.stderr

    def test_invalid_log_level_names_variable(self):
        """``MITRE_LOG_LEVEL=LOUD`` → one-line error naming the variable."""
        proc = self._import_server({"MITRE_LOG_LEVEL": "LOUD"})

        assert proc.returncode != 0
        lines = [line for line in proc.stderr.splitlines() if line.strip()]
        assert len(lines) == 1
        assert "MITRE_LOG_LEVEL" in lines[0]
        assert "Traceback" not in proc.stderr
