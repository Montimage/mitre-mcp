/**
 * Tests for frontend/src/services/agentMessages.js — the pure message/content
 * helpers extracted from the agent loop.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeContent,
  contentText,
  formatToolResult,
  buildSystemPrompt,
  MAX_TOOL_RESULT_CHARS
} from './agentMessages.js';

describe('normalizeContent', () => {
  it('passes strings through unchanged', () => {
    expect(normalizeContent('hello')).toBe('hello');
  });

  it('flattens an array of content blocks into a string', () => {
    expect(normalizeContent([{ type: 'text', text: 'First. ' }, { type: 'text', text: 'Second.' }])).toBe('First. Second.');
  });

  it('normalises null/undefined to an empty string', () => {
    expect(normalizeContent(null)).toBe('');
    expect(normalizeContent(undefined)).toBe('');
  });
});

describe('contentText', () => {
  it('joins text blocks with newlines', () => {
    expect(contentText([{ text: 'a' }, { text: 'b' }])).toBe('a\nb');
  });

  it('returns "" for non-array input', () => {
    expect(contentText('nope')).toBe('');
  });
});

describe('formatToolResult', () => {
  it('serialises JSON payloads compactly — no indentation (F-PERF-008)', () => {
    const out = formatToolResult({ result: { content: [{ text: '{"a":1,"b":[1,2]}' }] } });
    expect(out).toBe('{"a":1,"b":[1,2]}');
    expect(out).not.toContain('\n');
    expect(JSON.parse(out)).toEqual({ a: 1, b: [1, 2] });
  });

  it('truncates oversized payloads at the fixed cap (F-PERF-008)', () => {
    const big = JSON.stringify({ data: 'x'.repeat(MAX_TOOL_RESULT_CHARS + 5000) });
    const out = formatToolResult({ result: { content: [{ text: big }] } });
    expect(out).toContain('truncated');
    expect(out.length).toBeLessThanOrEqual(MAX_TOOL_RESULT_CHARS + 200);
  });

  it('caps non-JSON text passthrough at the same limit', () => {
    const out = formatToolResult({ result: { content: [{ text: 'y'.repeat(MAX_TOOL_RESULT_CHARS + 10) }] } });
    expect(out).toContain('truncated');
  });

  it('passes small non-JSON text through unchanged', () => {
    expect(formatToolResult({ result: { content: [{ text: 'plain text' }] } })).toBe('plain text');
  });
});

describe('buildSystemPrompt', () => {
  it('lists discovered tools', () => {
    const prompt = buildSystemPrompt([{ name: 'get_tactics', description: 'List tactics' }]);
    expect(prompt).toContain('- get_tactics: List tactics');
  });

  it('falls back to a no-tools note when discovery is empty', () => {
    expect(buildSystemPrompt([])).toContain('tool discovery is unavailable');
  });
});
