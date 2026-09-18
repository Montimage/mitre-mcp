/**
 * Tests for the browser agent loop (frontend/src/services/langGraphAgent.js).
 *
 * The MCP client wrapper is mocked — these tests exercise the agent itself:
 * lazy tool discovery, the query → tool-call → response loop, the tool
 * approval callback, and content normalisation (F-BUG-007 regression).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LangGraphAgent, { LLM_PROVIDERS } from './langGraphAgent.js';

// Hoisted fakes shared with the mocked MitreMCPClient below.
const mcp = vi.hoisted(() => ({
  listTools: vi.fn(),
  callTool: vi.fn(),
  testConnection: vi.fn(),
  resetSession: vi.fn(),
  getStatus: vi.fn(() => ({ connected: true, sessionId: 's-1', baseUrl: '/mcp', requestCount: 0 })),
}));

vi.mock('./mcpClient.js', () => ({
  default: class {
    constructor(host, port) {
      this.host = host;
      this.port = port;
    }
    listTools(...args) { return mcp.listTools(...args); }
    callTool(...args) { return mcp.callTool(...args); }
    testConnection(...args) { return mcp.testConnection(...args); }
    resetSession(...args) { return mcp.resetSession(...args); }
    getStatus(...args) { return mcp.getStatus(...args); }
  },
}));

const makeAgent = (config = {}) => new LangGraphAgent('localhost', 8000, { llmProvider: LLM_PROVIDERS.OLLAMA, ...config });

/**
 * Skip lazy tool discovery and inject a fake LLM + tool surface.
 * `toolsReady` resolves TRUE so ensureTools() reuses it forever — a resolved
 * `false` is cleared and the next ensureTools() would re-run real discovery.
 */
const stubReadyAgent = (agent, { invoke, tools = [] } = {}) => {
  agent.toolsReady = Promise.resolve(true);
  agent.tools = tools;
  agent.llmWithTools = { invoke: invoke ?? vi.fn() };
  return agent;
};

