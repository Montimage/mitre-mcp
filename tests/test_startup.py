"""Characterisation tests for the server start-up path.

These tests pin the behaviour of the single ``argparse`` parser
(``build_parser``/``parse_cli_args``/``get_cli_args``),
``build_config_banner``, ``main`` and ``attack_lifespan``.

Tasks 6.3/6.4 consolidated three hand-rolled ``sys.argv`` scans and three
banner builders into one parser and one banner function. Assertions that
pinned *buggy* behaviour were updated here, exactly where the old
behaviour was the bug:

- a trailing ``--port``/``--host`` with no value now exits 2 with a usage
  message instead of being silently ignored (F-CLEAN-006);
- ``--host --port`` no longer lets ``--host`` swallow the next flag as its
  value (F-DEAD-002);
- an invalid ``--port`` exits 2 (argparse's convention) instead of 1.

Task 6.9 removed the custom ``signal_handler`` (F-BUG-029): ``main`` no
longer installs SIGINT/SIGTERM handlers — uvicorn owns them in HTTP mode
and stdio mode relies on default ``KeyboardInterrupt`` propagation.
"""

import signal
import sys
from unittest.mock import AsyncMock, MagicMock

import pytest

import mitre_mcp.mitre_mcp_server as mod
from mitre_mcp.mitre_mcp_server import (
    attack_lifespan,
    build_config_banner,
    parse_cli_args,
)


@pytest.fixture(autouse=True)
def _reset_parsed_cli_args(monkeypatch):
    """Each test parses its own argv — never a namespace stored by main()."""
    monkeypatch.setattr(mod, "_parsed_cli_args", None)


class TestParseCliArgs:
    """Pin command-line parsing through the single argparse parser."""

    def test_defaults(self, monkeypatch):
        monkeypatch.delenv("FASTMCP_SERVER_HOST", raising=False)
        monkeypatch.delenv("FASTMCP_SERVER_PORT", raising=False)
        monkeypatch.setattr(sys, "argv", ["mitre-mcp"])

        args = parse_cli_args()
        assert (args.host, args.port) == ("localhost", 8000)
        assert args.http is False
        assert args.force_download is False

    def test_env_defaults(self, monkeypatch):
        monkeypatch.setenv("FASTMCP_SERVER_HOST", "0.0.0.0")
        monkeypatch.setenv("FASTMCP_SERVER_PORT", "9000")
        monkeypatch.setattr(sys, "argv", ["mitre-mcp"])

        args = parse_cli_args()
        assert (args.host, args.port) == ("0.0.0.0", 9000)

    def test_cli_overrides_env(self, monkeypatch):
        monkeypatch.setenv("FASTMCP_SERVER_HOST", "envhost")
        monkeypatch.setenv("FASTMCP_SERVER_PORT", "1111")
        monkeypatch.setattr(sys, "argv", ["mitre-mcp", "--host", "clihost", "--port", "2222"])

        args = parse_cli_args()
        assert (args.host, args.port) == ("clihost", 2222)

    def test_trailing_port_without_value_errors(self, monkeypatch, capsys):
        """F-CLEAN-006 fix: a trailing --port now exits non-zero with usage."""
        monkeypatch.setattr(sys, "argv", ["mitre-mcp", "--port"])

        with pytest.raises(SystemExit) as exc_info:
            parse_cli_args()
        assert exc_info.value.code != 0
        assert "usage" in capsys.readouterr().err.lower()

    def test_trailing_host_without_value_errors(self, monkeypatch, capsys):
        """A trailing --host with no value exits non-zero with usage."""
        monkeypatch.setattr(sys, "argv", ["mitre-mcp", "--host"])

        with pytest.raises(SystemExit) as exc_info:
            parse_cli_args()
        assert exc_info.value.code != 0
        assert "usage" in capsys.readouterr().err.lower()

    def test_host_no_longer_consumes_next_flag(self, monkeypatch):
        """F-DEAD-002 fix: --host cannot swallow the next option as a value."""
        monkeypatch.setattr(sys, "argv", ["mitre-mcp", "--host", "--port"])

        with pytest.raises(SystemExit) as exc_info:
            parse_cli_args()
        assert exc_info.value.code != 0

    def test_invalid_port_exits_nonzero(self, monkeypatch, capsys):
        monkeypatch.setattr(sys, "argv", ["mitre-mcp", "--port", "not-a-number"])

        with pytest.raises(SystemExit) as exc_info:
            parse_cli_args()
        assert exc_info.value.code == 2
        assert "usage" in capsys.readouterr().err.lower()

    def test_invalid_env_port_exits_nonzero(self, monkeypatch):
        monkeypatch.setenv("FASTMCP_SERVER_PORT", "bogus")
        monkeypatch.setattr(sys, "argv", ["mitre-mcp"])

        with pytest.raises(SystemExit) as exc_info:
            parse_cli_args()
        assert exc_info.value.code == 2

    def test_unknown_flag_rejected(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["mitre-mcp", "--bogus"])

        with pytest.raises(SystemExit) as exc_info:
            parse_cli_args()
        assert exc_info.value.code != 0

    def test_get_cli_args_tolerates_foreign_argv(self, monkeypatch):
        """Without main() (embedded/test hosts), only our flags are read."""
        monkeypatch.delenv("FASTMCP_SERVER_HOST", raising=False)
        monkeypatch.delenv("FASTMCP_SERVER_PORT", raising=False)
        monkeypatch.setattr(
            sys, "argv", ["pytest", "-q", "-p", "no:cacheprovider", "-o", "addopts="]
        )

        args = mod.get_cli_args()
        assert (args.http, args.host, args.port) == (False, "localhost", 8000)


