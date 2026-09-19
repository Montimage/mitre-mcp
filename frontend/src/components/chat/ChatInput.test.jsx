/**
 * Tests for the chat input (frontend/src/components/chat/ChatInput.jsx).
 *
 * Regressions covered:
 *  - F-UX-019 (#98): the textarea must not autofocus on mount — focusing on
 *    load scrolls mobile users into the chat and pops the keyboard before
 *    they choose to interact.
 *  - F-UX-019 (#98): the 1,000-character cap must not truncate silently —
 *    a counter/message names the limit once it is reached.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatInput from './ChatInput.jsx';

const getTextarea = () => screen.getByRole('textbox', { name: /chat message/i });

describe('ChatInput', () => {
  it('F-UX-019: does not autofocus on mount', () => {
    render(<ChatInput onSendMessage={vi.fn()} />);
    expect(document.activeElement).not.toBe(getTextarea());
  });

  it('F-UX-019: names the limit once the character cap is reached', () => {
    render(<ChatInput onSendMessage={vi.fn()} />);
    const textarea = getTextarea();

    // The counter is always visible, in its quiet state below the cap.
    expect(screen.getByText('0 / 1000')).toBeTruthy();
    expect(screen.queryByText(/character limit reached/i)).toBeNull();

    fireEvent.change(textarea, { target: { value: 'a'.repeat(1000) } });
    expect(screen.getByText(/character limit reached/i)).toBeTruthy();
    expect(screen.getByText(/1000 \/ 1000/)).toBeTruthy();
  });

  it('still sends a trimmed message and clears the input', () => {
    const onSendMessage = vi.fn();
    render(<ChatInput onSendMessage={onSendMessage} />);
    const textarea = getTextarea();

    fireEvent.change(textarea, { target: { value: '  what is APT29?  ' } });
    fireEvent.submit(textarea.closest('form'));

    expect(onSendMessage).toHaveBeenCalledWith('what is APT29?');
    expect(textarea.value).toBe('');
  });
});
