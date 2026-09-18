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

- Recorded pass rate: 171 passed / 171 total
- Failing tests: none
- Recorded coverage: 93.8 % (committed STIX fixture + protocol smoke test; gate `--cov-fail-under=79` — measured 93.77% on Python 3.11.15 with pytest-cov 7.1.0)
