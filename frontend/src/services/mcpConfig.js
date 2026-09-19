/**
 * Resolution of the configured MCP server address.
 *
 * The chat persists its server config in localStorage under
 * 'mcp-server-config'; the build-time VITE_MCP_DEFAULT_* env vars provide
 * the first-run defaults. Non-chat components (e.g. the landing Playbooks
 * tip) resolve the same address through this module instead of hard-coding
 * one, so the displayed address always matches what the chat will call.
 */

// Build-time defaults — overridable at runtime via the settings dialog
// (persisted to localStorage), so these only apply to a first run or after
// the saved config is cleared.
export const DEFAULT_MCP_HOST = import.meta.env.VITE_MCP_DEFAULT_HOST || 'localhost';
export const DEFAULT_MCP_PORT = Number(import.meta.env.VITE_MCP_DEFAULT_PORT) || 8000;

export const MCP_CONFIG_STORAGE_KEY = 'mcp-server-config';

/**
 * True when *host* (a hostname, or a full URL) names the loopback interface.
 * Used to keep local MCP/LLM endpoints on http:// — mitre-mcp has no TLS, and
 * browsers exempt localhost from mixed-content blocking.
 */
export const isLoopbackHost = (host) => {
  let h = String(host ?? '').trim().toLowerCase();
  if (!h) return false;
  if (/^https?:\/\//i.test(h)) {
    try {
      h = new URL(h).hostname;
    } catch {
      return false;
    }
  }
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
};

/**
 * True when this page is served from a non-loopback origin (GitHub Pages,
 * Netlify, …). Those origins cannot fetch localhost: Chrome treats it as
 * private-network / loopback address space and, on HTTPS pages, a
 * scheme-relative URL would incorrectly upgrade the local server to HTTPS.
 */
export const pageCannotReachLoopback = () => {
  if (typeof window === 'undefined') return false;
  return !isLoopbackHost(window.location.hostname);
};

/**
 * Load the saved MCP server config merged over the build defaults.
 *
 * @returns {{ host: string, port: number }} Never throws — a corrupt saved
 *   config falls back to the defaults.
 */
export const getMcpServerConfig = () => {
  const config = { host: DEFAULT_MCP_HOST, port: DEFAULT_MCP_PORT };
  try {
    const saved = localStorage.getItem(MCP_CONFIG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.host) config.host = parsed.host;
      if (parsed.port) config.port = parsed.port;
    }
  } catch {
    // Corrupt saved config — keep the build defaults.
  }
  return config;
};

/**
 * The configured server address for display (e.g. 'localhost:8000' or a
 * full URL when the settings dialog stored one).
 *
 * @returns {string}
 */
export const getMcpServerAddress = () => {
  const { host, port } = getMcpServerConfig();
  // A host saved as a full URL (https://…) is shown verbatim — appending a
  // port would misrepresent the endpoint.
  if (/^https?:\/\//i.test(host)) {
    return host;
  }
  return `${host}:${port}`;
};

/**
 * Build the MCP endpoint URL the client will call, from a host/port pair.
 *
 * A host already carrying a scheme (https://…/mcp) is used verbatim — the
 * settings dialog accepts full URLs. Otherwise the URL is assembled with
 * `new URL` so invalid components throw instead of silently producing a
 * malformed endpoint; the caller falls back to the raw interpolation for
 * preview purposes only, and save-time validation rejects such input anyway.
 *
 * @param {string} host - Hostname or full URL
 * @param {number|string} port - TCP port
 * @returns {string|null} The endpoint URL, or null when it cannot be built
 */
export const buildMcpServerUrl = (host, port) => {
  const h = String(host ?? '').trim();
  if (!h) return null;
  if (/^https?:\/\//i.test(h)) return h;
  try {
    // Loopback has no TLS in this project and is mixed-content-exempt, so
    // pin http://. Other hosts stay scheme-relative so an HTTPS-served UI
    // is not blocked as mixed content (same rule mcpClient applies).
    if (isLoopbackHost(h)) {
      return new URL(`http://${h}:${port}/mcp`).href;
    }
    return new URL(`//${h}:${port}/mcp`, window.location.origin).href;
  } catch {
    return null;
  }
};
