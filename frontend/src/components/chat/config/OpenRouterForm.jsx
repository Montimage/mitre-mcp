/**
 * OpenRouterForm Component
 *
 * API key + model select (with a free-form model ID input) and the OpenRouter
 * "test connection" control. Per-field validation errors arrive via `errors`
 * and render inline.
 */
export default function OpenRouterForm({ config, onChange, testing, testResult, onTest, errors = {} }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* OpenRouter API Key */}
        <div>
          <label htmlFor="openrouterApiKey" className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
            OpenRouter API Key
          </label>
          <input
            id="openrouterApiKey"
            type="password"
            value={config.openrouterApiKey}
            onChange={(e) => onChange('openrouterApiKey', e.target.value)}
            aria-invalid={Boolean(errors.openrouterApiKey)}
            className="w-full px-3 py-2 border-2 border-gray-300 focus:outline-none focus:border-black focus-visible:ring-2 focus-visible:ring-black text-sm"
            placeholder="Enter API key"
          />
          {errors.openrouterApiKey && (
            <p role="alert" className="text-xs text-red-700 mt-1">{errors.openrouterApiKey}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">Stored securely in browser IndexedDB</p>
        </div>

        {/* OpenRouter Model */}
        <div>
          <label htmlFor="openrouterModel" className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
            Model ID
          </label>
          <select
            id="openrouterModel"
            value={config.openrouterModel}
            onChange={(e) => onChange('openrouterModel', e.target.value)}
            className="w-full px-3 py-2 border-2 border-gray-300 focus:outline-none focus:border-black focus-visible:ring-2 focus-visible:ring-black text-sm bg-white"
          >
            <optgroup label="Anthropic">
              <option value="anthropic/claude-sonnet-4">Claude Sonnet 4</option>
              <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
              <option value="anthropic/claude-3.5-haiku">Claude 3.5 Haiku</option>
            </optgroup>
            <optgroup label="OpenAI">
              <option value="openai/gpt-4o">GPT-4o</option>
              <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
              <option value="openai/o1-preview">o1 Preview</option>
            </optgroup>
            <optgroup label="Google">
              <option value="google/gemini-2.5-flash-preview">Gemini 2.5 Flash</option>
              <option value="google/gemini-2.5-pro-preview">Gemini 2.5 Pro</option>
            </optgroup>
            <optgroup label="Meta">
              <option value="meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B</option>
              <option value="meta-llama/llama-3.1-8b-instruct">Llama 3.1 8B</option>
            </optgroup>
            <optgroup label="Mistral">
              <option value="mistralai/mistral-large">Mistral Large</option>
              <option value="mistralai/mistral-small-3.1-24b-instruct">Mistral Small 3.1</option>
            </optgroup>
            <optgroup label="DeepSeek">
              <option value="deepseek/deepseek-chat-v3-0324">DeepSeek Chat V3</option>
              <option value="deepseek/deepseek-r1">DeepSeek R1</option>
            </optgroup>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Or enter custom model ID from <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">openrouter.ai/models</a>
          </p>
        </div>
      </div>

      {/* Custom Model Input */}
      <div className="mb-4">
        <label htmlFor="openrouterModelCustom" className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
          Or Enter Custom Model ID
        </label>
        <input
          id="openrouterModelCustom"
          type="text"
          value={config.openrouterModel}
          onChange={(e) => onChange('openrouterModel', e.target.value)}
          className="w-full px-3 py-2 border-2 border-gray-300 focus:outline-none focus:border-black focus-visible:ring-2 focus-visible:ring-black text-sm"
          placeholder="e.g., anthropic/claude-3.5-sonnet"
        />
      </div>

      {/* OpenRouter Status Message */}
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

      {/* OpenRouter Test Button */}
      <div className="mb-2">
        <button
          onClick={onTest}
          disabled={testing}
          className="px-4 py-2 bg-black text-white text-xs font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        >
          {testing ? 'Testing OpenRouter...' : 'Test OpenRouter API'}
        </button>
      </div>

      {/* OpenRouter Help Text */}
      <div className="text-xs text-gray-600 space-y-1">
        <p>
          Get API key: <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">OpenRouter Dashboard</a>
        </p>
      </div>
    </>
  );
}
