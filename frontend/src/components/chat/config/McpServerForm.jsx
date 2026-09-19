/**
 * McpServerForm Component
 *
 * Host/port inputs, connection URL preview, and the MCP "test connection"
 * control for the settings dialog.
 */
export default function McpServerForm({ config, onChange, testing, testResult, onTest }) {
  return (
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
            onChange={(e) => onChange('host', e.target.value)}
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
            onChange={(e) => onChange('port', parseInt(e.target.value))}
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
          onClick={onTest}
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
  );
}
