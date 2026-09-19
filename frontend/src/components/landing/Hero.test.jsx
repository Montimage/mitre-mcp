/**
 * Tests for the hero section (frontend/src/components/landing/Hero.jsx).
 *
 * Regressions covered:
 *  - F-PERF-007 (#88): the chat mounts through React.lazy + Suspense so the
 *    agent and provider SDKs stay out of the landing entry chunk — the hero
 *    must render its static content immediately and the chat once its chunk
 *    resolves.
 *  - F-UX-003 (#92): Getting Started names choosing/installing a model and
 *    carries a first-run checklist that reflects the LLM probe result the
 *    chat reports.
 *  - F-UX-017 (#92): the last step links to the in-page chat anchor instead
 *    of opening the site the user is already on in a new tab.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import Hero from './Hero.jsx';

const mocks = vi.hoisted(() => ({ chatBoxProps: { current: null } }));

// The lazy boundary still resolves through import() — mock the module so the
// test never pulls the real ChatBox (agent, MCP client, provider SDKs). The
// stub captures its props so tests can drive onSetupStatusChange the way the
// real chat does once its init probes resolve.
vi.mock('../chat/ChatBox.jsx', () => ({
  default: (props) => {
    mocks.chatBoxProps.current = props;
    return <div data-testid="chatbox-stub">ChatBox</div>;
  },
}));

const reportSetupStatus = (status) => {
  act(() => {
    mocks.chatBoxProps.current.onSetupStatusChange(status);
  });
};

describe('Hero', () => {
  it('renders the landing content immediately', async () => {
    render(<Hero />);
    expect(screen.getByText('MITRE ATT&CK')).toBeTruthy();
    expect(screen.getByText('Intelligence Assistant')).toBeTruthy();
    // findBy* flushes the lazy resolution inside act() so the suspended
    // chunk does not resolve unwrapped after the synchronous assertions.
    expect(await screen.findByTestId('chatbox-stub')).toBeTruthy();
  });

  it('renders the lazily-loaded chat once its chunk resolves', async () => {
    render(<Hero />);
    expect(await screen.findByTestId('chatbox-stub')).toBeTruthy();
  });

  it('F-UX-003: Getting Started names choosing/installing a model', async () => {
    render(<Hero />);
    await screen.findByTestId('chatbox-stub');

    const steps = screen.getByText('Getting Started').parentElement.querySelectorAll('ol > li');
    const modelStep = [...steps].find((li) => /model/i.test(li.textContent));
    expect(modelStep).toBeTruthy();
    // The step names both paths the app supports: a local Ollama model or
    // an API key for the hosted providers.
    expect(modelStep.textContent).toContain('ollama pull llama3.1:8b');
    expect(modelStep.textContent).toMatch(/api key/i);
  });

  it('F-UX-003: the first-run checklist reflects the probe result the chat reports', async () => {
    render(<Hero />);
    await screen.findByTestId('chatbox-stub');

    const llmRow = screen.getByText(/LLM provider ready/).closest('li');
    const mcpRow = screen.getByText(/MCP server reachable/).closest('li');
    // Before the chat reports, both rows read "checking".
    expect(llmRow.getAttribute('data-status')).toBe('checking');
    expect(mcpRow.getAttribute('data-status')).toBe('checking');

    // A failed provider probe marks the LLM row and surfaces the cause.
    reportSetupStatus({
      llm: 'not-configured',
      llmError: 'Cannot connect to Ollama: connection refused\nMake sure Ollama is running',
      mcp: 'connected',
    });
    expect(llmRow.getAttribute('data-status')).toBe('not-configured');
    expect(mcpRow.getAttribute('data-status')).toBe('connected');
    expect(screen.getByText(/Cannot connect to Ollama/)).toBeTruthy();

    // A successful probe flips the row to ready and clears the cause.
    reportSetupStatus({ llm: 'ready', llmError: null, mcp: 'connected' });
    expect(llmRow.getAttribute('data-status')).toBe('ready');
    expect(screen.queryByText(/Cannot connect to Ollama/)).toBeNull();
  });

  it('F-UX-017: the last step links to the in-page chat anchor — no new-tab self-link remains', async () => {
    render(<Hero />);
    await screen.findByTestId('chatbox-stub');

    const chatLink = screen.getByRole('link', { name: /jump to the chat/i });
    expect(chatLink.getAttribute('href')).toBe('#chat');
    expect(chatLink.getAttribute('target')).toBeNull();
    // The anchor target exists — on the wrapper, so it works before the
    // lazy chat chunk resolves.
    expect(document.getElementById('chat')).toBeTruthy();

    // No link opens the site's own URL — in a new tab or anywhere else.
    const selfLinks = [...document.querySelectorAll('a[href*="mitre-mcp.montimage.eu"]')];
    expect(selfLinks).toHaveLength(0);
  });
});
