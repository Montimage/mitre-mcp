/**
 * McpServerForm Component
 *
 * Host/port inputs, connection URL preview, and the MCP "test connection"
 * control for the settings dialog. Per-field validation errors arrive via
 * `errors` and render inline beneath their input; an invalid form blocks the
 * save in the parent, so these messages are the user's only signal.
 */
import { buildMcpServerUrl } from '../../../services/mcpConfig.js';
import StatusBanner from './StatusBanner.jsx';

export default function McpServerForm({ config, onChange, testing, testResult, onTest, errors = {} }) {
  const serverUrl = buildMcpServerUrl(config.host, config.port)
    || `http://${config.host}:${config.port}/mcp`;

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
            aria-invalid={Boolean(errors.host)}
            className="w-full px-3 py-2 border-2 border-gray-300 focus:outline-none focus:border-black focus-visible:ring-2 focus-visible:ring-black text-sm"
            placeholder="localhost"
          />
          {errors.host && (
            <p role="alert" className="text-xs text-red-700 mt-1">{errors.host}</p>
          )}
        </div>

        {/* Port Input */}
        <div>
          <label htmlFor="port" className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
            Port
          </label>
          <input
            id="port"
            type="text"
            inputMode="numeric"
            value={config.port}
            onChange={(e) => onChange('port', e.target.value)}
            aria-invalid={Boolean(errors.port)}
            className="w-full px-3 py-2 border-2 border-gray-300 focus:outline-none focus:border-black focus-visible:ring-2 focus-visible:ring-black text-sm"
            placeholder="8000"
          />
          {errors.port && (
            <p role="alert" className="text-xs text-red-700 mt-1">{errors.port}</p>
          )}
        </div>
      </div>

      {/* Connection URL Preview */}
      <div className="mb-4 space-y-2">
        <p className="text-xs text-gray-600">
          <span className="font-medium">Server URL:</span>{' '}
          <code className="bg-white px-2 py-1 border border-gray-300 text-xs font-mono">
            {serverUrl}
          </code>
        </p>
        {config.host === 'localhost' && Number(config.port) === 8000 && (
          <p className="text-xs text-green-700">
            <span className="font-medium">Note:</span> In development, requests are sent through this app's local proxy (/mcp) so the browser can reach the server.
          </p>
        )}
      </div>

      {/* Status Message — semantics + icon come from StatusBanner (F-UX-008) */}
      <StatusBanner result={testResult} />

      {/* MCP Test Button */}
      <div className="mb-2">
        <button
          onClick={onTest}
          disabled={testing}
          className="px-4 py-2 bg-black text-white text-xs font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
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
