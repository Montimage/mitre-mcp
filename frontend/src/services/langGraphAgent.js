/**
 * Browser-Compatible Agent with Multiple LLM Support
 *
 * Implements an agent pattern similar to LangGraph but browser-compatible.
 * Supports Ollama for local LLM inference, Google Gemini, OpenRouter, and any
 * OpenAI-compatible endpoint for cloud-based inference.
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
import { getMcpClient } from './mcpClientCache.js';
import {
  LLM_PROVIDERS,
  initOllama,
  initGemini,
  initOpenRouter,
  initOpenAiCompatible,
  buildAgentErrorMessage
} from './llmProviders.js';
import {
  normalizeContent,
  contentText,
  formatToolResult as formatToolResultText,
  buildSystemPrompt as buildSystemPromptText,
  AGENT_ERROR_KINDS,
  agentErrorResult,
  agentErrorKind,
  tagAgentError
} from './agentMessages.js';

export { LLM_PROVIDERS };

/**
 * Maximum number of stored history entries replayed to the model per query.
 *
 * `conversationHistory` keeps the full record for the session, but only the
 * most recent entries are sent so the prompt stays bounded instead of
 * re-sending an ever-growing transcript every turn (F-PERF-008).
 * 20 entries ≈ the last 10 user/assistant exchanges.
 */
export const MAX_HISTORY_MESSAGES = 20;

