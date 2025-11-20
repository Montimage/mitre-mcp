# Implementation Plan: React Landing Page with LangGraphJS Chatbox

## Project Overview

Build a modern landing page using React.js, Vite, and Tailwind CSS with an integrated chatbox powered by LangGraphJS. The chatbox allows users to configure the MCP server address and interact with the mitre-mcp server through natural language.

**Tech Stack:**
- **Frontend Framework:** React.js (JavaScript only)
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Chatbot Engine:** LangGraphJS
- **MCP Integration:** HTTP-based Model Context Protocol

---

## Phase 1: Project Setup and Infrastructure

### Task 1.1: Initialize React + Vite Project
**Estimated Time:** 30 minutes

**Description:** Create a new React application with Vite bundler.

**Steps:**
1. Create new Vite project with React template
   ```bash
   npm create vite@latest frontend -- --template react
   cd frontend
   npm install
   ```
2. Test development server
   ```bash
   npm run dev
   ```
3. Clean up default Vite template files
   - Remove unnecessary CSS
   - Clean up App.jsx
   - Update index.html title and meta tags

**Deliverables:**
- Working Vite + React development environment
- Clean project structure

---

### Task 1.2: Configure Tailwind CSS
**Estimated Time:** 30 minutes

**Description:** Install and configure Tailwind CSS for styling.

**Steps:**
1. Install Tailwind CSS dependencies
   ```bash
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```
2. Configure `tailwind.config.js`
   ```javascript
   export default {
     content: [
       "./index.html",
       "./src/**/*.{js,jsx}",
     ],
     theme: {
       extend: {},
     },
     plugins: [],
   }
   ```
3. Add Tailwind directives to `src/index.css`
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   ```
4. Test with sample Tailwind classes

**Deliverables:**
- Tailwind CSS fully configured
- Styling working in development mode

---

### Task 1.3: Project Structure Setup
**Estimated Time:** 20 minutes

**Description:** Organize project folders and files.

**Project Structure:**
```
frontend/
├── public/
├── src/
│   ├── components/
│   │   ├── landing/
│   │   │   ├── Hero.jsx
│   │   │   ├── Features.jsx
│   │   │   └── Footer.jsx
│   │   └── chat/
│   │       ├── ChatBox.jsx
│   │       ├── ChatMessage.jsx
│   │       ├── ChatInput.jsx
│   │       └── ServerConfig.jsx
│   ├── services/
│   │   ├── mcpClient.js
│   │   └── langGraphAgent.js
│   ├── utils/
│   │   └── helpers.js
│   ├── hooks/
│   │   └── useChatAgent.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── package.json
└── vite.config.js
```

**Deliverables:**
- Organized folder structure
- Empty component files created

---

## Phase 2: Landing Page Development

### Task 2.1: Hero Section Component
**Estimated Time:** 1.5 hours

**Description:** Create an attractive hero section with project branding.

**Features:**
- Project title: "MITRE ATT&CK Intelligence Assistant"
- Subtitle describing the tool
- Call-to-action buttons
- Gradient background with Tailwind

**Component Structure:**
```jsx
// src/components/landing/Hero.jsx
export default function Hero() {
  return (
    <section className="bg-gradient-to-br from-blue-600 to-purple-700 text-white">
      {/* Hero content */}
    </section>
  );
}
```

**Key Elements:**
- Responsive design (mobile-first)
- Smooth animations
- Professional typography
- Action buttons (scroll to chat, view docs)

**Deliverables:**
- Functional Hero component
- Responsive across devices
- Smooth scroll to chatbox

---

### Task 2.2: Features Section Component
**Estimated Time:** 2 hours

**Description:** Showcase key features of the mitre-mcp integration.

**Features to Highlight:**
1. **Real-time MITRE ATT&CK Data**
   - Access comprehensive threat intelligence
   - Latest tactics, techniques, and procedures

2. **AI-Powered Queries**
   - Natural language interaction
   - Intelligent responses via LangGraphJS

3. **Flexible Configuration**
   - Connect to any mitre-mcp server
   - Custom server endpoints

4. **Multi-Domain Support**
   - Enterprise, Mobile, ICS domains
   - Comprehensive coverage

**Component Structure:**
```jsx
// src/components/landing/Features.jsx
export default function Features() {
  const features = [
    {
      icon: "🔍",
      title: "Real-time Intelligence",
      description: "..."
    },
    // More features
  ];

  return (
    <section className="py-16 bg-gray-50">
      {/* Features grid */}
    </section>
  );
}
```

**Deliverables:**
- Feature cards with icons
- Grid layout (responsive)
- Hover effects and animations

---

### Task 2.3: Footer Component
**Estimated Time:** 45 minutes

**Description:** Create footer with links and attribution.

**Elements:**
- Project information
- GitHub repository link
- Documentation links
- Montimage attribution
- Copyright notice

**Deliverables:**
- Professional footer component
- All links functional

---

## Phase 3: MCP Client Integration

### Task 3.1: MCP HTTP Client Service
**Estimated Time:** 2 hours

**Description:** Create JavaScript service to communicate with mitre-mcp server.

**File:** `src/services/mcpClient.js`

**Key Functions:**
```javascript
class MitreMCPClient {
  constructor(host = 'localhost', port = 8000) {
    this.baseUrl = `http://${host}:${port}/mcp`;
    this.sessionId = null;
    this.requestId = 0;
  }

