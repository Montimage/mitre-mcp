/**
 * Tests for App's landing tree (frontend/src/App.jsx).
 *
 * Covered:
 *  - The landing renders Hero + sections with the embedded ChatBox.
 *  - `#chat` remains the landing embed anchor (F-UX-019) — the chatbox's
 *    in-place full-size view (F-UX-020) is internal ChatBox state, not a
 *    route, so no hash ever swaps the landing away.
 *  - F-PERF-007: ChatBox mounts through React.lazy + Suspense — findBy*
 *    flushes the chunk the same way Hero.test does.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.jsx';

// The lazy ChatBox still resolves through import() — mock the module so the
// test never pulls the agent / provider SDKs.
vi.mock('./components/chat/ChatBox.jsx', () => ({
  default: () => <div data-testid="chatbox-stub">ChatBox</div>,
}));

describe('App', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  afterEach(() => {
    window.location.hash = '';
  });

  it('renders the landing with the Hero chat embed', async () => {
    render(<App />);

    expect(screen.getByRole('link', { name: /try it/i })).toBeTruthy();
    expect(document.getElementById('chat')).toBeTruthy();
    expect(document.getElementById('features')).toBeTruthy();
    expect(document.getElementById('playbooks')).toBeTruthy();
    expect(await screen.findByTestId('chatbox-stub')).toBeTruthy();
  });

  it('#chat still shows the landing Hero embed', async () => {
    window.location.hash = '#chat';
    render(<App />);

    expect(screen.getByRole('link', { name: /try it/i })).toBeTruthy();
    expect(document.getElementById('chat')).toBeTruthy();
    expect(await screen.findByTestId('chatbox-stub')).toBeTruthy();
  });
});
