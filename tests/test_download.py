"""Tests for download and caching functionality."""

import json
import logging
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


class _FakeStreamCM:
    """Async-context-manager stand-in for ``client.stream(...)``.

    ``client.stream`` is a *synchronous* method returning an async context
    manager, so mocks must return this wrapper — an ``AsyncMock`` attribute
    would produce a coroutine, which ``async with`` cannot enter.
    """

    def __init__(self, response=None, error=None):
        self._response = response
        self._error = error

    async def __aenter__(self):
        if self._error is not None:
            raise self._error
        return self._response

    async def __aexit__(self, exc_type, exc, tb):
        return False


def _streaming_response(body: bytes, *, status=200, headers=None, fail_after=0):
    """Build a fake streamed response: status, headers and aiter_bytes().

    ``fail_after`` raises an HTTPError once that many chunks were yielded —
    a mid-write failure for the atomicity tests.
    """
    response = MagicMock()
    response.status_code = status
    response.headers = httpx.Headers(headers or {})
    response.raise_for_status = MagicMock()

    chunks = [body[i : i + 8192] for i in range(0, len(body), 8192)] or [b""]

    async def _aiter():
        for index, chunk in enumerate(chunks):
            yield chunk
            if index + 1 == fail_after:
                raise httpx.HTTPError("connection reset mid-body")

    response.aiter_bytes = lambda: _aiter()
    return response


def _streaming_client(response=None, error=None):
    """Mock client whose ``stream()`` returns the fake context manager."""
    mock_client = AsyncMock()
    if error is not None:
        mock_client.stream = MagicMock(side_effect=error)
    else:
        mock_client.stream = MagicMock(return_value=_FakeStreamCM(response))
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    return mock_client


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

        body = json.dumps(sample_stix_bundle).encode()
        mock_client = _streaming_client(_streaming_response(body))

        validators = await download_domain(mock_client, "test", "http://example.com", output_path)

        # Verify file was created
        assert os.path.exists(output_path)

        # Verify content
        with open(output_path) as f:
            data = json.load(f)
        assert data["type"] == "bundle"
        assert validators == {"etag": "", "last_modified": ""}

    async def test_download_returns_response_validators(self, temp_data_dir, sample_stix_bundle):
        """The ETag/Last-Modified pair is captured for conditional refreshes."""
        output_path = os.path.join(temp_data_dir, "test.json")

        body = json.dumps(sample_stix_bundle).encode()
        response = _streaming_response(
            body, headers={"ETag": '"abc123"', "Last-Modified": "Tue, 01 Jul 2026 00:00:00 GMT"}
        )
        mock_client = _streaming_client(response)

        validators = await download_domain(mock_client, "test", "http://example.com", output_path)

        assert validators == {"etag": '"abc123"', "last_modified": "Tue, 01 Jul 2026 00:00:00 GMT"}

    async def test_not_modified_returns_none_and_keeps_file(self, temp_data_dir):
        """A 304 answer leaves the existing cache file untouched."""
        output_path = os.path.join(temp_data_dir, "test.json")
        with open(output_path, "wb") as f:
            f.write(b'{"type": "bundle", "objects": [{"keep": true}]}')

        response = _streaming_response(b"", status=304)
        mock_client = _streaming_client(response)

        result = await download_domain(
            mock_client,
            "test",
            "http://example.com",
            output_path,
            conditional_headers={"If-None-Match": '"abc123"'},
        )

        assert result is None
        with open(output_path, "rb") as f:
            assert f.read() == b'{"type": "bundle", "objects": [{"keep": true}]}'

    async def test_timeout_error(self, temp_data_dir):
        """Test timeout during download."""
        output_path = os.path.join(temp_data_dir, "test.json")

        mock_client = _streaming_client(error=httpx.TimeoutException("Timeout"))

        with pytest.raises(httpx.TimeoutException):
            await download_domain(mock_client, "test", "http://example.com", output_path)

    async def test_http_error(self, temp_data_dir):
        """Test HTTP error during download."""
        output_path = os.path.join(temp_data_dir, "test.json")

        mock_client = _streaming_client(error=httpx.HTTPError("HTTP Error"))

        with pytest.raises(httpx.HTTPError):
            await download_domain(mock_client, "test", "http://example.com", output_path)


