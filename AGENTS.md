# AGENTS.md

Cross-agent rules for this repository. The recorded build, test, and install commands are pinned once in `CLAUDE.md` under `## Commands`; the complete environment-variable inventory lives in `CONTRIBUTING.md` under `## Agent-runnable environment`.

## Project

MITRE ATT&CK MCP server: Python package `mitre_mcp` (requires Python >= 3.11) plus a React/Vite frontend in `frontend/` (Node 24). Invariants: never change observed MITRE tool outputs, keep the model dropdown in sync with the manifests, and never commit generated data or secrets.

## Commands

Run the commands of record verbatim from `CLAUDE.md` `## Commands` — they are defined there once and referenced here rather than duplicated. For setup details and environment variable names, see `CONTRIBUTING.md` `## Agent-runnable environment`.

## Layout

- `mitre_mcp/` — server package: `mitre_mcp_server.py` thin entry point and public re-export surface; `data.py` download/cache/indices, `models.py` result schemas, `server.py` the `mcp` object + lifespan, `tools.py` the nine tools, `cli.py` argv/banner/signals, `http.py` transport security + ASGI app, `config.py` env-driven config, `validators.py`
- `tests/` — pytest suite; `tests/integration/` needs a committed STIX fixture
- `frontend/` — React/Vite chat UI with its own lint and build pipeline
- `clients/` — Python and Node.js sample clients
- `scripts/` — installer and ATT&CK data download helpers
- `data/` — git-ignored ATT&CK cache; never commit it

## Conventions

- Minimal, focused diffs; conventional commits `type(scope): description (#N)`.
- Branch prefix follows the issue type: `fix/`, `feat/`, `refactor/`, `docs/`, `test/`, `chore/`.
- The recorded commands may still be RED — restoring green is P0 work; a red baseline is not your regression.

## Constraints

- Repository etiquette — never commit or push without being asked, never add `Co-Authored-By` trailers — is pinned in `CLAUDE.md` `## Constraints` and applies to every agent.
- Never copy secret values out of `.env` or the `.mcpregistry_*token` files — environment variable names only.
- Never commit `tests/data/` or `data/` contents — both are git-ignored by design.

## Done when

- The recorded build-check and test commands listed in `CLAUDE.md` `## Commands` exit 0.
- The frontend lint and build commands from the same section pass for frontend changes.
- No secrets or generated-data files appear in the diff.

## Baseline

Recorded pass rate and coverage are tracked in `CLAUDE.md` `## Baseline`. Update the record there when the relevant task lands; never invent a number.

## Read when needed

- `CONTRIBUTING.md` `## Agent-runnable environment` — environment variables and setup details
- `SECURITY.md` — vulnerability reporting and secret handling
- `Playbook.md` — high-level architecture walkthrough

## Token Efficiency

- Never re-read files you just wrote or edited. You know the contents.
- Never re-run commands to "verify" unless the outcome was uncertain.
- Don't echo back large blocks of code or file contents unless asked.
- Batch related edits into single operations. Don't make 5 edits when 1 handles it.
- Skip confirmations like "I'll continue..." Just do it.
- If a task needs 1 tool call, don't use 3. Plan before acting.
- Do not summarize what you just did unless the result is ambiguous or you need additional input.
