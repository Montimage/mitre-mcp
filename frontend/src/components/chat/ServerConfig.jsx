/**
 * ServerConfig Component
 *
 * Allows users to configure MCP server and LLM settings (Ollama, Gemini, OpenRouter, or an OpenAI-compatible endpoint)
 *
 * Orchestrates the settings dialog: holds the form state and persistence, and
 * delegates the per-section UI to `config/` form components, the IndexedDB
 * reads/writes to `services/storage.js`, and the "test connection" network
 * calls to `services/llmProbes.js`.
 *
 * Fields are validated inline: invalid input renders a per-field message and
 * blocks the save. "Reset to Defaults" is destructive — it asks for
 * confirmation, then notifies the parent with the defaults so the live agent
 * drops the old keys. `onDirtyChange` reports whether the form diverges from
 * the last persisted snapshot so the host can warn on close.
 */
import { useState, useEffect, useRef } from 'react';
import { saveApiKey, getApiKey, deleteApiKey } from '../../services/storage.js';
import { probeMcpServer, probeOllama, probeGemini, probeOpenRouter, probeOpenAiCompatible } from '../../services/llmProbes.js';
import { DEFAULT_MCP_HOST, DEFAULT_MCP_PORT, MCP_CONFIG_STORAGE_KEY } from '../../services/mcpConfig.js';
import { DEFAULT_OLLAMA_BASE_URL, DEFAULT_OLLAMA_MODEL } from '../../services/llmProviders.js';
import McpServerForm from './config/McpServerForm.jsx';
import StatusBanner from './config/StatusBanner.jsx';
import OllamaForm from './config/OllamaForm.jsx';
import GeminiForm from './config/GeminiForm.jsx';
import OpenRouterForm from './config/OpenRouterForm.jsx';
import OpenAICompatibleForm from './config/OpenAICompatibleForm.jsx';

const LLM_PROVIDERS = {
  OLLAMA: 'ollama',
  GEMINI: 'gemini',
  OPENROUTER: 'openrouter',
  OPENAI_COMPATIBLE: 'openai-compatible'
};

const DEFAULT_CONFIG = {
  host: DEFAULT_MCP_HOST,
  port: DEFAULT_MCP_PORT,
  llmProvider: LLM_PROVIDERS.OLLAMA,
  ollamaBaseUrl: DEFAULT_OLLAMA_BASE_URL,
  ollamaModel: DEFAULT_OLLAMA_MODEL,
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  openrouterApiKey: '',
  openrouterModel: 'anthropic/claude-3.5-sonnet',
  openaiCompatibleApiKey: '',
  openaiCompatibleBaseUrl: '',
  openaiCompatibleModel: ''
};

const CONFIG_KEYS = Object.keys(DEFAULT_CONFIG);

/**
 * Validate the form. Returns a map of field -> message; empty means valid.
 * Only the fields of the selected provider are checked — a hidden Ollama URL
 * must not block a Gemini save.
 */
const validateConfig = (cfg) => {
  const errors = {};

  const host = String(cfg.host ?? '').trim();
  if (!host) {
    errors.host = 'Host is required.';
  } else if (/^https?:\/\//i.test(host)) {
    try {
      void new URL(host);
    } catch {
      errors.host = 'Enter a valid server URL (e.g. https://mcp.example.com/mcp).';
    }
  } else if (!/^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(host)) {
    errors.host = 'Enter a valid hostname or URL.';
  }

  const portText = String(cfg.port ?? '').trim();
  if (!portText) {
    errors.port = 'Port is required.';
  } else if (!/^\d+$/.test(portText)) {
    errors.port = 'Port must be a number.';
  } else {
    const portNum = parseInt(portText, 10);
    if (portNum < 1 || portNum > 65535) {
      errors.port = 'Port must be between 1 and 65535.';
    }
  }

  if (cfg.llmProvider === LLM_PROVIDERS.OLLAMA) {
    const url = String(cfg.ollamaBaseUrl ?? '').trim();
    if (!url) {
      errors.ollamaBaseUrl = 'Ollama server URL is required.';
    } else {
      try {
        void new URL(url);
      } catch {
        errors.ollamaBaseUrl = 'Enter a valid URL (e.g. http://localhost:11434).';
      }
    }
  }
  if (cfg.llmProvider === LLM_PROVIDERS.GEMINI && !String(cfg.geminiApiKey ?? '').trim()) {
    errors.geminiApiKey = 'Gemini API key is required when Gemini is selected.';
  }
  if (cfg.llmProvider === LLM_PROVIDERS.OPENROUTER && !String(cfg.openrouterApiKey ?? '').trim()) {
    errors.openrouterApiKey = 'OpenRouter API key is required when OpenRouter is selected.';
  }
  if (cfg.llmProvider === LLM_PROVIDERS.OPENAI_COMPATIBLE) {
    // Endpoint URL and model are required; the API key is intentionally NOT —
    // plenty of OpenAI-compatible servers (LM Studio, llama.cpp) run keyless.
    const endpoint = String(cfg.openaiCompatibleBaseUrl ?? '').trim();
    if (!endpoint) {
      errors.openaiCompatibleBaseUrl = 'Endpoint URL is required.';
    } else {
      try {
        void new URL(endpoint);
      } catch {
        errors.openaiCompatibleBaseUrl = 'Enter a valid URL (e.g. http://localhost:1234/v1).';
      }
    }
    if (!String(cfg.openaiCompatibleModel ?? '').trim()) {
      errors.openaiCompatibleModel = 'Model name is required.';
    }
  }

  return errors;
};

