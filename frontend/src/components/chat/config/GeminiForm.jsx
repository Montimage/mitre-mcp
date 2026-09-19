/**
 * GeminiForm Component
 *
 * API key + model select and the Gemini "test connection" control.
 * Per-field validation errors arrive via `errors` and render inline.
 */
import StatusBanner from './StatusBanner.jsx';

export default function GeminiForm({ config, onChange, testing, testResult, onTest, errors = {} }) {
  return (
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
            onChange={(e) => onChange('geminiApiKey', e.target.value)}
            aria-invalid={Boolean(errors.geminiApiKey)}
            className="w-full px-3 py-2 border-2 border-gray-300 focus:outline-none focus:border-black focus-visible:ring-2 focus-visible:ring-black text-sm"
            placeholder="Enter API key"
          />
          {errors.geminiApiKey && (
            <p role="alert" className="text-xs text-red-700 mt-1">{errors.geminiApiKey}</p>
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
            onChange={(e) => onChange('geminiModel', e.target.value)}
            className="w-full px-3 py-2 border-2 border-gray-300 focus:outline-none focus:border-black focus-visible:ring-2 focus-visible:ring-black text-sm bg-white"
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

      {/* Gemini Status Message — semantics + icon come from StatusBanner (F-UX-008) */}
      <StatusBanner result={testResult} />

      {/* Gemini Test Button */}
      <div className="mb-2">
        <button
          onClick={onTest}
          disabled={testing}
          className="px-4 py-2 bg-black text-white text-xs font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        >
          {testing ? 'Testing Gemini...' : 'Test Gemini API'}
        </button>
      </div>

      {/* Gemini Help Text */}
      <div className="text-xs text-gray-600 space-y-1">
        <p>
          Get API key: <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google AI Studio</a>
        </p>
      </div>
    </>
  );
}
