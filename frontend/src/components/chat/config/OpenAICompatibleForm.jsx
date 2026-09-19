/**
 * OpenAICompatibleForm Component
 *
 * Endpoint URL + model inputs, an OPTIONAL API key input, and the "test
 * connection" control for any server speaking the OpenAI chat-completions
 * API (LM Studio, vLLM, llama.cpp, LiteLLM, a hosted gateway).
 * Per-field validation errors arrive via `errors` and render inline.
 */
import { isLoopbackHost, pageCannotReachLoopback } from '../../../services/mcpConfig.js';
import StatusBanner from './StatusBanner.jsx';

export default function OpenAICompatibleForm({ config, onChange, testing, testResult, onTest, errors = {} }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* Endpoint URL — full width: URLs run longer than key/model text. */}
        <div className="sm:col-span-2">
          <label htmlFor="openaiCompatibleBaseUrl" className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">
            Endpoint URL
          </label>
          <input
            id="openaiCompatibleBaseUrl"
            type="text"
            value={config.openaiCompatibleBaseUrl}
            onChange={(e) => onChange('openaiCompatibleBaseUrl', e.target.value)}
            aria-invalid={Boolean(errors.openaiCompatibleBaseUrl)}
            className="w-full border border-rule-strong bg-paper px-3 py-2 text-sm text-ink transition-colors focus:border-ink focus:bg-paper-card focus:outline-none"
            placeholder="http://localhost:1234/v1"
          />
          {errors.openaiCompatibleBaseUrl && (
            <p role="alert" className="text-xs text-red-700 mt-1">{errors.openaiCompatibleBaseUrl}</p>
          )}
        </div>

        {/* Model — free text: a custom endpoint's model IDs are not
            enumerable ahead of time; "Test Endpoint" lists what it serves. */}
        <div>
          <label htmlFor="openaiCompatibleModel" className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">
            Model Name
          </label>
          <input
            id="openaiCompatibleModel"
            type="text"
            value={config.openaiCompatibleModel}
            onChange={(e) => onChange('openaiCompatibleModel', e.target.value)}
            aria-invalid={Boolean(errors.openaiCompatibleModel)}
            className="w-full border border-rule-strong bg-paper px-3 py-2 text-sm text-ink transition-colors focus:border-ink focus:bg-paper-card focus:outline-none"
            placeholder="e.g., llama-3.1-8b-instruct"
          />
          {errors.openaiCompatibleModel && (
            <p role="alert" className="text-xs text-red-700 mt-1">{errors.openaiCompatibleModel}</p>
          )}
        </div>

        {/* API Key — optional: keyless endpoints accept any Bearer value. */}
        <div>
          <label htmlFor="openaiCompatibleApiKey" className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">
            API Key (Optional)
          </label>
          <input
            id="openaiCompatibleApiKey"
            type="password"
            value={config.openaiCompatibleApiKey}
            onChange={(e) => onChange('openaiCompatibleApiKey', e.target.value)}
            aria-invalid={Boolean(errors.openaiCompatibleApiKey)}
            className="w-full border border-rule-strong bg-paper px-3 py-2 text-sm text-ink transition-colors focus:border-ink focus:bg-paper-card focus:outline-none"
            placeholder="Leave empty if not required"
          />
          {errors.openaiCompatibleApiKey && (
            <p role="alert" className="text-xs text-red-700 mt-1">{errors.openaiCompatibleApiKey}</p>
          )}
        </div>
      </div>

      {/* Endpoint Status Message — semantics + icon come from StatusBanner (F-UX-008) */}
      <StatusBanner result={testResult} />

      {/* Endpoint Test Button */}
      <div className="mb-2">
        <button
          onClick={onTest}
          disabled={testing}
          className="bg-black px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {testing ? 'Testing Endpoint...' : 'Test Endpoint'}
        </button>
      </div>

      {/* OpenAI-compatible Help Text — names the /v1 convention and the
          two traps unique to a browser-called custom endpoint: the endpoint
          must answer cross-origin requests, and a key is only needed when
          the server asks for one. */}
      <div className="text-xs text-gray-600 space-y-1">
        <p>
          Works with LM Studio, vLLM, llama.cpp, LiteLLM and other OpenAI-compatible servers. Point at the API root — <code className="border border-rule bg-paper px-1.5 py-0.5 font-mono text-ink">/v1</code> is appended when missing.
        </p>
        <p>
          The browser calls the endpoint directly, so it must allow cross-origin (CORS) requests. Leave the API key empty when the endpoint does not require one.
        </p>
        {pageCannotReachLoopback() && isLoopbackHost(config.openaiCompatibleBaseUrl) && (
          <p role="status" className="text-red-700">
            A hosted page cannot call a local endpoint — the browser blocks access to the loopback address space. Use the local UI at{' '}
            <code className="border border-rule bg-paper px-1.5 py-0.5 font-mono text-ink">http://localhost:5173</code>
            {' '}to talk to LM Studio / llama.cpp on this machine.
          </p>
        )}
      </div>
    </>
  );
}
