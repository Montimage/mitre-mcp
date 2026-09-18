@AGENTS.md

Claude-specific pins for this repository. Shared rules (layout, conventions, constraints, token efficiency) live in `AGENTS.md`, which is imported above; the full environment inventory lives in `CONTRIBUTING.md` under `## Agent-runnable environment` — read it instead of guessing.

## Commands

- Python >= 3.11 virtual environment at `.venv` — activate before every Python command: `source .venv/bin/activate`
- Install (until the Task 0.2 lockfile lands): `pip install -e ".[dev]"`
- Build check: `python -c "import mitre_mcp.mitre_mcp_server"`
- Test suite of record: `pytest -q -p no:cacheprovider -o addopts=""`
- Frontend (`frontend/`, Node 24): `npm ci`, `npm run build`, `npm run lint`
- Environment variables: see `CONTRIBUTING.md` `## Agent-runnable environment` — twelve `MITRE_*` names, `FASTMCP_SERVER_HOST`/`FASTMCP_SERVER_PORT`, five `VITE_*` names

## Constraints

- You must never commit or push without being asked.
- Never add a `Co-Authored-By: Claude` line to a commit.

## Baseline

- Recorded pass rate: not yet measured (Task 0.2 fills this in)
- Recorded coverage: not yet measured (Task 0.4 fills this in)
