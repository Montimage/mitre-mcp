/**
 * F-PERF-012: ChatMessage is wrapped in React.memo so unchanged messages do
 * not re-render on every ChatBox state change.
 *
 * react-markdown is mocked with a render counter — the memoised component
 * only re-invokes its render (and therefore ReactMarkdown) when a prop
 * actually changes.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import ChatMessage from './ChatMessage.jsx';

const renderCount = vi.hoisted(() => ({ n: 0 }));

vi.mock('react-markdown', () => ({
  default: () => {
    renderCount.n += 1;
    return null;
  },
}));

describe('ChatMessage memoisation (F-PERF-012)', () => {
  it('is wrapped in React.memo', () => {
    expect(ChatMessage.$$typeof).toBe(Symbol.for('react.memo'));
  });

  it('does not re-render when its props are unchanged', () => {
    const props = { type: 'assistant', message: 'answer', timestamp: '2026-01-01T10:00:00Z' };
    const { rerender } = render(<ChatMessage {...props} />);
    expect(renderCount.n).toBe(1);

    // Identical props → memo bails out, the inner tree is not re-rendered.
    rerender(<ChatMessage {...props} />);
    expect(renderCount.n).toBe(1);

    // A changed message re-renders exactly once more.
    rerender(<ChatMessage {...props} message="new answer" />);
    expect(renderCount.n).toBe(2);
  });
});
