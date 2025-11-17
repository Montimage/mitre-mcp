"""Tests for download and caching functionality."""

import json
import os
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from mitre_mcp.mitre_mcp_server import (
    check_disk_space,
    download_and_save_attack_data_async,
    download_domain,
    load_metadata,
    parse_timestamp,
    validate_metadata,
    validate_stix_bundle,
)


class TestCheckDiskSpace:
    """Test disk space checking."""

    def test_sufficient_space(self, temp_data_dir):
        """Test with sufficient disk space."""
        # Should not raise
        check_disk_space(temp_data_dir, required_mb=1)

    def test_insufficient_space(self, temp_data_dir, monkeypatch):
        """Test with insufficient disk space."""
        # Mock disk_usage to return low free space
        mock_usage = MagicMock()
        mock_usage.free = 100  # 100 bytes
        monkeypatch.setattr("shutil.disk_usage", lambda x: mock_usage)

        with pytest.raises(RuntimeError, match="Insufficient disk space"):
            check_disk_space(temp_data_dir, required_mb=200)


class TestParseTimestamp:
    """Test timestamp parsing."""

    def test_parse_utc_timestamp(self):
        """Test parsing UTC timestamp."""
        timestamp = "2025-11-17T12:00:00+00:00"
        dt = parse_timestamp(timestamp)

        assert dt.year == 2025
        assert dt.month == 11
        assert dt.day == 17
        assert dt.tzinfo is not None

    def test_parse_naive_timestamp(self):
        """Test parsing naive timestamp (assumes UTC)."""
        timestamp = "2025-11-17T12:00:00"
        dt = parse_timestamp(timestamp)

        # Should add UTC timezone
        assert dt.tzinfo is not None
        assert dt.tzinfo == timezone.utc


class TestValidateMetadata:
    """Test metadata validation."""

    def test_valid_metadata(self, sample_metadata):
        """Test validating correct metadata."""
        result = validate_metadata(sample_metadata)

        assert result["last_update"] == sample_metadata["last_update"]
        assert result["domains"] == sample_metadata["domains"]

    def test_invalid_type(self):
        """Test metadata with wrong type."""
        with pytest.raises(ValueError, match="must be dict"):
            validate_metadata("not a dict")

    def test_missing_last_update(self):
        """Test metadata missing last_update."""
        with pytest.raises(ValueError, match="missing 'last_update'"):
            validate_metadata({"domains": []})

    def test_missing_domains(self):
        """Test metadata missing domains."""
        with pytest.raises(ValueError, match="missing 'domains'"):
            validate_metadata({"last_update": "2025-11-17T12:00:00+00:00"})

    def test_invalid_domains_type(self):
        """Test metadata with non-list domains."""
        with pytest.raises(ValueError, match="'domains' must be list"):
            validate_metadata({"last_update": "2025-11-17T12:00:00+00:00", "domains": "not a list"})

    def test_invalid_timestamp_format(self):
        """Test metadata with invalid timestamp format."""
        with pytest.raises(ValueError, match="Invalid last_update format"):
            validate_metadata({"last_update": "invalid date", "domains": []})


class TestLoadMetadata:
    """Test metadata loading."""

    def test_load_valid_metadata(self, temp_data_dir, sample_metadata):
        """Test loading valid metadata."""
        metadata_path = os.path.join(temp_data_dir, "metadata.json")

        with open(metadata_path, "w") as f:
            json.dump(sample_metadata, f)

        result = load_metadata(metadata_path)

        assert result is not None
        assert result["last_update"] == sample_metadata["last_update"]

    def test_load_missing_file(self, temp_data_dir):
        """Test loading nonexistent metadata file."""
        metadata_path = os.path.join(temp_data_dir, "metadata.json")

        result = load_metadata(metadata_path)

        assert result is None

    def test_load_invalid_json(self, temp_data_dir):
        """Test loading invalid JSON."""
        metadata_path = os.path.join(temp_data_dir, "metadata.json")

        with open(metadata_path, "w") as f:
            f.write("invalid json{")

        result = load_metadata(metadata_path)

        assert result is None

    def test_load_invalid_structure(self, temp_data_dir):
        """Test loading metadata with invalid structure."""
        metadata_path = os.path.join(temp_data_dir, "metadata.json")

        with open(metadata_path, "w") as f:
            json.dump({"wrong": "structure"}, f)

        result = load_metadata(metadata_path)

        assert result is None


