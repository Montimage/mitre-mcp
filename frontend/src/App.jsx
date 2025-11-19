/**
 * Main App Component
 *
 * Landing page with integrated chatbox for MITRE ATT&CK Intelligence Assistant
 */
import Hero from './components/landing/Hero';
import Features from './components/landing/Features';
import Footer from './components/landing/Footer';
import ChatBox from './components/chat/ChatBox';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <Hero />

      {/* Features Section */}
      <Features />

      {/* Chat Section */}
      <section id="chat" className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Try It Now
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Ask questions about MITRE ATT&CK tactics, techniques, threat groups, and more.
              The AI assistant will help you explore the framework using natural language.
            </p>
          </div>

          {/* ChatBox */}
          <ChatBox />

          {/* Example Queries */}
          <div className="mt-12">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">
              Example Queries
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl mx-auto">
              {exampleQueries.map((query, index) => (
                <div
                  key={index}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors cursor-default"
                >
                  💡 {query}
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-8 max-w-3xl mx-auto">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h4 className="font-semibold text-blue-900 mb-2">
                📝 Getting Started
              </h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                <li>Make sure the mitre-mcp server is running on your machine</li>
                <li>Configure the server address if it's not on localhost:8000</li>
                <li>Test the connection using the "Configure" button above</li>
                <li>Start asking questions in natural language!</li>
              </ol>
              <div className="mt-4 p-3 bg-blue-100 rounded text-xs text-blue-900 font-mono">
                Start server: <strong>mitre-mcp --http --port 8000</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}

// Example queries for users to try
const exampleQueries = [
  "Show me all tactics in the enterprise domain",
  "What is technique T1059?",
  "Which techniques does APT29 use?",
  "List initial access techniques",
  "What mitigations exist for privilege escalation?",
  "Tell me about the discovery tactic"
];
