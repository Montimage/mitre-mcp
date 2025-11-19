/**
 * LangGraph Agent Service
 *
 * Intelligent agent that routes user queries to appropriate MCP tools.
 * Can work with or without LLM integration.
 *
 * This implementation uses pattern matching for query routing.
 * For full LLM integration with OpenAI, set VITE_OPENAI_API_KEY environment variable.
 */
import MitreMCPClient, { MCP_TOOLS } from './mcpClient.js';

/**
 * Simple Agent for MCP Tool Routing
 *
 * Routes user queries to appropriate MCP tools based on pattern matching
 * and keyword detection.
 */
export default class LangGraphAgent {
  /**
   * Create a new agent instance
   *
   * @param {string} host - MCP server host
   * @param {number} port - MCP server port
   * @param {string|null} openaiApiKey - Optional OpenAI API key for LLM integration
   */
  constructor(host = 'localhost', port = 8000, openaiApiKey = null) {
    this.mcpClient = new MitreMCPClient(host, port);
    this.openaiApiKey = openaiApiKey;
    this.conversationHistory = [];
  }

  /**
   * Parse user query and determine intent
   *
   * @param {string} query - User's natural language query
   * @returns {Object} Intent with tool name and extracted parameters
   */
  parseIntent(query) {
    const lowerQuery = query.toLowerCase();

    // Pattern: Get tactics
    if (lowerQuery.includes('tactic') && (lowerQuery.includes('all') || lowerQuery.includes('list') || lowerQuery.includes('show'))) {
      return {
        tool: MCP_TOOLS.GET_TACTICS,
        params: {
          domain: this.extractDomain(lowerQuery)
        },
        confidence: 0.9
      };
    }

    // Pattern: Get specific technique by ID
    const techniqueIdMatch = lowerQuery.match(/t\d{4}(\.\d{3})?/i);
    if (techniqueIdMatch) {
      return {
        tool: MCP_TOOLS.GET_TECHNIQUE_BY_ID,
        params: {
          technique_id: techniqueIdMatch[0].toUpperCase(),
          domain: this.extractDomain(lowerQuery)
        },
        confidence: 0.95
      };
    }

    // Pattern: Get techniques by tactic
    const tacticKeywords = ['initial-access', 'execution', 'persistence', 'privilege-escalation',
                           'defense-evasion', 'credential-access', 'discovery', 'lateral-movement',
                           'collection', 'command-and-control', 'exfiltration', 'impact'];
    const foundTactic = tacticKeywords.find(tactic => lowerQuery.includes(tactic) || lowerQuery.includes(tactic.replace('-', ' ')));

    if (foundTactic && lowerQuery.includes('technique')) {
      return {
        tool: MCP_TOOLS.GET_TECHNIQUES_BY_TACTIC,
        params: {
          tactic_shortname: foundTactic,
          domain: this.extractDomain(lowerQuery)
        },
        confidence: 0.9
      };
    }

    // Pattern: Get all techniques
    if (lowerQuery.includes('technique') && (lowerQuery.includes('all') || lowerQuery.includes('list'))) {
      return {
        tool: MCP_TOOLS.GET_TECHNIQUES,
        params: {
          domain: this.extractDomain(lowerQuery),
          include_subtechniques: lowerQuery.includes('sub'),
          limit: this.extractLimit(lowerQuery)
        },
        confidence: 0.85
      };
    }

    // Pattern: Get groups
    if (lowerQuery.includes('group') && (lowerQuery.includes('all') || lowerQuery.includes('list') || lowerQuery.includes('show'))) {
      return {
        tool: MCP_TOOLS.GET_GROUPS,
        params: {
          domain: this.extractDomain(lowerQuery)
        },
        confidence: 0.9
      };
    }

    // Pattern: Get techniques used by group
    const groupMatch = lowerQuery.match(/apt\d+|apt\s*\d+|group\s+\d+/i);
    const groupNameMatch = lowerQuery.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/);

    if ((groupMatch || groupNameMatch) && (lowerQuery.includes('technique') || lowerQuery.includes('use') || lowerQuery.includes('tactic'))) {
      let groupName = groupMatch ? groupMatch[0].replace(/\s+/g, '') : groupNameMatch[0];
      return {
        tool: MCP_TOOLS.GET_TECHNIQUES_USED_BY_GROUP,
        params: {
          group_name: groupName,
          domain: this.extractDomain(lowerQuery)
        },
        confidence: 0.85
      };
    }

    // Pattern: Get software
    if (lowerQuery.includes('software') || lowerQuery.includes('malware') || lowerQuery.includes('tool')) {
      return {
        tool: MCP_TOOLS.GET_SOFTWARE,
        params: {
          domain: this.extractDomain(lowerQuery),
          software_types: this.extractSoftwareTypes(lowerQuery)
        },
        confidence: 0.85
      };
    }

    // Pattern: Get mitigations
    if (lowerQuery.includes('mitigation') && (lowerQuery.includes('all') || lowerQuery.includes('list'))) {
      return {
        tool: MCP_TOOLS.GET_MITIGATIONS,
        params: {
          domain: this.extractDomain(lowerQuery)
        },
        confidence: 0.9
      };
    }

