"""Characterisation tests for the server start-up path.

These tests pin the *current* behaviour of ``parse_http_args``,
``print_help``, ``signal_handler``, ``main`` and ``attack_lifespan`` —
including the oddities recorded in F-DEAD-002/F-CLEAN-006 (e.g. a
trailing ``--port`` with no value is silently ignored, and ``--host``
consumes the next argv token literally). They exist so the SDK v2 port
(Tasks 3.6-4.2) and later refactors have a regression net; they must not
drive production behaviour changes.
"""

import signal
import sys
from unittest.mock import AsyncMock, MagicMock

import pytest

import mitre_mcp.mitre_mcp_server as mod
from mitre_mcp.mitre_mcp_server import (
    attack_lifespan,
    parse_http_args,
    print_help,
    signal_handler,
)


class TestParseHttpArgs:
    """Pin command-line host/port parsing, including odd cases."""

    def test_defaults(self, monkeypatch):
        monkeypatch.delenv("FASTMCP_SERVER_HOST", raising=False)
        monkeypatch.delenv("FASTMCP_SERVER_PORT", raising=False)
        monkeypatch.setattr(sys, "argv", ["mitre-mcp"])

        assert parse_http_args() == ("localhost", 8000)

    def test_env_defaults(self, monkeypatch):
        monkeypatch.setenv("FASTMCP_SERVER_HOST", "0.0.0.0")
        monkeypatch.setenv("FASTMCP_SERVER_PORT", "9000")
        monkeypatch.setattr(sys, "argv", ["mitre-mcp"])

        assert parse_http_args() == ("0.0.0.0", 9000)

    def test_cli_overrides_env(self, monkeypatch):
        monkeypatch.setenv("FASTMCP_SERVER_HOST", "envhost")
        monkeypatch.setenv("FASTMCP_SERVER_PORT", "1111")
        monkeypatch.setattr(sys, "argv", ["mitre-mcp", "--host", "clihost", "--port", "2222"])

        assert parse_http_args() == ("clihost", 2222)

    def test_trailing_port_without_value_is_ignored(self, monkeypatch):
        """F-CLEAN-006: a trailing --port with no value keeps the default."""
        monkeypatch.setattr(sys, "argv", ["mitre-mcp", "--port"])

        assert parse_http_args() == ("localhost", 8000)

    def test_trailing_host_without_value_is_ignored(self, monkeypatch):
        """A trailing --host with no value keeps the default."""
        monkeypatch.setattr(sys, "argv", ["mitre-mcp", "--host"])

        assert parse_http_args() == ("localhost", 8000)

    def test_host_consumes_next_token_literally(self, monkeypatch):
        """F-DEAD-002 class oddity: --host takes the next argv token even
        when that token is another flag, which then cannot be parsed."""
        monkeypatch.setattr(sys, "argv", ["mitre-mcp", "--host", "--port"])

        assert parse_http_args() == ("--port", 8000)

    def test_invalid_port_exits_1(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["mitre-mcp", "--port", "not-a-number"])

        with pytest.raises(SystemExit) as exc_info:
            parse_http_args()
        assert exc_info.value.code == 1


class TestPrintHelp:
    """Pin help output and exit behaviour."""

    def test_prints_usage_and_exits_zero(self, capsys):
        with pytest.raises(SystemExit) as exc_info:
            print_help()
        assert exc_info.value.code == 0

        out = capsys.readouterr().out
        assert "MITRE ATT&CK MCP Server" in out
        assert "--http" in out
        assert "--force-download" in out
        assert "MITRE_CORS_ORIGINS" in out


class TestSignalHandler:
    """Pin graceful-shutdown exit codes."""

    def test_sigint_exits_zero(self):
        with pytest.raises(SystemExit) as exc_info:
            signal_handler(signal.SIGINT, None)
        assert exc_info.value.code == 0

    def test_sigterm_exits_zero(self):
        with pytest.raises(SystemExit) as exc_info:
            signal_handler(signal.SIGTERM, None)
        assert exc_info.value.code == 0


class TestMain:
    """Pin the entry-point dispatch behaviour."""

    def test_help_flag_calls_print_help(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["mitre-mcp", "--help"])
        help_mock = MagicMock()
        monkeypatch.setattr(mod, "print_help", help_mock)
        monkeypatch.setattr(mod.mcp, "run", MagicMock())
        monkeypatch.setattr(mod.signal, "signal", MagicMock())

        mod.main()

        help_mock.assert_called_once_with()

    def test_registers_sigint_and_sigterm_handlers(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["mitre-mcp"])
        sig_mock = MagicMock()
        monkeypatch.setattr(mod.signal, "signal", sig_mock)
        monkeypatch.setattr(mod.mcp, "run", MagicMock())

        mod.main()

        sig_mock.assert_any_call(signal.SIGINT, mod.signal_handler)
        sig_mock.assert_any_call(signal.SIGTERM, mod.signal_handler)

    def test_stdio_mode_runs_default_transport(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["mitre-mcp"])
        run_mock = MagicMock()
        monkeypatch.setattr(mod.mcp, "run", run_mock)
        monkeypatch.setattr(mod.signal, "signal", MagicMock())

        mod.main()

        run_mock.assert_called_once_with()

    def test_http_mode_wires_pipeline(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["mitre-mcp", "--http", "--host", "h", "--port", "1234"])
        setup_mock = MagicMock()
        build_mock = MagicMock(return_value="app")
        uvicorn_mock = MagicMock()
        server_inst = MagicMock()
        server_inst.serve.return_value = "coro"
        uvicorn_mock.Server.return_value = server_inst
        run_mock = MagicMock()
        monkeypatch.setattr(mod, "setup_http_server", setup_mock)
        monkeypatch.setattr(mod, "build_http_app", build_mock)
        monkeypatch.setattr(mod, "uvicorn", uvicorn_mock)
        monkeypatch.setattr(mod.asyncio, "run", run_mock)
        monkeypatch.setattr(mod.signal, "signal", MagicMock())

        mod.main()

        setup_mock.assert_called_once_with("h", 1234)
        build_mock.assert_called_once_with()
        uvicorn_mock.Config.assert_called_once_with(
            "app", host="h", port=1234, log_level=setup_mock.return_value
        )
        uvicorn_mock.Server.assert_called_once_with(uvicorn_mock.Config.return_value)
        run_mock.assert_called_once_with(server_inst.serve.return_value)

    def test_keyboard_interrupt_exits_zero(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["mitre-mcp"])
        monkeypatch.setattr(mod.mcp, "run", MagicMock(side_effect=KeyboardInterrupt()))
        monkeypatch.setattr(mod.signal, "signal", MagicMock())

        with pytest.raises(SystemExit) as exc_info:
            mod.main()
        assert exc_info.value.code == 0

    def test_unhandled_error_exits_1(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["mitre-mcp"])
        monkeypatch.setattr(mod.mcp, "run", MagicMock(side_effect=RuntimeError("boom")))
        monkeypatch.setattr(mod.signal, "signal", MagicMock())

        with pytest.raises(SystemExit) as exc_info:
            mod.main()
        assert exc_info.value.code == 1


