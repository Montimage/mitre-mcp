/**
 * Tests for frontend/src/services/agentMessages.js — the pure message/content
 * helpers extracted from the agent loop.
 */
import { describe, it, expect } from 'vitest';
import { normalizeContent, contentText, formatToolResult, buildSystemPrompt } from './agentMessages.js';

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
  it('pretty-prints JSON text payloads', () => {
    expect(JSON.parse(formatToolResult({ result: { content: [{ text: '{"a":1}' }] } }))).toEqual({ a: 1 });
  });

  it('passes non-JSON text through unchanged', () => {
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
