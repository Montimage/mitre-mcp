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
 *
 * Provider construction lives in `llmProviders.js`; message/content helpers
 * live in `agentMessages.js`. This module keeps the agent class and the
 * query/tool-call loop.
 */

import { tool } from '@langchain/core/tools';
import MitreMCPClient from './mcpClient.js';
import {
  LLM_PROVIDERS,
  initOllama,
  initGemini,
  initOpenRouter,
  buildProviderErrorMessage
} from './llmProviders.js';
import {
  normalizeContent,
  contentText,
  formatToolResult as formatToolResultText,
  buildSystemPrompt as buildSystemPromptText
} from './agentMessages.js';

export { LLM_PROVIDERS };

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
      initGemini(this, config);
    } else if (this.llmProvider === LLM_PROVIDERS.OPENROUTER) {
      initOpenRouter(this, config);
    } else {
      initOllama(this, config);
    }

    // Tool surface is discovered from the server's tools/list at runtime —
    // starts empty and is populated lazily on first use (see ensureTools)
    this.tools = [];
    this.toolDefinitions = [];
    this.llmWithTools = this.llm;
    this.toolsReady = null;

    this.conversationHistory = [];
  }

  /**
   * Ensure the tool surface has been discovered before use
   *
   * Runs tools/list discovery on first call — lazy so it can reuse the
   * session initializeSession() establishes instead of racing a second
   * handshake from the constructor. Awaits in-flight discovery; retries
   * on the next call after a failure (e.g. the MCP server was still
   * starting).
   *
   * @returns {Promise<Array>} LangChain tools (possibly empty)
   */
  async ensureTools() {
    if (!this.toolsReady) {
      // createMCPTools never rejects — it resolves true/false
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
    return formatToolResultText(result);
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
    return buildSystemPromptText(this.toolDefinitions);
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

      const errorMessage = buildProviderErrorMessage(this, error);

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
