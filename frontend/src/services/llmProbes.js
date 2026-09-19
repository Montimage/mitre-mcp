/**
 * LLM / MCP connectivity probes
 *
 * "Test connection" handlers for the settings dialog. Each probe performs a
 * lightweight read against the target service and resolves a result object —
 * `{ type: 'success' | 'error', message: string }` — instead of throwing, so
 * the UI can render the outcome directly.
 */

const PROBE_TIMEOUT_MS = 10000;

/**
 * Probe the MCP server. Dynamically imports the client cache so the module
 * is not pulled in until the user actually tests the connection. The probe
 * goes through the shared per-configuration cache (F-PERF-009): an
 * unchanged host:port reuses the live client instead of building — and
 * abandoning — a new one on every press.
 *
 * @param {{host: string, port: number}} config
 * @returns {Promise<{type: string, message: string}>}
 */
export const probeMcpServer = async ({ host, port }) => {
  try {
    const { getMcpClient } = await import('./mcpClientCache.js');
    const client = getMcpClient(host, port);
    const success = await client.testConnection();

    return success
      ? { type: 'success', message: 'Connection successful! MCP server is responding.' }
      : { type: 'error', message: 'Connection failed. Please check server address and ensure mitre-mcp is running.' };
  } catch (error) {
    // The console pointer is a developer diagnostic — only surface it in dev
    // builds; production users get the actionable message only.
    const hint = import.meta.env.DEV ? '\n\nCheck browser console for details.' : '';
    return { type: 'error', message: `Connection error: ${error.message}${hint}` };
  }
};

/**
 * Probe a local Ollama server by listing its tags and checking the configured
 * model is present.
 *
 * @param {{ollamaBaseUrl: string, ollamaModel: string}} config
 * @returns {Promise<{type: string, message: string}>}
 */
export const probeOllama = async ({ ollamaBaseUrl, ollamaModel }) => {
  try {
    // Use the dev proxy for the default localhost URL to avoid CORS
    const isDefaultOllama = ollamaBaseUrl === 'http://localhost:11434';
    const ollamaUrl = (import.meta.env.DEV && isDefaultOllama)
      ? '/ollama/api/tags'
      : `${ollamaBaseUrl}/api/tags`;

    const response = await fetch(ollamaUrl, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new Error(`Ollama server returned ${response.status}`);
    }

    const data = await response.json();
    const modelExists = data.models?.some(m => m.name === ollamaModel);

    if (modelExists) {
      return { type: 'success', message: `Ollama is running! Model "${ollamaModel}" is available.` };
    }

    const availableModels = data.models?.map(m => m.name).join(', ') || 'none';
    return {
      type: 'error',
      message: `Model "${ollamaModel}" not found. Available models: ${availableModels}\n\nRun: ollama pull ${ollamaModel}`
    };
  } catch (error) {
    return {
      type: 'error',
      message: `Cannot connect to Ollama: ${error.message}\n\nMake sure Ollama is running: ollama serve`
    };
  }
};

/**
 * Probe the Gemini API by listing models and checking the configured model.
 *
 * @param {{geminiApiKey: string, geminiModel: string}} config
 * @returns {Promise<{type: string, message: string}>}
 */
export const probeGemini = async ({ geminiApiKey, geminiModel }) => {
  if (!geminiApiKey) {
    return { type: 'error', message: 'Gemini API key is required. Enter it above.' };
  }

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models',
      {
        headers: { 'x-goog-api-key': geminiApiKey },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API returned ${response.status}`);
    }

    const data = await response.json();
    const modelExists = data.models?.some(m => m.name.includes(geminiModel.replace('gemini-', '')));

    if (modelExists) {
      return { type: 'success', message: `Gemini API is working! Model "${geminiModel}" is available.` };
    }

    const availableModels = data.models?.map(m => m.name.split('/').pop()).join(', ') || 'none';
    return {
      type: 'error',
      message: `Model "${geminiModel}" not found. Available models: ${availableModels}`
    };
  } catch (error) {
    return {
      type: 'error',
      message: `Cannot connect to Gemini API: ${error.message}\n\nMake sure your API key is valid.`
    };
  }
};

/**
 * Probe whichever LLM provider the config selects.
 *
 * Used by ChatBox on agent init/rebuild so the LLM status dot only goes green
 * when the provider actually answers — a constructor that merely validates
 * the config says nothing about reachability or the model being installed.
 * Missing-key configs resolve an error result here too, so the caller can
 * surface the cause instead of discovering it on first send.
 *
 * @param {Object} config - Full settings object (reads llmProvider + provider fields)
 * @returns {Promise<{type: string, message: string}>}
 */
export const probeLlmProvider = (config) => {
  const provider = config?.llmProvider || 'ollama';
  if (provider === 'gemini') {
    return probeGemini(config);
  }
  if (provider === 'openrouter') {
    return probeOpenRouter(config);
  }
  return probeOllama(config);
};

/**
 * Probe the OpenRouter API by listing models and checking the configured model.
 *
 * @param {{openrouterApiKey: string, openrouterModel: string}} config
 * @returns {Promise<{type: string, message: string}>}
 */
export const probeOpenRouter = async ({ openrouterApiKey, openrouterModel }) => {
  if (!openrouterApiKey) {
    return { type: 'error', message: 'OpenRouter API key is required. Enter it above.' };
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'MITRE MCP Chat'
      },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API returned ${response.status}`);
    }

    const data = await response.json();
    const modelExists = data.data?.some(m => m.id === openrouterModel);

    if (modelExists) {
      return { type: 'success', message: `OpenRouter API is working! Model "${openrouterModel}" is available.` };
    }

    return {
      type: 'error',
      message: `Model "${openrouterModel}" not found. Please check the model ID on openrouter.ai/models`
    };
  } catch (error) {
    return {
      type: 'error',
      message: `Cannot connect to OpenRouter API: ${error.message}\n\nMake sure your API key is valid.`
    };
  }
};
