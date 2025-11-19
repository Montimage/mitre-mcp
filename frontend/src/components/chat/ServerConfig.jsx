/**
 * ServerConfig Component
 *
 * Allows users to configure the MCP server connection settings
 */
import { useState, useEffect } from 'react';

export default function ServerConfig({ onConfigChange, initialConfig }) {
  const [config, setConfig] = useState({
    host: initialConfig?.host || 'localhost',
    port: initialConfig?.port || 8000
  });

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

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
      // Dynamically import to avoid issues if not yet installed
      const { default: MitreMCPClient } = await import('../../services/mcpClient.js');

      const client = new MitreMCPClient(config.host, config.port);
      const success = await client.testConnection();

      if (success) {
        setTestResult({
          type: 'success',
          message: 'Connection successful!'
        });
      } else {
        setTestResult({
          type: 'error',
          message: 'Connection failed. Please check server address and ensure mitre-mcp is running.'
        });
      }
    } catch (error) {
      setTestResult({
        type: 'error',
        message: `Connection error: ${error.message}`
      });
    } finally {
      setTesting(false);
    }
  };

  const handleReset = () => {
    const defaultConfig = { host: 'localhost', port: 8000 };
    setConfig(defaultConfig);
    localStorage.removeItem('mcp-server-config');
    setTestResult({
      type: 'info',
      message: 'Configuration reset to defaults'
    });
    setTimeout(() => setTestResult(null), 3000);
  };

  return (
    <div className="border-b border-gray-200 bg-gray-50 p-4">
      <div className="max-w-2xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          MCP Server Configuration
        </h3>

        {/* Input Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {/* Host Input */}
          <div>
            <label htmlFor="host" className="block text-sm font-medium text-gray-700 mb-1">
              Host
            </label>
            <input
              id="host"
              type="text"
              value={config.host}
              onChange={(e) => handleChange('host', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="localhost"
            />
          </div>

          {/* Port Input */}
          <div>
            <label htmlFor="port" className="block text-sm font-medium text-gray-700 mb-1">
              Port
            </label>
            <input
              id="port"
              type="number"
              value={config.port}
              onChange={(e) => handleChange('port', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="8000"
              min="1"
              max="65535"
            />
          </div>
        </div>

        {/* Connection URL Preview */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Server URL:</span>{' '}
            <code className="bg-gray-200 px-2 py-1 rounded text-xs">
              http://{config.host}:{config.port}/mcp
            </code>
          </p>
        </div>

        {/* Status Message */}
        {testResult && (
          <div
            className={`mb-4 p-3 rounded-md text-sm ${
              testResult.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : testResult.type === 'error'
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}
          >
            {testResult.message}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>

          <button
            onClick={handleSave}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            Save
          </button>

          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Reset
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-4 text-xs text-gray-500">
          <p>
            Make sure the mitre-mcp server is running before testing the connection.
            Run: <code className="bg-gray-200 px-1 rounded">mitre-mcp --http --port {config.port}</code>
          </p>
        </div>
      </div>
    </div>
  );
}
