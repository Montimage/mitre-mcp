/**
 * Tests for the settings dialog (frontend/src/components/chat/ServerConfig.jsx).
 *
 * Regressions covered:
 *  - F-BUG-019 (#74): "Reset to Defaults" must notify the parent through
 *    onConfigChange with the defaults — wiping storage alone left the live
 *    agent on the old keys.
 *  - F-BUG-020 (#74): an empty or non-numeric port is rejected with a message
 *    and nothing is persisted.
 *  - F-BUG-033 (#74): a failed save surfaces an error instead of being
 *    swallowed.
 *  - F-UX-006 (#94): invalid fields show an inline message and block save.
 *  - F-UX-007 (#94): reset asks for confirmation; edits mark the form dirty.
 *
 * storage.js and llmProbes.js are mocked so no IndexedDB or network is needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ServerConfig from './ServerConfig.jsx';
import { saveApiKey, getApiKey, deleteApiKey } from '../../services/storage.js';
import { probeMcpServer } from '../../services/llmProbes.js';
import { MCP_CONFIG_STORAGE_KEY } from '../../services/mcpConfig.js';

vi.mock('../../services/storage.js', () => ({
  saveApiKey: vi.fn(),
  getApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
}));

vi.mock('../../services/llmProbes.js', () => ({
  probeMcpServer: vi.fn(),
  probeOllama: vi.fn(),
  probeGemini: vi.fn(),
  probeOpenRouter: vi.fn(),
}));

describe('ServerConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    saveApiKey.mockResolvedValue(undefined);
    getApiKey.mockResolvedValue('');
    deleteApiKey.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('reset calls onConfigChange with the defaults', async () => {
    const onConfigChange = vi.fn();
    render(<ServerConfig onConfigChange={onConfigChange} />);

    fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));

    await waitFor(() => expect(onConfigChange).toHaveBeenCalled());
    expect(onConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'localhost', port: 8000, llmProvider: 'ollama' })
    );
    expect(localStorage.getItem(MCP_CONFIG_STORAGE_KEY)).toBeNull();
    await waitFor(() => {
      expect(deleteApiKey).toHaveBeenCalledWith('geminiApiKey');
      expect(deleteApiKey).toHaveBeenCalledWith('openrouterApiKey');
    });
  });

  it('empty port is rejected with a message and nothing is saved', async () => {
    const onConfigChange = vi.fn();
    render(<ServerConfig onConfigChange={onConfigChange} />);

    fireEvent.change(screen.getByLabelText(/port/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /save & close/i }));

    expect(await screen.findByText(/port is required/i)).toBeTruthy();
    expect(onConfigChange).not.toHaveBeenCalled();
    expect(localStorage.getItem(MCP_CONFIG_STORAGE_KEY)).toBeNull();
    expect(saveApiKey).not.toHaveBeenCalled();
    expect(deleteApiKey).not.toHaveBeenCalled();
  });

  it('non-numeric port is rejected with a message and nothing is saved', async () => {
    const onConfigChange = vi.fn();
    render(<ServerConfig onConfigChange={onConfigChange} />);

    fireEvent.change(screen.getByLabelText(/port/i), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /save & close/i }));

    expect(await screen.findByText(/port must be a number/i)).toBeTruthy();
    expect(onConfigChange).not.toHaveBeenCalled();
    expect(localStorage.getItem(MCP_CONFIG_STORAGE_KEY)).toBeNull();
  });

  it('out-of-range port is rejected with a message and nothing is saved', async () => {
    const onConfigChange = vi.fn();
    render(<ServerConfig onConfigChange={onConfigChange} />);

    fireEvent.change(screen.getByLabelText(/port/i), { target: { value: '99999' } });
    fireEvent.click(screen.getByRole('button', { name: /save & close/i }));

    expect(await screen.findByText(/between 1 and 65535/i)).toBeTruthy();
    expect(onConfigChange).not.toHaveBeenCalled();
    expect(localStorage.getItem(MCP_CONFIG_STORAGE_KEY)).toBeNull();
  });

  it('a failed save surfaces an error to the user', async () => {
    saveApiKey.mockRejectedValue(new Error('idb unavailable'));
    const onConfigChange = vi.fn();
    render(<ServerConfig onConfigChange={onConfigChange} />);

    // Select Gemini and enter a key so the save path writes to IndexedDB.
    fireEvent.click(screen.getByRole('radio', { name: /google gemini/i }));
    fireEvent.change(screen.getByLabelText(/gemini api key/i), { target: { value: 'k-1' } });
    fireEvent.click(screen.getByRole('button', { name: /save & close/i }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/could not save|failed/i);
    expect(onConfigChange).not.toHaveBeenCalled();
  });

  it('empty host is rejected with an inline message and blocks save', async () => {
    const onConfigChange = vi.fn();
    render(<ServerConfig onConfigChange={onConfigChange} />);

    fireEvent.change(screen.getByLabelText(/^host$/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /save & close/i }));

    expect(await screen.findByText(/host is required/i)).toBeTruthy();
    expect(onConfigChange).not.toHaveBeenCalled();
    expect(localStorage.getItem(MCP_CONFIG_STORAGE_KEY)).toBeNull();
  });

  it('provider-specific required field blocks save with an inline message', async () => {
    const onConfigChange = vi.fn();
    render(<ServerConfig onConfigChange={onConfigChange} />);

    // Gemini selected without an API key → inline error, save blocked.
    fireEvent.click(screen.getByRole('radio', { name: /google gemini/i }));
    fireEvent.click(screen.getByRole('button', { name: /save & close/i }));

    expect(await screen.findByText(/api key is required/i)).toBeTruthy();
    expect(onConfigChange).not.toHaveBeenCalled();
  });

  it('reset asks for confirmation before wiping settings', async () => {
    window.confirm.mockReturnValue(false);
    const onConfigChange = vi.fn();
    render(<ServerConfig onConfigChange={onConfigChange} />);

    fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));

    expect(window.confirm).toHaveBeenCalled();
    // Declined → nothing wiped, nothing applied.
    await new Promise((r) => setTimeout(r, 10));
    expect(onConfigChange).not.toHaveBeenCalled();
    expect(deleteApiKey).not.toHaveBeenCalled();
  });

  it('reports dirty state through onDirtyChange when the form is edited', async () => {
    const onDirtyChange = vi.fn();
    render(<ServerConfig onConfigChange={vi.fn()} onDirtyChange={onDirtyChange} />);

    fireEvent.change(screen.getByLabelText(/^host$/i), { target: { value: 'example.com' } });

    await waitFor(() => expect(onDirtyChange).toHaveBeenCalledWith(true));
  });

  it('a failed agent rebuild reported by the parent surfaces the error inside the dialog', async () => {
    // F-UX-005 (#93): the parent rebuilds the agent before swapping the live
    // config; when the build fails it reports { ok: false } and the dialog
    // stays open with the cause shown in the alert region.
    const onConfigChange = vi.fn().mockResolvedValue({ ok: false, error: 'Gemini SDK failed to load' });
    render(<ServerConfig onConfigChange={onConfigChange} />);

    fireEvent.click(screen.getByRole('button', { name: /save & close/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Gemini SDK failed to load');
    expect(onConfigChange).toHaveBeenCalled();
  });

  it('a valid save persists config, clears dirty and notifies the parent', async () => {
    const onConfigChange = vi.fn();
    const onDirtyChange = vi.fn();
    render(<ServerConfig onConfigChange={onConfigChange} onDirtyChange={onDirtyChange} />);

    fireEvent.change(screen.getByLabelText(/port/i), { target: { value: '9000' } });
    fireEvent.click(screen.getByRole('button', { name: /save & close/i }));

    await waitFor(() => expect(onConfigChange).toHaveBeenCalled());
    expect(onConfigChange).toHaveBeenCalledWith(expect.objectContaining({ port: 9000 }));
    const saved = JSON.parse(localStorage.getItem(MCP_CONFIG_STORAGE_KEY));
    expect(saved.port).toBe(9000);
    expect(saved.geminiApiKey).toBe('');
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });

  describe('F-UX-008: feedback carries real semantics', () => {
    it('a failed connection probe announces itself as an alert with an icon', async () => {
      probeMcpServer.mockResolvedValue({ type: 'error', message: 'Connection failed. Check the server.' });
      render(<ServerConfig onConfigChange={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /test mcp connection/i }));

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('Connection failed');
      expect(alert.className).toContain('bg-red-50');
      expect(alert.querySelector('svg')).toBeTruthy();
    });

    it('a successful connection probe announces politely as a status with an icon', async () => {
      probeMcpServer.mockResolvedValue({ type: 'success', message: 'Connection successful!' });
      render(<ServerConfig onConfigChange={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /test mcp connection/i }));

      const status = await screen.findByRole('status');
      expect(status.textContent).toContain('Connection successful');
      expect(status.className).toContain('bg-green-50');
      expect(status.querySelector('svg')).toBeTruthy();
    });

    it('a failed save surfaces an alert that also carries an icon', async () => {
      saveApiKey.mockRejectedValue(new Error('idb unavailable'));
      render(<ServerConfig onConfigChange={vi.fn()} />);

      fireEvent.click(screen.getByRole('radio', { name: /google gemini/i }));
      fireEvent.change(screen.getByLabelText(/gemini api key/i), { target: { value: 'k-1' } });
      fireEvent.click(screen.getByRole('button', { name: /save & close/i }));

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toMatch(/could not save|failed/i);
      expect(alert.querySelector('svg')).toBeTruthy();
    });

    it('the reset confirmation banner reads as a polite status, not an alert', async () => {
      render(<ServerConfig onConfigChange={vi.fn().mockResolvedValue({ ok: true })} />);

      fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));

      const status = await screen.findByRole('status');
      expect(status.textContent).toContain('reset to defaults');
      expect(status.querySelector('svg')).toBeTruthy();
    });
  });

  describe('F-UX-018: provider fields', () => {
    it('the OpenRouter model is a single control — one input with manifest suggestions', () => {
      const { container } = render(<ServerConfig onConfigChange={vi.fn()} />);

      fireEvent.click(screen.getByRole('radio', { name: /openrouter/i }));

      const modelInput = screen.getByLabelText(/model id/i);
      expect(modelInput.tagName).toBe('INPUT');
      // One field owns the value — the old second "custom ID" input is gone.
      expect(container.querySelector('#openrouterModelCustom')).toBeNull();
      // The manifest options survive as suggestions on the same control.
      expect(modelInput.getAttribute('list')).toBe('openrouter-model-options');
      const options = container.querySelectorAll('#openrouter-model-options option');
      expect(options.length).toBeGreaterThanOrEqual(10);
      expect([...options].some((o) => o.value === 'anthropic/claude-sonnet-4')).toBe(true);

      fireEvent.change(modelInput, { target: { value: 'custom/model-x' } });
      expect(modelInput.value).toBe('custom/model-x');
    });

    it('makes no provider-only storage claim about API keys', () => {
      render(<ServerConfig onConfigChange={vi.fn()} />);

      fireEvent.click(screen.getByRole('radio', { name: /openrouter/i }));

      expect(screen.queryByText(/stored securely/i)).toBeNull();
      expect(screen.queryByText(/indexeddb/i)).toBeNull();
    });
  });
});
