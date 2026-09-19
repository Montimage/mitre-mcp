"""Lazy domain loading and background cache refresh tests (issue #87, F-PERF-010).

Two behaviours are pinned here:

- Start-up loads only the enterprise domain — every tool defaults to it.
  Mobile and ICS parse on their first call, thread-safe under the v2
  worker-thread handlers, building that domain's indices and precomputed
  lists exactly like the old eager path.
- An expired-but-complete cache answers the first request from the stale
  bundles at once; the refresh download runs behind it instead of
  blocking start-up (the Task 2.7 stale-serve behaviour, moved off the
  critical path).
"""

import asyncio
import json
import logging
import os
import shutil
import sys
import threading
import time
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from mcp.client import Client
from mitreattack.stix20 import MitreAttackData

import mitre_mcp.mitre_mcp_server as mod
from mitre_mcp.data import AttackContext, attack_data_paths, stale_cache_servable
from mitre_mcp.mitre_mcp_server import attack_lifespan, mcp
from mitre_mcp.tools import get_attack_data, get_tactics

FIXTURE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
FIXTURE_PATHS = {
    "enterprise": os.path.join(FIXTURE_DIR, "enterprise-attack.json"),
    "mobile": os.path.join(FIXTURE_DIR, "mobile-attack.json"),
    "ics": os.path.join(FIXTURE_DIR, "ics-attack.json"),
}


def _write_cache(tmp_path, *, expired=True, domains=("enterprise", "mobile", "ics")):
    """Copy the fixture bundles into *tmp_path* and write a metadata file."""
    for domain in domains:
        shutil.copy(FIXTURE_PATHS[domain], os.path.join(tmp_path, f"{domain}-attack.json"))
    age = timedelta(days=60) if expired else timedelta(days=0)
    metadata = {
        "last_update": (datetime.now(timezone.utc) - age).isoformat(),
        "domains": list(domains),
    }
    with open(os.path.join(tmp_path, "metadata.json"), "w") as f:
        json.dump(metadata, f)


def _patch_runtime(monkeypatch, tmp_path):
    """Point the lifespan's data dir at *tmp_path* and tame argv."""
    monkeypatch.setattr(mod.Config, "get_data_dir", classmethod(lambda cls: str(tmp_path)))
    monkeypatch.setattr(sys, "argv", ["mitre-mcp"])


def _ctx_namespace(attack_context):
    """Wrap a real AttackContext in the Context shape the tools read."""
    return SimpleNamespace(request_context=SimpleNamespace(lifespan_context=attack_context))


class TestStaleCacheServable:
    """The stale-serve decision: complete + refresh-due, never forced."""

    def test_force_download_stays_blocking(self, tmp_path):
        _write_cache(tmp_path, expired=True)
        assert stale_cache_servable(attack_data_paths(str(tmp_path)), force=True) is False

    def test_empty_dir_is_not_servable(self, tmp_path):
        assert stale_cache_servable(attack_data_paths(str(tmp_path))) is False

    def test_expired_complete_cache_is_servable(self, tmp_path):
        _write_cache(tmp_path, expired=True)
        assert stale_cache_servable(attack_data_paths(str(tmp_path))) is True

    def test_fresh_complete_cache_is_not_servable(self, tmp_path):
        _write_cache(tmp_path, expired=False)
        assert stale_cache_servable(attack_data_paths(str(tmp_path))) is False

    def test_expired_partial_cache_is_not_servable(self, tmp_path):
        _write_cache(tmp_path, expired=True, domains=("enterprise", "mobile"))
        assert stale_cache_servable(attack_data_paths(str(tmp_path))) is False

    def test_missing_metadata_counts_as_refresh_due(self, tmp_path):
        _write_cache(tmp_path, expired=True)
        os.unlink(os.path.join(tmp_path, "metadata.json"))
        assert stale_cache_servable(attack_data_paths(str(tmp_path))) is True


