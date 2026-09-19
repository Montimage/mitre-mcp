/**
 * Tests for simulation mode in the chat container
 * (frontend/src/components/chat/ChatBox.jsx + services/simulation.js).
 *
 * Behaviour covered:
 *  - when the MCP probe reports the server unreachable, the chat opens in
 *    simulation mode: badged, banner-explained, and answering from the
 *    scripted demo without ever calling the agent;
 *  - a simulated tool trace is a plain system message, never a tool
 *    approval card — no resolver exists on this path to settle one;
 *  - an unscripted question gets the fallback, never an error bubble,
 *    because Retry would call a null agent;
 *  - a reachable server is untouched: no badge, no banner, real agent;
 *  - a failed agent construction is NOT simulation. That leaves the MCP
 *    status 'unknown', and the honest answer there names the LLM config
 *    problem rather than hiding it behind a demo (F-UX-004).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import ChatBox from './ChatBox.jsx';

const mocks = vi.hoisted(() => ({
  testConnection: vi.fn(),
  processQuery: vi.fn(),
  constructorError: null,
  probeLlmProvider: vi.fn(),
  getApiKey: vi.fn(),
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
    }
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

vi.mock('../../services/mcpClient.js', () => ({
  default: class {
    testConnection() { return Promise.resolve(true); }
    resetSession() {}
  },
}));

vi.mock('../../services/llmProbes.js', () => ({
  probeLlmProvider: (...args) => mocks.probeLlmProvider(...args),
  probeMcpServer: () => Promise.resolve({ type: 'success', message: 'ok' }),
}));

vi.mock('../../services/storage.js', () => ({
  getApiKey: (...args) => mocks.getApiKey(...args),
  saveApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
}));

// The scripted replay uses real timers for its two short pauses.
const SLOW = { timeout: 3000 };

const send = async (text) => {
  const textarea = await screen.findByPlaceholderText('Ask about MITRE ATT&CK...');
  fireEvent.change(textarea, { target: { value: text } });
  fireEvent.submit(textarea.closest('form'));
};

describe('ChatBox simulation mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.constructorError = null;
    mocks.testConnection.mockResolvedValue(false);
    mocks.processQuery.mockResolvedValue('agent answer');
    mocks.probeLlmProvider.mockResolvedValue({ type: 'error', message: 'Ollama is not running' });
    mocks.getApiKey.mockResolvedValue('');
    localStorage.clear();
  });

  it('opens in simulation mode when the server is unreachable', async () => {
    render(<ChatBox />);

    // The mode is stated three ways: an opening message, a persistent
    // badge, and a banner that says the answers are not live data.
    expect(await screen.findByText(/Simulation mode/, {}, SLOW)).toBeTruthy();
    expect(screen.getByText('Simulation')).toBeTruthy();
    expect(screen.getByText(/curated samples, not live ATT&CK data/)).toBeTruthy();
  });

  it('answers a scripted prompt from the demo without calling the agent', async () => {
    render(<ChatBox />);
    await screen.findByText(/Simulation mode/, {}, SLOW);

    await send('What is technique T1059?');

    expect(await screen.findByText(/Command and Scripting Interpreter/, {}, SLOW)).toBeTruthy();
    expect(mocks.processQuery).not.toHaveBeenCalled();
  });

  it('renders the tool trace as a labelled system message, not an approval card', async () => {
    render(<ChatBox />);
    await screen.findByText(/Simulation mode/, {}, SLOW);

    await send('What is technique T1059?');

    // Prefixed so it can never be read as a real call.
    expect(await screen.findByText(/Simulated · get_technique_by_id/, {}, SLOW)).toBeTruthy();
    // No approval card: nothing on this path could resolve one.
    expect(screen.queryByRole('button', { name: /Approve/ })).toBeNull();
  });

  it('falls back on an unscripted question — a suggestion, never an error bubble', async () => {
    render(<ChatBox />);
    await screen.findByText(/Simulation mode/, {}, SLOW);

    await send('Who won the 1998 world cup?');

    expect(await screen.findByText(/only a curated set of sample questions/, {}, SLOW)).toBeTruthy();
    // Retry would call the agent, which simulation mode does not have.
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the demo framing after Clear', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ChatBox />);
    await screen.findByText(/Simulation mode/, {}, SLOW);

    await send('What is technique T1059?');
    await screen.findByText(/Command and Scripting Interpreter/, {}, SLOW);

    fireEvent.click(screen.getByText('Clear'));

    expect(await screen.findByText(/Simulation mode/, {}, SLOW)).toBeTruthy();
    expect(screen.queryByText(/Command and Scripting Interpreter/)).toBeNull();
  });

  it('does not simulate when the server is reachable', async () => {
    mocks.testConnection.mockResolvedValue(true);
    mocks.probeLlmProvider.mockResolvedValue({ type: 'success', message: 'ready' });
    render(<ChatBox />);

    await screen.findByText(/Welcome to the MITRE ATT&CK Intelligence Assistant/, {}, SLOW);
    expect(screen.queryByText('Simulation')).toBeNull();
    expect(screen.queryByText(/curated samples/)).toBeNull();

    await send('What is technique T1059?');

    expect(await screen.findByText('agent answer', {}, SLOW)).toBeTruthy();
    expect(mocks.processQuery).toHaveBeenCalled();
  });

  it('still welcomes normally when the LLM works but the server is down', async () => {
    mocks.probeLlmProvider.mockResolvedValue({ type: 'success', message: 'ready' });
    render(<ChatBox />);

    // Both notices: the provider answered, and the data source did not.
    expect(
      await screen.findByText(/Welcome to the MITRE ATT&CK Intelligence Assistant/, {}, SLOW)
    ).toBeTruthy();
    expect(screen.getByText(/Simulation mode/)).toBeTruthy();
  });

  it('announces the switch back to live data when a server is connected', async () => {
    render(<ChatBox />);
    await screen.findByText(/Simulation mode/, {}, SLOW);
    await send('What is technique T1059?');
    await screen.findByText(/Command and Scripting Interpreter/, {}, SLOW);

    // The new config reaches a reachable server.
    mocks.testConnection.mockResolvedValue(true);
    mocks.probeLlmProvider.mockResolvedValue({ type: 'success', message: 'ready' });

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(dialog.querySelector('#host'), { target: { value: 'attack.example' } });
    fireEvent.click(within(dialog).getByText('Save & Close'));

    // The transcript is marked, so the demo answers above cannot be taken
    // for live results.
    expect(
      await screen.findByText(/Everything above this line was a simulated sample/, {}, SLOW)
    ).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Simulation')).toBeNull());
  });

  it('F-UX-004 boundary: a failed agent build names the config problem, it does not simulate', async () => {
    mocks.constructorError = new Error('Gemini API key is required. Provide geminiApiKey in the settings dialog.');
    render(<ChatBox />);

    // Construction threw before any MCP probe ran, so the status is
    // 'unknown' — not a missing server, and not simulation.
    expect(await screen.findByText(/not set up yet/, {}, SLOW)).toBeTruthy();
    expect(screen.queryByText('Simulation')).toBeNull();

    await send('What is technique T1059?');

    expect(await screen.findByText(/The agent is not set up:.*geminiApiKey/, {}, SLOW)).toBeTruthy();
  });
});
