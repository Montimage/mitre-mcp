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
  const defaultOllamaUrl = 'http://localhost:11434';
  const ollamaBaseUrl = config.ollamaBaseUrl || defaultOllamaUrl;

  // Use proxy in dev mode for default localhost:11434 to avoid CORS
  const isDefaultOllama = ollamaBaseUrl === defaultOllamaUrl;
  const finalOllamaUrl = (import.meta.env.DEV && isDefaultOllama)
    ? window.location.origin + '/ollama'
    : ollamaBaseUrl;

  agent.ollamaConfig = {
    model: config.ollamaModel || 'llama3.1:8b',
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
 * Build the provider-hinted error message shown when the agent loop fails
 *
 * @param {Object} agent - Agent instance (reads llmProvider + provider config)
 * @param {Error} error - The failure that aborted the query
 * @returns {string} User-facing error text
 */
export const buildProviderErrorMessage = (agent, error) => {
  if (agent.llmProvider === LLM_PROVIDERS.GEMINI) {
    return `I encountered an error while processing your query: ${error.message}\n\nPlease make sure:\n- Your Gemini API key is valid\n- The ${agent.geminiConfig?.model || 'gemini-2.5-flash'} model is available\n- The mitre-mcp server is running\n- Your query is clear and specific`;
  }
  if (agent.llmProvider === LLM_PROVIDERS.OPENROUTER) {
    return `I encountered an error while processing your query: ${error.message}\n\nPlease make sure:\n- Your OpenRouter API key is valid\n- The ${agent.openrouterConfig?.model || 'anthropic/claude-3.5-sonnet'} model is available\n- You have sufficient credits on OpenRouter\n- The mitre-mcp server is running\n- Your query is clear and specific`;
  }
  return `I encountered an error while processing your query: ${error.message}\n\nPlease make sure:\n- Ollama is running locally (http://localhost:11434)\n- The ${agent.ollamaConfig?.model || 'llama3.1:8b'} model is installed (run: ollama pull ${agent.ollamaConfig?.model || 'llama3.1:8b'})\n- The mitre-mcp server is running\n- Your query is clear and specific`;
};