  async initializeSession() {
    // Initialize MCP session
    // Extract mcp-session-id from headers
  }

  parseSSEResponse(sseText) {
    // Parse Server-Sent Events format
    // Extract JSON data from SSE wrapper
  }

  async callTool(toolName, args = {}) {
    // Call MCP tool via JSON-RPC
    // Handle session management
  }
}

export default MitreMCPClient;
```

**Critical Requirements:**
1. **Accept Header:** `application/json, text/event-stream`
2. **Session Management:** Initialize before tool calls
3. **SSE Parsing:** Handle Server-Sent Events format

**Error Handling:**
- Connection errors
- Invalid server address
- Session expiration
- Tool call failures

**Deliverables:**
- Working MCP client class
- Error handling implemented
- Unit tests (optional)

---

### Task 3.2: Test MCP Client Connection
**Estimated Time:** 1 hour

**Description:** Verify MCP client works with mitre-mcp server.

**Test Cases:**
1. Initialize session successfully
2. Call `get_tactics` tool
3. Call `get_technique_by_id` with T1059.001
4. Handle connection errors gracefully

**Testing Approach:**
```javascript
// Quick test in browser console
const client = new MitreMCPClient('localhost', 8000);
const result = await client.callTool('get_tactics', {
  domain: 'enterprise-attack'
});
console.log(result);
```

**Deliverables:**
- Verified MCP client functionality
- Connection error handling tested

---

## Phase 4: LangGraphJS Integration

### Task 4.1: Install LangGraphJS Dependencies
**Estimated Time:** 30 minutes

**Description:** Install LangChain and LangGraph libraries.

**Installation:**
```bash
npm install langchain @langchain/core @langchain/openai langgraph
```

**Configuration:**
- Set up API keys (if using OpenAI)
- Configure environment variables
- Create `.env.local` file

**Deliverables:**
- LangGraphJS installed
- Environment configured

---

### Task 4.2: Create LangGraph Agent
**Estimated Time:** 3 hours

**Description:** Build LangGraph agent to orchestrate MCP tool calls.

**File:** `src/services/langGraphAgent.js`

**Agent Architecture:**
```javascript
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, END } from "langgraph";
import MitreMCPClient from "./mcpClient.js";

// Define agent state
const AgentState = {
  messages: [],
  toolCalls: [],
  serverConfig: {}
};

// Define agent nodes
function shouldCallTool(state) {
  // Determine if tool call is needed
}

async function callMCPTool(state) {
  // Execute MCP tool call
}

function formatResponse(state) {
  // Format response for user
}

// Build graph
const workflow = new StateGraph(AgentState)
  .addNode("analyze", shouldCallTool)
  .addNode("callTool", callMCPTool)
  .addNode("respond", formatResponse)
  .addEdge("analyze", "callTool")
  .addEdge("callTool", "respond")
  .addEdge("respond", END);

