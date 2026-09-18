# Migration: ESLint 9 → 10

Task 5.7. Spike document for the eslint 9.x → 10.x upgrade.
Depends on #58 (`@vitejs/plugin-react` 5 → 6 — merged). The pins move
`eslint ^9.39.1` → `^10.10.0` and `@eslint/js ^9.39.1` → `^10.0.1`
**in lockstep** — both packages share the same major release line and
must land in one bump. Supersedes dependabot PR #153
(eslint 10.10.0) and PR #129 (`@eslint/js` 10.0.1); both left open per
instructions.

## Sources consulted

- ESLint 10 migration guide:
  <https://eslint.org/docs/latest/use/migrate-to-10.0.0>
- npm registry: `eslint@10.10.0`/`10.11.0` engines + peer ranges
- npm registry: `eslint-plugin-react-hooks@7.1.1` and
  `eslint-plugin-react-refresh@0.5.7` peer ranges

## Breaking changes 9.x → 10.x (user-facing)

- **Node.js floor raised**: `^20.19.0 || ^22.13.0 || >=24` — our
  Node 24 pin (#38) satisfies it.
- **`eslint:recommended` gained three rules**: `no-unassigned-vars`,
  `no-useless-assignment`, `preserve-caught-error`. Per AC, no rule
  may be disabled to pass — any new reports must be fixed in source
  (the ruleset stays same-or-stricter).
- **JSX references are now tracked**: JSX identifiers count as scope
  references, so `no-unused-vars`/`no-undef` now resolve JSX component
  usage natively. May surface new reports in `*.jsx` files.
- **New config-file lookup**: `v10_config_lookup_from_file` is now the
  default and the flag was removed. We set no flags — no-op.
- **Legacy config format removed**: `.eslintrc*` /
  `ESLINT_USE_FLAT_CONFIG=false` / `FlatESLint` / `LegacyESLint` are
  gone. We are already on flat `eslint.config.js` — no-op.
- **`/* eslint-env */` comments now error**: grep over `frontend/src/`
  and `frontend/*.js` found zero `eslint-env` (or any inline
  `eslint-*`) comments — no-op.
- **Jiti < 2.2.0 unsupported**: only relevant for TS/config-loading;
  our config is plain ESM JS — no-op. (`eslint@10` declares an
  optional peer `jiti: *`; not installed, not needed.)
- **POSIX character classes in globs**: our only glob is
  `**/*.{js,jsx}` — no classes in use, no-op.
- **`stylish` formatter** now uses `util.styleText` instead of chalk —
  cosmetic, no config impact.
- **`radix`, `no-shadow-restricted-names`, `func-names`,
  `no-invalid-regexp` changes**: none of these rules are configured
  beyond the recommended set; `no-shadow-restricted-names` is not in
  `eslint:recommended`.
- **`name` property added to core configs** — informational only.

## Configuration surface (verified)

`frontend/eslint.config.js` uses the flat-config API only:
`defineConfig` + `globalIgnores` from `eslint/config` (both still
exported in v10), `js.configs.recommended`,
`reactHooks.configs.flat.recommended`, `reactRefresh.configs.vite`,
plus `languageOptions` (`ecmaVersion`, `globals`,
`parserOptions.ecmaFeatures.jsx`) and one `no-unused-vars` override
(`varsIgnorePattern: '^[A-Z_]'`). No removed or renamed options are in
use — the config needs no changes.

## Plugin peer compatibility

- `eslint-plugin-react-hooks@7.1.1` (range `^7.0.1` in package.json):
  peer `eslint: ^3 || … || ^9 || ^10` — already compatible, no bump.
- `eslint-plugin-react-refresh@0.5.7` (range `^0.5.7`): peer
  `eslint: ^9 || ^10` — already compatible, no bump.

## Repository impact audit

- `.github/workflows/frontend.yml` uses `node-version: '24'` and
  `netlify.toml` sets `NODE_VERSION = "24"` — both satisfy the new
  engine floor; no changes needed.
- Dependabot PRs #153 (eslint 10.10.0) and #129 (@eslint/js 10.0.1)
  are superseded by this single lockstep bump; left open per
  instructions.

## Changes applied

- `docs/migrations/eslint-9-to-10.md`: this spike.
- `frontend/package.json`: `eslint ^9.39.1` → `^10.10.0`,
  `@eslint/js ^9.39.1` → `^10.0.1` — one lockstep bump, no other
  dependency touched.
- `frontend/package-lock.json`: regenerated via `npm install`.
- Verified: `npm ci`, `npm run lint`, `npm run build`,
  `npm audit --audit-level=high` all exit 0 on Node 24+; `npm ls
eslint @eslint/js` shows 10.x for both with zero new lint errors.
