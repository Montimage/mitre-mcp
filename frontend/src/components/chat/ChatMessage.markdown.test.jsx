/**
 * Markdown rendering guarantees for chat messages
 * (frontend/src/components/chat/ChatMessage.jsx).
 *
 * remark-gfm was added so tables render as tables — both the scripted demo
 * answers and real model output use them constantly, and without the plugin
 * they reached the user as rows of raw pipe characters.
 *
 * The plugin must not widen what a message can inject: react-markdown still
 * renders no raw HTML, and this file pins that alongside the new capability
 * so the two are never traded off against each other.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ChatMessage from './ChatMessage.jsx';

const TABLE = [
  '| Technique | Tactic |',
  '| --- | --- |',
  '| T1059.001 | Execution |',
  '| T1003 | Credential Access |',
].join('\n');

describe('ChatMessage markdown', () => {
  it('renders a GFM table as a real table, not raw pipes', () => {
    const { container } = render(<ChatMessage message={TABLE} type="assistant" />);

    const table = container.querySelector('table');
    expect(table).toBeTruthy();
    expect(container.querySelectorAll('th')).toHaveLength(2);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(table.textContent).toContain('T1059.001');
    // The pipe characters must be consumed by the table, not printed.
    expect(container.textContent).not.toContain('| T1059.001 |');
  });

  it('still renders no raw HTML', () => {
    const { container } = render(
      <ChatMessage
        message={'<img src=x onerror="alert(1)"> <script>alert(2)</script> **bold**'}
        type="assistant"
      />
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('strong')?.textContent).toBe('bold');
  });

  it('renders markdown lists with visible markers', () => {
    // Tailwind Preflight removes list-style and padding, so an unstyled
    // <ul> reaches the user as unmarked lines.
    const { container } = render(
      <ChatMessage message={'- first\n- second\n- third'} type="assistant" />
    );

    const list = container.querySelector('ul');
    expect(list).toBeTruthy();
    expect(list.className).toContain('list-disc');
    expect(container.querySelectorAll('li')).toHaveLength(3);
  });

  it('keeps the line structure of the multi-line system messages', () => {
    // These are built with literal \n and used to rely on whitespace-pre-wrap,
    // which the markdown wrapper no longer sets.
    const { container } = render(
      <ChatMessage
        message={'Configuration updated:\n- MCP Server: localhost:8000\n- LLM Provider: Ollama'}
        type="system"
      />
    );

    expect(container.textContent).toContain('Configuration updated:');
    expect(container.textContent).toContain('MCP Server: localhost:8000');
    expect(container.textContent).toContain('LLM Provider: Ollama');
    // The two dashed lines become a list rather than collapsing onto one line.
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('keeps single newlines as line breaks (remark-breaks still applies)', () => {
    const { container } = render(<ChatMessage message={'line one\nline two'} type="assistant" />);
    expect(container.querySelectorAll('br').length).toBeGreaterThan(0);
  });
});
