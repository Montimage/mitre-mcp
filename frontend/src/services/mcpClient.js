/**
 * MCP HTTP Client for mitre-mcp Server
 *
 * Handles communication with mitre-mcp server via HTTP/JSON-RPC protocol.
 * Implements session management, SSE parsing, and tool calling.
 *
 * Critical Protocol Requirements:
 * 1. Accept header must include: "application/json, text/event-stream"
 * 2. Initialize session before tool calls
 * 3. Handle Server-Sent Events (SSE) response format
 */
export default class MitreMCPClient {
  /**
   * Create a new MCP client instance
   *
   * @param {string} host - Server hostname (default: 'localhost')
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
    } else {
      this.baseUrl = `http://${host}:${portNum}/mcp`;
      console.log(`[MCP Client] Using direct URL: ${this.baseUrl}`);
    }
    this.sessionId = null;
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
   * This must be called before any tool calls. The session ID is extracted
   * from the response headers and used for all subsequent requests.
   *
   * @returns {Promise<void>}
   * @throws {Error} If session initialization fails
   */
  async initializeSession() {
    this.requestId++;

    const initPayload = {
      jsonrpc: '2.0',
      id: this.requestId,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'mitre-mcp-web-client',
          version: '1.0.0'
        }
      }
    };

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream' // Both MIME types required!
    };

    this.log('Initializing session...', initPayload);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(initPayload)
      });

      if (!response.ok) {
        throw new Error(`Session initialization failed: ${response.status} ${response.statusText}`);
      }

      // Extract session ID from response headers
      this.sessionId = response.headers.get('mcp-session-id');

      if (!this.sessionId) {
        throw new Error('Server did not return a session ID');
      }

      this.log('Session initialized', { sessionId: this.sessionId });

      return true;
    } catch (error) {
      this.log('Session initialization error', error);
      throw new Error(`Failed to initialize session: ${error.message}`);
    }
  }

  /**
   * Parse Server-Sent Events (SSE) response format
   *
   * SSE format example:
   *   event: message
   *   data: {"jsonrpc":"2.0","id":1,"result":{...}}
   *
   * @param {string} sseText - Raw SSE response text
   * @returns {Object} Parsed JSON object
   * @throws {Error} If parsing fails
   */
  parseSSEResponse(sseText) {
    try {
      const lines = sseText.trim().split('\n');
      const dataLines = [];

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          dataLines.push(line.substring(6)); // Skip "data: " prefix
        }
      }

      const jsonData = dataLines.join('');

      if (!jsonData) {
        throw new Error('No data found in SSE response');
      }

      this.log('Parsed SSE data', jsonData.substring(0, 200));

      return JSON.parse(jsonData);
    } catch (error) {
      this.log('SSE parsing error', error);
      throw new Error(`Failed to parse SSE response: ${error.message}`);
    }
  }

  /**
   * Call an MCP tool via HTTP/JSON-RPC
   *
   * Automatically initializes session if not already done.
   *
   * @param {string} toolName - Name of the MCP tool to call
   * @param {Object} args - Tool arguments
   * @returns {Promise<Object>} Tool call result
   * @throws {Error} If tool call fails
   */
  async callTool(toolName, args = {}) {
    // Initialize session if not already done
    if (!this.sessionId) {
      await this.initializeSession();
    }

    this.requestId++;

    const payload = {
      jsonrpc: '2.0',
      id: this.requestId,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream', // Both MIME types required!
      'mcp-session-id': this.sessionId
    };

    this.log(`Calling tool: ${toolName}`, args);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP Error ${response.status}: ${errorText}`);
      }

      const text = await response.text();

      // Check if response is SSE format (text/event-stream)
      const contentType = response.headers.get('content-type') || '';
      let result;

      if (contentType.includes('text/event-stream')) {
        result = this.parseSSEResponse(text);
      } else {
        result = JSON.parse(text);
      }

      // Check for JSON-RPC errors
      if (result.error) {
        const error = result.error;
        throw new Error(`JSON-RPC Error ${error.code}: ${error.message}`);
      }

      this.log(`Tool call result:`, result);

      return result;
    } catch (error) {
      this.log('Tool call error', error);
      throw new Error(`Failed to call tool ${toolName}: ${error.message}`);
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
    } catch (error) {
      return false;
    }
  }

  /**
   * Reset the client session
   *
   * Call this to force a new session on the next request
   */
  resetSession() {
    this.sessionId = null;
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
      connected: !!this.sessionId,
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
