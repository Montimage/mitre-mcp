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
 * Maximum characters of a tool result sent to the model (~16 KB).
 *
 * Results are re-sent to the LLM on every agent-loop iteration, so a large
 * payload (e.g. a full `get_software` listing) would flood the prompt each
 * round — oversized results are truncated at this fixed cap (F-PERF-008).
 */
export const MAX_TOOL_RESULT_CHARS = 16000;

/**
 * Truncate a tool-result string to MAX_TOOL_RESULT_CHARS, appending a marker
 * so the model knows the payload was cut.
 *
 * @param {*} text - Serialised tool result
 * @returns {string} Original string, or a truncated copy with a marker
 */
const capToolResult = (text) => {
  if (typeof text !== 'string' || text.length <= MAX_TOOL_RESULT_CHARS) return text;
  return `${text.slice(0, MAX_TOOL_RESULT_CHARS)}\n…[truncated — ${text.length} chars exceeds the ${MAX_TOOL_RESULT_CHARS}-char cap]`;
};

/**
 * Format an MCP tool result for LLM consumption
 *
 * JSON payloads are serialised compactly (no indentation) and every return
 * path is capped at MAX_TOOL_RESULT_CHARS (F-PERF-008).
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
        return capToolResult(data);
      }
    } else {
      parsedData = data;
    }

    // Compact JSON string for LLM to process — pretty-printing used to add
    // ~17 KB of indentation on large results
    return capToolResult(JSON.stringify(parsedData));
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
