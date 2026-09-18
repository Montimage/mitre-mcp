# Migration: commander 11 → 15

Task 5.10 / issue #62. Spike document for the commander 11.x → 15.x
upgrade of `clients/nodejs`, landed as one commit per major
(12 → 13 → 14 → 15) so any regression stays bisectable. Depends on
#61 (node-fetch removal — merged; this client already uses the MCP
SDK transport, not node-fetch). Supersedes dependabot PR #120
(commander 15.0.0), left open per instructions.

The bump also repairs the dead `--no-revoked` flag: the code read
`options.noRevoked`, but commander maps a lone negated flag
`--no-revoked` onto `options.revoked` (default `true`, `false` when
the flag is given), so `remove_revoked_deprecated` was always sent
as `undefined`. The fix reads `!options.revoked`, which restores the
Python client's `store_true` semantics: flag present → `true`
(exclude revoked/deprecated), flag absent → `false`.

## Sources consulted

- Commander CHANGELOG:
  <https://github.com/tj/commander.js/blob/master/CHANGELOG.md>
  ([12.0.0], [13.0.0], [14.0.0], [15.0.0] entries)
- npm registry: `commander@12.1.0` / `13.1.0` / `14.0.3` / `15.0.0`
  engines fields
- Negated-option behaviour: commander "Other option types, negatable
  boolean" docs + changelog entry [#2405]

## Breaking changes by major (verified against this repo)

### 11 → 12 (2024-02)

- **Node.js floor raised to >= 18** — repo pins `engines.node >= 24`,
  CI/Node 24+ satisfies it.
- **Default export of a global `Command` instance removed from
  CommonJS** — we already use the named `const { Command } =
  require('commander')` — no-op.
- **Duplicate option flag / command name now throws** — audited:
  every `program.option`/`.command` name in `mini-mcp-client.js` is
  unique per command — no-op.
- Exit code / `passThroughOptions` changes apply to executable
  subcommands — not used here.

### 12 → 13 (2024-12)

- **Excess command-arguments now error by default**
  (`allowExcessArguments` defaults to false). Our subcommands declare
  no `.argument()`, so stray positionals now fail with
  `error: too many arguments` instead of being silently ignored —
  accepted as stricter, correct behaviour; documented here.
- **Unsupported option flag syntax throws at construction** (e.g.
  multi-character `-ws` short flags). All our flags are plain long
  `--xxx` or standard `-h/-V` built-ins — no-op.
- **Multiple `.parse()` calls throw with
  `storeOptionsAsProperties: true`** — we call `parseAsync` once and
  read `opts()` — no-op.
- `Help.wrap()` refactor — we don't subclass `Help` — no-op.

### 13 → 14 (2025-05)

- **Node.js floor raised to >= 20** — satisfied by `>= 24` pin.
- Negative numbers accepted as option/command arguments — new
  capability, no code change needed.
- `Help` class internal refactor — not used.

### 14 → 15 (2026-05)

- **Implementation migrated CommonJS → ESM; `commander` is now
  ESM-only.** Our client is CommonJS (`require('commander')`), which
  keeps working via Node's `require(esm)` support — hence the new
  Node floor of **>= 22.12.0**, still under our `>= 24` pin.
  Verified: `require('commander')` resolves and `--help` exits 0 on
  Node 26.
- **Negated-option default refined** ([#2405]): only a *lone*
  `--no-*` flag gets an implicit `true` default; defining both a
  positive and negative flag no longer implies a default. We define
  `--no-revoked` and `--no-pretty` as lone negated flags —
  `options.revoked`/`options.pretty` still default to `true` — the
  semantics this fix relies on are unchanged.
- `commander/esm.mjs` re-export removed — not imported.
- Excess command-arguments are now listed in the error message —
  cosmetic.

## Repository impact audit

- `clients/nodejs/mini-mcp-client.js` is the only commander
  consumer (`clients/python` uses argparse; `frontend/` does not
  depend on commander).
- `engines.node >= 24` in `clients/nodejs/package.json` already
  satisfies every new floor (18 → 18 → 20 → 22.12).
- No `Option` subclassing, no `.storeOptionsAsProperties`, no
  executable subcommands, no `commander/esm.mjs` import, no
  duplicate flags — no other call sites need changes.
- Dependabot PR #120 (commander 15.0.0) is superseded by the
  per-major commits here; left open per instructions.

## Changes applied

- `docs/migrations/commander-11-to-15.md`: this spike.
- `clients/nodejs/package.json` + `package-lock.json`:
  `commander ^11.1.0` → `^12.1.0` → `^13.1.0` → `^14.0.3` →
  `^15.0.0`, one commit per major, `node mini-mcp-client.js --help`
  verified green at each step.
- `clients/nodejs/mini-mcp-client.js`: `options.noRevoked` →
  `!options.revoked` at the five `remove_revoked_deprecated` call
  sites (`grep -n noRevoked` prints 0).
- Verified: `npm ci` clean, `--help` exits 0, and a dry parse
  through the real CLI (SDK stubbed via `node --require`) shows
  `remove_revoked_deprecated: true` with `--no-revoked` and `false`
  without it.
