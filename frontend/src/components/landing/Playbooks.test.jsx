/**
 * Tests for the landing Playbooks section
 * (frontend/src/components/landing/Playbooks.jsx).
 *
 * Regressions covered:
 *  - F-UX-011: playbook queries are click-to-ask — clicking "Ask" places the
 *    query in the chat input and scrolls the chat into view; action buttons
 *    are always visible; copy feedback is consistent; the tip shows the
 *    configured server address rather than a hard-coded one.
 *
 * The ask flow is exercised end-to-end: Playbooks and ChatBox are mounted as
 * siblings, exactly as App renders them, and the prompt crosses over the
 * ASK_CHAT_EVENT bridge. LangGraphAgent is mocked; indexedDB is stubbed for
 * the API-key lookup; jsdom lacks scrollIntoView, so it is stubbed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import Playbooks from './Playbooks.jsx';
import ChatBox from '../chat/ChatBox.jsx';
import { MCP_CONFIG_STORAGE_KEY } from '../../services/mcpConfig.js';

const mocks = vi.hoisted(() => ({
  testConnection: vi.fn(),
  processQuery: vi.fn(),
  probeLlmProvider: vi.fn(),
}));

vi.mock('../../services/langGraphAgent.js', () => ({
  __esModule: true,
  default: class {
    testConnection() { return mocks.testConnection(); }
    processQuery(...args) { return mocks.processQuery(...args); }
    clearHistory() {}
  },
  LLM_PROVIDERS: {
    OLLAMA: 'ollama',
    GEMINI: 'gemini',
    OPENROUTER: 'openrouter',
    OPENAI_COMPATIBLE: 'openai-compatible',
  },
}));

vi.mock('../../services/llmProbes.js', () => ({
  probeLlmProvider: (...args) => mocks.probeLlmProvider(...args),
}));

const WELCOME = /Welcome to the MITRE ATT&CK Intelligence Assistant/;
const SCENARIO_QUERY = "Explain what 'Spearphishing Attachment' is in simple terms";
const QUICK_QUERY = 'What is technique T1059?';

const rowOf = (text) => screen.getByText(text).parentElement;

describe('Playbooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.testConnection.mockResolvedValue(true);
    mocks.processQuery.mockResolvedValue('agent answer');
    mocks.probeLlmProvider.mockResolvedValue({ type: 'success', message: 'Ollama is running!' });
    localStorage.clear();
    // jsdom does not implement scrollIntoView.
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    // jsdom has no navigator.clipboard.
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue() },
      configurable: true,
    });
    // Minimal indexedDB stub: the key lookup resolves '' via onerror.
    vi.stubGlobal('indexedDB', {
      open: () => {
        const request = {};
        setTimeout(() => request.onerror?.(), 0);
        return request;
      },
    });
  });

  it('F-UX-011: clicking a scenario "Ask" places the query in the chat input and scrolls to the chat', async () => {
    render(<><Playbooks /><ChatBox /></>);
    const textarea = await screen.findByPlaceholderText('Ask about MITRE ATT&CK...');
    await screen.findByText(WELCOME);

    fireEvent.click(screen.getByRole('button', { name: /Beginner Guide/ }));
    fireEvent.click(within(rowOf(SCENARIO_QUERY)).getByRole('button', { name: 'Ask' }));

    expect(textarea.value).toBe(SCENARIO_QUERY);
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('clicking a quick-start "Ask" places the query in the chat input and scrolls to the chat', async () => {
    render(<><Playbooks /><ChatBox /></>);
    const textarea = await screen.findByPlaceholderText('Ask about MITRE ATT&CK...');
    await screen.findByText(WELCOME);

    fireEvent.click(within(rowOf(QUICK_QUERY)).getByRole('button', { name: 'Ask' }));

    expect(textarea.value).toBe(QUICK_QUERY);
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('Copy shows the same "Copied" feedback in scenario and quick-start rows', async () => {
    render(<Playbooks />);

    // Quick-start rows are visible with no scenario selected.
    fireEvent.click(within(rowOf(QUICK_QUERY)).getByRole('button', { name: 'Copy' }));
    expect(await within(rowOf(QUICK_QUERY)).findByText('Copied')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Beginner Guide/ }));
    fireEvent.click(within(rowOf(SCENARIO_QUERY)).getByRole('button', { name: 'Copy' }));
    expect(await within(rowOf(SCENARIO_QUERY)).findByText('Copied')).toBeTruthy();
    expect(screen.queryByText('OK')).toBeNull();
  });

  it('action buttons are always visible — no hover-gated opacity class', () => {
    render(<Playbooks />);
    for (const name of ['Ask', 'Copy']) {
      for (const button of screen.getAllByRole('button', { name })) {
        expect(button.className).not.toMatch(/opacity-0|group-hover/);
      }
    }
  });

  it('tip shows the configured server address, not a hard-coded one', async () => {
    localStorage.setItem(MCP_CONFIG_STORAGE_KEY, JSON.stringify({ host: '10.0.0.5', port: 9100 }));
    render(<Playbooks />);

    fireEvent.click(screen.getByRole('button', { name: /Beginner Guide/ }));

    expect(await screen.findByText(/10\.0\.0\.5:9100/)).toBeTruthy();
    expect(screen.queryByText(/localhost:8000/)).toBeNull();
  });

  it('tip falls back to the build defaults when no config is saved', async () => {
    render(<Playbooks />);

    fireEvent.click(screen.getByRole('button', { name: /Beginner Guide/ }));

    expect(await screen.findByText(/localhost:8000/)).toBeTruthy();
  });
});
