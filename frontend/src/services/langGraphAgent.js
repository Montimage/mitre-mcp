/**
 * Browser-Compatible Agent with Multiple LLM Support
 *
 * Implements an agent pattern similar to LangGraph but browser-compatible.
 * Supports Ollama for local LLM inference, Google Gemini, and OpenRouter for cloud-based inference.
 *
 * Architecture:
 * 1. LLM with tool binding (ChatOllama, ChatGoogleGenerativeAI, or ChatOpenAI)
 * 2. Agent loop: Query → LLM → Tool Call → LLM → Response
 * 3. Maintains conversation history for context
 */

import { ChatOllama } from '@langchain/ollama';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import MitreMCPClient from './mcpClient.js';

/**
 * LLM Provider types
 */
export const LLM_PROVIDERS = {
  OLLAMA: 'ollama',
  GEMINI: 'gemini',
  OPENROUTER: 'openrouter'
};

/**
 * Normalise LLM response content to a plain string.
 * Providers may return content as a string or as an array of content
 * blocks (e.g. { type: 'text', text: '...' }); the UI expects a string.
 *
 * @param {*} content - Raw message content from the provider
 * @returns {string} Normalised string content
 */
const normalizeContent = (content) => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          if (typeof part.text === 'string') return part.text;
          if (typeof part.content === 'string') return part.content;
        }
        return '';
      })
      .join('');
  }
  if (content == null) return '';
  return String(content);
};

/**
 * Extract human-readable text from an MCP content block array
 *
 * @param {Array} content - MCP `content` array from a CallToolResult
 * @returns {string} Concatenated text blocks
 */
