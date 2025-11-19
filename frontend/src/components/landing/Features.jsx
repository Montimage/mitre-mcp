/**
 * Features Section Component
 *
 * Showcases key features of the MITRE ATT&CK Intelligence Assistant
 */
export default function Features() {
  const features = [
    {
      icon: "🔍",
      title: "Real-time MITRE ATT&CK Data",
      description: "Access the latest tactics, techniques, and procedures from the comprehensive MITRE ATT&CK framework with automatic caching and updates.",
      highlights: ["Latest threat intelligence", "Auto-cached data", "Fast lookups"]
    },
    {
      icon: "🤖",
      title: "AI-Powered Queries",
      description: "Use natural language to interact with the framework. Ask questions in plain English and get intelligent, context-aware responses.",
      highlights: ["Natural language processing", "Smart query understanding", "Context-aware responses"]
    },
    {
      icon: "🔧",
      title: "Flexible Configuration",
      description: "Connect to any mitre-mcp server with custom endpoints. Configure host, port, and connection settings to match your infrastructure.",
      highlights: ["Custom server endpoints", "Easy configuration", "Connection testing"]
    },
    {
      icon: "🌐",
      title: "Multi-Domain Support",
      description: "Query across Enterprise, Mobile, and ICS ATT&CK domains. Get comprehensive coverage of threats across different platforms.",
      highlights: ["Enterprise domain", "Mobile threats", "ICS/OT security"]
    },
    {
      icon: "⚡",
      title: "High Performance",
      description: "Optimized with O(1) lookups using pre-built indices. Experience 80-95% faster technique lookups compared to linear scanning.",
      highlights: ["Indexed data", "Fast responses", "Efficient caching"]
    },
    {
      icon: "🛠️",
      title: "Comprehensive Tooling",
      description: "Access all 9 MCP tools including tactics, techniques, groups, software, and mitigations through a unified conversational interface.",
      highlights: ["9 powerful tools", "Unified interface", "Complete coverage"]
    }
  ];

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Powerful Features
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Everything you need to interact with MITRE ATT&CK framework through natural language
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 border border-gray-100"
            >
              {/* Icon */}
              <div className="text-5xl mb-4">{feature.icon}</div>

              {/* Title */}
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                {feature.title}
              </h3>

              {/* Description */}
              <p className="text-gray-600 mb-4">
                {feature.description}
              </p>

              {/* Highlights */}
              <ul className="space-y-2">
                {feature.highlights.map((highlight, idx) => (
                  <li key={idx} className="flex items-start text-sm text-gray-700">
                    <span className="text-blue-600 mr-2">✓</span>
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Additional Info */}
        <div className="mt-12 text-center">
          <div className="inline-block bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-3xl">
            <p className="text-gray-700">
              <span className="font-semibold text-blue-700">Built with modern technologies:</span>
              {" "}React.js, Vite, Tailwind CSS, LangGraphJS, and the Model Context Protocol (MCP) for
              seamless integration with MITRE ATT&CK data.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
