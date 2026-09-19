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
  buildProviderErrorMessage
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
  it('exposes the three provider identifiers', () => {
    expect(LLM_PROVIDERS).toEqual({ OLLAMA: 'ollama', GEMINI: 'gemini', OPENROUTER: 'openrouter' });
  });

  it('hint at Ollama for the default provider', () => {
    const message = buildProviderErrorMessage(agent(), boom);
    expect(message).toContain('Ollama is running locally');
    expect(message).toContain('connection refused');
  });

  it('hint at the Gemini model and key for the gemini provider', () => {
    const message = buildProviderErrorMessage(
      agent({ llmProvider: LLM_PROVIDERS.GEMINI, geminiConfig: { model: 'gemini-2.5-pro' } }),
      boom
    );
    expect(message).toContain('Gemini API key');
    expect(message).toContain('gemini-2.5-pro');
  });

  it('hint at OpenRouter credits for the openrouter provider', () => {
    const message = buildProviderErrorMessage(
      agent({ llmProvider: LLM_PROVIDERS.OPENROUTER, openrouterConfig: { model: 'anthropic/claude-3.5-sonnet' } }),
      boom
    );
    expect(message).toContain('OpenRouter API key');
    expect(message).toContain('credits');
  });

  describe('temperature defaulting (F-BUG-034)', () => {
    it('passes temperature: 0 through to every provider constructor as 0', async () => {
      await initOllama({}, { temperature: 0 });
      expect(ctors.ollama.at(-1).temperature).toBe(0);

      await initGemini({}, { temperature: 0, geminiApiKey: 'k' });
      expect(ctors.genai.at(-1).temperature).toBe(0);

      await initOpenRouter({}, { temperature: 0, openrouterApiKey: 'k' });
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
});
