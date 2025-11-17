"""Tests for configuration module."""

import os

import pytest

from mitre_mcp.config import Config


class TestConfig:
    """Test Config class."""

    def test_default_values(self):
        """Test default configuration values."""
        assert Config.DOWNLOAD_TIMEOUT_SECONDS == 30
        assert Config.CACHE_EXPIRY_DAYS == 1
        assert Config.REQUIRED_DISK_SPACE_MB == 200
        assert Config.DEFAULT_PAGE_SIZE == 20
        assert Config.MAX_PAGE_SIZE == 1000
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
        # Remove env var if set
        monkeypatch.delenv("MITRE_DATA_DIR", raising=False)

        data_dir = Config.get_data_dir()
        assert data_dir.endswith("data")
        assert os.path.isabs(data_dir)

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
