/**
 * Smoke test for the Node.js sample client (clients/nodejs/mini-mcp-client.js).
 *
 * Offline checks — no mitre-mcp server required: the module must load, export
 * the client class, and construct/derive state correctly. Run with
 * `node --test` via `npm test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const CLIENT = path.join(__dirname, '..', 'mini-mcp-client.js');
const { MitreMCPClient } = require(CLIENT);

test('exports the MitreMCPClient class', () => {
  assert.equal(typeof MitreMCPClient, 'function');
});

test('constructor derives the /mcp URL from host and port', () => {
  const client = new MitreMCPClient('localhost', 8000);
  assert.equal(client.baseUrl, 'http://localhost:8000/mcp');
  assert.equal(client.port, 8000);
  assert.equal(client.client, null);
});

test('isSessionExpiredError recognizes the 404/session-terminated shapes', () => {
  const client = new MitreMCPClient();
  assert.equal(client.isSessionExpiredError({ status: 404 }), true);
  assert.equal(client.isSessionExpiredError({ code: 404 }), true);
  assert.equal(client.isSessionExpiredError(new Error('Session terminated')), true);
  assert.equal(client.isSessionExpiredError({ status: 500 }), false);
  assert.equal(client.isSessionExpiredError(null), false);
});

test('formatOutput pretty-prints or compacts JSON', () => {
  const client = new MitreMCPClient();
  const payload = { result: { isError: false } };
  assert.equal(client.formatOutput(payload, false), '{"result":{"isError":false}}');
  assert.ok(client.formatOutput(payload, true).includes('\n'));
});

test('--help prints usage and exits 0 without a server', () => {
  const out = execFileSync(process.execPath, [CLIENT, '--help'], { encoding: 'utf8' });
  assert.match(out, /techniques/);
  assert.match(out, /tactics/);
});
