/**
 * ChatBox Component
 *
 * Main chat interface integrating all chat components
 */
import { useState, useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import ServerConfig from './ServerConfig';
import LangGraphAgent from '../../services/langGraphAgent';

export default function ChatBox() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [serverConfig, setServerConfig] = useState({ host: 'localhost', port: 8000 });
  const [agent, setAgent] = useState(null);
  const messagesEndRef = useRef(null);

  // Initialize agent
  useEffect(() => {
    // Load config from localStorage
    const savedConfig = localStorage.getItem('mcp-server-config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setServerConfig(parsed);
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    }

    // Create agent instance
    const newAgent = new LangGraphAgent(serverConfig.host, serverConfig.port);
    setAgent(newAgent);

    // Add welcome message
    setMessages([{
      type: 'system',
      message: 'Welcome to the MITRE ATT&CK Intelligence Assistant! Ask me anything about tactics, techniques, groups, or mitigations.',
      timestamp: new Date().toISOString()
    }]);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle config change
  const handleConfigChange = (newConfig) => {
    setServerConfig(newConfig);

    // Recreate agent with new config
    const newAgent = new LangGraphAgent(newConfig.host, newConfig.port);
    setAgent(newAgent);

    // Add system message
    setMessages(prev => [...prev, {
      type: 'system',
      message: `Server configuration updated: ${newConfig.host}:${newConfig.port}`,
      timestamp: new Date().toISOString()
    }]);
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
      // Process query with agent
      const response = await agent.processQuery(text);

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
    <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">MITRE ATT&CK Assistant</h2>
            <p className="text-sm text-blue-100 mt-1">
              Powered by AI and Model Context Protocol
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {/* Clear Chat Button */}
            <button
              onClick={handleClearChat}
              className="px-3 py-1.5 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-md text-sm transition-colors"
              title="Clear chat history"
            >
              🗑️ Clear
            </button>

            {/* Config Button */}
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="px-3 py-1.5 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-md text-sm transition-colors"
              title="Configure server"
            >
              ⚙️ {showConfig ? 'Hide Config' : 'Configure'}
            </button>
          </div>
        </div>
      </div>

      {/* Server Config (collapsible) */}
      {showConfig && (
        <ServerConfig
          onConfigChange={handleConfigChange}
          initialConfig={serverConfig}
        />
      )}

      {/* Messages Container */}
      <div
        className="h-[500px] overflow-y-auto p-4 bg-gray-50"
        style={{ scrollBehavior: 'smooth' }}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>No messages yet. Start a conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <ChatMessage
                key={index}
                message={msg.message}
                type={msg.type}
                timestamp={msg.timestamp}
              />
            ))}
            {isLoading && (
              <div className="flex items-center space-x-2 text-gray-500 p-4">
                <svg
                  className="animate-spin h-5 w-5"
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
                <span>Assistant is thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
      />
    </div>
  );
}
