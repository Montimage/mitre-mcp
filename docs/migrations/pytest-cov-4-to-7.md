# Migration: pytest-cov 4 → 7

Task 5.4. Spike document for the pytest-cov 4.x → 7.x upgrade.
Depends on #55 (pytest 9 / pytest-asyncio 1 already on main); the pin
moves `pytest-cov>=4.1.0,<5.0.0` → `pytest-cov>=7,<8` and resolves
pytest-cov 7.1.0.

## Sources consulted

- Upstream changelog:
  <https://pytest-cov.readthedocs.io/en/latest/changelog.html>
- Upstream config/reporting docs:
  <https://pytest-cov.readthedocs.io/en/latest/config.html>
- coverage.py `patch = subprocess` config (7.0.0 migration note):
  <https://coverage.readthedocs.io/en/latest/config.html#run-patch>

## Breaking changes 4.1.0 → 7.1.0

- **5.0.0 (2024-03-24)**: dropped Python 3.7 (project floor is >=3.11
  — no impact); removed xdist rsync support (pytest-xdist is not a
  dependency here — no impact).
- **6.0.0 (2024-10-29)**: dropped Python 3.8 (no impact);
  `--cov-fail-under` now evaluates using the `precision` set in the
  coverage configuration instead of a fixed integer comparison; added
  `--cov-precision` CLI override. Our config sets no `precision`
  (upstream default 0), so the gate `79` is still an integer check.
- **6.1.0 (2025-04-01)**: terminal report header now renders
  full-width lines; removed the `CovFailUnderWarning` emitted when
  `--cov-fail-under` was set without a report — cosmetic.
- **6.2.x (2025-06)**: the plugin registers warning filters for
  `sqlite3` `ResourceWarning`, `PytestCovWarning`, and `CoverageWarning`
  so `filterwarnings = error` suites don't trip on coverage internals;
  requires pluggy >= 1.2.0 (locked pluggy already newer — no impact).
- **7.0.0 (2025-09-09)**: **dropped built-in subprocess measurement**.
  The plugin no longer installs its `.pth`-based subprocess coverage
  hook; coverage.py >= 7.10's `patch = subprocess` run option is the
  replacement. Requires coverage >= 7.10.6 (locked coverage is 7.16.1
  — satisfied). Packaging switched to hatchling — irrelevant to
  consumers.
- **7.1.0 (2026-03-21)**: total coverage computation is now consistent
  across report formats — `--cov-fail-under` no longer yields different
  results depending on which `--cov-report` outputs are enabled; the
  html+xml+term combination we pin is now checked once, consistently.

## Configuration surface (verified against installed 7.1.0)

- `--cov=mitre_mcp`, `--cov-report=term-missing`, `--cov-report=html`,
  `--cov-report=xml` — all unchanged and still valid.
- `--cov-fail-under=79` — unchanged flag; under 6.x+ the comparison
  honors coverage `[report] precision` (unset → 0 → integer compare),
  and under 7.1.0 the checked total is identical across reports.
- No `--cov-context` / `--no-cov-on-fail` / `--cov-reset` usage in
  `pyproject.toml` addopts, `tests/`, or `.github/workflows/test.yml`.
- No `--cov-branch` usage — branch-vs-statement drift not a factor.

## Repository impact audit

- No subprocesses spawned by `tests/` or `mitre_mcp/` (no
  `subprocess`/`Popen`/multiprocessing coverage paths), and
  `[tool.coverage.run]` sets no `concurrency`/`parallel`/`patch` — the
  7.0.0 subprocess-measurement removal is a no-op; no `patch =
subprocess` needed.
- `tests/` does not spawn `coverage` directly or read `.coverage*`
  data files.
- CI (`.github/workflows/test.yml`) invokes `pytest --cov=mitre_mcp
--cov-report=xml --cov-report=term-missing` — flags unchanged.
- Coverage drift: measured 93.77% post-bump on Python 3.11.15
  (gate 79 — ~15pp margin; the CLAUDE.md recorded baseline of 80.2%
  was stale and is updated to 93.8% alongside this change).
- Dependabot PR #121 (`pytest-cov` 4 → 7) is superseded by this
  change; left open per instructions.

## Changes applied

- `docs/migrations/pytest-cov-4-to-7.md`: this spike.
- `pyproject.toml`: dev extra `pytest-cov>=4.1.0,<5.0.0` →
  `pytest-cov>=7,<8` (resolves 7.1.0; coverage stays 7.16.1).
- `uv.lock`: regenerated via `uv lock` — pytest-cov 4.1.0 → 7.1.0,
  `coverage>=7.10.6` bound satisfied by existing 7.16.1; no other
  resolution changes.
- Verified: `pytest -q -p no:cacheprovider -o addopts=""` 171/171;
  default addopts run passes the `--cov-fail-under=79` gate at 80.2%
  and emits `coverage.xml` + `htmlcov/`.
