/**
 * MCP HTTP Client for mitre-mcp Server
 *
 * Wraps the official @modelcontextprotocol/client SDK's Client and
 * StreamableHTTPClientTransport (see docs/migrations/ts-mcp-client-choice.md).
 * The SDK handles protocol-version negotiation, SSE framing, the required
 * Accept header, and session-id propagation; this class preserves the
 * public interface the UI was built against, including the single
 * expired-session retry added for server session loss.
 */
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

export default class MitreMCPClient {
  /**
   * Create a new MCP client instance
   *
   * @param {string} host - Server hostname (default: 'localhost') or a full
   *   URL including scheme (e.g. 'https://mcp.example.com/mcp')
   * @param {number} port - Server port (default: 8000)
   */
  constructor(host = 'localhost', port = 8000) {
    // Use relative URL in development to go through Vite proxy (avoids CORS)
    // In production, you can set VITE_MCP_URL environment variable
    const portNum = typeof port === 'string' ? parseInt(port) : port;
    const isDefaultConfig = host === 'localhost' && portNum === 8000;

    if (import.meta.env.DEV && isDefaultConfig) {
      this.baseUrl = '/mcp';
      console.log('[MCP Client] Using proxy URL: /mcp');
    } else if (/^https?:\/\//i.test(host)) {
      // Full URL supplied in settings — use verbatim so HTTPS endpoints work
      this.baseUrl = host;
      console.log(`[MCP Client] Using configured URL: ${this.baseUrl}`);
    } else {
      // Scheme-relative URL inherits the page's scheme: an HTTPS-served UI
      // reaches the backend over HTTPS instead of being blocked as mixed
      // content; an HTTP dev UI keeps the previous http behaviour.
      this.baseUrl = new URL(`//${host}:${portNum}/mcp`, window.location.origin).href;
      console.log(`[MCP Client] Using direct URL: ${this.baseUrl}`);
    }
    this.client = null;
    this.sessionId = null;
    this.sessionInitialized = false;
    this.requestId = 0;
    this.debug = true; // Enable debug by default in dev mode
  }

  /**
   * Enable debug logging
   *
   * @param {boolean} enabled - Enable or disable debug mode
   */
  setDebug(enabled) {
    this.debug = enabled;
  }

  /**
   * Log debug message if debug mode is enabled
   *
   * @param {string} message - Debug message
   * @param {*} data - Optional data to log
   */
  log(message, data = null) {
    if (this.debug) {
      console.log(`[MCP Client] ${message}`, data || '');
    }
  }

  /**
   * Initialize an MCP session with the server
   *
   * This must be called before any tool calls. The SDK transport performs
   * protocol-version negotiation and captures the session-id response
   * header automatically.
   *
   * @returns {Promise<boolean>} True on success
   * @throws {Error} If session initialization fails
   */
  async initializeSession() {
    this.requestId++;
    this.log('Initializing session...');

    try {
      const transport = new StreamableHTTPClientTransport(
        new URL(this.baseUrl, window.location.origin)
      );
      const client = new Client({ name: 'mitre-mcp-web-client', version: '1.0.0' });
      // 'auto' probes server/discover for the modern era and falls back to
      // the legacy initialize handshake when the server only speaks 2025-era
      await client.connect(transport, { mode: 'auto' });

      this.client = client;
      // Absent when the server runs stateless — transport handles both cases
      this.sessionId = transport.sessionId ?? null;
      this.sessionInitialized = true;

      this.log('Session initialized', { sessionId: this.sessionId || '(stateless)' });
      return true;
    } catch (error) {
      this.log('Session initialization error', error);
      throw new Error(`Failed to initialize session: ${error.message}`, { cause: error });
    }
  }

  /**
   * Whether an SDK error reports an expired/unknown session (HTTP 404)
   *
   * @param {*} error - Error thrown by the SDK transport
   * @returns {boolean}
   */
  isSessionExpiredError(error) {
    return error?.status === 404 || error?.code === 404;
  }

