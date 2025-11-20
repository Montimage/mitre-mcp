# MITRE ATT&CK Intelligence Assistant - Frontend

A modern React.js landing page with integrated AI-powered chatbox for interacting with the MITRE ATT&CK framework through natural language queries.

## Features

- **Beautiful Landing Page**: Modern design with hero section, features showcase, and footer
- **AI-Powered Chatbox**: Natural language interface for querying MITRE ATT&CK data
- **MCP Integration**: Direct communication with mitre-mcp server via HTTP
- **Configurable Server**: Easy configuration of MCP server address
- **Responsive Design**: Mobile-first design that works on all devices
- **Real-time Communication**: Instant responses from MITRE ATT&CK framework
- **Example Queries**: Pre-built examples to help users get started

## Tech Stack

- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **AI Agent**: LangChain / LangGraphJS (pattern-based routing)
- **Protocol**: Model Context Protocol (MCP) over HTTP

## Prerequisites

1. **Node.js**: Version 16 or higher
2. **mitre-mcp Server**: Running on your machine
   ```bash
   pip install mitre-mcp
   mitre-mcp --http --port 8000
   ```

## Installation

1. **Clone the repository** (if not already done):
   ```bash
   git clone https://github.com/montimage/mitre-mcp.git
   cd mitre-mcp/frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment** (optional):
   ```bash
   cp .env.example .env
   # Edit .env if you need custom server configuration
   ```

## Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Building for Production

Build the optimized production bundle:

```bash
npm run build
```

The built files will be in the `dist/` directory.

Preview the production build:

```bash
npm run preview
```

## Usage

### 1. Start mitre-mcp Server

Before using the application, start the mitre-mcp server:

```bash
mitre-mcp --http --port 8000
```

### 2. Open the Application

Navigate to `http://localhost:5173` in your browser.

### 3. Configure Server Connection

Click the "⚙️ Configure" button in the chatbox header to:
- Set the server host (default: localhost)
- Set the server port (default: 8000)
- Test the connection
- Save your configuration

### 4. Start Chatting

Ask questions in natural language:

**Example Queries:**
- "Show me all tactics in the enterprise domain"
- "What is technique T1059?"
- "Which techniques does APT29 use?"
- "List initial access techniques"
- "What mitigations exist for privilege escalation?"

## Project Structure

```
frontend/
├── public/              # Static assets
├── src/
│   ├── components/
│   │   ├── landing/    # Landing page components
│   │   │   ├── Hero.jsx
│   │   │   ├── Features.jsx
│   │   │   └── Footer.jsx
│   │   └── chat/       # Chat interface components
│   │       ├── ChatBox.jsx
│   │       ├── ChatMessage.jsx
│   │       ├── ChatInput.jsx
│   │       └── ServerConfig.jsx
│   ├── services/       # Business logic
│   │   ├── mcpClient.js        # MCP HTTP client
│   │   └── langGraphAgent.js   # AI agent for query routing
│   ├── App.jsx         # Main app component
│   ├── main.jsx        # Entry point
│   └── index.css       # Global styles
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## How It Works

### 1. MCP Client (`mcpClient.js`)

Handles HTTP communication with the mitre-mcp server:
- Session management
- Tool invocation via JSON-RPC
- Server-Sent Events (SSE) parsing
- Error handling

### 2. LangGraph Agent (`langGraphAgent.js`)

Intelligent query router that:
- Parses user intent from natural language
- Routes queries to appropriate MCP tools
- Formats responses for display
- Maintains conversation history

**Supported Query Patterns:**
- Tactics: "show all tactics", "list tactics"
- Techniques: "what is T1059", "techniques for initial-access"
- Groups: "techniques used by APT29", "show all groups"
- Software: "list malware", "show tools"
- Mitigations: "what mitigations exist", "mitigations for privilege escalation"

### 3. Chat Components

- **ChatBox**: Main chat container with message list and input
- **ChatMessage**: Individual message display with formatting
- **ChatInput**: Text input with keyboard shortcuts
- **ServerConfig**: Server configuration UI

## Configuration

### Environment Variables

Create a `.env` file:

```bash
# MCP Server
VITE_MCP_DEFAULT_HOST=localhost
VITE_MCP_DEFAULT_PORT=8000

# Optional: OpenAI API (future feature)
# VITE_OPENAI_API_KEY=sk-...
```

### Runtime Configuration

Users can configure the server at runtime using the UI:
1. Click "⚙️ Configure" in the chatbox
2. Enter host and port
3. Test connection
4. Save configuration (stored in localStorage)

## Troubleshooting

### Connection Errors

**Problem**: "Connection failed" or "Failed to initialize session"

**Solutions**:
1. Verify mitre-mcp server is running:
   ```bash
   mitre-mcp --http --port 8000
   ```
2. Check server address in configuration
3. Ensure no firewall blocking localhost:8000
4. Check browser console for detailed errors

### Build Errors

**Problem**: Build fails with module errors

**Solutions**:
1. Delete `node_modules` and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```
2. Clear Vite cache:
   ```bash
   rm -rf .vite
   ```

### Query Not Working

**Problem**: Agent doesn't understand query

**Solutions**:
1. Try rephrasing with clearer keywords
2. Use example queries as templates
3. Include technique IDs (T####) for specific techniques
4. Check the agent patterns in `langGraphAgent.js`

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance

- **Initial Load**: < 2s on fast connection
- **Query Response**: Depends on mitre-mcp server (typically < 1s)
- **Bundle Size**: ~150KB gzipped (production)

## Future Enhancements

- [ ] OpenAI integration for advanced natural language understanding
- [ ] Streaming responses
- [ ] Query suggestions and autocomplete
- [ ] Data visualization (charts, graphs)
- [ ] Dark mode
- [ ] Export chat history
- [ ] Voice input
- [ ] Multi-language support

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - See [LICENSE](../LICENSE) file for details.

## Links

- **Main Repository**: https://github.com/montimage/mitre-mcp
- **mitre-mcp Documentation**: https://github.com/montimage/mitre-mcp#readme
- **MITRE ATT&CK**: https://attack.mitre.org/
- **Model Context Protocol**: https://spec.modelcontextprotocol.io/

## Support

For issues or questions:
- GitHub Issues: https://github.com/montimage/mitre-mcp/issues
- Email: luong.nguyen@montimage.eu

## Acknowledgments

- Built with React and Vite
- Styled with Tailwind CSS
- Powered by mitre-mcp server
- MITRE ATT&CK® framework

---

**Developed by [Montimage](https://www.montimage.eu)** - Cybersecurity solutions and AI-driven threat detection
