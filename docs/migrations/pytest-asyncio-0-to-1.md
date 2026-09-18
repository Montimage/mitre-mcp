# Migration: pytest-asyncio 0.x → 1

Task 5.3. Spike document for the pytest-asyncio 0.x → 1.x upgrade.

Sequencing note: the version edit itself landed ahead of this spike as
a forced compatibility pin inside the pytest 7 → 9 task (#54, commit
494d30f) — every pytest-asyncio 0.x release declares `pytest<9`, so
resolution at pytest 9 required `pytest-asyncio>=1.3.0,<2.0.0`. This
document completes the deferred migration scope: upstream breaking
changes, repository audit, and config finalization. The pin resolves
pytest-asyncio 1.4.0.

## Sources consulted

- Upstream changelog (Keep a Changelog format):
  <https://github.com/pytest-dev/pytest-asyncio/blob/main/docs/reference/changelog.rst>
- Upstream migration guide ("How to migrate from pytest-asyncio v0.23"):
  <https://pytest-asyncio.readthedocs.io/en/stable/how-to-guides/migrate_from_0_23.html>
- Plugin requirement metadata (PyPI `requires_dist`):
  <https://pypi.org/pypi/pytest-asyncio/json>
- Installed plugin surface: `.venv/.../pytest_asyncio/plugin.py`
  (1.4.0) — ini options, fixture names, marker kwargs verified against
  source.

## Breaking changes 0.x → 1.0.0

Per the 1.0.0 changelog section (last 0.x was 0.26.0):

- **The deprecated `event_loop` fixture was removed** (#1106). In 0.x
  a suite could request or redefine `event_loop` (e.g. a session- or
  module-scoped override) to control the loop. In 1.x the fixture does
  not exist; loop lifetime is managed by internal scoped-runner
  fixtures, and customization moves to `loop_scope` on
  `pytest.mark.asyncio` / `pytest_asyncio.fixture`, the
  `asyncio_default_fixture_loop_scope` /
  `asyncio_default_test_loop_scope` ini options, and (as of 1.4.0) the
  `pytest_asyncio_loop_factories` hook.
- Scoped event loops are created once rather than per scope (#1107) —
  internal speedup, no behavioral change for correct suites.
- `pytest.mark.asyncio(loop_scope=...)` no longer requires a pytest
  Collector at the named scope (#1112) — e.g. `loop_scope="class"` no
  longer requires an enclosing class.
- Python floor raised (1.x: >=3.9, later >=3.10) — no impact: project
  floor is Python >= 3.11.

## Changes in 1.1.0 – 1.4.0 relevant to the audit

- 1.1.0: tests run under `asyncio.Runner` (via
  `backports.asyncio.runner` on Python < 3.11 — not installed here);
  outstanding tasks are cancelled when their `loop_scope` ends; a
  warning is emitted when a test closes the current event loop.
- 1.2.0: `pytest.UsageError` for invalid
  `asyncio_default_fixture_loop_scope` /
  `asyncio_default_test_loop_scope` values; new `asyncio_debug`
  ini/`--asyncio-debug` CLI option; fixed `RuntimeError: There is no
current event loop` when a test unsets the loop (`asyncio.run()`).
- 1.3.0: pytest 9 support (#1279) — first release allowing `pytest<10`;
  Python 3.9 dropped.
- 1.4.0: overriding the `event_loop_policy` fixture is **deprecated**
  in favor of the `pytest_asyncio_loop_factories` hook (#1419); minimum
  pytest raised to 8.4.0; fixed `ResourceWarning: unclosed event loop`
  when a synchronous test unsets the current loop (#724); clearer
  `PytestDeprecationWarning` when `asyncio_default_fixture_loop_scope`
  is unset (#1298).

## Configuration surface (verified against installed 1.4.0)

- `asyncio_mode = "auto"` — unchanged semantics; still auto-marks async
  test functions and async fixtures. Strict remains the upstream
  default; this project opts into `auto`.
- `asyncio_default_fixture_loop_scope` — unset in 0.x-era config.
  1.x emits a `PytestDeprecationWarning` at `pytest_configure` time
  while unset; today async fixtures inherit the _fixture caching
  scope_, and a future release flips the default to `"function"`.
  Now pinned explicitly to `"function"` (the future default) — inert
  today because the suite has no async fixtures.
- `asyncio_default_test_loop_scope` — upstream default is already
  `"function"` (unchanged from 0.x); left unset intentionally.
- Marker: `@pytest.mark.asyncio(loop_scope="...")` (the 0.x `scope`
  kwarg is still accepted as an alias); the `asyncio` marker is already
  registered in `pyproject.toml` `markers`.

## Repository impact audit

- No `event_loop` fixture anywhere in `tests/` — nothing requested or
  overrode it, so the 1.0.0 removal is a no-op here.
- No `event_loop_policy` override — the 1.4.0 deprecation is a no-op.
- No async fixtures (no `async def` fixture functions, no
  `pytest_asyncio.fixture` decorators) — fixture loop scope is inert.
- No `loop_scope`/`scope` marker kwargs — all async tests run at the
  default function scope, identical to 0.x behavior.
- 22 async test functions across `tests/test_concurrency.py` (3),
  `tests/test_conformance.py` (4), `tests/test_download.py` (9),
  `tests/test_protocol_smoke.py` (2), `tests/test_startup.py` (4) —
  unchanged. Most carry explicit `@pytest.mark.asyncio`; the four in
  `test_startup.py` rely on `asyncio_mode = "auto"` and are still
  collected and run as coroutines.
- `tests/unit/test_mitre_mcp_server.py` drives the server loop manually
  via `asyncio.new_event_loop()` / `asyncio.set_event_loop()` inside a
  synchronous test — not a pytest-asyncio fixture path, unaffected;
  the 1.4.0 fix for #724 specifically hardens this pattern.
- Dependabot PR #151 (`pytest-asyncio>=0.21.0,<2.0.0`) is superseded
  by this change; left open per instructions.

## Changes applied

- `docs/migrations/pytest-asyncio-0-to-1.md`: this spike.
- `pyproject.toml`: `pytest-asyncio>=1.3.0,<2.0.0` — already in place
  from #54's forced compat pin (resolves 1.4.0); confirmed final, no
  edit needed.
- `pyproject.toml` `[tool.pytest.ini_options]`:
  `asyncio_default_fixture_loop_scope = "function"` added next to the
  existing `asyncio_mode = "auto"`.
- `uv.lock`: unchanged (`uv lock --check` exits 0; pin already locked).
- Verified: `pytest -q -p no:cacheprovider -o addopts=""` 171/171,
  `pytest -W error::DeprecationWarning` 171/171.