@pytest.mark.asyncio
class TestDownloadAndSaveAttackDataAsync:
    """Test async download and save."""

    async def test_use_cached_data(self, temp_data_dir, sample_stix_bundle):
        """Test using cached data when fresh."""
        # Create metadata indicating a fresh update (inside the expiry window)
        metadata = {
            "last_update": datetime.now(timezone.utc).isoformat(),
            "domains": ["enterprise", "mobile", "ics"],
        }
        metadata_path = os.path.join(temp_data_dir, "metadata.json")
        with open(metadata_path, "w") as f:
            json.dump(metadata, f)

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
        body = json.dumps(sample_stix_bundle).encode()

        with patch("mitre_mcp.mitre_mcp_server.httpx.AsyncClient") as mock_client_class:
            mock_client = _streaming_client(_streaming_response(body))
            mock_client_class.return_value = mock_client

            result = await download_and_save_attack_data_async(temp_data_dir, force=True)

            # Should have downloaded
            assert os.path.exists(result["metadata"])
            assert os.path.exists(result["enterprise"])

    async def test_expired_cache(self, temp_data_dir, sample_stix_bundle):
        """Test downloading when cache is expired."""
        # Create metadata older than the cache expiry window
        old_date = datetime.now(timezone.utc) - timedelta(days=60)
        metadata = {"last_update": old_date.isoformat(), "domains": ["enterprise", "mobile", "ics"]}
        metadata_path = os.path.join(temp_data_dir, "metadata.json")
        with open(metadata_path, "w") as f:
            json.dump(metadata, f)

        body = json.dumps(sample_stix_bundle).encode()

        with patch("mitre_mcp.mitre_mcp_server.httpx.AsyncClient") as mock_client_class:
            mock_client = _streaming_client(_streaming_response(body))
            mock_client_class.return_value = mock_client

            result = await download_and_save_attack_data_async(temp_data_dir, force=False)

            # Should have downloaded due to expiry
            assert os.path.exists(result["metadata"])


def _write_expired_cache(data_dir, sample_stix_bundle, domains=("enterprise", "mobile", "ics")):
    """Write an expired metadata file plus cached domain bundles."""
    old_date = datetime.now(timezone.utc) - timedelta(days=60)
    metadata = {"last_update": old_date.isoformat(), "domains": list(domains)}
    with open(os.path.join(data_dir, "metadata.json"), "w") as f:
        json.dump(metadata, f)
    for domain in domains:
        with open(os.path.join(data_dir, f"{domain}-attack.json"), "w") as f:
            json.dump(sample_stix_bundle, f)


def _failing_http_client(mock_client_class):
    """Point httpx.AsyncClient at a client whose requests always fail."""
    mock_client_class.return_value = _streaming_client(error=httpx.HTTPError("connection refused"))


@pytest.mark.asyncio
class TestStaleCacheFallback:
    """Test serving the stale cache when a refresh download fails."""

    async def test_expired_cache_served_on_download_failure(
        self, temp_data_dir, sample_stix_bundle, caplog
    ):
        """Expired cache + failing download -> stale cache served with a warning."""
        _write_expired_cache(temp_data_dir, sample_stix_bundle)

        with patch("mitre_mcp.mitre_mcp_server.httpx.AsyncClient") as mock_client_class:
            _failing_http_client(mock_client_class)

            with caplog.at_level(logging.WARNING):
                result = await download_and_save_attack_data_async(temp_data_dir, force=False)

        # Startup data paths still resolve to the on-disk cache
        for domain in ["enterprise", "mobile", "ics"]:
            assert os.path.exists(result[domain])

        # Staleness is observable in the logs
        assert any("stale" in record.message.lower() for record in caplog.records)

    async def test_no_cache_fails_on_download_failure(self, temp_data_dir):
        """No cache + failing download -> clear failure (first-run semantics)."""
        with patch("mitre_mcp.mitre_mcp_server.httpx.AsyncClient") as mock_client_class:
            _failing_http_client(mock_client_class)

            with pytest.raises(httpx.HTTPError, match="connection refused"):
                await download_and_save_attack_data_async(temp_data_dir, force=True)

    async def test_partial_cache_fails_on_download_failure(self, temp_data_dir, sample_stix_bundle):
        """Missing one domain file + failing download -> clear failure."""
        _write_expired_cache(temp_data_dir, sample_stix_bundle, domains=("enterprise", "mobile"))

        with patch("mitre_mcp.mitre_mcp_server.httpx.AsyncClient") as mock_client_class:
            _failing_http_client(mock_client_class)

            with pytest.raises(httpx.HTTPError, match="connection refused"):
                await download_and_save_attack_data_async(temp_data_dir, force=False)


