/**
 * LLM / MCP connectivity probes
 *
 * "Test connection" handlers for the settings dialog. Each probe performs a
 * lightweight read against the target service and resolves a result object —
 * `{ type: 'success' | 'error', message: string }` — instead of throwing, so
 * the UI can render the outcome directly.
 */

import { DEFAULT_OLLAMA_BASE_URL, DEFAULT_OLLAMA_MODEL, normalizeOpenAiBaseUrl } from './llmProviders.js';

const PROBE_TIMEOUT_MS = 10000;

/**
 * Read a probe response as JSON, failing with a message about the *service*
 * rather than about JSON syntax.
 *
 * A probe URL that resolves to a web server — a relative URL answered by the
 * SPA fallback, a wrong host, a captive portal — returns an HTML page with
 * status 200. `response.json()` then throws `Unexpected token '<'`, which
 * tells the user nothing about what to fix.
 *
 * The body is inspected through `clone()` so the original stream is still
 * intact for the caller; where `clone` is unavailable the message degrades
 * to the generic form rather than throwing again.
 */
const readProbeJson = async (response, service, url) => {
  const copy = typeof response.clone === 'function' ? response.clone() : null;
  try {
    return await response.json();
  } catch {
    let body = '';
    if (copy) {
      try {
        body = await copy.text();
      } catch {
        // Body already consumed — fall through to the generic message.
      }
    }
    const where = response.url || url || 'the configured URL';
    throw new Error(
      body.trimStart().startsWith('<')
        ? `${where} returned a web page, not the ${service} API. Check the server URL in Settings.`
        : `${where} did not return valid ${service} JSON.`
    );
  }
};

/** Best-effort error text from a non-OK response, tolerant of a non-JSON body. */
const readProbeError = async (response) => {
  try {
    const data = await readProbeJson(response, 'API');
    return data.error?.message || `API returned ${response.status}`;
  } catch {
    return `API returned ${response.status}`;
  }
};

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
  // Defaulted here, not assumed: a first run has no saved settings, so both
  // fields arrive undefined (see DEFAULT_OLLAMA_BASE_URL for what that used
  // to produce).
  const baseUrl = ollamaBaseUrl || DEFAULT_OLLAMA_BASE_URL;
  const model = ollamaModel || DEFAULT_OLLAMA_MODEL;

  try {
    // Use the dev proxy for the default localhost URL to avoid CORS
    const isDefaultOllama = baseUrl === DEFAULT_OLLAMA_BASE_URL;
    const ollamaUrl = (import.meta.env.DEV && isDefaultOllama)
      ? '/ollama/api/tags'
      : `${baseUrl}/api/tags`;

    const response = await fetch(ollamaUrl, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    });

    if (!response.ok) {
      // 502/503/504 come from something in front of Ollama that could not
      // reach it — in dev that is Vite's /ollama proxy. Reporting the raw
      // status would point the user at a gateway they did not configure.
      const unreachable = response.status === 502 || response.status === 503 || response.status === 504;
      throw new Error(
        unreachable
          ? `${baseUrl} is not responding (${response.status}).`
          : `Ollama server returned ${response.status}`
      );
    }

    const data = await readProbeJson(response, 'Ollama', ollamaUrl);
    const modelExists = data.models?.some(m => m.name === model);

    if (modelExists) {
      return { type: 'success', message: `Ollama is running! Model "${model}" is available.` };
    }

    const availableModels = data.models?.map(m => m.name).join(', ') || 'none';
    return {
      type: 'error',
      message: `Model "${model}" not found. Available models: ${availableModels}\n\nRun: ollama pull ${model}`
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
      throw new Error(await readProbeError(response));
    }

    const data = await readProbeJson(response, 'Gemini');
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
  if (provider === 'openai-compatible') {
    return probeOpenAiCompatible(config);
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
      throw new Error(await readProbeError(response));
    }

    const data = await readProbeJson(response, 'OpenRouter');
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

/**
 * Probe an OpenAI-compatible endpoint by listing its models and checking the
 * configured model is present.
 *
 * Unlike the cloud providers the API key is OPTIONAL — the Authorization
 * header is sent only when a key is set, so keyless endpoints (LM Studio,
 * llama.cpp, …) probe cleanly while a key-requiring gateway still gets its
 * Bearer credential. A bare-origin URL is normalized through the same helper
 * the agent init uses, so probe and chat hit the same API root.
 *
 * @param {{openaiCompatibleBaseUrl: string, openaiCompatibleApiKey: string, openaiCompatibleModel: string}} config
 * @returns {Promise<{type: string, message: string}>}
 */
export const probeOpenAiCompatible = async ({ openaiCompatibleBaseUrl, openaiCompatibleApiKey, openaiCompatibleModel }) => {
  const baseUrl = normalizeOpenAiBaseUrl(openaiCompatibleBaseUrl);
  if (!baseUrl) {
    return { type: 'error', message: 'Endpoint URL is required. Enter it above.' };
  }

  try {
    const headers = {};
    if (openaiCompatibleApiKey) {
      headers['Authorization'] = `Bearer ${openaiCompatibleApiKey}`;
    }

    const response = await fetch(`${baseUrl}/models`, {
      headers,
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new Error(await readProbeError(response));
    }

    const data = await readProbeJson(response, 'OpenAI-compatible');
    const modelExists = data.data?.some(m => m.id === openaiCompatibleModel);

    if (modelExists) {
      return { type: 'success', message: `Endpoint is working! Model "${openaiCompatibleModel}" is available.` };
    }

    // Custom endpoints usually serve a handful of models, so listing them is
    // actionable rather than noisy (unlike OpenRouter's catalogue).
    const availableModels = data.data?.map(m => m.id).join(', ') || 'none';
    return {
      type: 'error',
      message: `Model "${openaiCompatibleModel}" not found. Available models: ${availableModels}`
    };
  } catch (error) {
    return {
      type: 'error',
      message: `Cannot connect to the endpoint: ${error.message}\n\nCheck the endpoint URL — and the API key, if it requires one.`
    };
  }
};
