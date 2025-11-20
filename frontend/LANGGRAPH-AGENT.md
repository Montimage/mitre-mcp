# Browser-Compatible Agent with Ollama

This implementation uses an agent loop pattern with Ollama for local LLM inference, designed for browser compatibility.

## Architecture

The agent uses an iterative loop architecture:

```
Query → System Prompt + History → LLM
         ↓
   Tool Calls?
   Yes ↓        No → Final Response
   Execute Tools
         ↓
   Add Results → Back to LLM
```

### Components

1. **LLM with Tools**: ChatOllama with bound tool definitions
2. **Agent Loop**: Iterates until LLM returns final response (max 5 iterations)
3. **Tool Execution**: Invokes MCP tools and formats results
4. **Message History**: Maintains context across turns

### Flow

1. User query enters the graph
2. Agent node (LLM) analyzes the query and decides which tool(s) to call
3. If tools are needed:
   - Tool node executes the MCP tool
   - Results are sent back to the agent node
   - Agent processes the results and generates a response
4. Final response is returned to the user

## Browser Compatibility

This agent is fully browser-compatible and uses only browser-safe dependencies:

- **@langchain/ollama** - Ollama LLM integration
- **@langchain/core** - Tool definitions and utilities
- **zod** - Schema validation

Note: The original LangGraph StateGraph implementation was replaced with a simpler agent loop pattern to avoid Node.js-specific dependencies (`async_hooks`, etc.) that don't work in browsers.

## Prerequisites

### 1. Install Ollama

**macOS/Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:**
Download from [ollama.com/download](https://ollama.com/download)

**Verify installation:**
```bash
ollama --version
```

### 2. Pull a Model

The agent uses `llama3.2` by default (fast and capable). Pull it with:

```bash
ollama pull llama3.2
```

**Other recommended models:**
- `llama3.2:3b` - Smaller, faster (3GB)
- `llama3.2` - Default, balanced (4.7GB)
- `llama3.1:8b` - More capable (4.7GB)
- `qwen2.5:7b` - Alternative, good performance

### 3. Start Ollama Server

Ollama should start automatically, but you can verify:

```bash
ollama serve
```

The server runs on `http://localhost:11434` by default.

## Configuration

### Default Configuration

```javascript
{
  ollamaModel: 'llama3.2',          // Model name
  ollamaBaseUrl: 'http://localhost:11434',  // Ollama server URL
  temperature: 0.7                   // Response randomness (0-1)
}
```

### Custom Configuration

You can pass configuration when creating the agent:

```javascript
import LangGraphAgent from './services/langGraphAgent.js';

const agent = new LangGraphAgent('localhost', 8000, {
  ollamaModel: 'llama3.1:8b',       // Use different model
  temperature: 0.3,                  // More deterministic
  ollamaBaseUrl: 'http://localhost:11434'
});
```

## Features

### Intelligent Tool Selection

The LLM automatically chooses the right tool based on the query:

```
User: "What is technique T1055?"
→ Agent calls: get_technique_by_id(T1055)

User: "Show me APT29 techniques"
→ Agent calls: get_techniques_used_by_group(APT29)

User: "List persistence techniques"
→ Agent calls: get_techniques_by_tactic(persistence)
```

### Multi-Step Reasoning

The agent can chain multiple tool calls:

```
User: "Compare APT29 and APT28"
→ 1. get_techniques_used_by_group(APT29)
→ 2. get_techniques_used_by_group(APT28)
→ 3. LLM analyzes and compares results
```

### Context Awareness

The agent maintains conversation history and can reference previous queries:

```
User: "Show me all tactics"
Agent: [Lists tactics]

User: "What about persistence?"
→ Agent understands "persistence" refers to a tactic
```

## Available MCP Tools

The agent has access to 9 MCP tools:

1. **get_tactics** - List all tactical categories
2. **get_techniques** - List techniques with filtering
3. **get_technique_by_id** - Look up specific technique (e.g., T1055)
4. **get_techniques_by_tactic** - Get techniques for a tactic
5. **get_groups** - List threat actor groups
6. **get_techniques_used_by_group** - Get group's techniques
7. **get_software** - List malware and tools
8. **get_mitigations** - List security mitigations
9. **get_techniques_mitigated_by_mitigation** - Get mitigated techniques

Each tool includes:
- Descriptive name and documentation
- Input schema validation with Zod
- Proper error handling

## Performance Considerations

### Model Selection

Choose based on your hardware and performance needs:

| Model | Size | RAM | Speed | Quality |
|-------|------|-----|-------|---------|
| llama3.2:3b | 3GB | 8GB+ | Fast | Good |
| llama3.2 | 4.7GB | 8GB+ | Medium | Better |
| llama3.1:8b | 4.7GB | 16GB+ | Slower | Best |
| qwen2.5:7b | 4.4GB | 16GB+ | Medium | Excellent |

### Optimization Tips

1. **Use smaller models** for faster responses
2. **Lower temperature** (0.1-0.3) for consistent answers
3. **Increase temperature** (0.7-0.9) for creative responses
4. **Keep context short** - clear history when starting new topics

## Troubleshooting

### "Ollama is running locally" Error

**Problem:** Agent can't connect to Ollama

**Solutions:**
1. Check if Ollama is running: `ollama list`
2. Start Ollama: `ollama serve`
3. Verify port 11434 is not blocked
4. Try accessing: `curl http://localhost:11434/api/tags`

### "Model not installed" Error

**Problem:** The specified model isn't available

**Solutions:**
1. List available models: `ollama list`
2. Pull the model: `ollama pull llama3.2`
3. Wait for download to complete
4. Refresh the application

### Slow Responses

**Problem:** Agent takes too long to respond

**Solutions:**
1. Use a smaller model (llama3.2:3b)
2. Reduce context window
3. Check system resources (RAM, CPU)
4. Close other applications

### "MCP server is running" Error

**Problem:** Can't connect to MCP server

**Solutions:**
1. Start MCP server: `mitre-mcp --http --port 8000`
2. Check server address in config
3. Verify network connection
4. Check firewall settings

## Development

### Logging

Enable debug logging to see agent decisions:

```javascript
// In browser console
localStorage.setItem('debug', 'langgraph:*');
```

### Testing Individual Tools

Test tools directly without the LLM:

```javascript
const agent = new LangGraphAgent();
const result = await agent.mcpClient.callTool('get_tactics', {
  domain: 'enterprise-attack'
});
console.log(result);
```

### Custom System Prompt

Modify the system prompt in `langGraphAgent.js` line 338 to change agent behavior.

## References

- **LangGraph Docs**: https://docs.langchain.com/oss/javascript/langgraph/overview
- **Ollama**: https://ollama.com
- **MITRE ATT&CK**: https://attack.mitre.org
- **LangChain Tools**: https://docs.langchain.com/oss/javascript/core/tools

## Example Queries

Try these queries to test the agent:

**Basic Lookups:**
- "What is technique T1059?"
- "Show me all tactics"
- "List initial access techniques"

**Threat Intelligence:**
- "What techniques does APT29 use?"
- "Compare APT28 and APT29"
- "Show me techniques used by FIN7"

**Defense:**
- "What mitigations exist for credential access?"
- "How can I defend against T1003?"
- "Show me security controls for persistence"

**Complex Queries:**
- "What are the most common persistence techniques and how can I defend against them?"
- "Analyze APT29's tactics and recommend detection strategies"
- "Compare enterprise and mobile attack techniques"
