/**
 * ServerConfig Component
 *
 * Allows users to configure MCP server and LLM settings (Ollama, Gemini, or OpenRouter)
 */
import { useState, useEffect } from 'react';

const LLM_PROVIDERS = {
  OLLAMA: 'ollama',
  GEMINI: 'gemini',
  OPENROUTER: 'openrouter'
};

// IndexedDB helper functions for secure API key storage
const DB_NAME = 'mitre-mcp-config';
const DB_VERSION = 1;
const STORE_NAME = 'api-keys';

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

const saveApiKey = async (keyName, value) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ id: keyName, value });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

const getApiKey = async (keyName) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(keyName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result?.value || '');
  });
};

const deleteApiKey = async (keyName) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(keyName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export default function ServerConfig({ onConfigChange, initialConfig }) {
  const [config, setConfig] = useState({
    host: initialConfig?.host || 'localhost',
    port: initialConfig?.port || 8000,
    llmProvider: initialConfig?.llmProvider || LLM_PROVIDERS.OLLAMA,
    ollamaBaseUrl: initialConfig?.ollamaBaseUrl || 'http://localhost:11434',
    ollamaModel: initialConfig?.ollamaModel || 'llama3.1:8b',
    geminiApiKey: initialConfig?.geminiApiKey || '',
    geminiModel: initialConfig?.geminiModel || 'gemini-2.5-flash',
    openrouterApiKey: initialConfig?.openrouterApiKey || '',
    openrouterModel: initialConfig?.openrouterModel || 'anthropic/claude-3.5-sonnet'
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
      const saved = localStorage.getItem('mcp-server-config');
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
      }
      if (config.openrouterApiKey) {
        await saveApiKey('openrouterApiKey', config.openrouterApiKey);
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
    localStorage.setItem('mcp-server-config', JSON.stringify(configToSave));

    // Notify parent component (with full config including API keys)
    if (onConfigChange) {
      onConfigChange(config);
    }

    setSaving(false);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      console.log('[ServerConfig] Testing MCP connection with:', config);

      // Dynamically import to avoid issues if not yet installed
      const { default: MitreMCPClient } = await import('../../services/mcpClient.js');

      const client = new MitreMCPClient(config.host, config.port);
      console.log('[ServerConfig] Client created, testing connection...');

      const success = await client.testConnection();

      if (success) {
        setTestResult({
          type: 'success',
          message: 'Connection successful! MCP server is responding.'
        });
      } else {
        setTestResult({
          type: 'error',
          message: 'Connection failed. Please check server address and ensure mitre-mcp is running.'
        });
      }
    } catch (error) {
      console.error('[ServerConfig] Connection test error:', error);
      setTestResult({
        type: 'error',
        message: `Connection error: ${error.message}\n\nCheck browser console for details.`
      });
    } finally {
      setTesting(false);
    }
  };

  const handleTestOllama = async () => {
    setTestingOllama(true);
    setOllamaTestResult(null);

    try {
      console.log('[ServerConfig] Testing Ollama connection:', config.ollamaBaseUrl);

      // Use proxy in dev mode for default localhost:11434 to avoid CORS
      const isDefaultOllama = config.ollamaBaseUrl === 'http://localhost:11434';
      const ollamaUrl = (import.meta.env.DEV && isDefaultOllama)
        ? '/ollama/api/tags'
        : `${config.ollamaBaseUrl}/api/tags`;

      console.log('[ServerConfig] Fetching from:', ollamaUrl);

      // Test if Ollama is running by fetching tags
      const response = await fetch(ollamaUrl);

      if (!response.ok) {
        throw new Error(`Ollama server returned ${response.status}`);
      }

      const data = await response.json();
      console.log('[ServerConfig] Ollama models:', data.models);

      // Check if the configured model exists
      const modelExists = data.models?.some(m => m.name === config.ollamaModel);

      if (modelExists) {
        setOllamaTestResult({
          type: 'success',
          message: `Ollama is running! Model "${config.ollamaModel}" is available.`
        });
      } else {
        const availableModels = data.models?.map(m => m.name).join(', ') || 'none';
        setOllamaTestResult({
          type: 'error',
          message: `Model "${config.ollamaModel}" not found. Available models: ${availableModels}\n\nRun: ollama pull ${config.ollamaModel}`
        });
      }
    } catch (error) {
      console.error('[ServerConfig] Ollama test error:', error);
      setOllamaTestResult({
        type: 'error',
        message: `Cannot connect to Ollama: ${error.message}\n\nMake sure Ollama is running: ollama serve`
      });
    } finally {
      setTestingOllama(false);
    }
  };

  const handleTestGemini = async () => {
    setTestingGemini(true);
    setGeminiTestResult(null);

    try {
      const apiKey = config.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY;

      if (!apiKey) {
        setGeminiTestResult({
          type: 'error',
          message: 'Gemini API key is required. Enter it above or set VITE_GEMINI_API_KEY in .env file.'
        });
        return;
      }

      console.log('[ServerConfig] Testing Gemini connection...');

      // Test Gemini API by listing models
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `API returned ${response.status}`);
      }

      const data = await response.json();
      console.log('[ServerConfig] Gemini models:', data.models);

      // Check if the configured model exists
      const modelExists = data.models?.some(m => m.name.includes(config.geminiModel.replace('gemini-', '')));

      if (modelExists) {
        setGeminiTestResult({
          type: 'success',
          message: `Gemini API is working! Model "${config.geminiModel}" is available.`
        });
      } else {
        const availableModels = data.models?.map(m => m.name.split('/').pop()).join(', ') || 'none';
        setGeminiTestResult({
          type: 'error',
          message: `Model "${config.geminiModel}" not found. Available models: ${availableModels}`
        });
      }
    } catch (error) {
      console.error('[ServerConfig] Gemini test error:', error);
      setGeminiTestResult({
        type: 'error',
        message: `Cannot connect to Gemini API: ${error.message}\n\nMake sure your API key is valid.`
      });
    } finally {
      setTestingGemini(false);
    }
  };

  const handleTestOpenRouter = async () => {
    setTestingOpenRouter(true);
    setOpenrouterTestResult(null);

    try {
      const apiKey = config.openrouterApiKey || import.meta.env.VITE_OPENROUTER_API_KEY;

      if (!apiKey) {
        setOpenrouterTestResult({
          type: 'error',
          message: 'OpenRouter API key is required. Enter it above or set VITE_OPENROUTER_API_KEY in .env file.'
        });
        return;
      }

      console.log('[ServerConfig] Testing OpenRouter connection...');

      // Test OpenRouter API by fetching models
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'MITRE MCP Chat'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `API returned ${response.status}`);
      }

      const data = await response.json();
      console.log('[ServerConfig] OpenRouter models count:', data.data?.length);

      // Check if the configured model exists
      const modelExists = data.data?.some(m => m.id === config.openrouterModel);

      if (modelExists) {
        setOpenrouterTestResult({
          type: 'success',
          message: `OpenRouter API is working! Model "${config.openrouterModel}" is available.`
        });
      } else {
        setOpenrouterTestResult({
          type: 'error',
          message: `Model "${config.openrouterModel}" not found. Please check the model ID on openrouter.ai/models`
        });
      }
    } catch (error) {
      console.error('[ServerConfig] OpenRouter test error:', error);
      setOpenrouterTestResult({
        type: 'error',
        message: `Cannot connect to OpenRouter API: ${error.message}\n\nMake sure your API key is valid.`
      });
    } finally {
      setTestingOpenRouter(false);
    }
  };

  const handleReset = async () => {
    const defaultConfig = {
      host: 'localhost',
      port: 8000,
      llmProvider: LLM_PROVIDERS.OLLAMA,
      ollamaBaseUrl: 'http://localhost:11434',
      ollamaModel: 'llama3.1:8b',
      geminiApiKey: '',
      geminiModel: 'gemini-2.5-flash',
      openrouterApiKey: '',
      openrouterModel: 'anthropic/claude-3.5-sonnet'
    };
    setConfig(defaultConfig);
    localStorage.removeItem('mcp-server-config');

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
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
            MCP Server Configuration
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Host Input */}
            <div>
              <label htmlFor="host" className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                Host
              </label>
              <input
                id="host"
                type="text"
                value={config.host}
                onChange={(e) => handleChange('host', e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 focus:outline-none focus:border-black text-sm"
                placeholder="localhost"
              />
            </div>

            {/* Port Input */}
            <div>
              <label htmlFor="port" className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                Port
              </label>
              <input
                id="port"
                type="number"
                value={config.port}
                onChange={(e) => handleChange('port', parseInt(e.target.value))}
                className="w-full px-3 py-2 border-2 border-gray-300 focus:outline-none focus:border-black text-sm"
                placeholder="8000"
                min="1"
                max="65535"
              />
            </div>
          </div>

          {/* Connection URL Preview */}
          <div className="mb-4 space-y-2">
            <p className="text-xs text-gray-600">
              <span className="font-medium">Server URL:</span>{' '}
              <code className="bg-white px-2 py-1 border border-gray-300 text-xs font-mono">
                http://{config.host}:{config.port}/mcp
              </code>
            </p>
            {config.host === 'localhost' && config.port === 8000 && (
              <p className="text-xs text-green-700">
                <span className="font-medium">Note:</span> Using Vite proxy (/mcp) to avoid CORS issues
              </p>
            )}
          </div>

          {/* Status Message */}
          {testResult && (
            <div
              className={`mb-4 p-3 text-xs border ${
                testResult.type === 'success'
                  ? 'bg-white text-gray-900 border-gray-400'
                  : testResult.type === 'error'
                  ? 'bg-gray-100 text-gray-900 border-gray-400'
                  : 'bg-gray-50 text-gray-900 border-gray-300'
              }`}
            >
              {testResult.message}
            </div>
          )}

          {/* MCP Test Button */}
          <div className="mb-2">
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="px-4 py-2 bg-black text-white text-xs font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none"
            >
              {testing ? 'Testing MCP...' : 'Test MCP Connection'}
            </button>
          </div>

          {/* Help Text */}
          <div className="text-xs text-gray-600">
            <p>
              Run: <code className="bg-white px-2 py-1 border border-gray-300 font-mono">mitre-mcp --http --port {config.port}</code>
            </p>
          </div>
        </div>

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

          {/* Ollama Configuration */}
          {config.llmProvider === LLM_PROVIDERS.OLLAMA && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {/* Ollama Base URL */}
                <div>
                  <label htmlFor="ollamaBaseUrl" className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                    Ollama Server URL
                  </label>
                  <input
                    id="ollamaBaseUrl"
                    type="text"
                    value={config.ollamaBaseUrl}
                    onChange={(e) => handleChange('ollamaBaseUrl', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 focus:outline-none focus:border-black text-sm"
                    placeholder="http://localhost:11434"
                  />
                </div>

                {/* Ollama Model */}
                <div>
                  <label htmlFor="ollamaModel" className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                    Model Name
                  </label>
                  <input
                    id="ollamaModel"
                    type="text"
                    value={config.ollamaModel}
                    onChange={(e) => handleChange('ollamaModel', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 focus:outline-none focus:border-black text-sm"
                    placeholder="llama3.1:8b"
                  />
                </div>
              </div>

              {/* Ollama Status Message */}
              {ollamaTestResult && (
                <div
                  className={`mb-4 p-3 text-xs border whitespace-pre-line ${
                    ollamaTestResult.type === 'success'
                      ? 'bg-white text-gray-900 border-gray-400'
                      : 'bg-gray-100 text-gray-900 border-gray-400'
                  }`}
                >
                  {ollamaTestResult.message}
                </div>
              )}

              {/* Ollama Test Button */}
              <div className="mb-2">
                <button
                  onClick={handleTestOllama}
                  disabled={testingOllama}
                  className="px-4 py-2 bg-black text-white text-xs font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none"
                >
                  {testingOllama ? 'Testing Ollama...' : 'Test Ollama Connection'}
                </button>
              </div>

              {/* Ollama Help Text */}
              <div className="text-xs text-gray-600 space-y-1">
                <p>
                  Start Ollama: <code className="bg-white px-2 py-1 border border-gray-300 font-mono">ollama serve</code>
                </p>
                <p>
                  Pull model: <code className="bg-white px-2 py-1 border border-gray-300 font-mono">ollama pull {config.ollamaModel}</code>
                </p>
              </div>
            </>
          )}

          {/* Gemini Configuration */}
          {config.llmProvider === LLM_PROVIDERS.GEMINI && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {/* Gemini API Key */}
                <div>
                  <label htmlFor="geminiApiKey" className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                    Gemini API Key
                  </label>
                  <input
                    id="geminiApiKey"
                    type="password"
                    value={config.geminiApiKey}
                    onChange={(e) => handleChange('geminiApiKey', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 focus:outline-none focus:border-black text-sm"
                    placeholder="Enter API key or use .env file"
                  />
                  {import.meta.env.VITE_GEMINI_API_KEY && !config.geminiApiKey && (
                    <p className="text-xs text-green-700 mt-1">Using API key from environment</p>
                  )}
                </div>

                {/* Gemini Model */}
                <div>
                  <label htmlFor="geminiModel" className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                    Model Name
                  </label>
                  <select
                    id="geminiModel"
                    value={config.geminiModel}
                    onChange={(e) => handleChange('geminiModel', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 focus:outline-none focus:border-black text-sm bg-white"
                  >
                    <optgroup label="Gemini 3 (Latest)">
                      <option value="gemini-3-pro">gemini-3-pro (Most Intelligent)</option>
                      <option value="gemini-3-deep-think">gemini-3-deep-think (Deep Reasoning)</option>
                    </optgroup>
                    <optgroup label="Gemini 2.5">
                      <option value="gemini-2.5-pro">gemini-2.5-pro (Powerful)</option>
                      <option value="gemini-2.5-flash">gemini-2.5-flash (Fast + Thinking)</option>
                      <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite (Cost Effective)</option>
                    </optgroup>
                    <optgroup label="Gemini 2.0">
                      <option value="gemini-2.0-flash">gemini-2.0-flash (Balanced)</option>
                      <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite (Low Latency)</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Gemini Status Message */}
              {geminiTestResult && (
                <div
                  className={`mb-4 p-3 text-xs border whitespace-pre-line ${
                    geminiTestResult.type === 'success'
                      ? 'bg-white text-gray-900 border-gray-400'
                      : 'bg-gray-100 text-gray-900 border-gray-400'
                  }`}
                >
                  {geminiTestResult.message}
                </div>
              )}

              {/* Gemini Test Button */}
              <div className="mb-2">
                <button
                  onClick={handleTestGemini}
                  disabled={testingGemini}
                  className="px-4 py-2 bg-black text-white text-xs font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none"
                >
                  {testingGemini ? 'Testing Gemini...' : 'Test Gemini API'}
                </button>
              </div>

              {/* Gemini Help Text */}
              <div className="text-xs text-gray-600 space-y-1">
                <p>
                  Get API key: <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google AI Studio</a>
                </p>
                <p>
                  Or set <code className="bg-white px-2 py-1 border border-gray-300 font-mono">VITE_GEMINI_API_KEY</code> in .env file
                </p>
              </div>
            </>
          )}

          {/* OpenRouter Configuration */}
          {config.llmProvider === LLM_PROVIDERS.OPENROUTER && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {/* OpenRouter API Key */}
                <div>
                  <label htmlFor="openrouterApiKey" className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                    OpenRouter API Key
                  </label>
                  <input
                    id="openrouterApiKey"
                    type="password"
                    value={config.openrouterApiKey}
                    onChange={(e) => handleChange('openrouterApiKey', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 focus:outline-none focus:border-black text-sm"
                    placeholder="Enter API key or use .env file"
                  />
                  {import.meta.env.VITE_OPENROUTER_API_KEY && !config.openrouterApiKey && (
                    <p className="text-xs text-green-700 mt-1">Using API key from environment</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Stored securely in browser IndexedDB</p>
                </div>

                {/* OpenRouter Model */}
                <div>
                  <label htmlFor="openrouterModel" className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                    Model ID
                  </label>
                  <select
                    id="openrouterModel"
                    value={config.openrouterModel}
                    onChange={(e) => handleChange('openrouterModel', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 focus:outline-none focus:border-black text-sm bg-white"
                  >
                    <optgroup label="Anthropic">
                      <option value="anthropic/claude-sonnet-4">Claude Sonnet 4</option>
                      <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                      <option value="anthropic/claude-3.5-haiku">Claude 3.5 Haiku</option>
                    </optgroup>
                    <optgroup label="OpenAI">
                      <option value="openai/gpt-4o">GPT-4o</option>
                      <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
                      <option value="openai/o1-preview">o1 Preview</option>
                    </optgroup>
                    <optgroup label="Google">
                      <option value="google/gemini-2.5-flash-preview">Gemini 2.5 Flash</option>
                      <option value="google/gemini-2.5-pro-preview">Gemini 2.5 Pro</option>
                    </optgroup>
                    <optgroup label="Meta">
                      <option value="meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B</option>
                      <option value="meta-llama/llama-3.1-8b-instruct">Llama 3.1 8B</option>
                    </optgroup>
                    <optgroup label="Mistral">
                      <option value="mistralai/mistral-large">Mistral Large</option>
                      <option value="mistralai/mistral-small-3.1-24b-instruct">Mistral Small 3.1</option>
                    </optgroup>
                    <optgroup label="DeepSeek">
                      <option value="deepseek/deepseek-chat-v3-0324">DeepSeek Chat V3</option>
                      <option value="deepseek/deepseek-r1">DeepSeek R1</option>
                    </optgroup>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Or enter custom model ID from <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">openrouter.ai/models</a>
                  </p>
                </div>
              </div>

              {/* Custom Model Input */}
              <div className="mb-4">
                <label htmlFor="openrouterModelCustom" className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                  Or Enter Custom Model ID
                </label>
                <input
                  id="openrouterModelCustom"
                  type="text"
                  value={config.openrouterModel}
                  onChange={(e) => handleChange('openrouterModel', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 focus:outline-none focus:border-black text-sm"
                  placeholder="e.g., anthropic/claude-3.5-sonnet"
                />
              </div>

              {/* OpenRouter Status Message */}
              {openrouterTestResult && (
                <div
                  className={`mb-4 p-3 text-xs border whitespace-pre-line ${
                    openrouterTestResult.type === 'success'
                      ? 'bg-white text-gray-900 border-gray-400'
                      : 'bg-gray-100 text-gray-900 border-gray-400'
                  }`}
                >
                  {openrouterTestResult.message}
                </div>
              )}

              {/* OpenRouter Test Button */}
              <div className="mb-2">
                <button
                  onClick={handleTestOpenRouter}
                  disabled={testingOpenRouter}
                  className="px-4 py-2 bg-black text-white text-xs font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none"
                >
                  {testingOpenRouter ? 'Testing OpenRouter...' : 'Test OpenRouter API'}
                </button>
              </div>

              {/* OpenRouter Help Text */}
              <div className="text-xs text-gray-600 space-y-1">
                <p>
                  Get API key: <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">OpenRouter Dashboard</a>
                </p>
                <p>
                  Or set <code className="bg-white px-2 py-1 border border-gray-300 font-mono">VITE_OPENROUTER_API_KEY</code> in .env file
                </p>
              </div>
            </>
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
