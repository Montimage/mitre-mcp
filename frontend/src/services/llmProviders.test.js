/**
 * Tests for frontend/src/services/llmProviders.js — provider-hinted error
 * message and the shared LLM_PROVIDERS constant.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  LLM_PROVIDERS,
  initOllama,
  initGemini,
  initOpenRouter,
  initOpenAiCompatible,
  normalizeOpenAiBaseUrl,
  buildProviderErrorHint,
  buildAgentErrorMessage
} from './llmProviders.js';

// Capture the config object each provider class is constructed with.
const ctors = vi.hoisted(() => ({ ollama: [], genai: [], openai: [] }));

vi.mock('@langchain/ollama', () => ({
  ChatOllama: class { constructor(config) { ctors.ollama.push(config); } }
}));
vi.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: class { constructor(config) { ctors.genai.push(config); } }
}));
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: class { constructor(config) { ctors.openai.push(config); } }
}));

const agent = (overrides = {}) => ({ llmProvider: LLM_PROVIDERS.OLLAMA, ...overrides });
const boom = new Error('connection refused');

describe('llmProviders', () => {
  it('exposes the four provider identifiers', () => {
    expect(LLM_PROVIDERS).toEqual({
      OLLAMA: 'ollama',
      GEMINI: 'gemini',
      OPENROUTER: 'openrouter',
      OPENAI_COMPATIBLE: 'openai-compatible'
    });
  });

  it('hint at Ollama for the default provider', () => {
    const hint = buildProviderErrorHint(agent());
    expect(hint).toContain('Ollama is running locally');
    expect(hint).toContain('llama3.1:8b');
  });

  it('hint at the Gemini model and key for the gemini provider', () => {
    const hint = buildProviderErrorHint(
      agent({ llmProvider: LLM_PROVIDERS.GEMINI, geminiConfig: { model: 'gemini-2.5-pro' } })
    );
    expect(hint).toContain('Gemini API key');
    expect(hint).toContain('gemini-2.5-pro');
  });

  it('hint at OpenRouter credits for the openrouter provider', () => {
    const hint = buildProviderErrorHint(
      agent({ llmProvider: LLM_PROVIDERS.OPENROUTER, openrouterConfig: { model: 'anthropic/claude-3.5-sonnet' } })
    );
    expect(hint).toContain('OpenRouter API key');
    expect(hint).toContain('credits');
  });

  it('hint at the endpoint URL and optional key for the openai-compatible provider', () => {
    const hint = buildProviderErrorHint(
      agent({
        llmProvider: LLM_PROVIDERS.OPENAI_COMPATIBLE,
        openaiCompatibleConfig: { model: 'my-model', baseUrl: 'http://localhost:1234/v1' }
      })
    );
    expect(hint).toContain('http://localhost:1234/v1');
    expect(hint).toContain('my-model');
    expect(hint).toContain('API key');
  });

  describe('buildAgentErrorMessage (F-UX-009)', () => {
    it('names the provider and cause for llm failures, with the actionable hint', () => {
      const message = buildAgentErrorMessage(agent(), boom, 'llm');
      expect(message).toContain('LLM provider');
      expect(message).toContain('connection refused');
      expect(message).toContain('Ollama is running locally');
      // The blame-the-query checklist is gone (F-UX-009).
      expect(message).not.toMatch(/your query/i);
    });

    it('names the server for server failures — no provider hint', () => {
      const message = buildAgentErrorMessage(agent(), boom, 'server');
      expect(message).toContain('could not be reached');
      expect(message).toContain('connection refused');
      expect(message).not.toContain('Ollama');
    });

    it('names the tool call for tool failures', () => {
      const message = buildAgentErrorMessage(agent(), boom, 'tool');
      expect(message).toContain('tool call failed');
      expect(message).toContain('connection refused');
    });
  });

  describe('temperature defaulting (F-BUG-034)', () => {
    it('passes temperature: 0 through to every provider constructor as 0', async () => {
      await initOllama({}, { temperature: 0 });
      expect(ctors.ollama.at(-1).temperature).toBe(0);

      await initGemini({}, { temperature: 0, geminiApiKey: 'k' });
      expect(ctors.genai.at(-1).temperature).toBe(0);

      await initOpenRouter({}, { temperature: 0, openrouterApiKey: 'k' });
      expect(ctors.openai.at(-1).temperature).toBe(0);

      await initOpenAiCompatible({}, {
        temperature: 0,
        openaiCompatibleBaseUrl: 'http://localhost:1234/v1',
        openaiCompatibleModel: 'm'
      });
      expect(ctors.openai.at(-1).temperature).toBe(0);
    });

    it('still defaults temperature to 0.7 when unset', async () => {
      await initOllama({}, {});
      expect(ctors.ollama.at(-1).temperature).toBe(0.7);
    });
  });

  describe('lazy provider SDK loading (F-PERF-007)', () => {
    // The provider SDKs are dynamically imported so the bundle downloads only
    // the selected provider — init returns a promise for the constructed
    // model and assigns it on agent.llm when it resolves.
    it('returns a promise resolving to the model assigned on agent.llm', async () => {
      const a = {};
      const llm = await initOllama(a, {});
      expect(a.llm).toBe(llm);
      expect(ctors.ollama.at(-1).model).toBe('llama3.1:8b');
    });

    it('still throws synchronously when the API key is missing', () => {
      // Validation runs before the dynamic import, so the constructor keeps
      // its synchronous throw instead of producing a rejected promise.
      expect(() => initGemini({}, {})).toThrow('Gemini API key is required');
      expect(() => initOpenRouter({}, {})).toThrow('OpenRouter API key is required');
    });
  });

  describe('normalizeOpenAiBaseUrl', () => {
    it('appends /v1 to a bare origin so both spellings work', () => {
      expect(normalizeOpenAiBaseUrl('http://localhost:1234')).toBe('http://localhost:1234/v1');
      expect(normalizeOpenAiBaseUrl('http://localhost:1234/')).toBe('http://localhost:1234/v1');
    });

    it('keeps an explicit path as given — /v1 or a custom API root', () => {
      expect(normalizeOpenAiBaseUrl('http://localhost:1234/v1')).toBe('http://localhost:1234/v1');
      expect(normalizeOpenAiBaseUrl('https://gateway.example.com/openai/')).toBe('https://gateway.example.com/openai');
    });

    it('returns an empty string for empty input and passes unparseable input through', () => {
      expect(normalizeOpenAiBaseUrl('')).toBe('');
      expect(normalizeOpenAiBaseUrl(undefined)).toBe('');
      expect(normalizeOpenAiBaseUrl('not a url')).toBe('not a url');
    });
  });

  describe('initOpenAiCompatible', () => {
    const base = { openaiCompatibleBaseUrl: 'http://localhost:1234', openaiCompatibleModel: 'my-model' };

    it('constructs ChatOpenAI against the endpoint with a sentinel key when none is given', async () => {
      const a = {};
      const llm = await initOpenAiCompatible(a, base);

      expect(a.llm).toBe(llm);
      const cfg = ctors.openai.at(-1);
      // The SDK throws without a key — the sentinel satisfies it while a
      // keyless endpoint ignores the Bearer value.
      expect(cfg.apiKey).toBe('not-needed');
      expect(cfg.configuration.baseURL).toBe('http://localhost:1234/v1');
      expect(cfg.model).toBe('my-model');
      expect(a.openaiCompatibleConfig.baseUrl).toBe('http://localhost:1234/v1');
    });

    it('uses the supplied API key instead of the sentinel', async () => {
      await initOpenAiCompatible({}, { ...base, openaiCompatibleApiKey: 'sk-live' });
      expect(ctors.openai.at(-1).apiKey).toBe('sk-live');
    });

    it('sends no OpenRouter-style referer/title headers', async () => {
      await initOpenAiCompatible({}, base);
      expect(ctors.openai.at(-1).configuration.defaultHeaders).toBeUndefined();
    });

    it('throws synchronously when the endpoint URL or model is missing', () => {
      expect(() => initOpenAiCompatible({}, { openaiCompatibleModel: 'm' })).toThrow('Endpoint URL is required');
      expect(() => initOpenAiCompatible({}, { openaiCompatibleBaseUrl: 'http://x' })).toThrow('Model name is required');
      // …but never for a missing key — that is the point of the provider.
      expect(() => initOpenAiCompatible({}, base)).not.toThrow();
    });
  });
});