  /**
   * List the tools the server advertises (MCP tools/list)
   *
   * Automatically initializes session if not already done and applies the
   * same single expired-session retry as callTool. The SDK aggregates
   * paginated results and caches the list for callTool's output-schema
   * validation.
   *
   * @param {boolean} isRetry - Internal flag; true when this call is the
   *   single retry after an expired-session 404
   * @returns {Promise<Object>} ListToolsResult ({ tools: [...] })
   * @throws {Error} If the list request fails
   */
  async listTools(isRetry = false) {
    if (!this.sessionInitialized) {
      await this.initializeSession();
    }

    this.requestId++;
    this.log('Listing tools (tools/list)...');

    try {
      const result = await this.client.listTools();
      this.log(`tools/list returned ${result.tools?.length ?? 0} tool(s)`);
      return result;
    } catch (error) {
      // HTTP 404 means the server forgot our session — clear it,
      // re-initialise, and retry exactly once
      if (!isRetry && this.isSessionExpiredError(error)) {
        this.log('Session expired (404), re-initialising and retrying once');
        this.resetSession();
        await this.initializeSession();
        return this.listTools(true);
      }
      this.log('tools/list error', error);
      throw new Error(`Failed to list tools: ${error.message}`, { cause: error });
    }
  }

  /**
   * Call an MCP tool
   *
   * Automatically initializes session if not already done. Returns the same
   * envelope shape the previous hand-rolled transport produced
   * ({ result: <CallToolResult> }) so existing callers are unchanged.
   *
   * @param {string} toolName - Name of the MCP tool to call
   * @param {Object} args - Tool arguments
   * @param {boolean} isRetry - Internal flag; true when this call is the
   *   single retry after an expired-session 404
   * @returns {Promise<Object>} Tool call result
   * @throws {Error} If tool call fails
   */
  async callTool(toolName, args = {}, isRetry = false) {
    // Initialize session if not already done
    if (!this.sessionInitialized) {
      await this.initializeSession();
    }

    this.requestId++;
    this.log(`Calling tool: ${toolName}`, args);

    try {
      const result = await this.client.callTool({ name: toolName, arguments: args });
      this.log(`Tool call result:`, result);
      return { result };
    } catch (error) {
      // HTTP 404 means the server forgot our session — clear it,
      // re-initialise, and retry exactly once
      if (!isRetry && this.isSessionExpiredError(error)) {
        this.log('Session expired (404), re-initialising and retrying once');
        this.resetSession();
        await this.initializeSession();
        return this.callTool(toolName, args, true);
      }
      this.log('Tool call error', error);
      throw new Error(`Failed to call tool ${toolName}: ${error.message}`, { cause: error });
    }
  }

  /**
   * Test connection to the MCP server
   *
   * @returns {Promise<boolean>} True if connection successful
   */
  async testConnection() {
    try {
      await this.initializeSession();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reset the client session
   *
   * Call this to force a new session on the next request
   */
  resetSession() {
    // Terminate the old session server-side if one exists; fire-and-forget
    // since this method stays synchronous for existing callers
    this.client?.close().catch(() => {});
    this.client = null;
    this.sessionId = null;
    this.sessionInitialized = false;
    this.requestId = 0;
    this.log('Session reset');
  }

  /**
   * Get current session status
   *
   * @returns {Object} Session status information
   */
  getStatus() {
    return {
      connected: this.sessionInitialized,
      sessionId: this.sessionId,
      baseUrl: this.baseUrl,
      requestCount: this.requestId
    };
  }
}

/**
 * Available MCP Tools
 *
 * Reference for all available tools on the mitre-mcp server
 */
export const MCP_TOOLS = {
  GET_TACTICS: 'get_tactics',
  GET_TECHNIQUES: 'get_techniques',
  GET_TECHNIQUE_BY_ID: 'get_technique_by_id',
  GET_TECHNIQUES_BY_TACTIC: 'get_techniques_by_tactic',
  GET_GROUPS: 'get_groups',
  GET_TECHNIQUES_USED_BY_GROUP: 'get_techniques_used_by_group',
  GET_SOFTWARE: 'get_software',
  GET_MITIGATIONS: 'get_mitigations',
  GET_TECHNIQUES_MITIGATED_BY_MITIGATION: 'get_techniques_mitigated_by_mitigation'
};
