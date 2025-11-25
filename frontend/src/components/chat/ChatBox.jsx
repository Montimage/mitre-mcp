/**
 * ChatBox Component
 *
 * Main chat interface integrating all chat components
 */
import { useState, useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import ServerConfig from './ServerConfig';
import LangGraphAgent, { LLM_PROVIDERS } from '../../services/langGraphAgent';

// IndexedDB helper to get API keys
const getApiKey = async (keyName) => {
  return new Promise((resolve) => {
    const request = indexedDB.open('mitre-mcp-config', 1);
    request.onerror = () => resolve('');
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('api-keys')) {
        resolve('');
        return;
      }
      const transaction = db.transaction(['api-keys'], 'readonly');
      const store = transaction.objectStore('api-keys');
      const getRequest = store.get(keyName);
      getRequest.onerror = () => resolve('');
      getRequest.onsuccess = () => resolve(getRequest.result?.value || '');
    };
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('api-keys')) {
        db.createObjectStore('api-keys', { keyPath: 'id' });
      }
    };
  });
};

// Helper to get display name for LLM provider and model
const getModelDisplayInfo = (config) => {
  const provider = config.llmProvider || 'ollama';

  switch (provider) {
    case LLM_PROVIDERS.GEMINI:
      return {
        provider: 'Gemini',
        model: config.geminiModel || 'gemini-2.5-flash',
        color: 'bg-blue-600'
      };
    case LLM_PROVIDERS.OPENROUTER:
      return {
        provider: 'OpenRouter',
        model: config.openrouterModel || 'anthropic/claude-3.5-sonnet',
        color: 'bg-purple-600'
      };
    case LLM_PROVIDERS.OLLAMA:
    default:
      return {
        provider: 'Ollama',
        model: config.ollamaModel || 'llama3.1:8b',
        color: 'bg-green-600'
      };
  }
};