const agent = workflow.compile();
export default agent;
```

**Agent Capabilities:**
1. **Natural Language Understanding**
   - Parse user intents
   - Identify relevant MCP tools
   - Extract parameters from queries

2. **Tool Orchestration**
   - Map user queries to MCP tools
   - Chain multiple tool calls if needed
   - Handle complex queries

3. **Response Generation**
   - Format MCP responses
   - Provide context and explanations
   - Suggest follow-up queries

**Example Queries to Handle:**
- "Show me all tactics in enterprise domain"
- "What is technique T1059?"
- "Which techniques does APT29 use?"
- "Tell me about initial access techniques"

**Deliverables:**
- Working LangGraph agent
- Natural language processing
- MCP tool integration

---

### Task 4.3: Custom LangGraph Tools
**Estimated Time:** 2 hours

**Description:** Create LangGraph tool wrappers for MCP functions.

**Tool Definitions:**
```javascript
import { DynamicTool } from "@langchain/core/tools";

// Wrap MCP tools as LangChain tools
const getTacticsTool = new DynamicTool({
  name: "get_tactics",
  description: "Get all MITRE ATT&CK tactics for a domain",
  func: async ({ domain = "enterprise-attack" }) => {
    const client = new MitreMCPClient();
    return await client.callTool("get_tactics", { domain });
  }
});

const getTechniqueByIdTool = new DynamicTool({
  name: "get_technique_by_id",
  description: "Get details for a specific technique by ID (e.g., T1059.001)",
  func: async ({ technique_id, domain = "enterprise-attack" }) => {
    const client = new MitreMCPClient();
    return await client.callTool("get_technique_by_id", {
      technique_id,
      domain
    });
  }
});

