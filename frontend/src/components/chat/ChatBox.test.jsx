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
 * LangGraphAgent is mocked (with a constructor that can be made to throw),
 * llmProbes.js is mocked so the provider probe outcome is controlled, and
 * storage.js is mocked for the API-key lookup.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ChatBox from './ChatBox.jsx';
import { MCP_CONFIG_STORAGE_KEY } from '../../services/mcpConfig.js';

const mocks = vi.hoisted(() => ({
  agents: [],
  testConnection: vi.fn(),
  processQuery: vi.fn(),
  constructorError: null,
  probeLlmProvider: vi.fn(),
  getApiKey: vi.fn(),
  saveApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
}));

vi.mock('../../services/langGraphAgent.js', () => ({
  __esModule: true,
  default: class {
    constructor(host, port, config) {
      if (mocks.constructorError) {
        throw mocks.constructorError;
      }
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

vi.mock('../../services/llmProbes.js', () => ({
  probeLlmProvider: (...args) => mocks.probeLlmProvider(...args),
}));

vi.mock('../../services/storage.js', () => ({
  getApiKey: (...args) => mocks.getApiKey(...args),
  saveApiKey: (...args) => mocks.saveApiKey(...args),
  deleteApiKey: (...args) => mocks.deleteApiKey(...args),
}));

const WELCOME = /Welcome to the MITRE ATT&CK Intelligence Assistant/;

const mcpStatusDot = (container) =>
  container.querySelector('div[title^="MCP Server:"] .rounded-full');

describe('ChatBox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.agents.length = 0;
    mocks.constructorError = null;
    mocks.testConnection.mockResolvedValue(true);
    mocks.processQuery.mockResolvedValue('agent answer');
    mocks.probeLlmProvider.mockResolvedValue({
      type: 'success',
      message: 'Ollama is running! Model "llama3.1:8b" is available.'
    });
    mocks.getApiKey.mockResolvedValue('');
    mocks.saveApiKey.mockResolvedValue(undefined);
    mocks.deleteApiKey.mockResolvedValue(undefined);
    localStorage.clear();
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

  it('F-UX-014: the settings modal is a labelled dialog and the close button has an accessible name', async () => {
    render(<ChatBox />);
    await screen.findByText(WELCOME);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    // Icon-only close control exposes an accessible name.
    expect(screen.getByRole('button', { name: /close settings/i })).toBeTruthy();
  });

  it('F-UX-014: Esc closes the dialog and focus returns to the Settings trigger', async () => {
    render(<ChatBox />);
    await screen.findByText(WELCOME);

    const trigger = screen.getByRole('button', { name: 'Settings' });
    fireEvent.click(trigger);
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('F-UX-014: the close button closes the dialog and focus returns to the trigger', async () => {
    render(<ChatBox />);
    await screen.findByText(WELCOME);

    const trigger = screen.getByRole('button', { name: 'Settings' });
    fireEvent.click(trigger);
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByRole('button', { name: /close settings/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('F-UX-007: closing the dialog with unsaved edits asks for confirmation first', async () => {
    render(<ChatBox />);
    await screen.findByText(WELCOME);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = await screen.findByRole('dialog');

    // Edit a field inside the dialog → the form reports dirty.
    const hostInput = dialog.querySelector('#host');
    fireEvent.change(hostInput, { target: { value: 'example.com' } });
    await waitFor(() => {});

    // Declining the confirm keeps the dialog open.
    window.confirm.mockReturnValueOnce(false);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(window.confirm).toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();

    // Accepting it discards the edits and closes.
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('F-UX-007: the Settings trigger also guards unsaved edits while the dialog is open', async () => {
    render(<ChatBox />);
    await screen.findByText(WELCOME);

    const trigger = screen.getByRole('button', { name: 'Settings' });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');

    // Make the form dirty, then click the trigger again — it must confirm.
    fireEvent.change(dialog.querySelector('#host'), { target: { value: 'example.com' } });
    await waitFor(() => {});

    window.confirm.mockReturnValueOnce(false);
    fireEvent.click(trigger);
    expect(window.confirm).toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();

    // Accepting discards the edits and the trigger toggles the dialog shut.
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('F-UX-014: clicking the backdrop closes the dialog through the same guard', async () => {
    render(<ChatBox />);
    await screen.findByText(WELCOME);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = await screen.findByRole('dialog');

    // A click on the flex backdrop (the dialog's parent) closes cleanly.
    fireEvent.click(dialog.parentElement);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('F-UX-014: the chat textarea has a label and the message list is aria-live', async () => {
    const { container } = render(<ChatBox />);
    await screen.findByText(WELCOME);

    expect(screen.getByLabelText(/chat message/i)).toBeTruthy();
    expect(container.querySelector('[aria-live="polite"]')).toBeTruthy();
  });

  it('F-UX-014: Tab is trapped inside the dialog — focus cycles within it', async () => {
    render(<ChatBox />);
    await screen.findByText(WELCOME);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = await screen.findByRole('dialog');
    const closeButton = screen.getByRole('button', { name: /close settings/i });
    const resetButton = screen.getByRole('button', { name: /reset to defaults/i });

    // Focus moved into the dialog on open.
    expect(document.activeElement).toBe(dialog);

    // Shift+Tab from the dialog container wraps to the last control — it must
    // not step backwards into the page behind the modal.
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(resetButton);

    // Tab past the last control wraps to the first.
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(closeButton);

    // Shift+Tab from the first control wraps back to the last.
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(resetButton);
  });

  it('F-UX-002: an unreachable provider is not "ready" — no welcome, a "not set up yet" state with a settings action', async () => {
    mocks.probeLlmProvider.mockResolvedValue({
      type: 'error',
      message: 'Cannot connect to Ollama: connection refused'
    });
    const { container } = render(<ChatBox />);

    // The "not set up yet" state names the cause and offers a settings action.
    expect(await screen.findByText(/not set up yet/)).toBeTruthy();
    expect(screen.getByText(/Cannot connect to Ollama/)).toBeTruthy();

    // The LLM dot is not green and the welcome message was never posted.
    await waitFor(() => {
      expect(container.querySelector('div[title="LLM: not-configured"]')).toBeTruthy();
    });
    expect(container.querySelector('div[title="LLM: ready"]')).toBeNull();
    expect(screen.queryByText(WELCOME)).toBeNull();

    // The settings action opens the dialog.
    fireEvent.click(screen.getByRole('button', { name: /open settings/i }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('F-UX-002: a reachable provider with an installed model asserts the ready state', async () => {
    const { container } = render(<ChatBox />);

    await screen.findByText(WELCOME);
    await waitFor(() => {
      expect(container.querySelector('div[title="LLM: ready"]')).toBeTruthy();
    });
    expect(screen.queryByText(/not set up yet/)).toBeNull();
    expect(mocks.probeLlmProvider).toHaveBeenCalled();
  });

  it('F-UX-004: a missing API key names the key and renders an "Open Settings" action', async () => {
    localStorage.setItem(MCP_CONFIG_STORAGE_KEY, JSON.stringify({ llmProvider: 'gemini' }));
    mocks.constructorError = new Error(
      'Gemini API key is required. Provide geminiApiKey in the settings dialog.'
    );
    render(<ChatBox />);

    // Init fails before any agent exists — the banner already names the cause.
    await screen.findByText(/not set up yet/);

    const textarea = await screen.findByPlaceholderText('Ask about MITRE ATT&CK...');
    fireEvent.change(textarea, { target: { value: 'list tactics' } });
    fireEvent.submit(textarea.closest('form'));

    // The error names the missing key — no "refresh the page" dead end.
    expect(await screen.findByText(/The agent is not set up:.*geminiApiKey/)).toBeTruthy();
    expect(screen.queryByText(/Please refresh the page/)).toBeNull();

    // An "Open Settings" action is rendered and opens the dialog.
    const openSettings = screen.getAllByRole('button', { name: /open settings/i });
    expect(openSettings.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(openSettings[openSettings.length - 1]);
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('F-UX-005: a failed agent rebuild keeps the dialog open, shows the error inside it, and leaves the badge unchanged', async () => {
    render(<ChatBox />);
    await screen.findByText(WELCOME);

    // The badge describes the live provider (Ollama default).
    expect(screen.getByText('Ollama: llama3.1:8b')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await screen.findByRole('dialog');

    // Pick Gemini with a key so validation passes, then make the rebuild fail.
    fireEvent.click(screen.getByRole('radio', { name: /google gemini/i }));
    fireEvent.change(screen.getByLabelText(/gemini api key/i), { target: { value: 'k-1' } });
    mocks.constructorError = new Error('Gemini SDK failed to load');
    fireEvent.click(screen.getByRole('button', { name: /save & close/i }));

    // The dialog stays open and shows the failure inside it.
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Gemini SDK failed to load');
    expect(screen.getByRole('dialog')).toBeTruthy();

    // The badge still names the live provider — not the failed selection.
    expect(screen.getByText('Ollama: llama3.1:8b')).toBeTruthy();
    expect(screen.queryByText(/Gemini:/)).toBeNull();

    // A successful rebuild still closes the dialog and swaps the badge.
    mocks.constructorError = null;
    fireEvent.click(screen.getByRole('button', { name: /save & close/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText(/Gemini:/)).toBeTruthy();
  });

  it('F-UX-003: reports setup status upward — a failed probe reports not-configured with the cause', async () => {
    const onSetupStatusChange = vi.fn();
    mocks.probeLlmProvider.mockResolvedValue({
      type: 'error',
      message: 'Cannot connect to Ollama: connection refused'
    });
    render(<ChatBox onSetupStatusChange={onSetupStatusChange} />);

    // The "not set up yet" banner proves the probe resolved as an error.
    await screen.findByText(/not set up yet/);
    await waitFor(() => {
      expect(onSetupStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          llm: 'not-configured',
          llmError: 'Cannot connect to Ollama: connection refused'
        })
      );
    });
  });

  it('F-UX-003: reports setup status upward — a successful probe reports ready', async () => {
    const onSetupStatusChange = vi.fn();
    render(<ChatBox onSetupStatusChange={onSetupStatusChange} />);

    await screen.findByText(WELCOME);
    await waitFor(() => {
      expect(onSetupStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({ llm: 'ready', llmError: null, mcp: 'connected' })
      );
    });
  });
});