const contentText = (content) => {
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => (part && typeof part === 'object' && typeof part.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('\n');
};

/**
 * Browser-Compatible Agent with Multiple LLM Support
 *
 * Implements intelligent query routing and tool execution
 * using Ollama for local LLM inference, Google Gemini, or OpenRouter for cloud-based inference.
 */
export default class LangGraphAgent {
  /**
   * Create a new agent instance
   *
   * @param {string} host - MCP server host
   * @param {number} port - MCP server port
   * @param {Object} config - Agent configuration
   */
  constructor(host = 'localhost', port = 8000, config = {}) {
    this.mcpClient = new MitreMCPClient(host, port);

    // Determine LLM provider
    this.llmProvider = config.llmProvider || LLM_PROVIDERS.OLLAMA;

    if (this.llmProvider === LLM_PROVIDERS.GEMINI) {
      this.initGemini(config);
    } else if (this.llmProvider === LLM_PROVIDERS.OPENROUTER) {
      this.initOpenRouter(config);
    } else {
      this.initOllama(config);
    }

    // Tool surface is discovered from the server's tools/list at runtime —
    // starts empty and is populated asynchronously (see createMCPTools)
    this.tools = [];
    this.toolDefinitions = [];
    this.llmWithTools = this.llm;

    // Kick off discovery immediately; createMCPTools never rejects —
    // it resolves true/false so callers can retry on the next query
    this.toolsReady = this.createMCPTools();

    this.conversationHistory = [];
  }

  /**
   * Ensure the tool surface has been discovered before use
   *
   * Awaits in-flight discovery; retries once on the next call after a
   * failure (e.g. the MCP server was still starting when the agent was
   * constructed).
   *
   * @returns {Promise<Array>} LangChain tools (possibly empty)
   */
  async ensureTools() {
    if (!this.toolsReady) {
      this.toolsReady = this.createMCPTools();
    }
    const discovered = await this.toolsReady;
    if (!discovered) {
      // Clear the failed promise so the next query retries discovery
      this.toolsReady = null;
    }
    return this.tools;
  }

  /**
   * Initialize Ollama LLM
   * @param {Object} config - Configuration options
   */
  initOllama(config) {
    const defaultOllamaUrl = 'http://localhost:11434';
    const ollamaBaseUrl = config.ollamaBaseUrl || defaultOllamaUrl;

    // Use proxy in dev mode for default localhost:11434 to avoid CORS
    const isDefaultOllama = ollamaBaseUrl === defaultOllamaUrl;
    const finalOllamaUrl = (import.meta.env.DEV && isDefaultOllama)
      ? window.location.origin + '/ollama'
      : ollamaBaseUrl;

    this.ollamaConfig = {
      model: config.ollamaModel || 'llama3.1:8b',
      baseUrl: finalOllamaUrl,
      temperature: config.temperature || 0.7
    };

    console.log('[LangGraphAgent] Ollama config:', {
      model: this.ollamaConfig.model,
      baseUrl: this.ollamaConfig.baseUrl,
      isDev: import.meta.env.DEV,
      usingProxy: import.meta.env.DEV && isDefaultOllama
    });

    this.llm = new ChatOllama(this.ollamaConfig);
  }

  /**
   * Initialize Google Gemini LLM
   * @param {Object} config - Configuration options
   */
  initGemini(config) {
    const apiKey = config.geminiApiKey;

    if (!apiKey) {
      throw new Error('Gemini API key is required. Provide geminiApiKey in the settings dialog.');
    }

    this.geminiConfig = {
      model: config.geminiModel || 'gemini-2.5-flash',
      apiKey: apiKey,
      temperature: config.temperature || 0.7
    };

    console.log('[LangGraphAgent] Gemini config:', {
      model: this.geminiConfig.model,
      hasApiKey: !!apiKey
    });

    this.llm = new ChatGoogleGenerativeAI(this.geminiConfig);
  }

  /**
   * Initialize OpenRouter LLM
   * @param {Object} config - Configuration options
   */
  initOpenRouter(config) {
    const apiKey = config.openrouterApiKey;

    if (!apiKey) {
      throw new Error('OpenRouter API key is required. Provide openrouterApiKey in the settings dialog.');
    }

    this.openrouterConfig = {
      model: config.openrouterModel || 'anthropic/claude-3.5-sonnet',
      temperature: config.temperature || 0.7
    };

    console.log('[LangGraphAgent] OpenRouter config:', {
      model: this.openrouterConfig.model,
      hasApiKey: !!apiKey
    });

    // Use ChatOpenAI with OpenRouter's base URL
    // OpenRouter is OpenAI-compatible, so we use ChatOpenAI with custom baseURL
    this.llm = new ChatOpenAI({
      model: this.openrouterConfig.model,
      temperature: this.openrouterConfig.temperature,
      apiKey: apiKey,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
          'X-Title': 'MITRE MCP Chat'
        }
      }
    });
  }

  /**
   * Create LangChain tools from the server's tools/list
   *
   * Discovers the tool surface through the MCP protocol instead of
   * hard-coding declarations: every advertised tool gets a LangChain
   * wrapper whose schema is the server's own inputSchema, so new or
   * changed parameters are picked up automatically.
   *
   * Never rejects — resolves false on failure so callers can retry.
   *
   * @returns {Promise<boolean>} True when tools were discovered and bound
   */
  async createMCPTools() {
    try {
      const { tools: toolDefs } = await this.mcpClient.listTools();
      this.toolDefinitions = Array.isArray(toolDefs) ? toolDefs : [];
      this.tools = this.toolDefinitions.map((def) => this.mcpToolToLangChain(def));

      // Rebind only when we actually have tools — providers reject an
      // empty tool list, and a bare LLM is still usable as a fallback
      this.llmWithTools = this.tools.length > 0 ? this.llm.bindTools(this.tools) : this.llm;

      console.log(`[LangGraphAgent] Discovered ${this.tools.length} tool(s) via tools/list`);
      return this.tools.length > 0;
    } catch (error) {
      console.error('[LangGraphAgent] Tool discovery (tools/list) failed:', error);
      this.toolDefinitions = [];
      this.tools = [];
      this.llmWithTools = this.llm;
      return false;
    }
  }

  /**
   * Wrap one advertised MCP tool in a LangChain tool interface
   *
   * The tools/list `inputSchema` (JSON Schema) is passed through
   * unchanged — @langchain/core validates arguments against it and
   * forwards it to the provider as-is. A result flagged `isError` by the
   * server (MCP tool error, issue #47 semantics) is surfaced as a tool
   * failure rather than a successful payload containing an `error` key.
   *
   * @param {Object} toolDef - One entry of a tools/list result
   * @returns {*} LangChain structured tool
   */
  mcpToolToLangChain(toolDef) {
    const { name, description, inputSchema } = toolDef;
    const client = this.mcpClient;

    return tool(
      async (args) => {
        const envelope = await client.callTool(name, args ?? {});
        const result = envelope?.result;

        // MCP reports tool-level failures as isError + text content —
        // treat them as failures instead of parsing them as data
        if (result?.isError) {
          throw new Error(contentText(result.content) || `Tool ${name} reported an error`);
        }

        return this.formatToolResult(envelope);
      },
      {
        name,
        description: description || `${name} tool`,
        schema: inputSchema && typeof inputSchema === 'object'
          ? inputSchema
          : { type: 'object', properties: {} },
        // Surface schema-validation detail so the LLM can fix bad args
        verboseParsingErrors: true
      }
    );
  }

  /**
   * Format MCP tool result for LLM consumption
   *
   * @param {Object} result - Raw MCP result
   * @returns {string} Formatted string result
   */
  formatToolResult(result) {
    try {
      const data = result.result?.content?.[0]?.text || result.result || result;

      let parsedData;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
        } catch {
          return data;
        }
      } else {
        parsedData = data;
      }

      // Return JSON string for LLM to process
      return JSON.stringify(parsedData, null, 2);
    } catch (error) {
      console.error('Error formatting tool result:', error);
      return JSON.stringify({ error: error.message });
    }
  }

  /**
   * Execute tool calls from LLM
   *
   * @param {Array} toolCalls - Tool calls from LLM
   * @returns {Promise<Array>} Tool results
   */
  async executeTools(toolCalls) {
    await this.ensureTools();
    const results = [];

    for (const toolCall of toolCalls) {
      try {
        console.log(`[Agent] Executing tool: ${toolCall.name}`, toolCall.args);

        // Find the tool
        const tool = this.tools.find(t => t.name === toolCall.name);

        if (!tool) {
          results.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: toolCall.name,
            content: JSON.stringify({ error: `Tool ${toolCall.name} not found` })
          });
          continue;
        }

        // Execute the tool
        const result = await tool.invoke(toolCall.args);

        results.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: toolCall.name,
          content: result
        });
      } catch (error) {
        console.error(`[Agent] Error executing tool ${toolCall.name}:`, error);
        results.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: toolCall.name,
          content: JSON.stringify({ error: error.message })
        });
      }
    }

    return results;
  }

  /**
   * Build the system prompt, listing the tools discovered via tools/list
   *
   * @returns {string} System prompt content
   */
  buildSystemPrompt() {
    const toolList = this.toolDefinitions.length > 0
      ? this.toolDefinitions
        .map((def) => `- ${def.name}: ${def.description || 'No description provided'}`)
        .join('\n')
      : '- (tool discovery is unavailable; answer without tool calls)';

    return `You are a helpful cybersecurity assistant with access to the MITRE ATT&CK framework.
You have access to tools that can query the MITRE ATT&CK database. You MUST use these tools to answer questions - do not make up information.

Available tools:
${toolList}

IMPORTANT: When the user asks about MITRE ATT&CK data, you MUST call the appropriate tool. Do not describe what tool you would use - actually call it. Pick the tool whose name and description best match the question, and supply the arguments its input schema requires.

Be helpful, accurate, and security-focused in your responses.`;
  }

  /**
   * Process user query through the agent loop
   *
   * @param {string} query - User's natural language query
   * @param {Function} onToolCallRequest - Optional callback for tool approval (toolCalls) => Promise<boolean>
   * @returns {Promise<string>} Agent response
   */
  async processQuery(query, onToolCallRequest = null) {
    try {
      console.log('[Agent] Processing query:', query);

      // Make sure the discovered tool surface is bound before invoking
      await this.ensureTools();

      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: query,
        timestamp: new Date()
      });

      // Create system prompt from the discovered tool surface
      const systemMessage = {
        role: 'system',
        content: this.buildSystemPrompt()
      };

      // Build messages for LLM
      const messages = [
        systemMessage,
        ...this.conversationHistory
          .filter(m => m.role !== 'system')
          .map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content
          }))
      ];

      // Agent loop with max iterations
      const maxIterations = 5;
      let iteration = 0;
      let currentMessages = [...messages];

      while (iteration < maxIterations) {
        iteration++;
        console.log(`[Agent] Iteration ${iteration}`);

        // Invoke LLM
        const response = await this.llmWithTools.invoke(currentMessages);

        // Debug: log the full response structure
        console.log('[Agent] LLM response:', {
          content: typeof response.content === 'string' ? response.content.substring(0, 200) : response.content,
          contentType: typeof response.content,
          tool_calls: response.tool_calls,
          additional_kwargs: response.additional_kwargs
        });

        // Check if LLM wants to call tools
        // Some models put tool_calls in additional_kwargs
        const toolCalls = response.tool_calls || response.additional_kwargs?.tool_calls || [];

        if (toolCalls.length > 0) {
          console.log(`[Agent] LLM requested ${toolCalls.length} tool call(s)`, toolCalls);

          // Request user approval if callback provided
          if (onToolCallRequest) {
            const approved = await onToolCallRequest(toolCalls);
            if (!approved) {
              const cancelledResponse = "Tool execution was cancelled by user.";
              this.conversationHistory.push({
                role: 'assistant',
                content: cancelledResponse,
                timestamp: new Date()
              });
              return normalizeContent(cancelledResponse);
            }
          }

          // Add AI message with tool calls
          currentMessages.push({
            role: 'assistant',
            content: response.content || '',
            tool_calls: toolCalls
          });

          // Execute tools
          const toolResults = await this.executeTools(toolCalls);

          // Add tool results to messages
          currentMessages.push(...toolResults);

          // Continue loop to let LLM process results
          continue;
        }

        // No tool calls, we have final response
        console.log('[Agent] Final response generated');

        const finalResponse = normalizeContent(response.content);

        // Add to history
        this.conversationHistory.push({
          role: 'assistant',
          content: finalResponse,
          timestamp: new Date()
        });

        return finalResponse;
      }

      // Max iterations reached
      const fallbackResponse = 'I apologize, but I reached the maximum number of iterations while processing your query. Please try rephrasing your question or breaking it into smaller parts.';

      this.conversationHistory.push({
        role: 'assistant',
        content: fallbackResponse,
        timestamp: new Date()
      });

      return normalizeContent(fallbackResponse);
    } catch (error) {
      console.error('[Agent] Error:', error);

      let errorMessage;
      if (this.llmProvider === LLM_PROVIDERS.GEMINI) {
        errorMessage = `I encountered an error while processing your query: ${error.message}\n\nPlease make sure:\n- Your Gemini API key is valid\n- The ${this.geminiConfig?.model || 'gemini-2.5-flash'} model is available\n- The mitre-mcp server is running\n- Your query is clear and specific`;
      } else if (this.llmProvider === LLM_PROVIDERS.OPENROUTER) {
        errorMessage = `I encountered an error while processing your query: ${error.message}\n\nPlease make sure:\n- Your OpenRouter API key is valid\n- The ${this.openrouterConfig?.model || 'anthropic/claude-3.5-sonnet'} model is available\n- You have sufficient credits on OpenRouter\n- The mitre-mcp server is running\n- Your query is clear and specific`;
      } else {
        errorMessage = `I encountered an error while processing your query: ${error.message}\n\nPlease make sure:\n- Ollama is running locally (http://localhost:11434)\n- The ${this.ollamaConfig?.model || 'llama3.1:8b'} model is installed (run: ollama pull ${this.ollamaConfig?.model || 'llama3.1:8b'})\n- The mitre-mcp server is running\n- Your query is clear and specific`;
      }

      this.conversationHistory.push({
        role: 'error',
        content: errorMessage,
        timestamp: new Date()
      });

      return normalizeContent(errorMessage);
    }
  }

  /**
   * Get conversation history
   *
   * @returns {Array} Conversation history
   */
  getHistory() {
    return this.conversationHistory;
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
  }

  /**
   * Test connection to MCP server
   *
   * @returns {Promise<boolean>} True if connection successful
   */
  async testConnection() {
    try {
      return await this.mcpClient.testConnection();
    } catch (error) {
      console.error('[Agent] MCP connection test failed:', error);
      return false;
    }
  }

  /**
   * Get agent status
   *
   * @returns {Object} Agent status information
   */
  getStatus() {
    const status = {
      mcpStatus: this.mcpClient.getStatus(),
      conversationLength: this.conversationHistory.length,
      llmProvider: this.llmProvider,
      toolsCount: this.tools.length,
      toolsDiscovered: this.toolDefinitions.length > 0
    };

    if (this.llmProvider === LLM_PROVIDERS.GEMINI) {
      status.geminiModel = this.geminiConfig?.model;
    } else if (this.llmProvider === LLM_PROVIDERS.OPENROUTER) {
      status.openrouterModel = this.openrouterConfig?.model;
    } else {
      status.ollamaModel = this.ollamaConfig?.model;
      status.ollamaBaseUrl = this.ollamaConfig?.baseUrl;
    }

    return status;
  }
}
