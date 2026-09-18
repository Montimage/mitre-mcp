# Migration: node-fetch 2.7.0 → native fetch (Node ≥ 18, floor 24)

Issue #61 (`F-DEP-202`). `node-fetch` was removed from
`clients/nodejs/package.json` rather than upgraded — the Node 24 runtime floor
set by #38 guarantees a stable global `fetch` (undici), and Task 4.8 (#51)
already ported the sample client to `@modelcontextprotocol/client`, which owns
all HTTP via `StreamableHTTPClientTransport`. Zero direct `fetch` calls remain
in the client.

## Sources

- node-fetch CHANGELOG / README (v2 vs v3 split, CJS→ESM):
  https://github.com/node-fetch/node-fetch/blob/main/docs/CHANGELOG.md
- Node.js fetch documentation (global availability, undici base):
  https://nodejs.org/api/globals.html#fetch
- MDN Fetch API (standard semantics native fetch follows):
  https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
- MCP TypeScript SDK (transport owns HTTP after the SDK port):
  https://github.com/modelcontextprotocol/typescript-sdk

## Behavioural differences audited (node-fetch 2 → native fetch)

These matter only to _direct_ calls; none remain after the SDK port.

| Area          | node-fetch 2.x         | Native fetch (undici)        |
| ------------- | ---------------------- | ---------------------------- |
| Module type   | CommonJS (`require`)   | Global, no import            |
| Timeout       | `timeout` ms option    | `AbortSignal.timeout(ms)`    |
| Size cap      | `size` option          | none — stream/abort manually |
| Body streams  | Node streams           | WHATWG web streams           |
| `res.headers` | `Headers` (node-fetch) | Standard `Headers`           |
| Errors        | `FetchError` w/ `code` | `TypeError`, `cause` chain   |
| Redirect      | `follow`/`manual` opts | `redirect: 'manual'` etc.    |
| Agent         | `http.Agent` option    | `dispatcher` (undici)        |

## Verification

- `grep -c node-fetch clients/nodejs/package.json clients/nodejs/mini-mcp-client.js`
  → 0 for both files
- `cd clients/nodejs && npm ci` → lockfile unchanged
- `node clients/nodejs/mini-mcp-client.js --help` → exit 0
- `pytest -q -p no:cacheprovider -o addopts=""` → 171/171 pass
