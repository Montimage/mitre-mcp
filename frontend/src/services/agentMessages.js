/**
 * Message / content helpers for the browser agent
 *
 * Pure functions extracted from the agent loop: normalising provider content
 * to plain strings, reading MCP content blocks, formatting tool results, and
 * building the system prompt from the discovered tool surface.
 */

/**
 * Normalise LLM response content to a plain string.
 * Providers may return content as a string or as an array of content
 * blocks (e.g. { type: 'text', text: '...' }); the UI expects a string.
 *
 * @param {*} content - Raw message content from the provider
 * @returns {string} Normalised string content
 */
export const normalizeContent = (content) => {
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
export const contentText = (content) => {
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => (part && typeof part === 'object' && typeof part.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('\n');
};

/**
 * Format an MCP tool result for LLM consumption
 *
 * @param {Object} result - Raw MCP result envelope
 * @returns {string} Formatted string result
 */
export const formatToolResult = (result) => {
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
};

/**
 * Build the system prompt, listing the tools discovered via tools/list
 *
 * @param {Array} toolDefinitions - tools/list entries (name + description)
 * @returns {string} System prompt content
 */
export const buildSystemPrompt = (toolDefinitions) => {
  const toolList = toolDefinitions.length > 0
    ? toolDefinitions
      .map((def) => `- ${def.name}: ${def.description || 'No description provided'}`)
      .join('\n')
    : '- (tool discovery is unavailable; answer without tool calls)';

  return `You are a helpful cybersecurity assistant with access to the MITRE ATT&CK framework.
You have access to tools that can query the MITRE ATT&CK database. You MUST use these tools to answer questions - do not make up information.

Available tools:
${toolList}

IMPORTANT: When the user asks about MITRE ATT&CK data, you MUST call the appropriate tool. Do not describe what tool you would use - actually call it. Pick the tool whose name and description best match the question, and supply the arguments its input schema requires.

Be helpful, accurate, and security-focused in your responses.`;
};