@pytest.mark.asyncio
class TestAtomicCacheWrites:
    """F-BUG-028: a failed write must never truncate a good cache file."""

    async def test_failed_stream_leaves_previous_cache_intact(self, temp_data_dir):
        """A mid-write failure keeps the previous cache file and leaves
        no temp file behind."""
        output_path = os.path.join(temp_data_dir, "enterprise-attack.json")
        original = b'{"type": "bundle", "objects": [{"ok": true}]}'
        with open(output_path, "wb") as f:
            f.write(original)

        # Stream yields one chunk then dies mid-body
        body = b'{"type": "bundle", "objects": [' + b"x" * 9000
        response = _streaming_response(body, fail_after=1)
        mock_client = _streaming_client(response)

        with pytest.raises(httpx.HTTPError):
            await download_domain(mock_client, "enterprise", "http://example.com", output_path)

        # The previous cache file is byte-for-byte intact
        with open(output_path, "rb") as f:
            assert f.read() == original
        # And no partial temp file is left behind
        assert not os.path.exists(output_path + ".tmp")

    async def test_failed_metadata_write_leaves_previous_metadata_intact(
        self, temp_data_dir, sample_stix_bundle
    ):
        """A failure while writing metadata.json keeps the old metadata."""
        metadata_path = os.path.join(temp_data_dir, "metadata.json")
        original_meta = {
            "last_update": "2025-01-01T00:00:00+00:00",
            "domains": ["enterprise", "mobile", "ics"],
        }
        with open(metadata_path, "w") as f:
            json.dump(original_meta, f)

        body = json.dumps(sample_stix_bundle).encode()
        with patch("mitre_mcp.mitre_mcp_server.httpx.AsyncClient") as mock_client_class:
            mock_client = _streaming_client(_streaming_response(body))
            mock_client_class.return_value = mock_client

            with patch("mitre_mcp.data.os.replace", side_effect=OSError("disk full")):
                with pytest.raises(OSError, match="disk full"):
                    await download_and_save_attack_data_async(temp_data_dir, force=True)

        with open(metadata_path) as f:
            assert json.load(f) == original_meta


@pytest.mark.asyncio
class TestConditionalRefresh:
    """F-PERF-004: refreshes send conditional requests and a 304 keeps the
    cache file untouched."""

    async def test_second_refresh_sends_if_none_match_and_304_keeps_cache(
        self, temp_data_dir, sample_stix_bundle
    ):
        """First refresh stores the ETag; the second sends If-None-Match,
        and a 304 answer leaves every cache file byte-for-byte identical."""
        bundle_bytes = json.dumps(sample_stix_bundle).encode()
        seen_requests = []

        def handler(request: httpx.Request) -> httpx.Response:
            seen_requests.append(request)
            if request.headers.get("if-none-match") == '"v42"':
                return httpx.Response(304)
            return httpx.Response(200, content=bundle_bytes, headers={"ETag": '"v42"'})

        transport = httpx.MockTransport(handler)
        real_async_client = httpx.AsyncClient
        domains = ("enterprise", "mobile", "ics")

        with patch(
            "mitre_mcp.mitre_mcp_server.httpx.AsyncClient",
            lambda **kwargs: real_async_client(transport=transport),
        ):
            # First refresh — no stored validators, unconditional GETs.
            await download_and_save_attack_data_async(temp_data_dir, force=False)
            assert len(seen_requests) == len(domains)
            for request in seen_requests:
                assert "if-none-match" not in request.headers
                assert "if-modified-since" not in request.headers

            # Age the metadata so the next call refreshes again, keeping
            # the validators it just stored.
            metadata_path = os.path.join(temp_data_dir, "metadata.json")
            with open(metadata_path) as f:
                metadata = json.load(f)
            metadata["last_update"] = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
            with open(metadata_path, "w") as f:
                json.dump(metadata, f)

            cache_before = {}
            for domain in domains:
                path = os.path.join(temp_data_dir, f"{domain}-attack.json")
                with open(path, "rb") as f:
                    cache_before[path] = f.read()

            # Second refresh — conditional GETs, server answers 304.
            await download_and_save_attack_data_async(temp_data_dir, force=False)

        assert len(seen_requests) == 2 * len(domains)
        for request in seen_requests[len(domains) :]:
            assert request.headers.get("if-none-match") == '"v42"' or request.headers.get(
                "if-modified-since"
            )

        # 304 left every cache file untouched
        for path, content in cache_before.items():
            with open(path, "rb") as f:
                assert f.read() == content
