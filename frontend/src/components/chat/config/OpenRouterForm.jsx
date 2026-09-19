/**
 * OpenRouterForm Component
 *
 * API key + model ID input (one control with manifest suggestions) and the
 * OpenRouter "test connection" control. Per-field validation errors arrive
 * via `errors` and render inline.
 */
import StatusBanner from './StatusBanner.jsx';

// The dropdown suggestions the model input offers — kept in sync with the
// model list this build supports (same set the old <select> carried).
const OPENROUTER_MODEL_OPTIONS = [
  { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4 — Anthropic' },
  { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet — Anthropic' },
  { value: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku — Anthropic' },
  { value: 'openai/gpt-4o', label: 'GPT-4o — OpenAI' },
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini — OpenAI' },
  { value: 'openai/o1-preview', label: 'o1 Preview — OpenAI' },
  { value: 'google/gemini-2.5-flash-preview', label: 'Gemini 2.5 Flash — Google' },
  { value: 'google/gemini-2.5-pro-preview', label: 'Gemini 2.5 Pro — Google' },
  { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B — Meta' },
  { value: 'meta-llama/llama-3.1-8b-instruct', label: 'Llama 3.1 8B — Meta' },
  { value: 'mistralai/mistral-large', label: 'Mistral Large — Mistral' },
  { value: 'mistralai/mistral-small-3.1-24b-instruct', label: 'Mistral Small 3.1 — Mistral' },
  { value: 'deepseek/deepseek-chat-v3-0324', label: 'DeepSeek Chat V3 — DeepSeek' },
  { value: 'deepseek/deepseek-r1', label: 'DeepSeek R1 — DeepSeek' }
];

export default function OpenRouterForm({ config, onChange, testing, testResult, onTest, errors = {} }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* OpenRouter API Key */}
        <div>
          <label htmlFor="openrouterApiKey" className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">
            OpenRouter API Key
          </label>
          <input
            id="openrouterApiKey"
            type="password"
            value={config.openrouterApiKey}
            onChange={(e) => onChange('openrouterApiKey', e.target.value)}
            aria-invalid={Boolean(errors.openrouterApiKey)}
            className="w-full border border-rule-strong bg-paper px-3 py-2 text-sm text-ink transition-colors focus:border-ink focus:bg-paper-card focus:outline-none"
            placeholder="Enter API key"
          />
          {errors.openrouterApiKey && (
            <p role="alert" className="text-xs text-red-700 mt-1">{errors.openrouterApiKey}</p>
          )}
        </div>

        {/* OpenRouter Model — a single control: a text input with manifest
            suggestions, so a listed pick and a custom ID are entered in the
            same field (F-UX-018). */}
        <div>
          <label htmlFor="openrouterModel" className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">
            Model ID
          </label>
          <input
            id="openrouterModel"
            type="text"
            list="openrouter-model-options"
            value={config.openrouterModel}
            onChange={(e) => onChange('openrouterModel', e.target.value)}
            className="w-full border border-rule-strong bg-paper px-3 py-2 text-sm text-ink transition-colors focus:border-ink focus:bg-paper-card focus:outline-none"
            placeholder="e.g., anthropic/claude-3.5-sonnet"
          />
          <datalist id="openrouter-model-options">
            {OPENROUTER_MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} label={option.label} />
            ))}
          </datalist>
          <p className="text-xs text-gray-500 mt-1">
            Pick a model or type any ID from <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer" className="text-brass-700 underline decoration-brass underline-offset-2 transition-colors hover:text-ink">openrouter.ai/models</a>
          </p>
        </div>
      </div>

      {/* OpenRouter Status Message — semantics + icon come from StatusBanner (F-UX-008) */}
      <StatusBanner result={testResult} />

      {/* OpenRouter Test Button */}
      <div className="mb-2">
        <button
          onClick={onTest}
          disabled={testing}
          className="bg-black px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {testing ? 'Testing OpenRouter...' : 'Test OpenRouter API'}
        </button>
      </div>

      {/* OpenRouter Help Text */}
      <div className="text-xs text-gray-600 space-y-1">
        <p>
          Get API key: <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-brass-700 underline decoration-brass underline-offset-2 transition-colors hover:text-ink">OpenRouter Dashboard</a>
        </p>
      </div>
    </>
  );
}
