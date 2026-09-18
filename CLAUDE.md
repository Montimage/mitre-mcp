# CLAUDE.md

Repository-level agent guidance for the MITRE ATT&CK MCP server. The full environment inventory (every env var, setup detail) lives in `CONTRIBUTING.md` under `## Agent-runnable environment` — read it instead of guessing.

## Commands

- Python >= 3.11 virtual environment at `.venv` — activate before every Python command: `source .venv/bin/activate`
- Install (until the Task 0.2 lockfile lands): `pip install -e ".[dev]"`
- Build check: `python -c "import mitre_mcp.mitre_mcp_server"`
- Test suite of record: `pytest -q -p no:cacheprovider -o addopts=""`
- Frontend (`frontend/`, Node 24): `npm ci`, `npm run build`, `npm run lint`
- Environment variables: see `CONTRIBUTING.md` `## Agent-runnable environment` — twelve `MITRE_*` names, `FASTMCP_SERVER_HOST`/`FASTMCP_SERVER_PORT`, five `VITE_*` names

## Layout

- `mitre_mcp/` — server package: `mitre_mcp_server.py` entry point, `config.py` env-driven config, `validators.py`
- `tests/` — pytest suite; `tests/integration/` needs a committed STIX fixture
- `frontend/` — React/Vite chat UI with its own lint and build pipeline
- `clients/` — Python and Node.js sample clients
- `scripts/` — installer and ATT&CK data download helpers
- `data/` — git-ignored ATT&CK cache; never commit it

## Constraints

- You must never commit or push without being asked.
- Never add a `Co-Authored-By: Claude` line to a commit.
- Never copy secret values out of `.env` or the `.mcpregistry_*token` files — environment variable names only.
- Never commit `tests/data/` or `data/` contents — both are git-ignored by design.

## Conventions

- Minimal, focused diffs; conventional commits `type(scope): description (#N)`.
- Branch prefix follows the issue type: `fix/`, `feat/`, `refactor/`, `docs/`, `test/`, `chore/`.
- The recorded commands may still be RED — restoring green is P0 work; a red baseline is not your regression.

## Done when

- `python -c "import mitre_mcp.mitre_mcp_server"` exits 0
- `pytest -q -p no:cacheprovider -o addopts=""` passes at or above the recorded pass rate
- For frontend changes: `cd frontend && npm run lint && npm run build` exits 0

## Baseline

- Recorded pass rate: not yet measured (Task 0.2 fills this in)
- Recorded coverage: not yet measured (Task 0.4 fills this in)

## Token Efficiency

- Never re-read files you just wrote or edited. You know the contents.
- Never re-run commands to "verify" unless the outcome was uncertain.
- Don't echo back large blocks of code or file contents unless asked.
- Batch related edits into single operations. Don't make 5 edits when 1 handles it.
- Skip confirmations like "I'll continue..." Just do it.
- If a task needs 1 tool call, don't use 3. Plan before acting.
- Do not summarize what you just did unless the result is ambiguous or you need additional input.
