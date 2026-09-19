# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] — 2026-09-19

### Breaking Changes

- **Python floor raised to 3.11** — Python 3.10 support dropped (EOL 2026-10-31; also required by `mitreattack-python` 6) (#156)
- **Node 24 LTS** is now the declared runtime for the frontend and tooling (#155)
- **Server ported from MCP Python SDK v1 `FastMCP` to v2 `MCPServer`**, with MCP spec conformance updated to `2026-07-28` (#161, #163)

### Features

- Typed return models give every tool a real `outputSchema` (#165)
- Paginated list and relationship tools with precomputed domain lists (#193)
- Lazy-load Mobile/ICS domains and refresh the stale cache in the background (#204)
- Frontend: replaced the hand-rolled MCP transport with the official client SDK (#166)
- Frontend: discover the agent tool surface via `tools/list` (#167)
- Frontend: playbooks are click-to-ask (#191)
- Frontend: redesigned landing page with a chat simulation mode (#210)

### Bug Fixes

**Security**

- Stop API key logging/query leaks and stale-key resurrection (#141)
- Remove the build-time API key path from the frontend (#140)
- Restrictive CSP headers; drop `X-XSS-Protection` (#136)
- Default CORS to localhost origins without credentials (#144)
- Derive transport security from `--host` + CORS origins (#145)
- Optional bearer-token auth and a non-loopback bind warning (#197)

**Data & tools**

- Per-user cache directory and atomic streamed downloads (#195)
- Build lookup indices for all domains; unify alias matching (#194)
- Report tool failures as MCP tool errors, not success payloads (#164)
- Serve the stale ATT&CK cache when a refresh download fails (#148)
- Validate startup env config; drop the custom signal handler (#190)

**Frontend**

- Replace regex HTML injection with `react-markdown` (#135)
- Remove `vite-plugin-node-polyfills` (#134)
- `npm audit fix` — clear all high-severity vulnerabilities (#131)
- Truthful MCP status dot; unblock input on clear (#143)
- Normalise LLM content; add an error boundary (#142)
- Pass `versionNegotiation` to the `Client` constructor (#180)
- Resolve agent-loop defects; bound LLM-bound payloads (#189)
- StrictMode-safe `ChatBox` init effect (#188)
- Settings reset/validation, inline guards, dialog accessibility (#192)
- Probe the LLM provider before ready; truthful setup failures (#199)

**Clients & transport**

- Port both sample clients to the official MCP SDKs (#168)
- Recover from an expired MCP session on HTTP 404 (#147)
- Expose `Mcp-Session-Id` via CORS; tolerate stateless servers (#146)

### Refactoring

- Split the monolithic `mitre_mcp_server` into focused modules (`data`, `models`, `server`, `tools`, `cli`, `http`, `config`, `validators`) (#186)
- Consolidate startup argv parsing and banner (#182); dead-code cleanup pass (#183)
- Build the HTTP ASGI app explicitly; drop the CORS monkey-patch (#160)
- Consolidate packaging on the PEP 621 table (#139)
- Pack `get_techniques` params into `GetTechniquesOptions` (#196)
- Frontend: split `ServerConfig` and `langGraphAgent` (#187); shared MCP client + memoised chat messages (#201); split the chat bundle and lazy-load provider SDKs (#198); typed agent errors with Retry (#205); chat reachable from the navbar and usable on small screens (#206); proportionate tool approval for read-only lookups (#202); real status/feedback semantics (#207); named model setup in Getting Started (#200)

### Documentation

- Rewrite API-INTEGRATION.md around the official SDK clients (#170)
- Record the token migration out of the working tree (#185)
- Migration spikes: node-fetch removal (#178), pytest 7→9 breaking changes (#171)

### Dependencies

- `mitreattack-python` 4 → 5 → 6 (#157, #158)
- Drop the `requests` runtime dependency in favour of `httpx` with an explicit timeout (#137)
- Python client: drop the unused `mcp` requirement (#138); frontend: remove the unused `langchain` dependency (#132)
- commander 11 → 15 (#179), eslint 9 → 10 (#176), @vitejs/plugin-react 5 → 6 (#175), vite 7 → 8 (#174), globals 16 → 17 (#177)
- pytest 7 → 9 (#171), pytest-asyncio 0.x → 1 (#172), pytest-cov 4 → 7 (#173)
- `server.json` schema bumped to 2025-12-11 (#169)

### CI & Testing

- Switch PyPI publishing to OIDC Trusted Publishing (#149)
- Deploy the frontend to GitHub Pages (#208)
- Pin workflow SHAs, slim the PR matrix, harden the lint toolchain (#184)
- Vitest runner + first JavaScript tests (#181); start-up characterisation tests (#159); concurrency contracts for lifespan-once and worker threads (#162); Python coverage raised to the M3 target (#203)

**Full Changelog**: https://github.com/Montimage/mitre-mcp/compare/v0.3.2...v0.4.0
