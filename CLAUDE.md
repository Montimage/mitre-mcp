@AGENTS.md

Claude-specific pins for this repository. Shared rules (layout, conventions, constraints, token efficiency) live in `AGENTS.md`, which is imported above; the full environment inventory lives in `CONTRIBUTING.md` under `## Agent-runnable environment` — read it instead of guessing.

## Commands

- Python >= 3.11 virtual environment at `.venv` — activate before every Python command: `source .venv/bin/activate`
- Install (locked, from `uv.lock`): `uv sync --locked --extra dev`
- Build check: `python -c "import mitre_mcp.mitre_mcp_server"`
- Test suite of record: `pytest -q -p no:cacheprovider -o addopts=""`
- Frontend (`frontend/`, Node 24): `npm ci`, `npm run build`, `npm run lint`
- Environment variables: see `CONTRIBUTING.md` `## Agent-runnable environment` — twelve `MITRE_*` names, `FASTMCP_SERVER_HOST`/`FASTMCP_SERVER_PORT`, five `VITE_*` names

## Constraints

- You must never commit or push without being asked.
- Never add a `Co-Authored-By: Claude` line to a commit.

## Baseline

- Recorded pass rate: 131 passed / 133 total
- Failing tests (listed separately; live-data dependent — see Task 0.5):
  - `tests/integration/test_mcp_tools.py::TestMcpToolsIntegration::test_get_technique_by_id`
  - `tests/integration/test_mcp_tools.py::TestMcpToolsIntegration::test_get_techniques_by_tactic`
- Recorded coverage: 70.7 % (fresh checkout — 9 integration tests skip without `tests/data/`; gate `--cov-fail-under=70` in `pyproject.toml`)