export default function ChatBox() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [serverConfig, setServerConfig] = useState({ host: 'localhost', port: 8000, llmProvider: 'ollama' });
  const [agent, setAgent] = useState(null);
  const [pendingToolCalls, setPendingToolCalls] = useState(null);
  const [toolApprovalResolver, setToolApprovalResolver] = useState(null);
  const [mcpServerStatus, setMcpServerStatus] = useState('unknown'); // 'connected', 'disconnected', 'unknown'
  const [llmStatus, setLlmStatus] = useState('unknown'); // 'ready', 'not-configured', 'unknown'

  // Initialize agent
  useEffect(() => {
    const initAgent = async () => {
      // Load config from localStorage
      const savedConfig = localStorage.getItem('mcp-server-config');
      let config = { host: 'localhost', port: 8000, llmProvider: 'ollama' };

      if (savedConfig) {
        try {
          config = { ...config, ...JSON.parse(savedConfig) };
        } catch (error) {
          console.error('Failed to load config:', error);
        }
      }

      // Load API keys from IndexedDB
      const [geminiKey, openrouterKey] = await Promise.all([
        getApiKey('geminiApiKey'),
        getApiKey('openrouterApiKey')
      ]);

      config.geminiApiKey = geminiKey;
      config.openrouterApiKey = openrouterKey;

      setServerConfig(config);

      // Create agent instance with full config
      try {
        const newAgent = new LangGraphAgent(config.host, config.port, config);
        setAgent(newAgent);
        setLlmStatus('ready');

        // Test MCP server connection
        try {
          await newAgent.testConnection();
          setMcpServerStatus('connected');
        } catch (error) {
          console.warn('MCP server not reachable:', error);
          setMcpServerStatus('disconnected');
        }
      } catch (error) {
        console.error('Failed to initialize agent:', error);
        setLlmStatus('not-configured');
        setMcpServerStatus('unknown');
      }

      // Add welcome message
      setMessages([{
        type: 'system',
        message: 'Welcome to the MITRE ATT&CK Intelligence Assistant! Ask me anything about tactics, techniques, groups, or mitigations.',
        timestamp: new Date().toISOString()
      }]);
    };

    initAgent();
  }, []);

  // Scroll to bottom of messages container (not the page)
  const messagesContainerRef = useRef(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle config change
  const handleConfigChange = async (newConfig) => {
    setServerConfig(newConfig);

    // Recreate agent with new config including all LLM settings
    try {
      const newAgent = new LangGraphAgent(newConfig.host, newConfig.port, newConfig);
      setAgent(newAgent);
      setLlmStatus('ready');

      // Test MCP server connection
      try {
        await newAgent.testConnection();
        setMcpServerStatus('connected');
      } catch (error) {
        console.warn('MCP server not reachable:', error);
        setMcpServerStatus('disconnected');
      }

      // Get model display info
      const modelInfo = getModelDisplayInfo(newConfig);

      // Add system message
      setMessages(prev => [...prev, {
        type: 'system',
        message: `Configuration updated:\n- MCP Server: ${newConfig.host}:${newConfig.port}\n- LLM Provider: ${modelInfo.provider}\n- Model: ${modelInfo.model}`,
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      console.error('Failed to create agent:', error);
      setLlmStatus('not-configured');
      setMcpServerStatus('unknown');
      setMessages(prev => [...prev, {
        type: 'error',
        message: `Failed to initialize LLM: ${error.message}`,
        timestamp: new Date().toISOString()
      }]);
    }
  };

  // Handle tool approval
  const handleToolApproval = (approved) => {
    if (toolApprovalResolver) {
      // Update the tool-approval message to show the decision
      setMessages(prev => prev.map(msg => {
        if (msg.type === 'tool-approval' && msg.toolCalls === pendingToolCalls) {
          return { ...msg, decision: approved ? 'approved' : 'denied' };
        }
        return msg;
      }));

      toolApprovalResolver.resolve(approved);
      setPendingToolCalls(null);
      setToolApprovalResolver(null);
    }
  };

  // Handle sending message
  const handleSendMessage = async (text) => {
    if (!agent) {
      setMessages(prev => [...prev, {
        type: 'error',
        message: 'Agent not initialized. Please refresh the page.',
        timestamp: new Date().toISOString()
      }]);
      return;
    }

    setIsLoading(true);

    // Add user message
    setMessages(prev => [...prev, {
      type: 'user',
      message: text,
      timestamp: new Date().toISOString()
    }]);

    try {
      // Callback for tool approval
      const requestToolApproval = async (toolCalls) => {
        // Add approval request message to chat
        setMessages(prev => [...prev, {
          type: 'tool-approval',
          toolCalls: toolCalls,
          timestamp: new Date().toISOString()
        }]);

        return new Promise((resolve) => {
          setPendingToolCalls(toolCalls);
          setToolApprovalResolver({ resolve });
        });
      };

      // Process query with agent
      const response = await agent.processQuery(text, requestToolApproval);

      // Add assistant response
      setMessages(prev => [...prev, {
        type: 'assistant',
        message: response,
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      console.error('Error processing message:', error);

      // Add error message
      setMessages(prev => [...prev, {
        type: 'error',
        message: `Error: ${error.message}\n\nPlease check:\n- mitre-mcp server is running\n- Server address is correct\n- Network connection is active`,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle clear chat
  const handleClearChat = () => {
    if (window.confirm('Clear all messages?')) {
      setMessages([{
        type: 'system',
        message: 'Chat cleared. How can I help you?',
        timestamp: new Date().toISOString()
      }]);

      if (agent) {
        agent.clearHistory();
      }
    }
  };

  return (
    <div className="w-full bg-white border-2 border-gray-300 shadow-xl">
      {/* Header */}
      <div className="border-b-2 border-gray-300 bg-black text-white p-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold">Ask a Question</h2>
            <p className="text-xs text-gray-400 mt-1">
              AI-Powered MITRE ATT&CK Assistant
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Status Indicators */}
            <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-800 border border-gray-600">
              {/* MCP Server Status */}
              <div className="flex items-center gap-1.5" title={`MCP Server: ${mcpServerStatus}`}>
                <div className={`w-2 h-2 rounded-full ${
                  mcpServerStatus === 'connected' ? 'bg-green-500' :
                  mcpServerStatus === 'disconnected' ? 'bg-red-500' :
                  'bg-gray-400'
                }`}></div>
                <span className="text-xs text-gray-300">MCP</span>
              </div>

              {/* LLM Status */}
              <div className="flex items-center gap-1.5" title={`LLM: ${llmStatus}`}>
                <div className={`w-2 h-2 rounded-full ${
                  llmStatus === 'ready' ? 'bg-green-500' :
                  llmStatus === 'not-configured' ? 'bg-red-500' :
                  'bg-gray-400'
                }`}></div>
                <span className="text-xs text-gray-300">LLM</span>
              </div>
            </div>

            {/* Clear Chat Button */}
            <button
              onClick={handleClearChat}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-xs transition-colors"
              title="Clear chat history"
            >
              Clear
            </button>

            {/* Config Button */}
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-xs transition-colors"
              title="Configure server"
            >
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showConfig && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border-2 border-gray-300">
              {/* Modal Header */}
              <div className="sticky top-0 bg-black text-white px-6 py-4 flex justify-between items-center z-10">
                <h3 className="text-lg font-bold">Settings</h3>
                <button
                  onClick={() => setShowConfig(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <ServerConfig
                onConfigChange={(config) => {
                  handleConfigChange(config);
                  setShowConfig(false);
                }}
                initialConfig={serverConfig}
              />
            </div>
          </div>
        </div>
      )}

      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        className="h-[500px] overflow-y-auto p-4 bg-gray-50 border-b-2 border-gray-300"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p className="text-sm">Start a conversation...</p>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <ChatMessage
                key={index}
                message={msg.message}
                type={msg.type}
                timestamp={msg.timestamp}
                toolCalls={msg.toolCalls}
                decision={msg.decision}
                onApprove={() => handleToolApproval(true)}
                onDeny={() => handleToolApproval(false)}
              />
            ))}
            {isLoading && (
              <div className="flex items-center space-x-2 text-gray-600 p-4 text-sm">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Thinking...</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        modelInfo={getModelDisplayInfo(serverConfig)}
      />
    </div>
  );
}
