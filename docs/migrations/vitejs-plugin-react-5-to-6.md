# Migration: @vitejs/plugin-react 5 → 6

Task 5.6. Spike document for the `@vitejs/plugin-react` 5.x → 6.x
upgrade. Depends on #57 (vite 8 — merged; plugin-react 6 requires
vite `^8.0.0`). The pin moves `@vitejs/plugin-react ^5.2.0` →
`^6.1.1` and resolves 6.1.1. Supersedes dependabot PR #154 (left
open per instructions).

## Sources consulted

- `@vitejs/plugin-react` CHANGELOG (5.x → 6.1.1):
  <https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/CHANGELOG.md>
- Babel removal PR: <https://github.com/vitejs/vite-plugin-react/pull/1123>
- Vite 7 drop PR: <https://github.com/vitejs/vite-plugin-react/pull/1124>
- `@vitejs/plugin-react@6.1.1` peer range / `peerDependenciesMeta`
  (npm registry)

## Breaking changes 5.x → 6.1.1

- **Babel removed from the plugin** (#1123). Vite 8 performs the
  React Refresh transform with Oxc, so plugin-react 6 no longer
  depends on Babel and the `react({ babel: ... })` option is gone.
  Projects that need Babel plugins must add
  `@rolldown/plugin-babel` as a sibling plugin; React Compiler users
  migrate `babel.plugins: ['babel-plugin-react-compiler']` to
  `babel({ presets: [reactCompilerPreset()] })`.
- **Vite 7 and below dropped** (#1124). Peer range is now
  `vite ^8.0.0` only — satisfied by our vite 8.3.0 pin (#57).
- **New optional peers** (all `peerDependenciesMeta.optional`):
  `@rolldown/plugin-babel ^0.1.7 || ^0.2.0`,
  `babel-plugin-react-compiler ^1.0.0`, and (since 6.1.0)
  `oxc-transform-react ^0.145.0` for the experimental native React
  Compiler via `react({ compiler: true })`. None are required for
  the default `react()` path.
- **Runtime floor**: Node `^20.19.0 || >=22.12.0` — our Node 24 pin
  (#38) satisfies it.

## Configuration surface (verified)

- `frontend/vite.config.js` calls `react()` with **no options** —
  the removed `babel` option was never in use, so no config changes
  are required.
- Grep over `frontend/` (excluding `node_modules`/lockfile) for
  `babel|reactCompiler|oxc-transform-react`: zero hits outside this
  document's scope — no Babel plugins, presets, or React Compiler
  usage to migrate.
- `npm ls @vitejs/plugin-react` prints 6.1.1; no other package
  changed major version in the same commit (the removed
  `@babel/*`/`babel-plugin-*` entries were transitive deps of
  plugin-react 5 and leave the lockfile with it).

## Changes applied

- `docs/migrations/vitejs-plugin-react-5-to-6.md`: this spike.
- `frontend/package.json`: devDependency
  `@vitejs/plugin-react ^5.2.0` → `^6.1.1` (resolves 6.1.1). No
  other dependency touched — one major per commit.
- `frontend/package-lock.json`: regenerated via `npm install` —
  plugin-react 5.2.0 → 6.1.1 plus removal of its Babel transitive
  subtree; `@rolldown/pluginutils` added.
- Verified: `npm ci`, `npm ls @vitejs/plugin-react` (6.x),
  `npm run lint`, `npm run build`, and
  `npm audit --audit-level=high` all exit 0 on Node 24+.
