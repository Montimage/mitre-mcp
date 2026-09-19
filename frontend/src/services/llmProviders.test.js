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
  it('exposes the three provider identifiers', () => {
    expect(LLM_PROVIDERS).toEqual({ OLLAMA: 'ollama', GEMINI: 'gemini', OPENROUTER: 'openrouter' });
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
