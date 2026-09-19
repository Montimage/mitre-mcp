/**
 * OllamaForm Component
 *
 * Server URL + model inputs and the Ollama "test connection" control.
 * Per-field validation errors arrive via `errors` and render inline.
 */
export default function OllamaForm({ config, onChange, testing, testResult, onTest, errors = {} }) {
  return (
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
            onChange={(e) => onChange('ollamaBaseUrl', e.target.value)}
            aria-invalid={Boolean(errors.ollamaBaseUrl)}
            className="w-full px-3 py-2 border-2 border-gray-300 focus:outline-none focus:border-black focus-visible:ring-2 focus-visible:ring-black text-sm"
            placeholder="http://localhost:11434"
          />
          {errors.ollamaBaseUrl && (
            <p role="alert" className="text-xs text-red-700 mt-1">{errors.ollamaBaseUrl}</p>
          )}
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
            onChange={(e) => onChange('ollamaModel', e.target.value)}
            className="w-full px-3 py-2 border-2 border-gray-300 focus:outline-none focus:border-black focus-visible:ring-2 focus-visible:ring-black text-sm"
            placeholder="llama3.1:8b"
          />
        </div>
      </div>

      {/* Ollama Status Message */}
      {testResult && (
        <div
          className={`mb-4 p-3 text-xs border whitespace-pre-line ${
            testResult.type === 'success'
              ? 'bg-white text-gray-900 border-gray-400'
              : 'bg-gray-100 text-gray-900 border-gray-400'
          }`}
        >
          {testResult.message}
        </div>
      )}

      {/* Ollama Test Button */}
      <div className="mb-2">
        <button
          onClick={onTest}
          disabled={testing}
          className="px-4 py-2 bg-black text-white text-xs font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        >
          {testing ? 'Testing Ollama...' : 'Test Ollama Connection'}
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
  );
}