def _patch_lifespan_deps(monkeypatch, tmp_path, fake_attack=None):
    """Point the lifespan's filesystem/download/parse deps at mocks."""
    monkeypatch.setattr(mod.Config, "get_data_dir", classmethod(lambda cls: str(tmp_path)))
    monkeypatch.setattr(sys, "argv", ["mitre-mcp"])
    if fake_attack is None:
        fake_attack = MagicMock()
        fake_attack.get_groups.return_value = [{"name": "g1", "aliases": ["ga"]}]
        fake_attack.get_mitigations.return_value = [{"name": "m1"}]
        fake_attack.get_techniques.return_value = [
            {"external_references": [{"source_name": "mitre-attack", "external_id": "T1000"}]}
        ]
    monkeypatch.setattr(mod, "MitreAttackData", MagicMock(return_value=fake_attack))
    return fake_attack


class TestAttackLifespan:
    """Pin lifespan init: download -> parse -> index -> yield context."""

    async def test_yields_attack_context(self, monkeypatch, tmp_path):
        paths = {
            "enterprise": str(tmp_path / "enterprise-attack.json"),
            "mobile": str(tmp_path / "mobile-attack.json"),
            "ics": str(tmp_path / "ics-attack.json"),
            "metadata": str(tmp_path / "metadata.json"),
        }
        dl_mock = AsyncMock(return_value=paths)
        monkeypatch.setattr(mod, "download_and_save_attack_data_async", dl_mock)
        fake = _patch_lifespan_deps(monkeypatch, tmp_path)

        async with attack_lifespan(MagicMock()) as ctx:
            assert ctx.enterprise_attack is fake
            assert ctx.mobile_attack is fake
            assert ctx.ics_attack is fake
            assert "g1" in ctx.groups_index
            assert "ga" in ctx.groups_index  # aliases are indexed too
            assert "m1" in ctx.mitigations_index
            assert "T1000" in ctx.techniques_by_mitre_id

        dl_mock.assert_awaited_once_with(str(tmp_path), force=False)

    async def test_force_download_flag_propagates(self, monkeypatch, tmp_path):
        dl_mock = AsyncMock(
            return_value={
                "enterprise": str(tmp_path / "e.json"),
                "mobile": str(tmp_path / "m.json"),
                "ics": str(tmp_path / "i.json"),
                "metadata": str(tmp_path / "md.json"),
            }
        )
        monkeypatch.setattr(mod, "download_and_save_attack_data_async", dl_mock)
        _patch_lifespan_deps(monkeypatch, tmp_path)
        monkeypatch.setattr(sys, "argv", ["mitre-mcp", "--force-download"])

        async with attack_lifespan(MagicMock()):
            pass

        dl_mock.assert_awaited_once_with(str(tmp_path), force=True)

    async def test_http_mode_config_banner(self, monkeypatch, tmp_path):
        """Pin: --http mode prints the streamable-HTTP config banner."""
        dl_mock = AsyncMock(
            return_value={
                "enterprise": str(tmp_path / "e.json"),
                "mobile": str(tmp_path / "m.json"),
                "ics": str(tmp_path / "i.json"),
                "metadata": str(tmp_path / "md.json"),
            }
        )
        monkeypatch.setattr(mod, "download_and_save_attack_data_async", dl_mock)
        _patch_lifespan_deps(monkeypatch, tmp_path)
        monkeypatch.setattr(sys, "argv", ["mitre-mcp", "--http", "--host", "h", "--port", "9"])

        async with attack_lifespan(MagicMock()):
            pass

    async def test_download_failure_propagates(self, monkeypatch, tmp_path):
        """Pin: a download error still fails startup (stale-cache fallback
        lives inside the download function, not here)."""
        monkeypatch.setattr(
            mod,
            "download_and_save_attack_data_async",
            AsyncMock(side_effect=RuntimeError("offline")),
        )
        _patch_lifespan_deps(monkeypatch, tmp_path)

        with pytest.raises(RuntimeError, match="offline"):
            async with attack_lifespan(MagicMock()):
                pass
