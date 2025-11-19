/**
 * Hero Section Component
 *
 * Main landing section with project branding, description, and call-to-action
 */
export default function Hero() {
  const scrollToChat = () => {
    const chatSection = document.getElementById('chat');
    if (chatSection) {
      chatSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 text-white py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center">
          {/* Main Title */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-6">
            MITRE ATT&CK
            <br />
            <span className="text-blue-200">Intelligence Assistant</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 max-w-2xl mx-auto text-xl sm:text-2xl text-blue-100">
            Interact with the MITRE ATT&CK framework using natural language powered by AI
          </p>

          {/* Description */}
          <p className="mt-4 max-w-3xl mx-auto text-base sm:text-lg text-blue-200">
            Query tactics, techniques, threat groups, and mitigations from the world's most comprehensive
            adversary knowledge base. Built with LangGraphJS and the Model Context Protocol.
          </p>

          {/* Call-to-Action Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={scrollToChat}
              className="w-full sm:w-auto px-8 py-4 bg-white text-blue-700 font-semibold rounded-lg shadow-lg hover:bg-blue-50 hover:scale-105 transform transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-300"
            >
              Try It Now
            </button>
            <a
              href="https://github.com/montimage/mitre-mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-4 bg-transparent border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-blue-700 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-300"
            >
              View Documentation
            </a>
          </div>

          {/* Feature Badges */}
          <div className="mt-12 flex flex-wrap justify-center gap-4 text-sm">
            <span className="px-4 py-2 bg-blue-800 bg-opacity-50 rounded-full backdrop-blur-sm">
              🔍 Real-time Data
            </span>
            <span className="px-4 py-2 bg-blue-800 bg-opacity-50 rounded-full backdrop-blur-sm">
              🤖 AI-Powered
            </span>
            <span className="px-4 py-2 bg-blue-800 bg-opacity-50 rounded-full backdrop-blur-sm">
              ⚡ Fast & Efficient
            </span>
            <span className="px-4 py-2 bg-blue-800 bg-opacity-50 rounded-full backdrop-blur-sm">
              🔧 Fully Configurable
            </span>
          </div>
        </div>
      </div>

      {/* Decorative Element */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-50 to-transparent"></div>
    </section>
  );
}
