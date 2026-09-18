/**
 * Tests for the chat container (frontend/src/components/chat/ChatBox.jsx).
 *
 * Regressions covered:
 *  - F-BUG-006: the MCP status dot must follow the boolean testConnection()
 *    resolves to, not the absence of a throw (it never throws).
 *  - F-BUG-010: clearing the chat while a tool approval is pending must
 *    resolve that approval so the input is re-enabled.
 *
 * LangGraphAgent is mocked; indexedDB is stubbed for the API-key lookup.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
});
