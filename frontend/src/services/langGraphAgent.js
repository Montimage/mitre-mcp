/**
 * Browser-Compatible Agent with Ollama LLM
 *
 * Implements an agent pattern similar to LangGraph but browser-compatible.
 * Uses Ollama for local LLM inference with tool calling capabilities.
 *
 * Architecture:
 * 1. LLM with tool binding (ChatOllama)
 * 2. Agent loop: Query → LLM → Tool Call → LLM → Response
 * 3. Maintains conversation history for context
 */

import { ChatOllama } from '@langchain/ollama';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import MitreMCPClient, { MCP_TOOLS } from './mcpClient.js';

/**
 * Browser-Compatible Agent with Ollama LLM
 *
 * Implements intelligent query routing and tool execution
 * using Ollama for local LLM inference.
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

    // Ollama configuration
    this.ollamaConfig = {
      model: config.ollamaModel || 'llama3.2',
      baseUrl: config.ollamaBaseUrl || 'http://localhost:11434',
      temperature: config.temperature || 0.7,
      ...config
    };

    // Initialize LLM
    this.llm = new ChatOllama(this.ollamaConfig);

    // Create MCP tools
    this.tools = this.createMCPTools();

    // Bind tools to LLM
    this.llmWithTools = this.llm.bindTools(this.tools);

    this.conversationHistory = [];
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
   * @returns {Promise<string>} Agent response
   */
  async processQuery(query) {
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

You can help users with:
- Finding information about tactics, techniques, groups, software, and mitigations
- Answering questions about specific threat actors and their methods
- Providing defense recommendations and mitigation strategies
- Explaining cybersecurity concepts in the context of MITRE ATT&CK

When using tools:
- Always use get_technique_by_id when the user mentions a specific technique ID (e.g., T1055)
- Use get_techniques_used_by_group when asked about specific threat actors (e.g., APT29, APT28)
- Use get_techniques_by_tactic when asked about techniques for a specific tactic
- Provide clear, concise answers based on the data you receive
- Format responses in a user-friendly way with proper structure

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

        // Check if LLM wants to call tools
        if (response.tool_calls && response.tool_calls.length > 0) {
          console.log(`[Agent] LLM requested ${response.tool_calls.length} tool call(s)`);

          // Add AI message with tool calls
          currentMessages.push({
            role: 'assistant',
            content: response.content || '',
            tool_calls: response.tool_calls
          });

          // Execute tools
          const toolResults = await this.executeTools(response.tool_calls);

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

      const errorMessage = `I encountered an error while processing your query: ${error.message}\n\nPlease make sure:\n- Ollama is running locally (http://localhost:11434)\n- The ${this.ollamaConfig.model} model is installed (run: ollama pull ${this.ollamaConfig.model})\n- The mitre-mcp server is running\n- Your query is clear and specific`;

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
   * Get agent status
   *
   * @returns {Object} Agent status information
   */
  getStatus() {
    return {
      mcpStatus: this.mcpClient.getStatus(),
      conversationLength: this.conversationHistory.length,
      ollamaModel: this.ollamaConfig.model,
      ollamaBaseUrl: this.ollamaConfig.baseUrl,
      toolsCount: this.tools.length
    };
  }
}
