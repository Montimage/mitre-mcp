/**
 * Tests for frontend/src/services/llmProviders.js — provider-hinted error
 * message and the shared LLM_PROVIDERS constant.
 */
import { describe, it, expect } from 'vitest';
import { LLM_PROVIDERS, buildProviderErrorMessage } from './llmProviders.js';

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
});
