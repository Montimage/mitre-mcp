/**
 * Tests for the chat message renderer
 * (frontend/src/components/chat/ChatMessage.jsx).
 *
 * Includes the F-BUG-001 regression: message markup must render as text,
 * never as injected HTML (the old formatMessage() + dangerouslySetInnerHTML
 * XSS vector, fixed via react-markdown).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatMessage from './ChatMessage.jsx';

describe('ChatMessage', () => {
  it('F-BUG-001 regression: raw HTML in a message is escaped, never injected', () => {
    const payload = '<img src=x onerror=alert(1)>\n<script>alert("xss")</script>';
    const { container } = render(<ChatMessage type="assistant" message={payload} timestamp="2026-01-01T10:00:00Z" />);

    // The markup must not produce real DOM elements...
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    // ...and must be visible as literal escaped text instead.
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(container.textContent).toContain('<script>alert("xss")</script>');
  });

  it('renders markdown formatting as React elements', () => {
    const { container } = render(
      <ChatMessage type="assistant" message={'**bold** and `code`'} timestamp="2026-01-01T10:00:00Z" />
    );
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('code')?.textContent).toBe('code');
  });

  it('labels the header by message type', () => {
    const { rerender } = render(<ChatMessage type="user" message="hi" />);
    expect(screen.getByText('You')).toBeTruthy();

    rerender(<ChatMessage type="assistant" message="hi" />);
    expect(screen.getByText('Assistant')).toBeTruthy();

    rerender(<ChatMessage type="system" message="hi" />);
    expect(screen.getByText('System')).toBeTruthy();

    rerender(<ChatMessage type="error" message="hi" />);
    expect(screen.getByText('Error')).toBeTruthy();
  });

  it('shows a Copy action only on assistant messages', () => {
    const { rerender } = render(<ChatMessage type="assistant" message="answer" />);
    expect(screen.getByTitle('Copy message')).toBeTruthy();

    rerender(<ChatMessage type="user" message="question" />);
    expect(screen.queryByTitle('Copy message')).toBeNull();
  });

  describe('typed error bubble (F-UX-009)', () => {
    it.each([
      ['llm', 'LLM error'],
      ['tool', 'Tool error'],
      ['server', 'Server error'],
    ])('a %s failure renders an alert bubble with a Retry action and no Copy button', (kind, label) => {
      const onRetry = vi.fn();
      render(
        <ChatMessage
          type="error"
          message={`${kind} broke`}
          errorKind={kind}
          retryable
          retryQuery="list tactics"
          onRetry={onRetry}
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('bg-red-50');
      expect(alert.className).toContain('border-red-400');
      expect(screen.getByText(label)).toBeTruthy();
      expect(screen.getByText(`${kind} broke`)).toBeTruthy();
      expect(screen.queryByTitle('Copy message')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /retry/i }));
      expect(onRetry).toHaveBeenCalledWith('list tactics');
    });

    it('renders no Retry when the failure is not retryable or carries no query', () => {
      const { rerender } = render(
        <ChatMessage type="error" message="broken" errorKind="llm" retryable={false} retryQuery="q" onRetry={vi.fn()} />
      );
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();

      rerender(<ChatMessage type="error" message="broken" errorKind="llm" retryable onRetry={vi.fn()} />);
      expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
    });

    it('labels an unknown error kind plainly as Error', () => {
      render(<ChatMessage type="error" message="broken" />);
      expect(screen.getByText('Error')).toBeTruthy();
    });
  });

  describe('tool-approval card', () => {
    const toolCalls = [{ name: 'get_tactics', args: { domain: 'enterprise-attack' } }];

    it('lists the requested tools and wires approve/deny buttons', () => {
      const onApprove = vi.fn();
      const onDeny = vi.fn();
      render(
        <ChatMessage type="tool-approval" toolCalls={toolCalls} onApprove={onApprove} onDeny={onDeny} timestamp="2026-01-01T10:00:00Z" />
      );

      expect(screen.getByText('Tool Execution Request')).toBeTruthy();
      expect(screen.getByText(/get_tactics/)).toBeTruthy();
      expect(screen.getByText(/enterprise-attack/)).toBeTruthy();

      fireEvent.click(screen.getByText('✓ Approve'));
      expect(onApprove).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('✗ Deny'));
      expect(onDeny).toHaveBeenCalledTimes(1);
    });

    it('shows the recorded decision instead of the buttons', () => {
      const { rerender } = render(
        <ChatMessage type="tool-approval" toolCalls={toolCalls} decision="approved" />
      );
      expect(screen.getByText('✓ Approved by user')).toBeTruthy();
      expect(screen.queryByText('✓ Approve')).toBeNull();

      rerender(<ChatMessage type="tool-approval" toolCalls={toolCalls} decision="denied" />);
      expect(screen.getByText('✗ Denied by user')).toBeTruthy();
    });

    it('F-UX-010: an all-read-only batch gets an informational card showing the tool title, not the raw name', () => {
      const readOnlyCalls = [{
        id: 'c1',
        name: 'get_tactics',
        title: 'Get Tactics',
        description: 'List the ATT&CK tactics',
        args: { domain: 'enterprise-attack' },
        readOnly: true,
      }];
      render(
        <ChatMessage type="tool-approval" toolCalls={readOnlyCalls} onApprove={vi.fn()} onDeny={vi.fn()} onAlwaysAllow={vi.fn()} />
      );

      expect(screen.getByText('Read-only lookup')).toBeTruthy();
      // The human title is the tool's label — the raw name is not rendered.
      expect(screen.getByText('Get Tactics')).toBeTruthy();
      expect(screen.queryByText(/get_tactics/)).toBeNull();
      // The plain-language description leads; the JSON arguments stay
      // available behind a disclosure instead of dominating the card.
      expect(screen.getByText('List the ATT&CK tactics')).toBeTruthy();
      expect(screen.getByText('Arguments')).toBeTruthy();
      expect(screen.getByText(/enterprise-attack/)).toBeTruthy();
    });

    it('F-UX-010: "Always allow lookups" is offered on read-only batches and fires its callback', () => {
      const onAlwaysAllow = vi.fn();
      const readOnlyCalls = [
        { id: 'c1', name: 'get_tactics', title: 'Get Tactics', args: {}, readOnly: true },
      ];
      render(
        <ChatMessage type="tool-approval" toolCalls={readOnlyCalls} onApprove={vi.fn()} onDeny={vi.fn()} onAlwaysAllow={onAlwaysAllow} />
      );

      fireEvent.click(screen.getByRole('button', { name: /always allow lookups/i }));
      expect(onAlwaysAllow).toHaveBeenCalledTimes(1);
    });

    it('F-UX-010: a non-read-only call keeps the warning card and gets no always-allow choice', () => {
      const calls = [{ id: 'c1', name: 'run_query', args: {}, readOnly: false }];
      render(
        <ChatMessage type="tool-approval" toolCalls={calls} onApprove={vi.fn()} onDeny={vi.fn()} onAlwaysAllow={vi.fn()} />
      );

      expect(screen.getByText('Tool Execution Request')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /always allow lookups/i })).toBeNull();
    });

    it('F-UX-010: a mixed batch keeps the warning card — always-allow only applies to all-read-only batches', () => {
      const calls = [
        { id: 'c1', name: 'get_tactics', title: 'Get Tactics', args: {}, readOnly: true },
        { id: 'c2', name: 'run_query', args: {}, readOnly: false },
      ];
      render(
        <ChatMessage type="tool-approval" toolCalls={calls} onApprove={vi.fn()} onDeny={vi.fn()} onAlwaysAllow={vi.fn()} />
      );

      expect(screen.getByText('Tool Execution Request')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /always allow lookups/i })).toBeNull();
    });
  });
});
