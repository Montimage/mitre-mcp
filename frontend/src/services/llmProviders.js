/**
 * LLM provider construction for the browser agent
 *
 * Validates the provider-specific config and records it on the agent
 * (`ollamaConfig`, `geminiConfig`, `openrouterConfig`), then builds the
 * LangChain chat model on `agent.llm`. Also owns the provider-hinted error
 * message shown when the agent loop fails.
 *
 * Each provider SDK is loaded with a dynamic `import()` so the bundle only
 * downloads the one provider the configuration selects — the landing page
 * never fetches the other two (F-PERF-007). The init functions stay
 * synchronous up to the dynamic import so missing-API-key validation still
 * throws synchronously from the agent constructor; the returned promise
 * resolves to the constructed chat model.
 */

/**
 * Ollama defaults, exported so the probe, the agent and the settings dialog
 * all resolve the same URL and model. They used to be spelled out in each of
 * the three, and llmProbes.js was the one that forgot to apply them — on a
 * first run the config carries no `ollamaBaseUrl`, so the probe fetched the
 * literal string "undefined/api/tags", a *relative* URL that the dev server
 * and GitHub Pages both answer with index.html. The probe then reported
 * `Unexpected token '<'` instead of anything about Ollama.
 */
export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';
export const DEFAULT_OLLAMA_MODEL = 'llama3.1:8b';

/**
 * LLM Provider types
 */
export const LLM_PROVIDERS = {
  OLLAMA: 'ollama',
  GEMINI: 'gemini',
  OPENROUTER: 'openrouter'
};

/**
 * Initialize an Ollama LLM on the agent
 *
 * @param {Object} agent - Agent instance to configure
 * @param {Object} config - Configuration options
 * @returns {Promise<*>} Resolves to the constructed ChatOllama (also on agent.llm)
 */
export const initOllama = (agent, config) => {
  const ollamaBaseUrl = config.ollamaBaseUrl || DEFAULT_OLLAMA_BASE_URL;

  // Use proxy in dev mode for default localhost:11434 to avoid CORS
  const isDefaultOllama = ollamaBaseUrl === DEFAULT_OLLAMA_BASE_URL;
  const finalOllamaUrl = (import.meta.env.DEV && isDefaultOllama)
    ? window.location.origin + '/ollama'
    : ollamaBaseUrl;

  agent.ollamaConfig = {
    model: config.ollamaModel || DEFAULT_OLLAMA_MODEL,
    baseUrl: finalOllamaUrl,
    temperature: config.temperature ?? 0.7
  };

  console.log('[LangGraphAgent] Ollama config:', {
    model: agent.ollamaConfig.model,
    baseUrl: agent.ollamaConfig.baseUrl,
    isDev: import.meta.env.DEV,
    usingProxy: import.meta.env.DEV && isDefaultOllama
  });

  // Dynamic import: the SDK chunk is fetched only when Ollama is selected.
  return import('@langchain/ollama').then(({ ChatOllama }) => {
    agent.llm = new ChatOllama(agent.ollamaConfig);
    return agent.llm;
  });
};

/**
 * Initialize a Google Gemini LLM on the agent
 *
 * @param {Object} agent - Agent instance to configure
 * @param {Object} config - Configuration options
 * @returns {Promise<*>} Resolves to the constructed ChatGoogleGenerativeAI (also on agent.llm)
 */
export const initGemini = (agent, config) => {
  const apiKey = config.geminiApiKey;

  if (!apiKey) {
    throw new Error('Gemini API key is required. Provide geminiApiKey in the settings dialog.');
  }

  agent.geminiConfig = {
    model: config.geminiModel || 'gemini-2.5-flash',
    apiKey: apiKey,
    temperature: config.temperature ?? 0.7
  };

  console.log('[LangGraphAgent] Gemini config:', {
    model: agent.geminiConfig.model,
    hasApiKey: !!apiKey
  });

  // Dynamic import: the SDK chunk is fetched only when Gemini is selected.
  return import('@langchain/google-genai').then(({ ChatGoogleGenerativeAI }) => {
    agent.llm = new ChatGoogleGenerativeAI(agent.geminiConfig);
    return agent.llm;
  });
};

/**
 * Initialize an OpenRouter LLM on the agent
 *
 * OpenRouter is OpenAI-compatible, so ChatOpenAI is used with a custom baseURL.
 *
 * @param {Object} agent - Agent instance to configure
 * @param {Object} config - Configuration options
 * @returns {Promise<*>} Resolves to the constructed ChatOpenAI (also on agent.llm)
 */
export const initOpenRouter = (agent, config) => {
  const apiKey = config.openrouterApiKey;

  if (!apiKey) {
    throw new Error('OpenRouter API key is required. Provide openrouterApiKey in the settings dialog.');
  }

  agent.openrouterConfig = {
    model: config.openrouterModel || 'anthropic/claude-3.5-sonnet',
    temperature: config.temperature ?? 0.7
  };

  console.log('[LangGraphAgent] OpenRouter config:', {
    model: agent.openrouterConfig.model,
    hasApiKey: !!apiKey
  });

  // Dynamic import: the SDK chunk is fetched only when OpenRouter is selected.
  return import('@langchain/openai').then(({ ChatOpenAI }) => {
    agent.llm = new ChatOpenAI({
      model: agent.openrouterConfig.model,
      temperature: agent.openrouterConfig.temperature,
      apiKey: apiKey,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
          'X-Title': 'MITRE MCP Chat'
        }
      }
    });
    return agent.llm;
  });
};

/**
 * One-line actionable hint for the configured provider (F-UX-009)
 *
 * Deliberately short: it names the thing to check — the key, the model, the
 * local daemon — without the old checklist that ended by blaming the user's
 * query.
 *
 * @param {Object} agent - Agent instance (reads llmProvider + provider config)
 * @returns {string} Provider-specific check hint
 */
export const buildProviderErrorHint = (agent) => {
  if (agent.llmProvider === LLM_PROVIDERS.GEMINI) {
    return `Check that the Gemini API key is valid and the ${agent.geminiConfig?.model || 'gemini-2.5-flash'} model is available.`;
  }
  if (agent.llmProvider === LLM_PROVIDERS.OPENROUTER) {
    return `Check that the OpenRouter API key is valid, has credits, and the ${agent.openrouterConfig?.model || 'anthropic/claude-3.5-sonnet'} model is available.`;
  }
  const model = agent.ollamaConfig?.model || 'llama3.1:8b';
  return `Check that Ollama is running locally and the ${model} model is installed (ollama pull ${model}).`;
};

/**
 * User-facing message for a typed agent failure (F-UX-009)
 *
 * States the failing subsystem and the cause — never the generic checklist
 * that blamed the user's query.
 *
 * @param {Object} agent - Agent instance (reads llmProvider + provider config)
 * @param {Error} error - The failure that aborted the query
 * @param {string} kind - One of AGENT_ERROR_KINDS ('llm' | 'tool' | 'server')
 * @returns {string} User-facing error text
 */
export const buildAgentErrorMessage = (agent, error, kind) => {
  const cause = error?.message || 'unknown error';
  if (kind === 'server') {
    return `The MITRE MCP server could not be reached: ${cause}`;
  }
  if (kind === 'tool') {
    return `A tool call failed: ${cause}`;
  }
  return `The LLM provider could not complete the request: ${cause}\n${buildProviderErrorHint(agent)}`;
};
