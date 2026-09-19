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
      <h3 className="dossier-section mb-4">
        MCP Server Configuration
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* Host Input */}
        <div>
          <label htmlFor="host" className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">
            Host
          </label>
          <input
            id="host"
            type="text"
            value={config.host}
            onChange={(e) => onChange('host', e.target.value)}
            aria-invalid={Boolean(errors.host)}
            className="w-full border border-rule-strong bg-paper px-3 py-2 text-sm text-ink transition-colors focus:border-ink focus:bg-paper-card focus:outline-none"
            placeholder="localhost"
          />
          {errors.host && (
            <p role="alert" className="text-xs text-red-700 mt-1">{errors.host}</p>
          )}
        </div>

        {/* Port Input */}
        <div>
          <label htmlFor="port" className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">
            Port
          </label>
          <input
            id="port"
            type="text"
            inputMode="numeric"
            value={config.port}
            onChange={(e) => onChange('port', e.target.value)}
            aria-invalid={Boolean(errors.port)}
            className="w-full border border-rule-strong bg-paper px-3 py-2 text-sm text-ink transition-colors focus:border-ink focus:bg-paper-card focus:outline-none"
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
          <code className="border border-rule bg-paper px-2 py-1 font-mono text-xs text-ink">
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
          className="bg-black px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {testing ? 'Testing MCP...' : 'Test MCP Connection'}
        </button>
      </div>

      {/* Help Text */}
      <div className="text-xs text-gray-600">
        <p>
          Run: <code className="border border-rule bg-paper px-2 py-1 font-mono text-ink">mitre-mcp --http --port {config.port}</code>
        </p>
      </div>
    </div>
  );
}