export default function ServerConfig({ onConfigChange, onDirtyChange, initialConfig }) {
  const [config, setConfig] = useState({
    host: initialConfig?.host || DEFAULT_CONFIG.host,
    port: initialConfig?.port || DEFAULT_CONFIG.port,
    llmProvider: initialConfig?.llmProvider || DEFAULT_CONFIG.llmProvider,
    ollamaBaseUrl: initialConfig?.ollamaBaseUrl || DEFAULT_CONFIG.ollamaBaseUrl,
    ollamaModel: initialConfig?.ollamaModel || DEFAULT_CONFIG.ollamaModel,
    geminiApiKey: initialConfig?.geminiApiKey || DEFAULT_CONFIG.geminiApiKey,
    geminiModel: initialConfig?.geminiModel || DEFAULT_CONFIG.geminiModel,
    openrouterApiKey: initialConfig?.openrouterApiKey || DEFAULT_CONFIG.openrouterApiKey,
    openrouterModel: initialConfig?.openrouterModel || DEFAULT_CONFIG.openrouterModel,
    openaiCompatibleApiKey: initialConfig?.openaiCompatibleApiKey || DEFAULT_CONFIG.openaiCompatibleApiKey,
    openaiCompatibleBaseUrl: initialConfig?.openaiCompatibleBaseUrl || DEFAULT_CONFIG.openaiCompatibleBaseUrl,
    openaiCompatibleModel: initialConfig?.openaiCompatibleModel || DEFAULT_CONFIG.openaiCompatibleModel
  });

  const [testing, setTesting] = useState(false);
  const [testingOllama, setTestingOllama] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [testingOpenRouter, setTestingOpenRouter] = useState(false);
  const [testingOpenAiCompatible, setTestingOpenAiCompatible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [ollamaTestResult, setOllamaTestResult] = useState(null);
  const [geminiTestResult, setGeminiTestResult] = useState(null);
  const [openrouterTestResult, setOpenrouterTestResult] = useState(null);
  const [openaiCompatibleTestResult, setOpenaiCompatibleTestResult] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saveError, setSaveError] = useState(null);

  // The last persisted form values — dirty tracking compares against this.
  const snapshotRef = useRef({ ...config });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    // Load saved config from localStorage
    const loadConfig = async () => {
      const saved = localStorage.getItem(MCP_CONFIG_STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);

          // Load API keys from IndexedDB
          const [geminiKey, openrouterKey, openaiCompatibleKey] = await Promise.all([
            getApiKey('geminiApiKey').catch(() => ''),
            getApiKey('openrouterApiKey').catch(() => ''),
            getApiKey('openaiCompatibleApiKey').catch(() => '')
          ]);

          const loaded = {
            ...parsed,
            geminiApiKey: geminiKey || parsed.geminiApiKey || '',
            openrouterApiKey: openrouterKey || parsed.openrouterApiKey || '',
            openaiCompatibleApiKey: openaiCompatibleKey || parsed.openaiCompatibleApiKey || ''
          };
          // Persisted state is the clean baseline — loading it is not an edit.
          // Merge over the defaults so a partial saved config never leaves a
          // controlled input's value undefined.
          snapshotRef.current = { ...DEFAULT_CONFIG, ...loaded };
          setConfig({ ...DEFAULT_CONFIG, ...loaded });
        } catch (error) {
          console.error('Failed to load saved config:', error);
        }
      }
    };
    loadConfig();
  }, []);

  // Dirty = any tracked field differs from the last persisted snapshot.
  useEffect(() => {
    const snap = snapshotRef.current;
    setDirty(CONFIG_KEYS.some((key) => config[key] !== snap[key]));
  }, [config]);

  // Report dirty transitions to the host (it warns when closing with edits).
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const handleChange = (field, value) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    // Editing a field clears its inline error so the message does not linger.
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    const errors = validateConfig(config);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return; // inline messages block the save — nothing is persisted
    }

    setSaving(true);

    const cleanConfig = {
      ...config,
      host: String(config.host).trim(),
      port: parseInt(String(config.port).trim(), 10)
    };

    try {
      // Save API keys to IndexedDB (more secure than localStorage)
      if (cleanConfig.geminiApiKey) {
        await saveApiKey('geminiApiKey', cleanConfig.geminiApiKey);
      } else {
        await deleteApiKey('geminiApiKey');
      }
      if (cleanConfig.openrouterApiKey) {
        await saveApiKey('openrouterApiKey', cleanConfig.openrouterApiKey);
      } else {
        await deleteApiKey('openrouterApiKey');
      }
      if (cleanConfig.openaiCompatibleApiKey) {
        await saveApiKey('openaiCompatibleApiKey', cleanConfig.openaiCompatibleApiKey);
      } else {
        await deleteApiKey('openaiCompatibleApiKey');
      }

      // Save config to localStorage (without API keys for security)
      const configToSave = {
        ...cleanConfig,
        geminiApiKey: '', // Don't store API keys in localStorage
        openrouterApiKey: '',
        openaiCompatibleApiKey: ''
      };
      localStorage.setItem(MCP_CONFIG_STORAGE_KEY, JSON.stringify(configToSave));
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveError('Could not save settings. Check that browser storage is available and try again.');
      setSaving(false);
      return;
    }

    snapshotRef.current = { ...cleanConfig };
    // Reflect the persisted (trimmed/coerced) values so dirty tracking
    // compares like with like.
    setConfig(cleanConfig);
    setDirty(false);

    // Notify parent component (with full config including API keys).
    // The parent rebuilds the agent first and reports back — a failed build
    // keeps this dialog open with the cause shown here instead of closing
    // over a silently-broken swap (F-UX-005).
    if (onConfigChange) {
      try {
        const result = await onConfigChange(cleanConfig);
        if (result && result.ok === false) {
          setSaveError(`Could not apply the new settings: ${result.error || 'agent rebuild failed'}`);
          setSaving(false);
          return;
        }
      } catch (error) {
        setSaveError(`Could not apply the new settings: ${error.message}`);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
  };

  // Run a probe, toggling its `testing` flag and storing its result object.
  const runProbe = async (probe, setTestingFlag, setResult) => {
    setTestingFlag(true);
    setResult(null);
    try {
      setResult(await probe(config));
    } finally {
      setTestingFlag(false);
    }
  };

  const handleTestConnection = () => runProbe(probeMcpServer, setTesting, setTestResult);
  const handleTestOllama = () => runProbe(probeOllama, setTestingOllama, setOllamaTestResult);
  const handleTestGemini = () => runProbe(probeGemini, setTestingGemini, setGeminiTestResult);
  const handleTestOpenRouter = () => runProbe(probeOpenRouter, setTestingOpenRouter, setOpenrouterTestResult);
  const handleTestOpenAiCompatible = () => runProbe(probeOpenAiCompatible, setTestingOpenAiCompatible, setOpenaiCompatibleTestResult);

  const handleReset = async () => {
    // Destructive: wipes stored API keys and saved config — confirm first.
    if (!window.confirm('Reset all settings to defaults? This removes the saved API keys and cannot be undone.')) {
      return;
    }

    setConfig({ ...DEFAULT_CONFIG });
    localStorage.removeItem(MCP_CONFIG_STORAGE_KEY);

    // Clear API keys from IndexedDB
    try {
      await deleteApiKey('geminiApiKey');
      await deleteApiKey('openrouterApiKey');
      await deleteApiKey('openaiCompatibleApiKey');
    } catch (error) {
      console.error('Failed to delete API keys from IndexedDB:', error);
    }

    snapshotRef.current = { ...DEFAULT_CONFIG };
    setDirty(false);
    setFieldErrors({});
    setSaveError(null);

    // The live agent must drop the old keys — apply the defaults, not just
    // the wiped storage (F-BUG-019). A failed rebuild surfaces inside the
    // dialog the same way a failed save does (F-UX-005).
    if (onConfigChange) {
      try {
        const result = await onConfigChange({ ...DEFAULT_CONFIG });
        if (result && result.ok === false) {
          setSaveError(`Could not apply the defaults: ${result.error || 'agent rebuild failed'}`);
          return;
        }
      } catch (error) {
        setSaveError(`Could not apply the defaults: ${error.message}`);
        return;
      }
    }

    setTestResult({
      type: 'info',
      message: 'Configuration reset to defaults'
    });
    setTimeout(() => setTestResult(null), 3000);
  };

  return (
    <div className="bg-paper-card p-6 sm:p-8">
      <div className="max-w-3xl mx-auto">
        {/* MCP Server Configuration */}
        <McpServerForm
          config={config}
          onChange={handleChange}
          testing={testing}
          testResult={testResult}
          onTest={handleTestConnection}
          errors={fieldErrors}
        />

        {/* Divider */}
        <div className="border-t border-rule my-8"></div>

        {/* LLM Configuration */}
        <div className="mb-6">
          <h3 className="dossier-section mb-4">
            LLM Configuration
          </h3>

          {/* Provider Selection */}
          <div className="mb-4">
            <label className="mb-2.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">
              LLM Provider
            </label>
            <div className="flex flex-wrap gap-2">
              <label className="flex cursor-pointer items-center border border-rule-strong px-3 py-2 transition-colors hover:border-ink has-checked:border-ink has-checked:bg-paper-sunk">
                <input
                  type="radio"
                  name="llmProvider"
                  value={LLM_PROVIDERS.OLLAMA}
                  checked={config.llmProvider === LLM_PROVIDERS.OLLAMA}
                  onChange={(e) => handleChange('llmProvider', e.target.value)}
                  className="mr-2 accent-brass-700"
                />
                <span className="text-sm text-gray-700">Ollama (Local)</span>
              </label>
              <label className="flex cursor-pointer items-center border border-rule-strong px-3 py-2 transition-colors hover:border-ink has-checked:border-ink has-checked:bg-paper-sunk">
                <input
                  type="radio"
                  name="llmProvider"
                  value={LLM_PROVIDERS.GEMINI}
                  checked={config.llmProvider === LLM_PROVIDERS.GEMINI}
                  onChange={(e) => handleChange('llmProvider', e.target.value)}
                  className="mr-2 accent-brass-700"
                />
                <span className="text-sm text-gray-700">Google Gemini</span>
              </label>
              <label className="flex cursor-pointer items-center border border-rule-strong px-3 py-2 transition-colors hover:border-ink has-checked:border-ink has-checked:bg-paper-sunk">
                <input
                  type="radio"
                  name="llmProvider"
                  value={LLM_PROVIDERS.OPENROUTER}
                  checked={config.llmProvider === LLM_PROVIDERS.OPENROUTER}
                  onChange={(e) => handleChange('llmProvider', e.target.value)}
                  className="mr-2 accent-brass-700"
                />
                <span className="text-sm text-gray-700">OpenRouter</span>
              </label>
              <label className="flex cursor-pointer items-center border border-rule-strong px-3 py-2 transition-colors hover:border-ink has-checked:border-ink has-checked:bg-paper-sunk">
                <input
                  type="radio"
                  name="llmProvider"
                  value={LLM_PROVIDERS.OPENAI_COMPATIBLE}
                  checked={config.llmProvider === LLM_PROVIDERS.OPENAI_COMPATIBLE}
                  onChange={(e) => handleChange('llmProvider', e.target.value)}
                  className="mr-2 accent-brass-700"
                />
                <span className="text-sm text-gray-700">OpenAI-compatible</span>
              </label>
            </div>
          </div>

          {/* Per-provider Configuration */}
          {config.llmProvider === LLM_PROVIDERS.OLLAMA && (
            <OllamaForm
              config={config}
              onChange={handleChange}
              testing={testingOllama}
              testResult={ollamaTestResult}
              onTest={handleTestOllama}
              errors={fieldErrors}
            />
          )}
          {config.llmProvider === LLM_PROVIDERS.GEMINI && (
            <GeminiForm
              config={config}
              onChange={handleChange}
              testing={testingGemini}
              testResult={geminiTestResult}
              onTest={handleTestGemini}
              errors={fieldErrors}
            />
          )}
          {config.llmProvider === LLM_PROVIDERS.OPENROUTER && (
            <OpenRouterForm
              config={config}
              onChange={handleChange}
              testing={testingOpenRouter}
              testResult={openrouterTestResult}
              onTest={handleTestOpenRouter}
              errors={fieldErrors}
            />
          )}
          {config.llmProvider === LLM_PROVIDERS.OPENAI_COMPATIBLE && (
            <OpenAICompatibleForm
              config={config}
              onChange={handleChange}
              testing={testingOpenAiCompatible}
              testResult={openaiCompatibleTestResult}
              onTest={handleTestOpenAiCompatible}
              errors={fieldErrors}
            />
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-rule my-8"></div>

        {/* Save Error — same alert+icon treatment as the probe banners (F-UX-008) */}
        <StatusBanner result={saveError ? { type: 'error', message: saveError } : null} />

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-black px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {saving ? 'Saving...' : 'Save & Close'}
          </button>

          <button
            onClick={handleReset}
            disabled={saving}
            className="border border-rule-strong bg-paper-card px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-gray-600 transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:text-gray-400"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
