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
  });
});