/**
 * Browser-Compatible Agent with Multiple LLM Support
 *
 * Implements intelligent query routing and tool execution
 * using Ollama for local LLM inference, Google Gemini, OpenRouter, or an
 * OpenAI-compatible endpoint for cloud-based inference.
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
    // One client per server configuration (F-PERF-009): an unchanged
    // host:port reuses the shared instance — and its session — across agent
    // rebuilds; a changed one swaps the cache entry, which closes the
    // evicted client. If this constructor throws after this line (provider
    // init failure), the still-live previous agent's client was evicted but
    // only reset, so it re-initializes lazily on its next call.
    this.mcpClient = getMcpClient(host, port);

    // Determine LLM provider
    this.llmProvider = config.llmProvider || LLM_PROVIDERS.OLLAMA;

    // The provider init validates synchronously — a missing API key still
    // throws out of the constructor — and returns a promise for the
    // dynamically imported SDK model, so only the selected provider's chunk
    // is ever fetched (F-PERF-007).
    let llmInit;
    if (this.llmProvider === LLM_PROVIDERS.GEMINI) {
      llmInit = initGemini(this, config);
    } else if (this.llmProvider === LLM_PROVIDERS.OPENROUTER) {
      llmInit = initOpenRouter(this, config);
    } else if (this.llmProvider === LLM_PROVIDERS.OPENAI_COMPATIBLE) {
      llmInit = initOpenAiCompatible(this, config);
    } else {
      llmInit = initOllama(this, config);
    }

    this.llm = null;
    this.llmWithTools = null;
    this.llmReady = Promise.resolve(llmInit).then((llm) => {
      this.llm = llm;
      // ??= so a test that stubbed llmWithTools before the SDK resolved is
      // not clobbered when the import lands.
      this.llmWithTools ??= llm;
      return llm;
    });
    // Swallow only the *unobserved* rejection — awaiters still see it via
    // llmReady — so an agent that is constructed but never queried cannot
    // raise an unhandled-rejection warning if the SDK fails to load.
    this.llmReady.catch(() => {});

    // Tool surface is discovered from the server's tools/list at runtime —
    // starts empty and is populated lazily on first use (see ensureTools)
    this.tools = [];
    this.toolDefinitions = [];
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
    // The provider SDK resolves asynchronously from the constructor — wait
    // for it before anything touches this.llm (bindTools in createMCPTools).
    await this.llmReady;
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
        let envelope;
        try {
          envelope = await client.callTool(name, args ?? {});
        } catch (error) {
          // A rejected tools/call is transport-level — the server is
          // unreachable or the session died. Tag it so the query surfaces a
          // 'server' failure rather than a tool-level one (F-UX-009).
          throw tagAgentError(error, AGENT_ERROR_KINDS.SERVER);
        }
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
            content: JSON.stringify({ error: `Tool ${toolCall.name} not found` }),
            failed: true
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

        // A transport-level failure means the server is gone — feeding it
        // back to the model only burns iterations on calls that cannot
        // succeed, so it aborts the query as a typed 'server' error
        // (F-UX-009). Tool-level failures still go back for the model to
        // recover from (fixed arguments, a different tool).
        if (error?.agentKind === AGENT_ERROR_KINDS.SERVER) {
          throw error;
        }

        results.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: toolCall.name,
          content: JSON.stringify({ error: error.message }),
          failed: true
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
   * Resolves to the assistant's answer string on success. On failure it
   * resolves to a typed error result — `{ error: true, kind, message,
   * retryable }` where kind is 'llm' (provider/model failure), 'tool' (an
   * MCP tool call kept failing) or 'server' (the MCP server was
   * unreachable) — so the caller can render an error with a Retry action
   * instead of an assistant answer (F-UX-009).
   *
   * @param {string} query - User's natural language query
   * @param {Function} onToolCallRequest - Optional callback for tool approval (toolCalls) => Promise<boolean>
   * @returns {Promise<string|{error: true, kind: string, message: string, retryable: boolean}>} Agent response or typed error
   */
  async processQuery(query, onToolCallRequest = null) {
    // Set when a tool-level failure was fed back into the loop this query —
    // it decides whether a max-iterations exit is a 'tool' or 'llm' failure.
    let toolFailed = false;
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

      // Build messages for LLM — only real conversation turns are replayed:
      // 'error' entries are UI-facing failure records, not user input
      // (F-BUG-021), and the replay is capped at the most recent entries so
      // the prompt stays bounded (F-PERF-008)
      const messages = [
        systemMessage,
        ...this.conversationHistory
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .slice(-MAX_HISTORY_MESSAGES)
          .map(m => ({
            role: m.role,
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

        // Invoke LLM — a rejection here is a provider/model failure,
        // tagged 'llm' for the query-level catch (F-UX-009)
        let response;
        try {
          response = await this.llmWithTools.invoke(currentMessages);
        } catch (invokeError) {
          throw tagAgentError(invokeError, AGENT_ERROR_KINDS.LLM);
        }

        // Debug: log the response shape (content preview + tool calls)
        console.log('[Agent] LLM response:', {
          content: typeof response.content === 'string' ? response.content.substring(0, 200) : response.content,
          contentType: typeof response.content,
          tool_calls: response.tool_calls
        });

        // Check if the LLM requested tool calls — LangChain normalises
        // provider responses onto response.tool_calls (F-BUG-032)
        const toolCalls = response.tool_calls || [];

        if (toolCalls.length > 0) {
          console.log(`[Agent] LLM requested ${toolCalls.length} tool call(s)`, toolCalls);

          // Request user approval if callback provided. The calls handed to
          // the approval UI carry the display metadata discovered via
          // tools/list — the human-readable title, the plain-language
          // description and the readOnlyHint flag — so the card can be
          // proportionate for read-only lookups (F-UX-010). Execution below
          // still uses the provider's original tool_calls.
          if (onToolCallRequest) {
            const approvalCalls = toolCalls.map((toolCall) => {
              const def = this.toolDefinitions.find((d) => d.name === toolCall.name);
              const annotations = def?.annotations ?? {};
              return {
                ...toolCall,
                title: def?.title || annotations.title || toolCall.name,
                description: def?.description || '',
                readOnly: annotations.readOnlyHint === true
              };
            });
            const approved = await onToolCallRequest(approvalCalls);
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

          // Execute tools — a transport-level failure throws out of here
          // tagged 'server'; tool-level failures come back as tool results
          // flagged `failed` (an internal marker, stripped before the model
          // sees them) so a max-iterations exit can be classified (F-UX-009)
          const toolResults = await this.executeTools(toolCalls);
          if (toolResults.some((r) => r.failed)) {
            toolFailed = true;
          }

          // Add tool results to messages — the internal `failed` marker is
          // stripped so the wire shape stays exactly what the model expects
          currentMessages.push(...toolResults.map((r) => ({
            tool_call_id: r.tool_call_id,
            role: r.role,
            name: r.name,
            content: r.content
          })));

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

      // Max iterations reached — a real failure, returned as a typed error
      // (F-UX-009): when a tool call failed along the way the tools are the
      // subsystem that could not satisfy the query ('tool'); otherwise the
      // model kept looping without a final answer ('llm').
      const kind = toolFailed ? AGENT_ERROR_KINDS.TOOL : AGENT_ERROR_KINDS.LLM;
      const message = buildAgentErrorMessage(
        this,
        new Error('the agent reached the maximum number of iterations without a final answer'),
        kind
      );

      this.conversationHistory.push({
        role: 'error',
        content: message,
        kind,
        timestamp: new Date()
      });

      return agentErrorResult(kind, message);
    } catch (error) {
      console.error('[Agent] Error:', error);

      const kind = agentErrorKind(error);
      const message = buildAgentErrorMessage(this, error, kind);

      this.conversationHistory.push({
        role: 'error',
        content: message,
        kind,
        timestamp: new Date()
      });

      return agentErrorResult(kind, message);
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
    } else if (this.llmProvider === LLM_PROVIDERS.OPENAI_COMPATIBLE) {
      status.openaiCompatibleModel = this.openaiCompatibleConfig?.model;
      status.openaiCompatibleBaseUrl = this.openaiCompatibleConfig?.baseUrl;
    } else {
      status.ollamaModel = this.ollamaConfig?.model;
      status.ollamaBaseUrl = this.ollamaConfig?.baseUrl;
    }

    return status;
  }
}
