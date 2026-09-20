/**
 * GeminiForm Component
 *
 * API key + model name input (one control with model suggestions) and the
 * Gemini "test connection" control. Per-field validation errors arrive
 * via `errors` and render inline.
 */
import StatusBanner from './StatusBanner.jsx';

// The dropdown suggestions the model input offers — kept in sync with the
// model list this build supports (same set the old <select> carried).
const GEMINI_MODEL_OPTIONS = [
  { value: 'gemini-3-pro', label: 'Gemini 3 Pro — Most Intelligent' },
  { value: 'gemini-3-deep-think', label: 'Gemini 3 Deep Think — Deep Reasoning' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro — Powerful' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — Fast + Thinking' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite — Cost Effective' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash — Balanced' },
  { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite — Low Latency' }
];

export default function GeminiForm({ config, onChange, testing, testResult, onTest, errors = {} }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* Gemini API Key */}
        <div>
          <label htmlFor="geminiApiKey" className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">
            Gemini API Key
          </label>
          <input
            id="geminiApiKey"
            type="password"
            value={config.geminiApiKey}
            onChange={(e) => onChange('geminiApiKey', e.target.value)}
            aria-invalid={Boolean(errors.geminiApiKey)}
            className="w-full border border-rule-strong bg-paper px-3 py-2 text-sm text-ink transition-colors focus:border-ink focus:bg-paper-card focus:outline-none"
            placeholder="Enter API key"
          />
          {errors.geminiApiKey && (
            <p role="alert" className="text-xs text-red-700 mt-1">{errors.geminiApiKey}</p>
          )}
        </div>

        {/* Gemini Model — a single control: a text input with model
            suggestions, so a listed pick and any new or renamed model are
            entered in the same field (F-UX-018). */}
        <div>
          <label htmlFor="geminiModel" className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">
            Model Name
          </label>
          <input
            id="geminiModel"
            type="text"
            list="gemini-model-options"
            value={config.geminiModel}
            onChange={(e) => onChange('geminiModel', e.target.value)}
            className="w-full border border-rule-strong bg-paper px-3 py-2 text-sm text-ink transition-colors focus:border-ink focus:bg-paper-card focus:outline-none"
            placeholder="e.g., gemini-2.5-flash"
          />
          <datalist id="gemini-model-options">
            {GEMINI_MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} label={option.label} />
            ))}
          </datalist>
          <p className="text-xs text-gray-500 mt-1">
            Pick a model or type any name from <a href="https://ai.google.dev/gemini-api/docs/models" target="_blank" rel="noopener noreferrer" className="text-brass-700 underline decoration-brass underline-offset-2 transition-colors hover:text-ink">ai.google.dev/gemini-api/docs/models</a>
          </p>
        </div>
      </div>

      {/* Gemini Status Message — semantics + icon come from StatusBanner (F-UX-008) */}
      <StatusBanner result={testResult} />

      {/* Gemini Test Button */}
      <div className="mb-2">
        <button
          onClick={onTest}
          disabled={testing}
          className="bg-black px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {testing ? 'Testing Gemini...' : 'Test Gemini API'}
        </button>
      </div>

      {/* Gemini Help Text */}
      <div className="text-xs text-gray-600 space-y-1">
        <p>
          Get API key: <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-brass-700 underline decoration-brass underline-offset-2 transition-colors hover:text-ink">Google AI Studio</a>
        </p>
      </div>
    </>
  );
}
