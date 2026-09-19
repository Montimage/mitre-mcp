/**
 * ServerConfig Component
 *
 * Allows users to configure MCP server and LLM settings (Ollama, Gemini, or OpenRouter)
 *
 * Orchestrates the settings dialog: holds the form state and persistence, and
 * delegates the per-section UI to `config/` form components, the IndexedDB
 * reads/writes to `services/storage.js`, and the "test connection" network
 * calls to `services/llmProbes.js`.
 */
import { useState, useEffect } from 'react';
import { saveApiKey, getApiKey, deleteApiKey } from '../../services/storage.js';
import { probeMcpServer, probeOllama, probeGemini, probeOpenRouter } from '../../services/llmProbes.js';
import { DEFAULT_MCP_HOST, DEFAULT_MCP_PORT, MCP_CONFIG_STORAGE_KEY } from '../../services/mcpConfig.js';
import McpServerForm from './config/McpServerForm.jsx';
import OllamaForm from './config/OllamaForm.jsx';
import GeminiForm from './config/GeminiForm.jsx';
import OpenRouterForm from './config/OpenRouterForm.jsx';

const LLM_PROVIDERS = {
  OLLAMA: 'ollama',
  GEMINI: 'gemini',
  OPENROUTER: 'openrouter'
};

const DEFAULT_CONFIG = {
  host: DEFAULT_MCP_HOST,
  port: DEFAULT_MCP_PORT,
  llmProvider: LLM_PROVIDERS.OLLAMA,
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.1:8b',
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  openrouterApiKey: '',
  openrouterModel: 'anthropic/claude-3.5-sonnet'
};

export default function ServerConfig({ onConfigChange, initialConfig }) {
  const [config, setConfig] = useState({
    host: initialConfig?.host || DEFAULT_CONFIG.host,
    port: initialConfig?.port || DEFAULT_CONFIG.port,
    llmProvider: initialConfig?.llmProvider || DEFAULT_CONFIG.llmProvider,
    ollamaBaseUrl: initialConfig?.ollamaBaseUrl || DEFAULT_CONFIG.ollamaBaseUrl,
    ollamaModel: initialConfig?.ollamaModel || DEFAULT_CONFIG.ollamaModel,
    geminiApiKey: initialConfig?.geminiApiKey || DEFAULT_CONFIG.geminiApiKey,
    geminiModel: initialConfig?.geminiModel || DEFAULT_CONFIG.geminiModel,
    openrouterApiKey: initialConfig?.openrouterApiKey || DEFAULT_CONFIG.openrouterApiKey,
    openrouterModel: initialConfig?.openrouterModel || DEFAULT_CONFIG.openrouterModel
  });

  const [testing, setTesting] = useState(false);
  const [testingOllama, setTestingOllama] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [testingOpenRouter, setTestingOpenRouter] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [ollamaTestResult, setOllamaTestResult] = useState(null);
  const [geminiTestResult, setGeminiTestResult] = useState(null);
  const [openrouterTestResult, setOpenrouterTestResult] = useState(null);

  useEffect(() => {
    // Load saved config from localStorage
    const loadConfig = async () => {
      const saved = localStorage.getItem(MCP_CONFIG_STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);

          // Load API keys from IndexedDB
          const [geminiKey, openrouterKey] = await Promise.all([
            getApiKey('geminiApiKey').catch(() => ''),
            getApiKey('openrouterApiKey').catch(() => '')
          ]);

          setConfig({
            ...parsed,
            geminiApiKey: geminiKey || parsed.geminiApiKey || '',
            openrouterApiKey: openrouterKey || parsed.openrouterApiKey || ''
          });
        } catch (error) {
          console.error('Failed to load saved config:', error);
        }
      }
    };
    loadConfig();
  }, []);

  const handleChange = (field, value) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
  };

  const handleSave = async () => {
    setSaving(true);

    // Save API keys to IndexedDB (more secure than localStorage)
    try {
      if (config.geminiApiKey) {
        await saveApiKey('geminiApiKey', config.geminiApiKey);
      } else {
        await deleteApiKey('geminiApiKey');
      }
      if (config.openrouterApiKey) {
        await saveApiKey('openrouterApiKey', config.openrouterApiKey);
      } else {
        await deleteApiKey('openrouterApiKey');
      }
    } catch (error) {
      console.error('Failed to save API keys to IndexedDB:', error);
    }

    // Save config to localStorage (without API keys for security)
    const configToSave = {
      ...config,
      geminiApiKey: '', // Don't store API keys in localStorage
      openrouterApiKey: ''
    };
    localStorage.setItem(MCP_CONFIG_STORAGE_KEY, JSON.stringify(configToSave));

    // Notify parent component (with full config including API keys)
    if (onConfigChange) {
      onConfigChange(config);
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

  const handleReset = async () => {
    setConfig({ ...DEFAULT_CONFIG });
    localStorage.removeItem(MCP_CONFIG_STORAGE_KEY);

    // Clear API keys from IndexedDB
    try {
      await deleteApiKey('geminiApiKey');
      await deleteApiKey('openrouterApiKey');
    } catch (error) {
      console.error('Failed to delete API keys from IndexedDB:', error);
    }

    setTestResult({
      type: 'info',
      message: 'Configuration reset to defaults'
    });
    setTimeout(() => setTestResult(null), 3000);
  };

  return (
    <div className="bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        {/* MCP Server Configuration */}
        <McpServerForm
          config={config}
          onChange={handleChange}
          testing={testing}
          testResult={testResult}
          onTest={handleTestConnection}
        />

        {/* Divider */}
        <div className="border-t border-gray-300 my-6"></div>

        {/* LLM Configuration */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
            LLM Configuration
          </h3>

          {/* Provider Selection */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
              LLM Provider
            </label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="llmProvider"
                  value={LLM_PROVIDERS.OLLAMA}
                  checked={config.llmProvider === LLM_PROVIDERS.OLLAMA}
                  onChange={(e) => handleChange('llmProvider', e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm">Ollama (Local)</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="llmProvider"
                  value={LLM_PROVIDERS.GEMINI}
                  checked={config.llmProvider === LLM_PROVIDERS.GEMINI}
                  onChange={(e) => handleChange('llmProvider', e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm">Google Gemini</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="llmProvider"
                  value={LLM_PROVIDERS.OPENROUTER}
                  checked={config.llmProvider === LLM_PROVIDERS.OPENROUTER}
                  onChange={(e) => handleChange('llmProvider', e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm">OpenRouter</span>
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
            />
          )}
          {config.llmProvider === LLM_PROVIDERS.GEMINI && (
            <GeminiForm
              config={config}
              onChange={handleChange}
              testing={testingGemini}
              testResult={geminiTestResult}
              onTest={handleTestGemini}
            />
          )}
          {config.llmProvider === LLM_PROVIDERS.OPENROUTER && (
            <OpenRouterForm
              config={config}
              onChange={handleChange}
              testing={testingOpenRouter}
              testResult={openrouterTestResult}
              onTest={handleTestOpenRouter}
            />
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-300 my-6"></div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-black text-white text-xs font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none"
          >
            {saving ? 'Saving...' : 'Save & Close'}
          </button>

          <button
            onClick={handleReset}
            disabled={saving}
            className="px-4 py-2 bg-gray-300 text-gray-900 text-xs font-medium hover:bg-gray-400 disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors focus:outline-none"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