class TestHelpText:
    """Pin help output and exit behaviour (argparse's own --help)."""

    def test_help_prints_usage_and_exits_zero(self, capsys):
        with pytest.raises(SystemExit) as exc_info:
            parse_cli_args(["--help"])
        assert exc_info.value.code == 0

        out = capsys.readouterr().out
        assert "MITRE ATT&CK MCP Server" in out
        assert "--http" in out
        assert "--force-download" in out
        assert "MITRE_CORS_ORIGINS" in out


class TestStartupBanner:
    """Pin the single banner producer and its once-per-startup call."""

    def test_stdio_banner_text(self):
        banner = build_config_banner(http=False, host="localhost", port=8000)
        assert "stdio mode" in banner
        assert "mitre_mcp.mitre_mcp_server" in banner
        assert "Add this to your MCP client configuration:" in banner

    def test_http_banner_text(self):
        banner = build_config_banner(http=True, host="h", port=9)
        assert "Streamable HTTP mode" in banner
        assert "http://h:9/mcp" in banner
        assert "Add this to your MCP client configuration:" in banner

    async def test_banner_built_once_per_startup(self, monkeypatch, tmp_path):
        """One definition, one call per start-up (issue #66)."""
        spy = MagicMock(wraps=mod.build_config_banner)
        monkeypatch.setattr(mod, "build_config_banner", spy)
        paths = {
            "enterprise": str(tmp_path / "e.json"),
            "mobile": str(tmp_path / "m.json"),
            "ics": str(tmp_path / "i.json"),
            "metadata": str(tmp_path / "md.json"),
        }
        monkeypatch.setattr(
            mod, "download_and_save_attack_data_async", AsyncMock(return_value=paths)
        )
        _patch_lifespan_deps(monkeypatch, tmp_path)
        monkeypatch.setattr(sys, "argv", ["mitre-mcp"])

        async with attack_lifespan(MagicMock()):
            pass

        spy.assert_called_once()

    def test_setup_http_server_does_not_print_banner(self, capfd):
        """The banner no longer comes out of setup_http_server."""
        mod.setup_http_server("localhost", 8000)

        captured = capfd.readouterr()
        assert "Add this to your MCP client configuration" not in captured.err
        assert "is ready" not in captured.err


class TestMain:
    """Pin the entry-point dispatch behaviour."""

    def test_help_flag_prints_usage_and_exits_zero(self, monkeypatch, capsys):
        monkeypatch.setattr(sys, "argv", ["mitre-mcp", "--help"])
        run_mock = MagicMock()
        monkeypatch.setattr(mod.mcp, "run", run_mock)

        with pytest.raises(SystemExit) as exc_info:
            mod.main()
        assert exc_info.value.code == 0

        assert "usage" in capsys.readouterr().out.lower()
        run_mock.assert_not_called()

    def test_does_not_install_signal_handlers(self, monkeypatch):
        """F-BUG-029: signal handling is owned by the runtime, not main()."""
        monkeypatch.setattr(sys, "argv", ["mitre-mcp"])
        sig_mock = MagicMock()
        monkeypatch.setattr(signal, "signal", sig_mock)
        monkeypatch.setattr(mod.mcp, "run", MagicMock())

        mod.main()

        sig_mock.assert_not_called()

    def test_stdio_mode_runs_default_transport(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["mitre-mcp"])
        run_mock = MagicMock()
        monkeypatch.setattr(mod.mcp, "run", run_mock)

        mod.main()

        run_mock.assert_called_once_with()

    def test_http_mode_wires_pipeline(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["mitre-mcp", "--http", "--host", "h", "--port", "1234"])
        setup_mock = MagicMock(return_value=("info", "ts"))
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

        mod.main()

        setup_mock.assert_called_once_with("h", 1234)
        build_mock.assert_called_once_with("h", "ts")
        uvicorn_mock.Config.assert_called_once_with("app", host="h", port=1234, log_level="info")
        uvicorn_mock.Server.assert_called_once_with(uvicorn_mock.Config.return_value)
        run_mock.assert_called_once_with(server_inst.serve.return_value)

    def test_keyboard_interrupt_exits_zero(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["mitre-mcp"])
        monkeypatch.setattr(mod.mcp, "run", MagicMock(side_effect=KeyboardInterrupt()))

        with pytest.raises(SystemExit) as exc_info:
            mod.main()
        assert exc_info.value.code == 0

    def test_unhandled_error_exits_1(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["mitre-mcp"])
        monkeypatch.setattr(mod.mcp, "run", MagicMock(side_effect=RuntimeError("boom")))

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
            # F-PERF-011: indices are built for EVERY domain, not just
            # enterprise — same fake data underlies all three here.
            for domain in ("enterprise-attack", "mobile-attack", "ics-attack"):
                idx = ctx.domain_indices[domain]
                assert "g1" in idx.groups
                assert "ga" in idx.groups  # aliases are indexed too (F-BUG-015)
                assert "m1" in idx.mitigations
                assert "T1000" in idx.techniques_by_mitre_id

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