describe('LangGraphAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mcp.listTools.mockResolvedValue({ tools: [] });
    mcp.callTool.mockResolvedValue({ result: { content: [{ type: 'text', text: '{}' }] } });
    mcp.testConnection.mockResolvedValue(true);
  });

  describe('construction and provider config', () => {
    it('defaults to the Ollama provider', () => {
      const agent = makeAgent();
      expect(agent.llmProvider).toBe('ollama');
      expect(agent.ollamaConfig.model).toBe('llama3.1:8b');
      expect(agent.getStatus().llmProvider).toBe('ollama');
    });

    it('requires an API key for Gemini', () => {
      expect(() => makeAgent({ llmProvider: LLM_PROVIDERS.GEMINI })).toThrow('Gemini API key is required');
    });

    it('requires an API key for OpenRouter', () => {
      expect(() => makeAgent({ llmProvider: LLM_PROVIDERS.OPENROUTER })).toThrow('OpenRouter API key is required');
    });
  });

  describe('tool discovery (ensureTools / createMCPTools)', () => {
    it('discovers tools lazily from tools/list and binds them', async () => {
      mcp.listTools.mockResolvedValue({
        tools: [{ name: 'get_tactics', description: 'List tactics', inputSchema: { type: 'object', properties: {} } }],
      });
      const agent = makeAgent();
      agent.llm.bindTools = vi.fn().mockReturnValue('bound-llm');

      await agent.ensureTools();

      expect(mcp.listTools).toHaveBeenCalledTimes(1);
      expect(agent.tools).toHaveLength(1);
      expect(agent.llm.bindTools).toHaveBeenCalledWith(agent.tools);
      expect(agent.llmWithTools).toBe('bound-llm');
      expect(agent.getStatus().toolsDiscovered).toBe(true);
    });

    it('keeps the bare LLM when discovery finds no tools', async () => {
      mcp.listTools.mockResolvedValue({ tools: [] });
      const agent = makeAgent();
      agent.llm.bindTools = vi.fn();

      await agent.ensureTools();

      expect(agent.llm.bindTools).not.toHaveBeenCalled();
      expect(agent.llmWithTools).toBe(agent.llm);
    });

    it('recovers on the next call after a discovery failure', async () => {
      mcp.listTools.mockRejectedValueOnce(new Error('server down'));
      const agent = makeAgent();

      await agent.ensureTools();
      expect(agent.tools).toEqual([]);

      mcp.listTools.mockResolvedValue({ tools: [{ name: 'get_tactics', inputSchema: { type: 'object' } }] });
      await agent.ensureTools();
      expect(agent.tools).toHaveLength(1);
      expect(mcp.listTools).toHaveBeenCalledTimes(2);
    });
  });

  describe('mcpToolToLangChain / formatToolResult', () => {
    it('wraps callTool results via formatToolResult', async () => {
      mcp.callTool.mockResolvedValue({
        result: { content: [{ type: 'text', text: '{"tactics":[]}' }] },
      });
      const agent = makeAgent();
      const wrapped = agent.mcpToolToLangChain({ name: 'get_tactics', description: 'List', inputSchema: { type: 'object' } });

      const out = await wrapped.invoke({});
      expect(mcp.callTool).toHaveBeenCalledWith('get_tactics', {});
      expect(JSON.parse(out)).toEqual({ tactics: [] });
    });

    it('throws on an MCP isError result instead of returning it as data', async () => {
      mcp.callTool.mockResolvedValue({
        result: { isError: true, content: [{ type: 'text', text: 'bad arguments' }] },
      });
      const agent = makeAgent();
      const wrapped = agent.mcpToolToLangChain({ name: 'get_tactics', inputSchema: { type: 'object' } });

      await expect(wrapped.invoke({})).rejects.toThrow('bad arguments');
    });

    it('formatToolResult passes through non-JSON text unchanged', () => {
      const agent = makeAgent();
      expect(agent.formatToolResult({ result: { content: [{ text: 'plain text' }] } })).toBe('plain text');
      expect(JSON.parse(agent.formatToolResult({ result: { content: [{ text: '{"a":1}' }] } }))).toEqual({ a: 1 });
    });
  });

  describe('executeTools', () => {
    it('returns an error payload for an unknown tool name', async () => {
      const agent = stubReadyAgent(makeAgent());
      const [result] = await agent.executeTools([{ id: 'c1', name: 'nonexistent', args: {} }]);
      expect(result.role).toBe('tool');
      expect(JSON.parse(result.content).error).toMatch(/not found/);
    });

    it('invokes the matching tool and wraps the result as a tool message', async () => {
      const fakeTool = { name: 'get_tactics', invoke: vi.fn().mockResolvedValue('{"ok":true}') };
      const agent = stubReadyAgent(makeAgent(), { tools: [fakeTool] });

      const [result] = await agent.executeTools([{ id: 'c1', name: 'get_tactics', args: { domain: 'e' } }]);
      expect(fakeTool.invoke).toHaveBeenCalledWith({ domain: 'e' });
      expect(result).toMatchObject({ tool_call_id: 'c1', role: 'tool', name: 'get_tactics', content: '{"ok":true}' });
    });
  });

  describe('processQuery — the agent loop', () => {
    it('returns the normalised final response and records history', async () => {
      const agent = stubReadyAgent(makeAgent(), { invoke: vi.fn().mockResolvedValue({ content: 'The answer.' }) });
      const invoke = agent.llmWithTools.invoke;

      const response = await agent.processQuery('What are tactics?');

      expect(response).toBe('The answer.');
      expect(invoke).toHaveBeenCalledTimes(1);
      const history = agent.getHistory();
      expect(history[0]).toMatchObject({ role: 'user', content: 'What are tactics?' });
      expect(history.at(-1)).toMatchObject({ role: 'assistant', content: 'The answer.' });
    });

    it('F-BUG-007 regression: array content blocks are flattened to a string', async () => {
      const agent = makeAgent();
      stubReadyAgent(agent, {
        invoke: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'First. ' }, { type: 'text', text: 'Second.' }],
        }),
      });

      const response = await agent.processQuery('multi-part response?');
      expect(response).toBe('First. Second.');
      expect(typeof response).toBe('string');
      expect(agent.getHistory().at(-1).content).toBe('First. Second.');
    });

    it('F-BUG-007 regression: null content normalises to an empty string', async () => {
      const agent = makeAgent();
      stubReadyAgent(agent, { invoke: vi.fn().mockResolvedValue({ content: null }) });
      await expect(agent.processQuery('q')).resolves.toBe('');
    });

    it('executes requested tool calls then answers', async () => {
      const fakeTool = { name: 'get_tactics', invoke: vi.fn().mockResolvedValue('{"tactics":14}') };
      const agent = makeAgent();
      stubReadyAgent(agent, { tools: [fakeTool] });
      agent.llmWithTools.invoke
        .mockResolvedValueOnce({ content: '', tool_calls: [{ id: 'c1', name: 'get_tactics', args: {} }] })
        .mockResolvedValueOnce({ content: 'There are 14 tactics.' });

      const response = await agent.processQuery('list tactics');

      expect(fakeTool.invoke).toHaveBeenCalledTimes(1);
      expect(response).toBe('There are 14 tactics.');
      expect(agent.llmWithTools.invoke).toHaveBeenCalledTimes(2);
    });

    it('stops after a denied tool-approval request', async () => {
      const fakeTool = { name: 'get_tactics', invoke: vi.fn() };
      const agent = makeAgent();
      stubReadyAgent(agent, { tools: [fakeTool] });
      agent.llmWithTools.invoke.mockResolvedValue({
        content: '', tool_calls: [{ id: 'c1', name: 'get_tactics', args: {} }],
      });

      const onToolCallRequest = vi.fn().mockResolvedValue(false);
      const response = await agent.processQuery('list tactics', onToolCallRequest);

      expect(onToolCallRequest).toHaveBeenCalledWith([{ id: 'c1', name: 'get_tactics', args: {} }]);
      expect(fakeTool.invoke).not.toHaveBeenCalled();
      expect(response).toBe('Tool execution was cancelled by user.');
    });

    it('runs the tool when approval is granted', async () => {
      const fakeTool = { name: 'get_tactics', invoke: vi.fn().mockResolvedValue('{"ok":1}') };
      const agent = makeAgent();
      stubReadyAgent(agent, { tools: [fakeTool] });
      agent.llmWithTools.invoke
        .mockResolvedValueOnce({ content: '', tool_calls: [{ id: 'c1', name: 'get_tactics', args: {} }] })
        .mockResolvedValueOnce({ content: 'done' });

      const response = await agent.processQuery('go', vi.fn().mockResolvedValue(true));
      expect(fakeTool.invoke).toHaveBeenCalledTimes(1);
      expect(response).toBe('done');
    });

    it('returns the max-iterations fallback after 5 tool-calling rounds', async () => {
      const fakeTool = { name: 'get_tactics', invoke: vi.fn().mockResolvedValue('{}') };
      const agent = makeAgent();
      stubReadyAgent(agent, { tools: [fakeTool] });
      agent.llmWithTools.invoke.mockResolvedValue({
        content: '', tool_calls: [{ id: 'c1', name: 'get_tactics', args: {} }],
      });

      const response = await agent.processQuery('loop forever');
      expect(agent.llmWithTools.invoke).toHaveBeenCalledTimes(5);
      expect(response).toMatch(/maximum number of iterations/);
    });

    it('converts an LLM failure into a provider-hinted error message', async () => {
      const agent = makeAgent();
      stubReadyAgent(agent, { invoke: vi.fn().mockRejectedValue(new Error('connection refused')) });

      const response = await agent.processQuery('boom');
      expect(response).toMatch(/I encountered an error/);
      expect(response).toMatch(/Ollama is running locally/);
      expect(agent.getHistory().at(-1).role).toBe('error');
    });
  });

  describe('history and status', () => {
    it('clearHistory empties the conversation', async () => {
      const agent = makeAgent();
      stubReadyAgent(agent, { invoke: vi.fn().mockResolvedValue({ content: 'ok' }) });
      await agent.processQuery('q');
      expect(agent.getHistory().length).toBeGreaterThan(0);
      agent.clearHistory();
      expect(agent.getHistory()).toEqual([]);
    });

    it('testConnection delegates to the MCP client', async () => {
      mcp.testConnection.mockResolvedValue(false);
      const agent = makeAgent();
      await expect(agent.testConnection()).resolves.toBe(false);
    });
  });
});