    // Pattern: Get techniques mitigated by mitigation
    if (lowerQuery.includes('mitigation') && lowerQuery.includes('technique')) {
      // Try to extract mitigation name (usually quoted or capitalized)
      const mitigationMatch = lowerQuery.match(/"([^"]+)"|'([^']+)'/);
      if (mitigationMatch) {
        return {
          tool: MCP_TOOLS.GET_TECHNIQUES_MITIGATED_BY_MITIGATION,
          params: {
            mitigation_name: mitigationMatch[1] || mitigationMatch[2],
            domain: this.extractDomain(lowerQuery)
          },
          confidence: 0.85
        };
      }
    }

    // Default: Get tactics (most general query)
    return {
      tool: MCP_TOOLS.GET_TACTICS,
      params: {
        domain: this.extractDomain(lowerQuery)
      },
      confidence: 0.5,
      message: "I'm not sure exactly what you're looking for. Here are the available tactics:"
    };
  }

  /**
   * Extract domain from query (enterprise, mobile, ics)
   *
   * @param {string} query - User query
   * @returns {string} Domain identifier
   */
  extractDomain(query) {
    if (query.includes('mobile')) return 'mobile-attack';
    if (query.includes('ics') || query.includes('industrial')) return 'ics-attack';
    return 'enterprise-attack';
  }

  /**
   * Extract limit for paginated results
   *
   * @param {string} query - User query
   * @returns {number} Result limit
   */
  extractLimit(query) {
    const limitMatch = query.match(/(\d+)\s*(result|item|technique|group)/i);
    if (limitMatch) {
      return Math.min(parseInt(limitMatch[1]), 100);
    }
    return 20;
  }

  /**
   * Extract software types from query
   *
   * @param {string} query - User query
   * @returns {string[]} Software types
   */
  extractSoftwareTypes(query) {
    const types = [];
    if (query.includes('malware')) types.push('malware');
    if (query.includes('tool')) types.push('tool');
    return types.length > 0 ? types : ['malware', 'tool'];
  }

  /**
   * Format MCP response for display
   *
   * @param {Object} result - MCP tool result
   * @param {string} toolName - Name of the tool that was called
   * @returns {string} Formatted response text
   */
  formatResponse(result, toolName) {
    try {
      // Extract the actual data from the result
      const data = result.result?.content?.[0]?.text || result.result || result;

      // Try to parse if it's a JSON string
      let parsedData;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
        } catch {
          return data; // Return as is if not JSON
        }
      } else {
        parsedData = data;
      }

      // Format based on tool type
      if (Array.isArray(parsedData)) {
        if (parsedData.length === 0) {
          return "No results found.";
        }

        // Format array of results
        let response = `Found ${parsedData.length} result(s):\n\n`;

        parsedData.slice(0, 10).forEach((item, index) => {
          response += `${index + 1}. `;

          if (item.name) response += `**${item.name}**`;
          if (item.technique_id) response += ` (${item.technique_id})`;
          if (item.shortname) response += ` [${item.shortname}]`;
          if (item.description) {
            const desc = item.description.substring(0, 150);
            response += `\n   ${desc}${item.description.length > 150 ? '...' : ''}`;
          }
          response += '\n\n';
        });

        if (parsedData.length > 10) {
          response += `\n_Showing first 10 of ${parsedData.length} results._`;
        }

        return response;
      }

      // Single object result
      if (typeof parsedData === 'object' && parsedData !== null) {
        let response = '';

        if (parsedData.name) response += `**${parsedData.name}**\n\n`;
        if (parsedData.technique_id) response += `ID: ${parsedData.technique_id}\n`;
        if (parsedData.tactics) response += `Tactics: ${parsedData.tactics.join(', ')}\n`;
        if (parsedData.description) response += `\nDescription: ${parsedData.description}\n`;
        if (parsedData.url) response += `\nMore info: ${parsedData.url}`;

        return response || JSON.stringify(parsedData, null, 2);
      }

      // Fallback: return JSON string
      return JSON.stringify(parsedData, null, 2);
    } catch (error) {
      console.error('Error formatting response:', error);
      return 'Received response but had trouble formatting it.';
    }
  }

  /**
   * Process user query and return response
   *
   * @param {string} query - User's natural language query
   * @returns {Promise<string>} Formatted response text
   */
  async processQuery(query) {
    try {
      // Add to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: query,
        timestamp: new Date()
      });

      // Parse intent from query
      const intent = this.parseIntent(query);

      // Call appropriate MCP tool
      const result = await this.mcpClient.callTool(intent.tool, intent.params);

      // Format response
      let response = '';
      if (intent.message) {
        response += intent.message + '\n\n';
      }
      response += this.formatResponse(result, intent.tool);

      // Add to conversation history
      this.conversationHistory.push({
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        tool: intent.tool,
        confidence: intent.confidence
      });

      return response;
    } catch (error) {
      console.error('Error processing query:', error);

      const errorMessage = `I encountered an error while processing your query: ${error.message}\n\nPlease make sure:\n- The mitre-mcp server is running\n- The server address is configured correctly\n- Your query is clear and specific`;

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
      hasOpenAI: !!this.openaiApiKey
    };
  }
}
