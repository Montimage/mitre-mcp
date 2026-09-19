/**
 * Tests for the MCP client wrapper (frontend/src/services/mcpClient.js).
 *
 * The official @modelcontextprotocol/client SDK is mocked so tests exercise
 * only our wrapper: URL selection, the { result } envelope, and the single
 * expired-session retry.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MitreMCPClient, { MCP_TOOLS } from './mcpClient.js';

// Hoisted spies shared with the mocked SDK classes below.
const sdk = vi.hoisted(() => ({
  connect: vi.fn(),
  listTools: vi.fn(),
  callTool: vi.fn(),
  close: vi.fn(),
  lastClientInfo: null,
  lastClientOptions: null,
  sessionId: 'test-session-id',
}));

vi.mock('@modelcontextprotocol/client', () => ({
  Client: class {
    constructor(info, options) {
      sdk.lastClientInfo = info;
      sdk.lastClientOptions = options;
    }
    connect(transport) { return sdk.connect(transport); }
    listTools() { return sdk.listTools(); }
    callTool(request) { return sdk.callTool(request); }
    close() { return sdk.close(); }
  },
  StreamableHTTPClientTransport: class {
    constructor(url) {
      this.url = url;
      this.sessionId = sdk.sessionId;
    }
  },
}));

describe('MitreMCPClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdk.connect.mockResolvedValue(undefined);
    sdk.listTools.mockResolvedValue({ tools: [{ name: 'get_tactics' }] });
    sdk.callTool.mockResolvedValue({ content: [{ type: 'text', text: '{}' }] });
    sdk.close.mockResolvedValue(undefined);
    sdk.sessionId = 'test-session-id';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('constructor URL selection', () => {
    it('uses the Vite proxy path for the default localhost:8000 in dev', () => {
      vi.stubEnv('DEV', true);
      const client = new MitreMCPClient();
      expect(client.baseUrl).toBe('/mcp');
    });

    it('uses a full http(s) URL verbatim', () => {
      vi.stubEnv('DEV', true);
      const client = new MitreMCPClient('https://mcp.example.com/mcp');
      expect(client.baseUrl).toBe('https://mcp.example.com/mcp');
    });

    it('builds a scheme-relative URL from host and port outside dev defaults', () => {
      vi.stubEnv('DEV', false);
      const client = new MitreMCPClient('mcp.internal', 9000);
      expect(client.baseUrl).toBe('http://mcp.internal:9000/mcp');
    });

    it('treats a string port like a number', () => {
      vi.stubEnv('DEV', true);
      const client = new MitreMCPClient('localhost', '8000');
      expect(client.baseUrl).toBe('/mcp');
    });

    it('uses http for loopback outside dev so an HTTPS page does not rewrite it to TLS', () => {
      vi.stubEnv('DEV', false);
      const client = new MitreMCPClient('localhost', 8000);
      expect(client.baseUrl).toBe('http://localhost:8000/mcp');
    });
  });

  describe('initializeSession', () => {
    it('connects the SDK client and captures the transport session id', async () => {
      const client = new MitreMCPClient('https://mcp.example.com/mcp');
      await expect(client.initializeSession()).resolves.toBe(true);

      expect(sdk.connect).toHaveBeenCalledTimes(1);
      expect(sdk.lastClientInfo).toEqual({ name: 'mitre-mcp-web-client', version: '1.0.0' });
      expect(client.sessionInitialized).toBe(true);
      expect(client.sessionId).toBe('test-session-id');
      expect(client.getStatus()).toMatchObject({ connected: true, sessionId: 'test-session-id' });
    });

    it('records a null sessionId for a stateless server', async () => {
      sdk.sessionId = undefined;
      const client = new MitreMCPClient('https://mcp.example.com/mcp');
      await client.initializeSession();
      expect(client.sessionInitialized).toBe(true);
      expect(client.sessionId).toBeNull();
    });

    it('wraps transport failures in a descriptive error', async () => {
      sdk.connect.mockRejectedValue(new Error('connection refused'));
      const client = new MitreMCPClient('https://mcp.example.com/mcp');
      await expect(client.initializeSession()).rejects.toThrow('Failed to initialize session: connection refused');
      expect(client.sessionInitialized).toBe(false);
    });
  });

  describe('callTool', () => {
    it('initializes the session lazily and returns the { result } envelope', async () => {
      const client = new MitreMCPClient('https://mcp.example.com/mcp');
      const envelope = await client.callTool('get_tactics', { domain: 'enterprise-attack' });

      expect(sdk.connect).toHaveBeenCalledTimes(1);
      expect(sdk.callTool).toHaveBeenCalledWith({ name: 'get_tactics', arguments: { domain: 'enterprise-attack' } });
      expect(envelope).toEqual({ result: { content: [{ type: 'text', text: '{}' }] } });
    });

    it('retries once after an expired-session 404', async () => {
      const client = new MitreMCPClient('https://mcp.example.com/mcp');
      await client.initializeSession();

      sdk.callTool
        .mockRejectedValueOnce(Object.assign(new Error('session terminated'), { status: 404 }))
        .mockResolvedValueOnce({ content: [{ type: 'text', text: '{"ok":true}' }] });

      const envelope = await client.callTool('get_tactics');
      expect(sdk.connect).toHaveBeenCalledTimes(2); // re-initialized once
      expect(sdk.callTool).toHaveBeenCalledTimes(2);
      expect(envelope.result.content[0].text).toBe('{"ok":true}');
    });

    it('does not retry non-404 failures', async () => {
      const client = new MitreMCPClient('https://mcp.example.com/mcp');
      sdk.callTool.mockRejectedValue(new Error('server exploded'));

      await expect(client.callTool('get_tactics')).rejects.toThrow('Failed to call tool get_tactics: server exploded');
      expect(sdk.callTool).toHaveBeenCalledTimes(1);
    });

    it('does not retry a second 404', async () => {
      const client = new MitreMCPClient('https://mcp.example.com/mcp');
      sdk.callTool.mockRejectedValue(Object.assign(new Error('gone'), { status: 404 }));

      await expect(client.callTool('get_tactics')).rejects.toThrow('Failed to call tool get_tactics: gone');
      expect(sdk.callTool).toHaveBeenCalledTimes(2); // initial + single retry
    });
  });

  describe('listTools', () => {
    it('returns the SDK result and initializes lazily', async () => {
      const client = new MitreMCPClient('https://mcp.example.com/mcp');
      const result = await client.listTools();
      expect(result).toEqual({ tools: [{ name: 'get_tactics' }] });
      expect(sdk.connect).toHaveBeenCalledTimes(1);
    });

    it('retries once after an expired-session 404', async () => {
      const client = new MitreMCPClient('https://mcp.example.com/mcp');
      await client.initializeSession();

      sdk.listTools
        .mockRejectedValueOnce(Object.assign(new Error('lost'), { code: 404 }))
        .mockResolvedValueOnce({ tools: [] });

      const result = await client.listTools();
      expect(result).toEqual({ tools: [] });
      expect(sdk.listTools).toHaveBeenCalledTimes(2);
      expect(sdk.connect).toHaveBeenCalledTimes(2);
    });
  });

  describe('isSessionExpiredError', () => {
    const client = new MitreMCPClient('https://mcp.example.com/mcp');

    it('recognizes status and code 404', () => {
      expect(client.isSessionExpiredError({ status: 404 })).toBe(true);
      expect(client.isSessionExpiredError({ code: 404 })).toBe(true);
    });

    it('rejects other errors', () => {
      expect(client.isSessionExpiredError({ status: 500 })).toBe(false);
      expect(client.isSessionExpiredError(new Error('nope'))).toBe(false);
      expect(client.isSessionExpiredError(null)).toBe(false);
    });
  });

  describe('resetSession / testConnection', () => {
    it('resetSession clears state and closes the SDK client', async () => {
      const client = new MitreMCPClient('https://mcp.example.com/mcp');
      await client.initializeSession();
      client.resetSession();

      expect(sdk.close).toHaveBeenCalledTimes(1);
      expect(client.sessionInitialized).toBe(false);
      expect(client.sessionId).toBeNull();
      expect(client.getStatus().connected).toBe(false);
    });

    it('testConnection resolves true on success and false on failure', async () => {
      const client = new MitreMCPClient('https://mcp.example.com/mcp');
      await expect(client.testConnection()).resolves.toBe(true);

      sdk.connect.mockRejectedValueOnce(new Error('down'));
      const failing = new MitreMCPClient('https://mcp.example.com/mcp');
      await expect(failing.testConnection()).resolves.toBe(false);
    });
  });

  describe('debug flag (F-PERF-013)', () => {
    it('defaults debug logging off outside dev mode', () => {
      vi.stubEnv('DEV', false);
      const client = new MitreMCPClient('https://mcp.example.com/mcp');
      expect(client.debug).toBe(false);
    });

    it('enables debug logging in dev mode', () => {
      vi.stubEnv('DEV', true);
      const client = new MitreMCPClient('https://mcp.example.com/mcp');
      expect(client.debug).toBe(true);
    });

    it('setDebug still overrides the env default', () => {
      vi.stubEnv('DEV', false);
      const client = new MitreMCPClient('https://mcp.example.com/mcp');
      client.setDebug(true);
      expect(client.debug).toBe(true);
    });
  });

  describe('MCP_TOOLS', () => {
    it('names the documented mitre-mcp tools', () => {
      expect(MCP_TOOLS.GET_TACTICS).toBe('get_tactics');
      expect(MCP_TOOLS.GET_TECHNIQUE_BY_ID).toBe('get_technique_by_id');
      expect(Object.keys(MCP_TOOLS).length).toBe(9);
    });
  });
});