// Add all 9 MCP tools...
```

**MCP Tools to Wrap:**
1. get_tactics
2. get_techniques
3. get_technique_by_id
4. get_techniques_by_tactic
5. get_groups
6. get_techniques_used_by_group
7. get_software
8. get_mitigations
9. get_techniques_mitigated_by_mitigation

**Deliverables:**
- All 9 MCP tools wrapped
- Tool descriptions optimized for LLM
- Parameter validation

---

## Phase 5: Chatbox UI Development

### Task 5.1: Server Configuration Component
**Estimated Time:** 1.5 hours

**Description:** Create UI to configure MCP server connection.

**File:** `src/components/chat/ServerConfig.jsx`

**Features:**
- Input fields for host and port
- Connection status indicator
- Save/Reset buttons
- Validation for URL format
- Test connection button

**UI Design:**
```
┌─────────────────────────────────────┐
│ MCP Server Configuration            │
├─────────────────────────────────────┤
│ Host: [localhost            ]       │
│ Port: [8000                 ]       │
│                                     │
│ Status: ● Connected                 │
│                                     │
│ [Test Connection] [Save]            │
└─────────────────────────────────────┘
```

**State Management:**
```javascript
const [serverConfig, setServerConfig] = useState({
  host: 'localhost',
  port: 8000
});
const [connectionStatus, setConnectionStatus] = useState('disconnected');
```

**Deliverables:**
- Server config component
- Connection testing
- Persistent storage (localStorage)

---

### Task 5.2: Chat Message Component
**Estimated Time:** 1 hour

**Description:** Display individual chat messages with styling.

**File:** `src/components/chat/ChatMessage.jsx`

**Message Types:**
1. **User messages** - Right-aligned, blue background
2. **Assistant messages** - Left-aligned, gray background
3. **System messages** - Center-aligned, italic
4. **Error messages** - Red border and text

**Component:**
```jsx
export default function ChatMessage({ message, type, timestamp }) {
  const styles = {
    user: "ml-auto bg-blue-600 text-white",
    assistant: "mr-auto bg-gray-200 text-gray-900",
    system: "mx-auto bg-yellow-100 text-gray-700 italic",
    error: "mr-auto bg-red-50 border-red-300 text-red-700"
  };

  return (
    <div className={`max-w-[80%] rounded-lg p-3 mb-2 ${styles[type]}`}>
      <div className="text-sm">{message}</div>
      <div className="text-xs opacity-70 mt-1">{timestamp}</div>
    </div>
  );
}
```

**Features:**
- Markdown rendering support
- Code block syntax highlighting
- Timestamp display
- Copy to clipboard button

**Deliverables:**
- ChatMessage component
- Multiple message types styled
- Markdown support

---

### Task 5.3: Chat Input Component
**Estimated Time:** 1 hour

**Description:** Input field for user to send messages.

**File:** `src/components/chat/ChatInput.jsx`

**Features:**
- Multi-line text input (textarea)
- Send button
- Enter to send (Shift+Enter for new line)
- Character counter
- Loading state during processing
- Auto-focus on mount
- Auto-resize textarea

**Component:**
```jsx
export default function ChatInput({ onSendMessage, isLoading }) {
  const [input, setInput] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t p-4">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask about MITRE ATT&CK..."
        className="w-full p-2 border rounded-lg resize-none"
        rows={3}
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={!input.trim() || isLoading}
        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg"
      >
        {isLoading ? "Processing..." : "Send"}
      </button>
    </form>
  );
}
```

**Deliverables:**
- Chat input component
- Keyboard shortcuts
- Loading states

---

### Task 5.4: Main ChatBox Component
**Estimated Time:** 2.5 hours

**Description:** Integrate all chat components with LangGraph agent.

**File:** `src/components/chat/ChatBox.jsx`

**Features:**
1. **Message Management**
   - Display message history
   - Auto-scroll to bottom
   - Clear chat button

2. **Agent Integration**
   - Connect to LangGraph agent
   - Stream responses (if supported)
   - Handle errors gracefully

3. **UI Elements**
   - Collapsible server config
   - Message list with scroll
   - Input area
   - Loading indicators

**Component Structure:**
```jsx
export default function ChatBox() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const { sendMessage, serverConfig } = useChatAgent();

  const handleSendMessage = async (text) => {
    setIsLoading(true);

    // Add user message
    setMessages(prev => [...prev, {
      type: 'user',
      content: text,
      timestamp: new Date().toISOString()
    }]);

    try {
      // Call LangGraph agent
      const response = await sendMessage(text);

      // Add assistant response
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      // Add error message
      setMessages(prev => [...prev, {
        type: 'error',
        content: `Error: ${error.message}`,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="border-b p-4 flex justify-between items-center">
        <h2 className="text-xl font-bold">MITRE ATT&CK Assistant</h2>
        <button onClick={() => setShowConfig(!showConfig)}>
          ⚙️ Configure
        </button>
      </div>

      {/* Server Config (collapsible) */}
      {showConfig && <ServerConfig />}

      {/* Messages */}
      <div className="h-96 overflow-y-auto p-4">
        {messages.map((msg, idx) => (
          <ChatMessage key={idx} {...msg} />
        ))}
      </div>

      {/* Input */}
      <ChatInput
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
      />
    </div>
  );
}
```

**Deliverables:**
- Complete chatbox integration
- Message persistence (localStorage)
- Error handling
- Loading states

---

## Phase 6: Custom Hooks and State Management

### Task 6.1: useChatAgent Hook
**Estimated Time:** 1.5 hours

**Description:** Create React hook for agent interaction.

**File:** `src/hooks/useChatAgent.js`

**Hook Interface:**
```javascript
export function useChatAgent() {
  const [serverConfig, setServerConfig] = useState({
    host: 'localhost',
    port: 8000
  });
  const [isConnected, setIsConnected] = useState(false);
  const [agent, setAgent] = useState(null);

  // Initialize agent
  useEffect(() => {
    const initAgent = async () => {
      // Create and configure LangGraph agent
    };
    initAgent();
  }, [serverConfig]);

  // Send message to agent
  const sendMessage = async (message) => {
    // Invoke agent with message
    // Return response
  };

  // Test connection
  const testConnection = async () => {
    // Test MCP server connection
  };

  return {
    sendMessage,
    testConnection,
    serverConfig,
    setServerConfig,
    isConnected
  };
}
```

**Deliverables:**
- useChatAgent hook
- Connection management
- Agent state management

---

## Phase 7: Integration and Polish

### Task 7.1: Integrate Landing Page with ChatBox
**Estimated Time:** 1 hour

**Description:** Combine landing page sections with chatbox.

**File:** `src/App.jsx`

**Layout:**
```jsx
export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Hero />
      <Features />

      {/* Chat Section */}
      <section id="chat" className="py-16 px-4">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">
            Try It Now
          </h2>
          <ChatBox />
        </div>
      </section>

      <Footer />
    </div>
  );
}
```

**Deliverables:**
- Integrated application
- Smooth scrolling between sections
- Responsive layout

---

### Task 7.2: Responsive Design Testing
**Estimated Time:** 1.5 hours

**Description:** Test and fix responsive design across devices.

**Test Breakpoints:**
- Mobile: 320px - 640px
- Tablet: 641px - 1024px
- Desktop: 1025px+

**Testing Checklist:**
- [ ] Hero section scales properly
- [ ] Features grid adapts (1, 2, or 3 columns)
- [ ] ChatBox width constrained on large screens
- [ ] Input fields touch-friendly on mobile
- [ ] Navigation/buttons accessible
- [ ] Text readable at all sizes

**Deliverables:**
- Fully responsive design
- Cross-browser tested

---

### Task 7.3: Example Queries and Help System
**Estimated Time:** 1 hour

**Description:** Add suggested queries and help documentation.

**Features:**
1. **Quick Start Queries**
   - Display clickable example queries
   - Pre-fill input on click

2. **Help Modal**
   - Explain how to use the chatbox
   - List available query types
   - Show example queries

**Example Queries:**
```javascript
const exampleQueries = [
  "Show me all tactics in the enterprise domain",
  "What is technique T1059?",
  "Which techniques does APT29 use?",
  "List initial access techniques",
  "What mitigations exist for privilege escalation?",
  "Show me all mobile attack techniques"
];
```

**Deliverables:**
- Quick start queries component
- Help modal
- User guidance

---

### Task 7.4: Error Handling and Loading States
**Estimated Time:** 1.5 hours

**Description:** Improve UX with proper error handling and feedback.

**Error Scenarios:**
1. Server connection failed
2. Invalid technique ID
3. Network timeout
4. Session expired
5. LLM API error (if using OpenAI)

**Loading States:**
1. Initial connection
2. Tool call in progress
3. Agent thinking
4. Streaming response (optional)

**UI Feedback:**
```jsx
// Error Toast Component
function ErrorToast({ message, onClose }) {
  return (
    <div className="fixed top-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg">
      <div className="flex items-center justify-between">
        <span>{message}</span>
        <button onClick={onClose}>✕</button>
      </div>
    </div>
  );
}

// Loading Spinner
function LoadingSpinner() {
  return (
    <div className="flex items-center space-x-2">
      <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent" />
      <span>Thinking...</span>
    </div>
  );
}
```

**Deliverables:**
- Comprehensive error handling
- User-friendly error messages
- Loading indicators
- Toast notifications

---

## Phase 8: Testing and Documentation

### Task 8.1: End-to-End Testing
**Estimated Time:** 2 hours

**Description:** Test complete user flows.

**Test Scenarios:**
1. **First Time User**
   - Landing on page
   - Reading features
   - Configuring server
   - Sending first query

2. **Configuration Change**
   - Update server address
   - Test connection
   - Resume chat

3. **Complex Queries**
   - Multi-step questions
   - Chained tool calls
   - Error recovery

4. **Edge Cases**
   - Empty input
   - Very long messages
   - Rapid consecutive queries
   - Server downtime

**Deliverables:**
- Test report
- Bug fixes
- Improved error handling

---

### Task 8.2: Create README Documentation
**Estimated Time:** 1.5 hours

**Description:** Write comprehensive README for the frontend.

**File:** `frontend/README.md`

**Sections:**
1. **Overview**
   - What this application does
   - Tech stack

2. **Prerequisites**
   - Node.js version
   - mitre-mcp server running
   - API keys (if needed)

3. **Installation**
   ```bash
   cd frontend
   npm install
   ```

4. **Configuration**
   - Environment variables
   - Server settings

5. **Development**
   ```bash
   npm run dev
   ```

6. **Build**
   ```bash
   npm run build
   npm run preview
   ```

7. **Usage Guide**
   - How to configure server
   - Example queries
   - Troubleshooting

8. **Architecture**
   - Component structure
   - LangGraph integration
   - MCP client flow

**Deliverables:**
- Comprehensive README
- Usage examples
- Troubleshooting guide

---

### Task 8.3: Code Comments and JSDoc
**Estimated Time:** 1 hour

**Description:** Add documentation to code.

**Standards:**
```javascript
/**
 * Initializes an MCP session with the server.
 *
 * @returns {Promise<void>} Resolves when session is initialized
 * @throws {Error} If session initialization fails
 */
async initializeSession() {
  // Implementation
}

/**
 * Parses Server-Sent Events (SSE) response format.
 *
 * @param {string} sseText - Raw SSE response text
 * @returns {Object} Parsed JSON object
 */
parseSSEResponse(sseText) {
  // Implementation
}
```

**Deliverables:**
- JSDoc comments for all functions
- Component prop documentation
- Inline comments for complex logic

---

## Phase 9: Deployment and Optimization

### Task 9.1: Production Build Optimization
**Estimated Time:** 1.5 hours

**Description:** Optimize bundle size and performance.

**Optimization Tasks:**
1. **Code Splitting**
   - Lazy load heavy components
   - Split vendor bundles

2. **Asset Optimization**
   - Optimize images
   - Minify CSS/JS
   - Enable compression

3. **Vite Configuration**
   ```javascript
   // vite.config.js
   export default defineConfig({
     plugins: [react()],
     build: {
       rollupOptions: {
         output: {
           manualChunks: {
             'langchain': ['langchain', '@langchain/core'],
             'react-vendor': ['react', 'react-dom']
           }
         }
       },
       chunkSizeWarningLimit: 1000
     }
   });
   ```

4. **Performance Monitoring**
   - Lighthouse audit
   - Bundle analyzer

**Deliverables:**
- Optimized production build
- Performance report
- Bundle size < 500KB (gzipped)

---

### Task 9.2: Environment Configuration
**Estimated Time:** 45 minutes

**Description:** Set up environment variables for different deployments.

**Files:**
- `.env.development`
- `.env.production`
- `.env.example`

**Variables:**
```bash
# .env.example
VITE_MCP_DEFAULT_HOST=localhost
VITE_MCP_DEFAULT_PORT=8000
VITE_OPENAI_API_KEY=your_api_key_here
VITE_APP_TITLE=MITRE ATT&CK Intelligence Assistant
```

**Deliverables:**
- Environment files
- Configuration documentation
- .gitignore updated

---

### Task 9.3: Static Site Deployment
**Estimated Time:** 1 hour

**Description:** Deploy to static hosting (Netlify, Vercel, or GitHub Pages).

**Deployment Options:**

**Option A: Vercel**
```bash
npm install -g vercel
vercel --prod
```

**Option B: Netlify**
```bash
npm run build
# Deploy dist/ folder via Netlify UI
```

**Option C: GitHub Pages**
```javascript
// vite.config.js
export default defineConfig({
  base: '/mitre-mcp/',
  // ...
});
```

**Build Command:** `npm run build`
**Output Directory:** `dist`

**Deliverables:**
- Deployed application
- Public URL
- Deployment documentation

---

## Phase 10: Advanced Features (Optional Enhancements)

### Task 10.1: Chat History Persistence
**Estimated Time:** 1 hour

**Features:**
- Save chat history to localStorage
- Load previous conversations
- Export chat as JSON/Markdown
- Clear history button

---

### Task 10.2: Streaming Responses
**Estimated Time:** 2 hours

**Features:**
- Stream LLM responses in real-time
- Show typing indicator
- Smoother UX for long responses

---

### Task 10.3: Dark Mode
**Estimated Time:** 1.5 hours

**Features:**
- Toggle dark/light theme
- Persist preference
- System preference detection
- Tailwind dark mode classes

---

### Task 10.4: Advanced Query Features
**Estimated Time:** 2 hours

**Features:**
- Query suggestions (autocomplete)
- Related queries
- Query history with search
- Favorite queries

---

### Task 10.5: Data Visualization
**Estimated Time:** 3 hours

**Features:**
- Technique relationship graphs
- Tactic distribution charts
- Group activity timelines
- Use D3.js or Chart.js

---

## Timeline Estimate

### Minimum Viable Product (MVP)
**Total Time: 30-35 hours**

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1 | Project Setup | 1.5 hours |
| Phase 2 | Landing Page | 4 hours |
| Phase 3 | MCP Client | 3 hours |
| Phase 4 | LangGraphJS | 5.5 hours |
| Phase 5 | Chatbox UI | 6.5 hours |
| Phase 6 | Hooks | 1.5 hours |
| Phase 7 | Integration | 5 hours |
| Phase 8 | Testing & Docs | 4.5 hours |
| Phase 9 | Deployment | 3 hours |

### With Optional Features
**Total Time: 40-45 hours**

---

## Technical Considerations

### 1. Security
- **API Keys:** Never commit API keys to repository
- **CORS:** Ensure MCP server allows requests from frontend
- **Input Validation:** Sanitize all user inputs
- **XSS Prevention:** Use React's built-in escaping

### 2. Performance
- **Lazy Loading:** Load chat components on demand
- **Debouncing:** Debounce input to prevent excessive requests
- **Caching:** Cache MCP responses in client
- **Virtual Scrolling:** For long chat histories

### 3. Accessibility
- **Keyboard Navigation:** Full keyboard support
- **Screen Readers:** ARIA labels on all interactive elements
- **Focus Management:** Proper focus states
- **Color Contrast:** WCAG AA compliance

### 4. Browser Compatibility
- **Target:** Last 2 versions of major browsers
- **Polyfills:** For older browser support if needed
- **Progressive Enhancement:** Basic functionality without JS

---

## Dependencies Summary

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "langchain": "^0.1.0",
    "@langchain/core": "^0.1.0",
    "@langchain/openai": "^0.0.19",
    "langgraph": "^0.0.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

---

## Success Criteria

### Functional Requirements
- [ ] Landing page displays correctly on all devices
- [ ] Users can configure MCP server address
- [ ] Chatbox successfully connects to mitre-mcp server
- [ ] Natural language queries return accurate results
- [ ] All 9 MCP tools accessible through chat
- [ ] Error handling provides helpful feedback
- [ ] Chat history persists during session

### Non-Functional Requirements
- [ ] Page loads in < 3 seconds
- [ ] First contentful paint < 1.5 seconds
- [ ] Lighthouse score > 90
- [ ] Mobile-responsive design
- [ ] WCAG AA accessibility compliance
- [ ] Cross-browser compatibility (Chrome, Firefox, Safari, Edge)

---

## Risk Mitigation

### Risk 1: LangGraphJS Complexity
**Mitigation:** Start with simple tool-calling pattern, add complexity incrementally

### Risk 2: MCP Server Connection Issues
**Mitigation:** Implement robust error handling and connection testing

### Risk 3: LLM API Costs (if using OpenAI)
**Mitigation:**
- Implement rate limiting
- Cache responses
- Use smaller models (gpt-3.5-turbo)
- Consider local LLM alternatives (Ollama)

### Risk 4: Performance with Large Responses
**Mitigation:**
- Implement pagination
- Limit response size in prompts
- Use streaming responses

---

## Next Steps After Implementation

1. **User Testing**
   - Gather feedback from security analysts
   - Identify usability issues
   - Iterate on UX

2. **Feature Expansion**
   - Add more query types
   - Implement data visualization
   - Multi-language support

3. **Integration**
   - Connect to other security tools
   - API for programmatic access
   - Webhook notifications

4. **Documentation**
   - Video tutorials
   - Interactive guide
   - API documentation

---

## References

- [MITRE ATT&CK Framework](https://attack.mitre.org/)
- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/)
- [LangChain Documentation](https://js.langchain.com/)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraphjs/)
- [React Documentation](https://react.dev/)
- [Vite Guide](https://vitejs.dev/guide/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

## Contact & Support

For questions about this implementation plan:
- Review the main mitre-mcp documentation
- Check the API-INTEGRATION.md guide
- Contact: luong.nguyen@montimage.eu

---

**Document Version:** 1.0
**Last Updated:** 2025-11-19
**Author:** Claude (Anthropic AI Assistant)
