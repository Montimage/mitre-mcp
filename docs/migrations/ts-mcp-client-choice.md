# TypeScript MCP client package choice (issue #49)

Date: 2026-09-18. Recorded before code changes per the issue's spike-first
acceptance criterion.

## Candidates

| Package | Version | Type | Runtime deps (npm) | Unpacked |
|---|---|---|---|---|
| `@modelcontextprotocol/sdk` | 1.30.0 | Full SDK (client + server) | express, hono, cors, ajv, raw-body, express-rate-limit, zod-to-json-schema, … (~18) | 4.3 MB |
| `@modelcontextprotocol/client` | 2.0.0 | Client-only (`@modelcontextprotocol/core` 2.0.0) | zod, jose, cross-spawn, eventsource, eventsource-parser, pkce-challenge (~7) | 6.6 MB |

## Sources consulted

- npm registry metadata (`npm view`) for both packages — versions,
  dependency trees, exports maps, engines (`>=20`; Node 24 satisfies).
- Upstream repository (both packages live in it):
  https://github.com/modelcontextprotocol/typescript-sdk
- Installed-tarball inspection of `@modelcontextprotocol/client@2.0.0`
  (`npm pack` + `tar xzf`): the main `dist/index.mjs` entry contains **no
  `node:` imports** — Node-only code is isolated behind the `./stdio`
  subpath (`stdio.mjs` imports `node:process`, `node:stream`), which a
  browser bundle never touches. Exports include `Client`,
  `StreamableHTTPClientTransport`, `SdkHttpError`, `SSEClientTransport`.

## Decision: `@modelcontextprotocol/client` 2.0.0

1. **Browser-bundle fit.** The client-only package carries no server
   dependencies (express, hono, cors, ajv, raw-body). Bundling the full
   `sdk` would drag Node server code into the Vite graph and risk
   reintroducing the Node-builtin shims removed with
   `vite-plugin-node-polyfills` (issue #31). Verified empirically: the
   client package's main entry is free of `node:` imports.
2. **Same official scope.** Both packages are published under
   `@modelcontextprotocol` from the same upstream monorepo; `client` is
   the purpose-built artifact for this use case, not a third-party fork.
3. **Protocol surface.** `Client.connect(transport)` performs version
   negotiation itself (no hard-coded `2024-11-05`), and
   `StreamableHTTPClientTransport` manages the `mcp-session-id` header,
   the required `Accept: application/json, text/event-stream` header, and
   SSE framing internally — deleting the hand-rolled parser and the
   `data: ` line-joining bug (F-BUG-017). HTTP errors surface as
   `SdkHttpError` with a `status` property, so the expired-session 404
   recovery added in #37 can key off `error.status === 404`.

## Risks accepted

- `engines` says `node >=20`: advisory for bundling (build runs on Node
  24); the browser path uses `fetch`, `URL`, and `ReadableStream` only.
- The package is newer than the v1 `sdk` line our Python side mirrors —
  mitigated by keeping the public `MitreMCPClient` interface unchanged so
  any transport swap stays local to `mcpClient.js`.
