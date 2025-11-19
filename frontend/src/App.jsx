/**
 * Main App Component
 *
 * Landing page with integrated chatbox for MITRE ATT&CK Intelligence Assistant
 */
import Hero from './components/landing/Hero';
import Features from './components/landing/Features';
import Playbooks from './components/landing/Playbooks';
import Footer from './components/landing/Footer';
import ChatBox from './components/chat/ChatBox';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <Hero />

      {/* Features Section */}
      <Features />

      {/* Playbooks Section */}
      <Playbooks />

      {/* Chat Section */}
      <section id="chat" className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Try It Now
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Copy any query from the playbooks above or ask your own questions about MITRE ATT&CK.
              The AI assistant will help you explore tactics, techniques, threat groups, and more.
            </p>
          </div>

          {/* ChatBox */}
          <ChatBox />

          {/* Instructions */}
          <div className="mt-8 max-w-3xl mx-auto">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h4 className="font-semibold text-blue-900 mb-2">
                📝 Getting Started
              </h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                <li>Make sure the mitre-mcp server is running on your machine</li>
                <li>Configure the server address if it's not on localhost:8000</li>
                <li>Test the connection using the "⚙️ Configure" button in the chatbox</li>
                <li>Copy queries from the playbooks above or ask your own questions!</li>
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
