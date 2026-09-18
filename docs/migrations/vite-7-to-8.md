# Migration: Vite 7 → 8

Task 5.5. Spike document for the vite 7.x → 8.x upgrade.
Depends on #38 (Node 24 everywhere — merged) and #50 (frontend SDK
work — merged). The pin moves `vite ^7.2.2` → `^8.3.0` and resolves
vite 8.3.0. Supersedes dependabot PR #123 (left open per
instructions).

## Sources consulted

- Vite 8 announcement: <https://vite.dev/blog/announcing-vite8>
- Vite 8 migration guide:
  <https://github.com/vitejs/vite/blob/main/docs/guide/migration.md>
- Vite 8 changelog (via the migration guide link)
- `@vitejs/plugin-react@5.2.0` peer range (npm registry)

## Breaking changes 7.x → 8.3.0

- **Rolldown replaces Rollup + esbuild.** Vite 8 bundles with Rolldown
  (Rust) for both dev-time dependency pre-bundling and production
  builds; Oxc replaces esbuild for JS transforms and minification;
  Lightning CSS replaces esbuild for CSS minification. A compatibility
  layer auto-converts `rollupOptions`/`esbuild` config to the new
  equivalents.
- **`build.rollupOptions` → `build.rolldownOptions`.** The old key is
  a deprecated alias that still works.
- **`esbuild` option → `oxc`.** Deprecated alias; `esbuild.supported`
  is unsupported by Oxc. `optimizeDeps.esbuildOptions` →
  `optimizeDeps.rolldownOptions`, same treatment.
- **esbuild is now an optional dependency.** Plugins calling
  `transformWithEsbuild` need esbuild installed explicitly; the helper
  is deprecated in favor of `transformWithOxc`.
- **CJS default-import interop is now consistent** between dev and
  build: the `default` import is the whole `module.exports` only when
  the importer is ESM (`.mjs`/`.mts` or nearest `package.json` has
  `"type": "module"`) or the module lacks a truthy `__esModule` flag;
  otherwise it resolves to `module.exports.default`.
- **`manualChunks` object form unsupported** — Rolldown accepts only
  the function form.
- **Default `build.target` raised** (Chrome 111 / Safari 16.4 baseline,
  up from Chrome 107 / Safari 16).
- **Runtime floor unchanged**: Node `^20.19.0 || >=22.12.0` — our
  Node 24 pin (#38) satisfies it. Package is ESM-only (already true
  in 7.x).

## Configuration surface (verified against installed 8.3.0)

- `frontend/vite.config.js` uses only `plugins: [react()]` and
  `server.proxy` (`/mcp` → :8000, `/ollama` → :11434 with a path
  rewrite). No `build.*`, `esbuild`, `optimizeDeps`, `minify`,
  `target`, or `manualChunks` keys — none of the renamed/deprecated
  options are in use, so no config changes are required.
- Grep over `frontend/` (excluding `node_modules`/lockfile) for
  `rollupOptions|rolldownOptions|esbuild|optimizeDeps|minify|
manualChunks|build.target|transformWithEsbuild`: zero hits.
- `src/` uses no `require()` or `process.env` — the CJS interop change
  is a no-op here (`"type": "module"` is set anyway).
- `@vitejs/plugin-react` stays at `^5.2.0`: its peer range is
  `vite ^4.2 || ^5 || ^6 || ^7 || ^8`, so vite 8 installs without a
  forced plugin bump. The plugin-react 6.x upgrade remains scoped to
  issue #58 (dependabot PR #154).

## Repository impact audit

- `netlify.toml` sets `NODE_VERSION = "24"` and `.github/workflows/
frontend.yml` uses `node-version: '24'` — both already satisfy the
  vite 8 engine floor; no changes needed.
- Build output: chunk names/hashes change under Rolldown (expected),
  but the `dist/` shape (`index.html` + hashed `assets/`) is
  unchanged — `netlify.toml` publish dir and `[[headers]]` rules still
  match.
- Dependabot PR #123 (vite 7.3.6 → 8.3.0) is superseded by this
  change; left open per instructions.

## Changes applied

- `docs/migrations/vite-7-to-8.md`: this spike.
- `frontend/package.json`: devDependency `vite ^7.2.2` → `^8.3.0`
  (resolves 8.3.0). No other dependency touched — one major per
  commit.
- `frontend/package-lock.json`: regenerated via `npm install` — vite
  7.3.6 → 8.3.0 plus its new transitive tree (rolldown, oxc,
  lightningcss native binaries; esbuild/rollup removed from the vite
  subtree).
- Verified: `npm ci`, `npm run lint`, `npm run build`, and
  `npm audit --audit-level=high` all exit 0 on Node 24+.
