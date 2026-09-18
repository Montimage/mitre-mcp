# Migration: globals 16 → 17

Task 5.8. Spike document for the globals 16.x → 17.x upgrade.
Depends on #59 (eslint 10 + `@eslint/js` 10 — merged). The pin moves
`globals ^16.5.0` → `^17.12.0`; the package is consumed only by the
ESLint flat config (`languageOptions.globals`). Supersedes dependabot
PR #150 (globals 17.x); left open per instructions.

## Sources consulted

- globals v17.0.0 release notes:
  <https://github.com/sindresorhus/globals/releases/tag/v17.0.0>
- globals release list through v17.12.0:
  <https://github.com/sindresorhus/globals/releases>
- npm registry: `globals@17.x` engines (`node: >=18`)

## Breaking change 16.x → 17.x

- **`audioWorklet` environment split out of `browser`**: AudioWorklet
  globals (`AudioWorkletGlobalScope`, `AudioWorkletProcessor`,
  `currentFrame`, `currentTime`, `registerProcessor`, `sampleRate`)
  moved from `globals.browser` into a new `globals.audioWorklet` key.
  Impact: only code referencing those identifiers. Grep over
  `frontend/src/` and `frontend/eslint.config.js` found zero
  `AudioWorklet`/`audioWorklet` references — no-op, the config needs
  no changes.

## Non-breaking additions (17.x line)

- New environments: `bunBuiltin`, `denoBuiltin`, `paintWorklet`,
  `sharedWorker`, `react-native`; `browser` now merges Chrome and
  Firefox data; periodic `Update globals` refreshes; `GM_cookie` added
  to Greasemonkey; `__webpack_layer__` added. None are referenced by
  our config.

## Configuration surface (verified)

`frontend/eslint.config.js` uses `import globals from 'globals'` and a
single `languageOptions.globals = globals.browser`. The `browser` key
still exists in v17 — usage remains valid, no renamed keys in use.

## Repository impact audit

- Engines floor is `node >=18`; our Node 24 pin (#38) satisfies it.
- No other dependency in `frontend/package.json` constrains `globals`.

## Changes applied

- `docs/migrations/globals-16-to-17.md`: this spike.
- `frontend/package.json`: `globals ^16.5.0` → `^17.12.0` — no other
  dependency touched.
- `frontend/package-lock.json`: regenerated via `npm install`.
- Verified: `npm ci`, `npm run lint`, `npm run build`,
  `npm audit --audit-level=high` all exit 0 on Node 24+; `npm ls
globals` shows 17.12.0 with zero new lint errors.
