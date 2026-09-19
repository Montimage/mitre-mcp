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
