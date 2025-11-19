/**
 * Hero Section Component
 *
 * Main landing section with project branding, description, and integrated chatbox
 */
import ChatBox from '../chat/ChatBox';

export default function Hero() {
  return (
    <section className="relative bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left Column - Content */}
          <div className="space-y-8">
            {/* Main Title */}
            <div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-black mb-4">
                MITRE ATT&CK
                <br />
                <span className="text-gray-600">Intelligence Assistant</span>
              </h1>
              <div className="h-1 w-20 bg-black"></div>
            </div>

            {/* Subtitle */}
            <p className="text-xl text-gray-700 leading-relaxed">
              Interact with the MITRE ATT&CK framework using natural language powered by AI
            </p>

            {/* Description */}
            <p className="text-base text-gray-600 leading-relaxed max-w-xl">
              Query tactics, techniques, threat groups, and mitigations from the world's most comprehensive
              adversary knowledge base. Built with LangGraphJS and the Model Context Protocol.
            </p>

            {/* Feature Badges */}
            <div className="flex flex-wrap gap-3">
              <span className="px-4 py-2 bg-gray-100 text-gray-900 text-sm font-medium border border-gray-300 shadow-sm">
                Real-time Data
              </span>
              <span className="px-4 py-2 bg-gray-100 text-gray-900 text-sm font-medium border border-gray-300 shadow-sm">
                AI-Powered
              </span>
              <span className="px-4 py-2 bg-gray-100 text-gray-900 text-sm font-medium border border-gray-300 shadow-sm">
                Fast & Efficient
              </span>
              <span className="px-4 py-2 bg-gray-100 text-gray-900 text-sm font-medium border border-gray-300 shadow-sm">
                Fully Configurable
              </span>
            </div>

            {/* Call-to-Action */}
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="https://github.com/montimage/mitre-mcp"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 bg-black text-white font-semibold border-2 border-black hover:bg-gray-900 transition-colors shadow-lg"
              >
                View Documentation
              </a>
            </div>

            {/* Getting Started Instructions */}
            <div className="mt-8 p-6 bg-gray-50 border border-gray-200 shadow-sm">
              <h4 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide">
                Getting Started
              </h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                <li>Make sure the mitre-mcp server is running on your machine</li>
                <li>Configure the server address using the gear icon in the chatbox</li>
                <li>Test the connection and start asking questions</li>
              </ol>
              <div className="mt-4 p-3 bg-white border border-gray-300 text-xs text-gray-900 font-mono">
                mitre-mcp --http --port 8000
              </div>
            </div>
          </div>

          {/* Right Column - ChatBox */}
          <div className="lg:sticky lg:top-8">
            <ChatBox />
          </div>
        </div>
      </div>
    </section>
  );
}
