/**
 * OllamaForm Component
 *
 * Server URL + model inputs and the Ollama "test connection" control.
 * Per-field validation errors arrive via `errors` and render inline.
 */
import StatusBanner from './StatusBanner.jsx';

export default function OllamaForm({ config, onChange, testing, testResult, onTest, errors = {} }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* Ollama Base URL */}
        <div>
          <label htmlFor="ollamaBaseUrl" className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">
            Ollama Server URL
          </label>
          <input
            id="ollamaBaseUrl"
            type="text"
            value={config.ollamaBaseUrl}
            onChange={(e) => onChange('ollamaBaseUrl', e.target.value)}
            aria-invalid={Boolean(errors.ollamaBaseUrl)}
            className="w-full border border-rule-strong bg-paper px-3 py-2 text-sm text-ink transition-colors focus:border-ink focus:bg-paper-card focus:outline-none"
            placeholder="http://localhost:11434"
          />
          {errors.ollamaBaseUrl && (
            <p role="alert" className="text-xs text-red-700 mt-1">{errors.ollamaBaseUrl}</p>
          )}
        </div>

        {/* Ollama Model */}
        <div>
          <label htmlFor="ollamaModel" className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">
            Model Name
          </label>
          <input
            id="ollamaModel"
            type="text"
            value={config.ollamaModel}
            onChange={(e) => onChange('ollamaModel', e.target.value)}
            className="w-full border border-rule-strong bg-paper px-3 py-2 text-sm text-ink transition-colors focus:border-ink focus:bg-paper-card focus:outline-none"
            placeholder="llama3.1:8b"
          />
        </div>
      </div>

      {/* Ollama Status Message — semantics + icon come from StatusBanner (F-UX-008) */}
      <StatusBanner result={testResult} />

      {/* Ollama Test Button */}
      <div className="mb-2">
        <button
          onClick={onTest}
          disabled={testing}
          className="bg-black px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {testing ? 'Testing Ollama...' : 'Test Ollama Connection'}
        </button>
      </div>

      {/* Ollama Help Text */}
      <div className="text-xs text-gray-600 space-y-1">
        <p>
          Start Ollama: <code className="border border-rule bg-paper px-2 py-1 font-mono text-ink">ollama serve</code>
        </p>
        <p>
          Pull model: <code className="border border-rule bg-paper px-2 py-1 font-mono text-ink">ollama pull {config.ollamaModel}</code>
        </p>
      </div>
    </>
  );
}