class TestEnsureDomain:
    """The lazy loader on AttackContext — first call loads, exactly once."""

    def _ctx(self, **kwargs):
        return AttackContext(enterprise_attack=MagicMock(), **kwargs)

    def test_enterprise_returns_immediately(self):
        attack = MagicMock()
        ctx = self._ctx()
        ctx.enterprise_attack = attack
        assert ctx.ensure_domain("enterprise-attack") is attack

    def test_unknown_domain_raises_value_error(self):
        with pytest.raises(ValueError, match="Invalid domain: bogus"):
            self._ctx().ensure_domain("bogus")

    def test_missing_path_raises_value_error(self):
        """A context with no domain_paths cannot lazy-load."""
        with pytest.raises(ValueError, match="No cached file for domain"):
            self._ctx().ensure_domain("mobile-attack")

    def test_default_loader_parses_bundle_and_publishes_lookups(self):
        """Without an injected loader the fallback parses the cache file
        and publishes indices + lists together."""
        ctx = self._ctx(domain_paths={"mobile-attack": FIXTURE_PATHS["mobile"]})

        data = ctx.ensure_domain("mobile-attack")

        assert isinstance(data, MitreAttackData)
        assert ctx.mobile_attack is data
        assert "mobile-attack" in ctx.domain_indices
        assert "mobile-attack" in ctx.domain_lists
        assert "fixture mobile group" in ctx.domain_indices["mobile-attack"].groups
        # Second call returns the cached store — no reload.
        assert ctx.ensure_domain("mobile-attack") is data

    def test_injected_loader_is_used(self):
        """A supplied domain_loader replaces the fallback entirely."""
        sentinel = (MagicMock(), MagicMock(), MagicMock())
        loader = MagicMock(return_value=sentinel)
        ctx = self._ctx(
            domain_paths={"ics-attack": "/nonexistent/ics.json"},
            domain_loader=loader,
        )

        data = ctx.ensure_domain("ics-attack")

        loader.assert_called_once_with("/nonexistent/ics.json")
        assert data is sentinel[0]
        assert ctx.domain_indices["ics-attack"] is sentinel[1]
        assert ctx.domain_lists["ics-attack"] is sentinel[2]

    def test_concurrent_first_calls_load_exactly_once(self):
        """Racing worker threads funnel through the per-domain lock."""
        ctx = self._ctx(domain_paths={"mobile-attack": FIXTURE_PATHS["mobile"]})
        constructions = []

        def slow_loader(path):
            time.sleep(0.05)  # widen the race window inside the lock
            constructions.append(path)
            return MagicMock(), MagicMock(), MagicMock()

        ctx.domain_loader = slow_loader
        barrier = threading.Barrier(8)
        results = []

        def worker():
            barrier.wait()
            results.append(ctx.ensure_domain("mobile-attack"))

        threads = [threading.Thread(target=worker) for _ in range(8)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(constructions) == 1
        assert len(set(map(id, results))) == 1  # every caller got the same store


class TestLazyStartup:
    """The lifespan parses enterprise only; mobile/ICS stay cold."""

    async def test_only_enterprise_loaded_at_startup(self, monkeypatch, tmp_path):
        download = AsyncMock(return_value=FIXTURE_PATHS)
        monkeypatch.setattr(mod, "download_and_save_attack_data_async", download)
        _patch_runtime(monkeypatch, tmp_path)
        mad_spy = MagicMock(wraps=MitreAttackData)
        monkeypatch.setattr(mod, "MitreAttackData", mad_spy)

        async with attack_lifespan(MagicMock()) as ctx:
            assert isinstance(ctx.enterprise_attack, MitreAttackData)
            assert ctx.mobile_attack is None
            assert ctx.ics_attack is None
            assert set(ctx.domain_indices) == {"enterprise-attack"}
            assert set(ctx.domain_lists) == {"enterprise-attack"}

        mad_spy.assert_called_once_with(FIXTURE_PATHS["enterprise"])

    async def test_fresh_cache_still_blocks_for_download(self, monkeypatch, tmp_path):
        """A complete fresh cache never takes the background path — the
        download function is awaited before the context is yielded."""
        _write_cache(tmp_path, expired=False)
        download = AsyncMock(return_value=attack_data_paths(str(tmp_path)))
        monkeypatch.setattr(mod, "download_and_save_attack_data_async", download)
        _patch_runtime(monkeypatch, tmp_path)

        async with attack_lifespan(MagicMock()):
            download.assert_awaited_once()  # already complete at yield = blocking


class TestLazyLoadThroughTools:
    """The first call against a cold domain loads it — once, thread-safe."""

    @pytest.mark.asyncio
    async def test_first_mobile_call_loads_once_under_concurrency(self, tmp_path):
        real_mad = mod.MitreAttackData
        constructed = []

        def counting_mad(path):
            constructed.append(path)
            if path != FIXTURE_PATHS["enterprise"]:
                time.sleep(0.02)  # widen the race window inside the lock
            return real_mad(path)

        download = AsyncMock(return_value=FIXTURE_PATHS)
        with (
            patch.object(mod.Config, "get_data_dir", classmethod(lambda cls: str(tmp_path))),
            patch.object(mod, "download_and_save_attack_data_async", download),
            patch.object(mod, "MitreAttackData", counting_mad),
        ):
            async with Client(mcp) as client:
                # Concurrent calls on real worker threads: a lists-only
                # path (_domain_lists) and a store+index path
                # (get_attack_data + _domain_indices) both trigger the
                # load.
                calls = await asyncio.gather(
                    *[
                        client.call_tool("get_tactics", {"domain": "mobile-attack"})
                        for _ in range(4)
                    ]
                    + [
                        client.call_tool(
                            "get_techniques_used_by_group",
                            {"group_name": "MobileAlias", "domain": "mobile-attack"},
                        )
                        for _ in range(4)
                    ]
                )

        assert all(not c.is_error for c in calls)
        assert constructed.count(FIXTURE_PATHS["enterprise"]) == 1  # eager at load
        assert constructed.count(FIXTURE_PATHS["mobile"]) == 1  # exactly once
        assert FIXTURE_PATHS["ics"] not in constructed  # never touched

    def test_tool_calls_trigger_load_via_lists_and_indices(self):
        """The three lookup helpers all route through ensure_domain."""
        ctx = AttackContext(
            enterprise_attack=MagicMock(),
            domain_paths={
                "mobile-attack": FIXTURE_PATHS["mobile"],
                "ics-attack": FIXTURE_PATHS["ics"],
            },
        )
        wrapped = _ctx_namespace(ctx)

        tactics = get_tactics(wrapped, domain="mobile-attack")
        assert [t["name"] for t in tactics["tactics"]] == ["Fixture Mobile Tactic"]
        assert ctx.mobile_attack is not None
        assert "mobile-attack" in ctx.domain_lists

        # get_attack_data goes through ensure_domain too.
        assert get_attack_data("ics-attack", wrapped) is ctx.ics_attack
        assert "ics-attack" in ctx.domain_indices


class TestBackgroundRefresh:
    """An expired cache serves stale data while the refresh runs behind it."""

    async def test_first_request_served_stale_before_refresh_completes(self, monkeypatch, tmp_path):
        _write_cache(tmp_path, expired=True)
        _patch_runtime(monkeypatch, tmp_path)

        refresh_started = asyncio.Event()
        refresh_release = asyncio.Event()
        refresh_calls = []

        async def gated_refresh(data_dir, force=False):
            refresh_calls.append(data_dir)
            refresh_started.set()
            await refresh_release.wait()
            return attack_data_paths(data_dir)

        monkeypatch.setattr(mod, "download_and_save_attack_data_async", gated_refresh)

        async with attack_lifespan(MagicMock()) as ctx:
            # The refresh was kicked off but has not completed.
            await asyncio.wait_for(refresh_started.wait(), timeout=5)
            assert not refresh_release.is_set()

            # ...while the first request is already answered from the
            # stale bundle — the fixture enterprise data, parsed at load.
            result = get_tactics(_ctx_namespace(ctx), domain="enterprise-attack")
            names = {t["name"] for t in result["tactics"]}
            assert {"Persistence", "Lateral Movement"} <= names

            refresh_release.set()
            await asyncio.sleep(0)  # let the refresh task finish

        assert refresh_calls == [str(tmp_path)]

    async def test_inflight_refresh_cancelled_on_shutdown(self, monkeypatch, tmp_path):
        """A refresh still running at shutdown is cancelled and drained."""
        _write_cache(tmp_path, expired=True)
        _patch_runtime(monkeypatch, tmp_path)

        refresh_started = asyncio.Event()
        refresh_cancelled = asyncio.Event()

        async def gated_refresh(data_dir, force=False):
            refresh_started.set()
            try:
                await asyncio.Event().wait()  # never released
            except asyncio.CancelledError:
                refresh_cancelled.set()
                raise
            return attack_data_paths(data_dir)

        monkeypatch.setattr(mod, "download_and_save_attack_data_async", gated_refresh)

        async with attack_lifespan(MagicMock()):
            await asyncio.wait_for(refresh_started.wait(), timeout=5)
            # Exit with the refresh still in flight.

        assert refresh_cancelled.is_set()

    async def test_failed_background_refresh_is_logged(self, monkeypatch, tmp_path, caplog):
        """A failed background refresh warns instead of crashing teardown."""
        _write_cache(tmp_path, expired=True)
        _patch_runtime(monkeypatch, tmp_path)
        monkeypatch.setattr(
            mod,
            "download_and_save_attack_data_async",
            AsyncMock(side_effect=RuntimeError("refresh boom")),
        )

        with caplog.at_level(logging.WARNING):
            async with attack_lifespan(MagicMock()):
                await asyncio.sleep(0.05)  # let the task fail

        assert any("refresh failed" in record.message.lower() for record in caplog.records)
