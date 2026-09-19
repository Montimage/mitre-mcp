/**
 * Tests for frontend/src/services/llmProbes.js — the "test connection" probes.
 *
 * `fetch` is stubbed and the MCP client module is mocked so no real network
 * happens; each probe is asserted to resolve a `{ type, message }` object.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { probeMcpServer, probeOllama, probeGemini, probeOpenRouter, probeLlmProvider } from './llmProbes.js';
import { releaseMcpClient } from './mcpClientCache.js';

const mcp = vi.hoisted(() => ({ ctor: vi.fn(), testConnection: vi.fn(), resetSession: vi.fn() }));

vi.mock('./mcpClient.js', () => ({
  default: class {
    constructor(...args) { mcp.ctor(...args); }
    testConnection(...args) { return mcp.testConnection(...args); }
    resetSession(...args) { return mcp.resetSession(...args); }
  },
}));

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
});

describe('llmProbes', () => {
  beforeEach(() => {
    // Probes share the per-config client cache (F-PERF-009) — evict any
    // leftover first so its close does not count toward this test's mocks.
    releaseMcpClient();
    vi.clearAllMocks();
    mcp.testConnection.mockResolvedValue(true);
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('probeMcpServer', () => {
    it('reports success when the client connects', async () => {
      const result = await probeMcpServer({ host: 'localhost', port: 8000 });
      expect(result.type).toBe('success');
    });

    it('reports error when the client cannot connect', async () => {
      mcp.testConnection.mockResolvedValue(false);
      const result = await probeMcpServer({ host: 'localhost', port: 8000 });
      expect(result.type).toBe('error');
    });

    it('F-PERF-009: reuses one client for an unchanged config and closes it on change', async () => {
      await probeMcpServer({ host: 'localhost', port: 8000 });
      await probeMcpServer({ host: 'localhost', port: '8000' }); // same key, string port
      expect(mcp.ctor).toHaveBeenCalledTimes(1);

      // A different server evicts and closes the previous client.
      await probeMcpServer({ host: 'other-host', port: 8000 });
      expect(mcp.ctor).toHaveBeenCalledTimes(2);
      expect(mcp.resetSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('probeOllama', () => {
    it('reports success when the configured model is present', async () => {
      fetch.mockResolvedValue(jsonResponse({ models: [{ name: 'llama3.1:8b' }] }));
      const result = await probeOllama({ ollamaBaseUrl: 'http://localhost:11434', ollamaModel: 'llama3.1:8b' });
      expect(result.type).toBe('success');
    });

    it('reports error listing available models when the model is missing', async () => {
      fetch.mockResolvedValue(jsonResponse({ models: [{ name: 'other:1b' }] }));
      const result = await probeOllama({ ollamaBaseUrl: 'http://localhost:11434', ollamaModel: 'llama3.1:8b' });
      expect(result.type).toBe('error');
      expect(result.message).toContain('not found');
    });

    it('reports error when the server is unreachable', async () => {
      fetch.mockRejectedValue(new Error('connection refused'));
      const result = await probeOllama({ ollamaBaseUrl: 'http://localhost:11434', ollamaModel: 'llama3.1:8b' });
      expect(result.type).toBe('error');
      expect(result.message).toContain('Cannot connect to Ollama');
    });
  });

  describe('probeGemini', () => {
    it('requires an API key before any network call', async () => {
      const result = await probeGemini({ geminiApiKey: '', geminiModel: 'gemini-2.5-flash' });
      expect(result.type).toBe('error');
      expect(result.message).toContain('API key is required');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('reports success when the configured model is present', async () => {
      fetch.mockResolvedValue(jsonResponse({ models: [{ name: 'models/gemini-2.5-flash' }] }));
      const result = await probeGemini({ geminiApiKey: 'key', geminiModel: 'gemini-2.5-flash' });
      expect(result.type).toBe('success');
    });
  });

  describe('probeOpenRouter', () => {
    it('requires an API key before any network call', async () => {
      const result = await probeOpenRouter({ openrouterApiKey: '', openrouterModel: 'anthropic/claude-3.5-sonnet' });
      expect(result.type).toBe('error');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('reports success when the configured model id is present', async () => {
      fetch.mockResolvedValue(jsonResponse({ data: [{ id: 'anthropic/claude-3.5-sonnet' }] }));
      const result = await probeOpenRouter({ openrouterApiKey: 'key', openrouterModel: 'anthropic/claude-3.5-sonnet' });
      expect(result.type).toBe('success');
    });
  });

  describe('probeLlmProvider', () => {
    it('routes to the Ollama probe when no provider is set', async () => {
      fetch.mockResolvedValue(jsonResponse({ models: [{ name: 'llama3.1:8b' }] }));
      const result = await probeLlmProvider({ ollamaBaseUrl: 'http://localhost:11434', ollamaModel: 'llama3.1:8b' });
      expect(result.type).toBe('success');
      expect(fetch).toHaveBeenCalled();
    });

    it('routes to the Gemini probe when gemini is selected', async () => {
      const result = await probeLlmProvider({ llmProvider: 'gemini', geminiApiKey: '', geminiModel: 'gemini-2.5-flash' });
      expect(result.type).toBe('error');
      expect(result.message).toContain('API key is required');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('routes to the OpenRouter probe when openrouter is selected', async () => {
      const result = await probeLlmProvider({ llmProvider: 'openrouter', openrouterApiKey: '', openrouterModel: 'x' });
      expect(result.type).toBe('error');
      expect(result.message).toContain('OpenRouter API key is required');
      expect(fetch).not.toHaveBeenCalled();
    });
  });
});
