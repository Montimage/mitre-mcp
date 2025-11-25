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
import { z } from 'zod';
import MitreMCPClient, { MCP_TOOLS } from './mcpClient.js';

/**
 * LLM Provider types
 */
export const LLM_PROVIDERS = {
  OLLAMA: 'ollama',
  GEMINI: 'gemini',
  OPENROUTER: 'openrouter'
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

    // Create MCP tools
    this.tools = this.createMCPTools();

    // Bind tools to LLM
    this.llmWithTools = this.llm.bindTools(this.tools);

    this.conversationHistory = [];
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
    // Get API key from config or environment variable
    const apiKey = config.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('Gemini API key is required. Set VITE_GEMINI_API_KEY in .env or provide geminiApiKey in config.');
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
    // Get API key from config or environment variable
    const apiKey = config.openrouterApiKey || import.meta.env.VITE_OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new Error('OpenRouter API key is required. Set VITE_OPENROUTER_API_KEY in .env or provide openrouterApiKey in config.');
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
   * Create LangChain tools from MCP tools
   *
   * Wraps each MCP tool in a LangChain tool interface
   *
   * @returns {Array} Array of LangChain tools
   */
  createMCPTools() {
    const tools = [];

    // get_tactics tool
    tools.push(
      tool(
        async ({ domain }) => {
          const result = await this.mcpClient.callTool(MCP_TOOLS.GET_TACTICS, { domain });
          return this.formatToolResult(result);
        },
        {
          name: 'get_tactics',
          description: 'Get all MITRE ATT&CK tactics. Returns a list of tactical categories like Initial Access, Execution, Persistence, etc.',
          schema: z.object({
            domain: z.enum(['enterprise-attack', 'mobile-attack', 'ics-attack']).default('enterprise-attack')
          })
        }
      )
    );

    // get_techniques tool
    tools.push(
      tool(
        async ({ domain, include_subtechniques, limit }) => {
          const result = await this.mcpClient.callTool(MCP_TOOLS.GET_TECHNIQUES, {
            domain,
            include_subtechniques,
            limit
          });
          return this.formatToolResult(result);
        },
        {
          name: 'get_techniques',
          description: 'List all MITRE ATT&CK techniques with optional filtering. Use this to explore available techniques.',
          schema: z.object({
            domain: z.enum(['enterprise-attack', 'mobile-attack', 'ics-attack']).default('enterprise-attack'),
            include_subtechniques: z.boolean().default(false),
            limit: z.number().default(20)
          })
        }
      )
    );

    // get_technique_by_id tool
    tools.push(
      tool(
        async ({ technique_id, domain }) => {
          const result = await this.mcpClient.callTool(MCP_TOOLS.GET_TECHNIQUE_BY_ID, {
            technique_id,
            domain
          });
          return this.formatToolResult(result);
        },
        {
          name: 'get_technique_by_id',
          description: 'Look up a specific MITRE ATT&CK technique by its ID (e.g., T1055, T1059.001). Use this when the user mentions a specific technique ID.',
          schema: z.object({
            technique_id: z.string().regex(/^T\d{4}(\.\d{3})?$/),
            domain: z.enum(['enterprise-attack', 'mobile-attack', 'ics-attack']).default('enterprise-attack')
          })
        }
      )
    );

    // get_techniques_by_tactic tool
    tools.push(
      tool(
        async ({ tactic_shortname, domain }) => {
          const result = await this.mcpClient.callTool(MCP_TOOLS.GET_TECHNIQUES_BY_TACTIC, {
            tactic_shortname,
            domain
          });
          return this.formatToolResult(result);
        },
        {
          name: 'get_techniques_by_tactic',
          description: 'Get all techniques for a specific tactic (e.g., initial-access, execution, persistence). Use this when the user asks about techniques for a specific tactic.',
          schema: z.object({
            tactic_shortname: z.string(),
            domain: z.enum(['enterprise-attack', 'mobile-attack', 'ics-attack']).default('enterprise-attack')
          })
        }
      )
    );

    // get_groups tool
    tools.push(
      tool(
        async ({ domain }) => {
          const result = await this.mcpClient.callTool(MCP_TOOLS.GET_GROUPS, { domain });
          return this.formatToolResult(result);
        },
        {
          name: 'get_groups',
          description: 'Get all threat actor groups tracked by MITRE ATT&CK. Returns APT groups, cybercriminal organizations, etc.',
          schema: z.object({
            domain: z.enum(['enterprise-attack', 'mobile-attack', 'ics-attack']).default('enterprise-attack')
          })
        }
      )
    );

    // get_techniques_used_by_group tool
    tools.push(
      tool(
        async ({ group_name, domain }) => {
          const result = await this.mcpClient.callTool(MCP_TOOLS.GET_TECHNIQUES_USED_BY_GROUP, {
            group_name,
            domain
          });
          return this.formatToolResult(result);
        },
        {
          name: 'get_techniques_used_by_group',
          description: 'Get techniques used by a specific threat group (e.g., APT29, APT28, FIN7). Use this when the user asks about a specific threat actor.',
          schema: z.object({
            group_name: z.string(),
            domain: z.enum(['enterprise-attack', 'mobile-attack', 'ics-attack']).default('enterprise-attack')
          })
        }
      )
    );

    // get_software tool
    tools.push(
      tool(
        async ({ domain, software_types }) => {
          const result = await this.mcpClient.callTool(MCP_TOOLS.GET_SOFTWARE, {
            domain,
            software_types
          });
          return this.formatToolResult(result);
        },
        {
          name: 'get_software',
          description: 'Get malware and tools used by threat actors. Can filter by type (malware or tool).',
          schema: z.object({
            domain: z.enum(['enterprise-attack', 'mobile-attack', 'ics-attack']).default('enterprise-attack'),
            software_types: z.array(z.enum(['malware', 'tool'])).optional()
          })
        }
      )
    );

    // get_mitigations tool
    tools.push(
      tool(
        async ({ domain }) => {
          const result = await this.mcpClient.callTool(MCP_TOOLS.GET_MITIGATIONS, { domain });
          return this.formatToolResult(result);
        },
        {
          name: 'get_mitigations',
          description: 'Get all security mitigations recommended by MITRE ATT&CK. Use this when the user asks about defenses or security controls.',
          schema: z.object({
            domain: z.enum(['enterprise-attack', 'mobile-attack', 'ics-attack']).default('enterprise-attack')
          })
        }
      )
    );

    // get_techniques_mitigated_by_mitigation tool
    tools.push(
      tool(
        async ({ mitigation_name, domain }) => {
          const result = await this.mcpClient.callTool(
            MCP_TOOLS.GET_TECHNIQUES_MITIGATED_BY_MITIGATION,
            { mitigation_name, domain }
          );
          return this.formatToolResult(result);
        },
        {
          name: 'get_techniques_mitigated_by_mitigation',
          description: 'Get techniques addressed by a specific mitigation (e.g., Network Segmentation, Multi-factor Authentication).',
          schema: z.object({
            mitigation_name: z.string(),
            domain: z.enum(['enterprise-attack', 'mobile-attack', 'ics-attack']).default('enterprise-attack')
          })
        }
      )
    );

    return tools;
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
   * Process user query through the agent loop
   *
   * @param {string} query - User's natural language query
   * @param {Function} onToolCallRequest - Optional callback for tool approval (toolCalls) => Promise<boolean>
   * @returns {Promise<string>} Agent response
   */
  async processQuery(query, onToolCallRequest = null) {
    try {
      console.log('[Agent] Processing query:', query);

      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: query,
        timestamp: new Date()
      });

      // Create system prompt
      const systemMessage = {
        role: 'system',
        content: `You are a helpful cybersecurity assistant with access to the MITRE ATT&CK framework.
You have access to tools that can query the MITRE ATT&CK database. You MUST use these tools to answer questions - do not make up information.

Available tools:
- get_technique_by_id: Look up a specific technique by ID (e.g., T1055, T1059.001)
- get_techniques: List all techniques
- get_tactics: Get all tactics
- get_techniques_by_tactic: Get techniques for a specific tactic
- get_groups: Get all threat actor groups
- get_techniques_used_by_group: Get techniques used by a specific group
- get_software: Get malware and tools
- get_mitigations: Get security mitigations
- get_techniques_mitigated_by_mitigation: Get techniques addressed by a mitigation

IMPORTANT: When the user asks about MITRE ATT&CK data, you MUST call the appropriate tool. Do not describe what tool you would use - actually call it.

Examples:
- If user asks about "T1055", call get_technique_by_id with technique_id="T1055"
- If user asks about "APT29", call get_techniques_used_by_group with group_name="APT29"
- If user asks about "persistence techniques", call get_techniques_by_tactic with tactic_shortname="persistence"

Be helpful, accurate, and security-focused in your responses.`
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
              return cancelledResponse;
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

        const finalResponse = response.content;

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

      return fallbackResponse;
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

      return errorMessage;
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
      toolsCount: this.tools.length
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
