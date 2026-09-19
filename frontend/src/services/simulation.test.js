/**
 * Tests for the scripted demo (frontend/src/services/simulation.js).
 *
 * The contract that matters here is determinism: a closed set of prompts
 * resolves exactly, one extra tier resolves a bare technique ID, and
 * everything else falls back rather than guessing. A demo that answers the
 * wrong question confidently is worse than one that says it cannot.
 */
import { describe, it, expect } from 'vitest';
import {
  SIMULATION_SUGGESTIONS,
  SIMULATION_TOOL_PREFIX,
  SIMULATION_WELCOME,
  getScriptedPrompts,
  getSimulatedAnswer,
  normalizePrompt,
} from './simulation.js';

// The nine tools the mitre-mcp server exposes. A trace naming anything else
// would be showing the user a call that cannot exist.
const REAL_TOOLS = [
  'get_techniques',
  'get_tactics',
  'get_groups',
  'get_software',
  'get_techniques_by_tactic',
  'get_techniques_used_by_group',
  'get_mitigations',
  'get_techniques_mitigated_by_mitigation',
  'get_technique_by_id',
];

describe('normalizePrompt', () => {
  it('collapses case, punctuation and whitespace', () => {
    expect(normalizePrompt('What is technique T1059?')).toBe('what is technique t1059');
    expect(normalizePrompt('  WHAT   is  technique   T1059 ?! ')).toBe('what is technique t1059');
  });

  it('folds curly apostrophes so copied prompts still match', () => {
    expect(normalizePrompt('Explain what ‘Spearphishing Attachment’ is')).toBe(
      normalizePrompt("Explain what 'Spearphishing Attachment' is")
    );
  });
});

describe('getSimulatedAnswer', () => {
  it('answers every scripted prompt', () => {
    const prompts = getScriptedPrompts();
    expect(prompts.length).toBeGreaterThan(20);

    for (const prompt of prompts) {
      const result = getSimulatedAnswer(prompt);
      expect(result.matched, prompt).toBe(true);
      expect(result.answer.length, prompt).toBeGreaterThan(80);
    }
  });

  it('matches regardless of case and trailing punctuation', () => {
    const exact = getSimulatedAnswer('What is technique T1059?');
    const sloppy = getSimulatedAnswer('  what is TECHNIQUE t1059  ');
    expect(sloppy.matched).toBe(true);
    expect(sloppy.answer).toBe(exact.answer);
  });

  it('resolves a question that names a single scripted technique ID', () => {
    const result = getSimulatedAnswer('Tell me about T1053.005 please');
    expect(result.matched).toBe(true);
    expect(result.answer).toContain('Scheduled Task');
  });

  it('falls back when a question names more than one technique ID', () => {
    // Ambiguous: answering about whichever ID appeared first would be a
    // guess dressed up as an answer.
    const result = getSimulatedAnswer('Compare T1003 and T1059.001 for me');
    expect(result.matched).toBe(false);
  });

  it('falls back on an unscripted question, with suggestions and no error', () => {
    const result = getSimulatedAnswer('What is the capital of France?');
    expect(result.matched).toBe(false);
    expect(result.tools).toEqual([]);
    expect(result.answer).toMatch(/simulation/i);
    for (const suggestion of SIMULATION_SUGGESTIONS) {
      expect(result.answer).toContain(suggestion);
    }
  });

  it('handles empty and nullish input without throwing', () => {
    for (const input of ['', '   ', null, undefined]) {
      expect(getSimulatedAnswer(input).matched).toBe(false);
    }
  });
});

describe('script integrity', () => {
  it('every suggestion offered by the fallback is itself scripted', () => {
    for (const suggestion of SIMULATION_SUGGESTIONS) {
      expect(getSimulatedAnswer(suggestion).matched, suggestion).toBe(true);
    }
  });

  it('every tool trace names one of the nine real MCP tools', () => {
    for (const prompt of getScriptedPrompts()) {
      const { tools } = getSimulatedAnswer(prompt);
      expect(tools.length, prompt).toBeGreaterThan(0);
      for (const call of tools) {
        const name = call.slice(0, call.indexOf('('));
        expect(REAL_TOOLS, `${prompt} -> ${call}`).toContain(name);
      }
    }
  });

  it('no two entries claim the same prompt', () => {
    const normalized = getScriptedPrompts().map(normalizePrompt);
    expect(new Set(normalized).size).toBe(normalized.length);
  });

  it('the welcome names the mode and says the answers are not live data', () => {
    expect(SIMULATION_WELCOME).toMatch(/simulation/i);
    expect(SIMULATION_WELCOME).toMatch(/live ATT&CK data/i);
    expect(SIMULATION_TOOL_PREFIX).toMatch(/simulated/i);
  });
});
