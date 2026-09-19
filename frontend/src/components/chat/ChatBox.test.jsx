/**
 * Tests for the chat container (frontend/src/components/chat/ChatBox.jsx).
 *
 * Regressions covered:
 *  - F-BUG-006: the MCP status dot must follow the boolean testConnection()
 *    resolves to, not the absence of a throw (it never throws).
 *  - F-BUG-010: clearing the chat while a tool approval is pending must
 *    resolve that approval so the input is re-enabled.
 *  - F-BUG-023: the init effect must be StrictMode-safe — a cancelled flag
 *    plus cleanup so remounts initialise a single agent and no state update
 *    fires after unmount.
 *
 * LangGraphAgent is mocked; indexedDB is stubbed for the API-key lookup.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ChatBox from './ChatBox.jsx';

const mocks = vi.hoisted(() => ({
  agents: [],
  testConnection: vi.fn(),
  processQuery: vi.fn(),
}));

vi.mock('../../services/langGraphAgent.js', () => ({
  __esModule: true,
  default: class {
    constructor(host, port, config) {
      this.host = host;
      this.port = port;
      this.config = config;
      this.cleared = false;
      mocks.agents.push(this);
    }
    testConnection() { return mocks.testConnection(); }
    processQuery(...args) { return mocks.processQuery(...args); }
    clearHistory() { this.cleared = true; }
  },
  LLM_PROVIDERS: { OLLAMA: 'ollama', GEMINI: 'gemini', OPENROUTER: 'openrouter' },
}));

const WELCOME = /Welcome to the MITRE ATT&CK Intelligence Assistant/;

const mcpStatusDot = (container) =>
  container.querySelector('div[title^="MCP Server:"] .rounded-full');

describe('ChatBox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.agents.length = 0;
    mocks.testConnection.mockResolvedValue(true);
    mocks.processQuery.mockResolvedValue('agent answer');
    localStorage.clear();
    // Minimal indexedDB stub: the key lookup resolves '' via onerror.
    vi.stubGlobal('indexedDB', {
      open: () => {
        const request = {};
        setTimeout(() => request.onerror?.(), 0);
        return request;
      },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('F-BUG-006 regression: MCP dot is red when testConnection resolves false', async () => {
    mocks.testConnection.mockResolvedValue(false);
    const { container } = render(<ChatBox />);

    await screen.findByText(WELCOME);
    await waitFor(() => {
      expect(container.querySelector('div[title="MCP Server: disconnected"]')).toBeTruthy();
    });
    expect(mcpStatusDot(container).className).toContain('bg-red-500');
  });

  it('F-BUG-006 regression: MCP dot is green when testConnection resolves true', async () => {
    mocks.testConnection.mockResolvedValue(true);
    const { container } = render(<ChatBox />);

    await screen.findByText(WELCOME);
    await waitFor(() => {
      expect(container.querySelector('div[title="MCP Server: connected"]')).toBeTruthy();
    });
    expect(mcpStatusDot(container).className).toContain('bg-green-500');
  });

  it('sends a message and renders the agent response', async () => {
    render(<ChatBox />);
    const textarea = await screen.findByPlaceholderText('Ask about MITRE ATT&CK...');
    await screen.findByText(WELCOME);

    fireEvent.change(textarea, { target: { value: 'list tactics' } });
    fireEvent.submit(textarea.closest('form'));

    expect(mocks.processQuery).toHaveBeenCalledWith('list tactics', expect.any(Function));
    expect(await screen.findByText('agent answer')).toBeTruthy();
  });

  it('F-BUG-010 regression: clearing with a pending approval resolves it and re-enables input', async () => {
    // The fake agent requests approval and waits on the resolver ChatBox stores.
    mocks.processQuery.mockImplementation(async (text, requestApproval) => {
      const approved = await requestApproval([{ id: 'c1', name: 'get_tactics', args: {} }]);
      return approved ? 'tools ran' : 'cancelled';
    });

    render(<ChatBox />);
    const textarea = await screen.findByPlaceholderText('Ask about MITRE ATT&CK...');
    await screen.findByText(WELCOME);

    // Send a query — the agent parks on the approval card.
    fireEvent.change(textarea, { target: { value: 'list tactics' } });
    fireEvent.submit(textarea.closest('form'));
    await screen.findByText('Tool Execution Request');
    expect(textarea.disabled).toBe(true);

    // Clear while the approval is pending.
    fireEvent.click(screen.getByText('Clear'));

    // The pending promise resolves (deny), the card is gone, the input unlocks.
    await waitFor(() => expect(textarea.disabled).toBe(false));
    expect(screen.queryByText('Tool Execution Request')).toBeNull();
    expect(screen.getByText('Chat cleared. How can I help you?')).toBeTruthy();
    expect(mocks.agents[0].cleared).toBe(true);
  });

  it('F-BUG-023 regression: StrictMode mount/unmount/remount initialises one agent per live mount, nothing after unmount', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      // StrictMode double-mounts in dev: the stale init run must bail, so the
      // mounted tree ends up with exactly one agent.
      const first = render(<StrictMode><ChatBox /></StrictMode>);
      await screen.findByText(WELCOME);
      expect(mocks.agents).toHaveLength(1);
      first.unmount();

      // Unmounting while init is still in flight (the stubbed IndexedDB read
      // resolves on a setTimeout) must cancel every pending continuation —
      // no agent is constructed and no setState fires once it resolves.
      const second = render(<StrictMode><ChatBox /></StrictMode>);
      second.unmount();
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
      expect(mocks.agents).toHaveLength(1);

      // A clean remount still initialises exactly one agent of its own.
      const third = render(<StrictMode><ChatBox /></StrictMode>);
      await screen.findByText(WELCOME);
      expect(mocks.agents).toHaveLength(2);
      third.unmount();

      // No stray act() or state-update-on-unmounted warnings at any point.
      const reactWarnings = consoleError.mock.calls.flat().filter(
        (arg) => typeof arg === 'string' && /not wrapped in act|state update on an unmounted/i.test(arg)
      );
      expect(reactWarnings).toEqual([]);
    } finally {
      consoleError.mockRestore();
    }
  });
});