class TestValidateStixBundle:
    """Test STIX bundle validation."""

    def test_valid_bundle(self, sample_stix_bundle):
        """Test validating valid STIX bundle."""
        result = validate_stix_bundle(json.dumps(sample_stix_bundle), "test")

        assert result["type"] == "bundle"
        assert len(result["objects"]) == 2

    def test_invalid_json(self):
        """Test invalid JSON."""
        with pytest.raises(ValueError, match="Invalid JSON"):
            validate_stix_bundle("invalid json{", "test")

    def test_not_dict(self):
        """Test bundle that's not a dict."""
        with pytest.raises(ValueError, match="must be dict"):
            validate_stix_bundle("[]", "test")

    def test_missing_type(self):
        """Test bundle missing type."""
        with pytest.raises(ValueError, match="missing 'type: bundle'"):
            validate_stix_bundle('{"objects": []}', "test")

    def test_wrong_type(self):
        """Test bundle with wrong type."""
        with pytest.raises(ValueError, match="missing 'type: bundle'"):
            validate_stix_bundle('{"type": "wrong", "objects": []}', "test")

    def test_missing_objects(self):
        """Test bundle missing objects."""
        with pytest.raises(ValueError, match="missing 'objects' array"):
            validate_stix_bundle('{"type": "bundle"}', "test")

    def test_objects_not_list(self):
        """Test bundle with non-list objects."""
        with pytest.raises(ValueError, match="missing 'objects' array"):
            validate_stix_bundle('{"type": "bundle", "objects": "not list"}', "test")


@pytest.mark.asyncio
class TestDownloadDomain:
    """Test async domain download."""

    async def test_successful_download(self, temp_data_dir, sample_stix_bundle):
        """Test successful domain download."""
        output_path = os.path.join(temp_data_dir, "test.json")

        # Mock HTTP client
        mock_response = MagicMock()
        mock_response.text = json.dumps(sample_stix_bundle)
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)

        await download_domain(mock_client, "test", "http://example.com", output_path)

        # Verify file was created
        assert os.path.exists(output_path)

        # Verify content
        with open(output_path) as f:
            data = json.load(f)
        assert data["type"] == "bundle"

    async def test_timeout_error(self, temp_data_dir):
        """Test timeout during download."""
        output_path = os.path.join(temp_data_dir, "test.json")

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=httpx.TimeoutException("Timeout"))

        with pytest.raises(httpx.TimeoutException):
            await download_domain(mock_client, "test", "http://example.com", output_path)

    async def test_http_error(self, temp_data_dir):
        """Test HTTP error during download."""
        output_path = os.path.join(temp_data_dir, "test.json")

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=httpx.HTTPError("HTTP Error"))

        with pytest.raises(httpx.HTTPError):
            await download_domain(mock_client, "test", "http://example.com", output_path)


@pytest.mark.asyncio
class TestDownloadAndSaveAttackDataAsync:
    """Test async download and save."""

    async def test_use_cached_data(self, temp_data_dir, sample_metadata, sample_stix_bundle):
        """Test using cached data when fresh."""
        # Create metadata indicating recent update
        metadata_path = os.path.join(temp_data_dir, "metadata.json")
        with open(metadata_path, "w") as f:
            json.dump(sample_metadata, f)

        # Create dummy data files
        for domain in ["enterprise", "mobile", "ics"]:
            path = os.path.join(temp_data_dir, f"{domain}-attack.json")
            with open(path, "w") as f:
                json.dump(sample_stix_bundle, f)

        # Should not download (use cache)
        result = await download_and_save_attack_data_async(temp_data_dir, force=False)

        assert "enterprise" in result
        assert "mobile" in result
        assert "ics" in result

    async def test_force_download(self, temp_data_dir, sample_stix_bundle):
        """Test force download."""
        with patch("mitre_mcp.mitre_mcp_server.httpx.AsyncClient") as mock_client_class:
            # Mock the async client
            mock_response = MagicMock()
            mock_response.text = json.dumps(sample_stix_bundle)
            mock_response.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)

            mock_client_class.return_value = mock_client

            result = await download_and_save_attack_data_async(temp_data_dir, force=True)

            # Should have downloaded
            assert os.path.exists(result["metadata"])
            assert os.path.exists(result["enterprise"])

    async def test_expired_cache(self, temp_data_dir, sample_stix_bundle):
        """Test downloading when cache is expired."""
        # Create old metadata
        old_date = datetime.now(timezone.utc) - timedelta(days=7)
        metadata = {"last_update": old_date.isoformat(), "domains": ["enterprise", "mobile", "ics"]}
        metadata_path = os.path.join(temp_data_dir, "metadata.json")
        with open(metadata_path, "w") as f:
            json.dump(metadata, f)

        with patch("mitre_mcp.mitre_mcp_server.httpx.AsyncClient") as mock_client_class:
            mock_response = MagicMock()
            mock_response.text = json.dumps(sample_stix_bundle)
            mock_response.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)

            mock_client_class.return_value = mock_client

            result = await download_and_save_attack_data_async(temp_data_dir, force=False)

            # Should have downloaded due to expiry
            assert os.path.exists(result["metadata"])
