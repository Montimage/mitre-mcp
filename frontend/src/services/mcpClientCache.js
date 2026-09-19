/**
 * Shared MCP client cache
 *
 * F-PERF-009: every agent rebuild, settings save and "test connection" used
 * to construct a fresh `MitreMCPClient` and abandon the previous one — along
 * with any live MCP session it held. This module keeps exactly one client
 * per server configuration so an unchanged `host:port` reuses the same
 * instance (and its session) across agent rebuilds and probes.
 *
 * The cache is keyed on the normalized `host:port` pair — the only inputs
 * the client uses. A different key evicts the previous entry and closes it
 * via `resetSession()`, which terminates the SDK session server-side.
 * `releaseMcpClient()` is the teardown hook for unmount and tests.
 */
import MitreMCPClient from './mcpClient.js';

let cached = null; // { key: string, client: MitreMCPClient }

/**
 * Normalize the cache key the same way the client normalizes its inputs:
 * the port is coerced through parseInt so '8000' and 8000 share one entry.
 *
 * @param {string} host
 * @param {number|string} port
 * @returns {string}
 */
const keyFor = (host, port) => {
  const portNum = parseInt(port, 10);
  return `${host}::${Number.isNaN(portNum) ? port : portNum}`;
};

/**
 * Return the shared client for this server configuration.
 *
 * An unchanged `host:port` returns the same instance; a changed one closes
 * the previous client and constructs a replacement. Construction is lazy —
 * the client does not open a session until first use, so a discarded entry
 * never leaves a dangling server session.
 *
 * @param {string} host
 * @param {number|string} port
 * @returns {MitreMCPClient}
 */
export const getMcpClient = (host, port) => {
  const key = keyFor(host, port);
  if (cached && cached.key === key) {
    return cached.client;
  }
  releaseMcpClient();
  const client = new MitreMCPClient(host, port);
  cached = { key, client };
  return client;
};

/**
 * Close and drop the cached client (config-change eviction, component
 * teardown, test isolation). `resetSession()` terminates the SDK session
 * when one exists; the call is a no-op on an empty cache.
 */
export const releaseMcpClient = () => {
  if (!cached) return;
  try {
    cached.client.resetSession();
  } catch {
    // A client without resetSession (partial mock) still gets evicted.
  }
  cached = null;
};
