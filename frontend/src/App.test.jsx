/**
 * Tests for App's landing vs dedicated-chat hash branch
 * (frontend/src/App.jsx + components/chat/ChatPage.jsx).
 *
 * Covered:
 *  - F-UX-020: `#/chat` is the dedicated full-size page; `#chat` remains
 *    the landing embed anchor and still shows Hero + Navbar + sections.
 *  - F-PERF-007: ChatPage (and ChatBox inside it) mount through React.lazy
 *    + Suspense — findBy* flushes the chunk the same way Hero.test does.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import App from './App.jsx';

const mocks = vi.hoisted(() => ({ chatBoxProps: { current: null } }));

// The lazy ChatBox (Hero embed and ChatPage) still resolves through import()
// — mock the module so the test never pulls the agent / provider SDKs. The
// stub captures layout so the dedicated page can pin `full`.
vi.mock('./components/chat/ChatBox.jsx', () => ({
  default: (props) => {
    mocks.chatBoxProps.current = props;
    return (
      <div data-testid="chatbox-stub" data-layout={props.layout || 'embedded'}>
        ChatBox
      </div>
    );
  },
}));

describe('App', () => {
  beforeEach(() => {
    mocks.chatBoxProps.current = null;
    window.location.hash = '';
  });

  afterEach(() => {
    window.location.hash = '';
  });

  it('renders the landing with the Hero chat embed when the hash is empty', async () => {
    render(<App />);

    expect(screen.getByRole('link', { name: /try it/i })).toBeTruthy();
    expect(document.getElementById('chat')).toBeTruthy();
    expect(document.getElementById('features')).toBeTruthy();
    expect(document.getElementById('playbooks')).toBeTruthy();

    const stub = await screen.findByTestId('chatbox-stub');
    expect(stub.getAttribute('data-layout')).toBe('embedded');
    expect(screen.queryByRole('link', { name: /back to landing/i })).toBeNull();
  });

  it('F-UX-020: #chat still shows the landing Hero embed, not the dedicated page', async () => {
    window.location.hash = '#chat';
    render(<App />);

    expect(screen.getByRole('link', { name: /try it/i })).toBeTruthy();
    expect(document.getElementById('chat')).toBeTruthy();
    expect(document.getElementById('features')).toBeTruthy();
    expect(document.getElementById('playbooks')).toBeTruthy();

    const stub = await screen.findByTestId('chatbox-stub');
    expect(stub.getAttribute('data-layout')).toBe('embedded');
    expect(screen.queryByRole('link', { name: /back to landing/i })).toBeNull();
  });

  it('F-UX-020 / F-PERF-007: #/chat on mount shows the lazy dedicated page and hides landing sections', async () => {
    window.location.hash = '#/chat';
    render(<App />);

    const back = await screen.findByRole('link', { name: /back to landing/i });
    expect(back.getAttribute('href')).toBe('#');

    const stub = await screen.findByTestId('chatbox-stub');
    expect(stub.getAttribute('data-layout')).toBe('full');

    expect(screen.queryByRole('link', { name: /try it/i })).toBeNull();
    expect(document.getElementById('chat')).toBeNull();
    expect(document.getElementById('features')).toBeNull();
    expect(document.getElementById('playbooks')).toBeNull();
  });

  it('F-UX-020: a hashchange to #/chat swaps the landing for the dedicated page', async () => {
    render(<App />);
    await screen.findByTestId('chatbox-stub');
    expect(screen.getByRole('link', { name: /try it/i })).toBeTruthy();

    await act(async () => {
      window.location.hash = '#/chat';
    });

    expect(await screen.findByRole('link', { name: /back to landing/i })).toBeTruthy();
    expect((await screen.findByTestId('chatbox-stub')).getAttribute('data-layout')).toBe('full');
    expect(screen.queryByRole('link', { name: /try it/i })).toBeNull();
    expect(document.getElementById('chat')).toBeNull();
  });

  it('F-UX-020: a hashchange away from #/chat restores the landing embed', async () => {
    window.location.hash = '#/chat';
    render(<App />);
    await screen.findByRole('link', { name: /back to landing/i });

    await act(async () => {
      window.location.hash = '';
    });

    expect(await screen.findByRole('link', { name: /try it/i })).toBeTruthy();
    expect(document.getElementById('chat')).toBeTruthy();
    const stub = await screen.findByTestId('chatbox-stub');
    expect(stub.getAttribute('data-layout')).toBe('embedded');
    expect(screen.queryByRole('link', { name: /back to landing/i })).toBeNull();
  });
});
