/**
 * ServerConfig Component
 *
 * Allows users to configure MCP server and Ollama LLM settings
 */
import { useState, useEffect } from 'react';

export default function ServerConfig({ onConfigChange, initialConfig }) {
  const [config, setConfig] = useState({
    host: initialConfig?.host || 'localhost',
    port: initialConfig?.port || 8000,
    ollamaBaseUrl: initialConfig?.ollamaBaseUrl || 'http://localhost:11434',
    ollamaModel: initialConfig?.ollamaModel || 'llama3.1:8b'
  });

  const [testing, setTesting] = useState(false);
  const [testingOllama, setTestingOllama] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [ollamaTestResult, setOllamaTestResult] = useState(null);

  useEffect(() => {
    // Load saved config from localStorage
    const saved = localStorage.getItem('mcp-server-config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig(parsed);
      } catch (error) {
        console.error('Failed to load saved config:', error);
      }
    }
  }, []);

  const handleChange = (field, value) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
  };

  const handleSave = () => {
    // Save to localStorage
    localStorage.setItem('mcp-server-config', JSON.stringify(config));

    // Notify parent component
    if (onConfigChange) {
      onConfigChange(config);
    }

    setTestResult({
      type: 'success',
      message: 'Configuration saved successfully!'
    });

    setTimeout(() => setTestResult(null), 3000);
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

      // Test if Ollama is running by fetching tags
      const response = await fetch(`${config.ollamaBaseUrl}/api/tags`);

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

  const handleReset = () => {
    const defaultConfig = {
      host: 'localhost',
      port: 8000,
      ollamaBaseUrl: 'http://localhost:11434',
      ollamaModel: 'llama3.1:8b'
    };
    setConfig(defaultConfig);
    localStorage.removeItem('mcp-server-config');
    setTestResult({
      type: 'info',
      message: 'Configuration reset to defaults'
    });
    setTimeout(() => setTestResult(null), 3000);
  };

  return (
    <div className="border-b-2 border-gray-300 bg-gray-50 p-4">
      <div className="max-w-3xl">
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

        {/* Ollama Configuration */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
            Ollama LLM Configuration
          </h3>

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
        </div>

        {/* Divider */}
        <div className="border-t border-gray-300 my-6"></div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-gray-700 text-white text-xs font-medium hover:bg-gray-600 transition-colors focus:outline-none"
          >
            Save All
          </button>

          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-300 text-gray-900 text-xs font-medium hover:bg-gray-400 transition-colors focus:outline-none"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
