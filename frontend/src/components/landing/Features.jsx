/**
 * Features Section Component
 *
 * Showcases key features of the MITRE ATT&CK Intelligence Assistant
 */
export default function Features() {
  const features = [
    {
      title: "Real-time MITRE ATT&CK Data",
      description: "Access the latest tactics, techniques, and procedures from the comprehensive MITRE ATT&CK framework with automatic caching and updates.",
      highlights: ["Latest threat intelligence", "Auto-cached data", "Fast lookups"]
    },
    {
      title: "AI-Powered Queries",
      description: "Use natural language to interact with the framework. Ask questions in plain English and get intelligent, context-aware responses.",
      highlights: ["Natural language processing", "Smart query understanding", "Context-aware responses"]
    },
    {
      title: "Flexible Configuration",
      description: "Connect to any mitre-mcp server with custom endpoints. Configure host, port, and connection settings to match your infrastructure.",
      highlights: ["Custom server endpoints", "Easy configuration", "Connection testing"]
    },
    {
      title: "Multi-Domain Support",
      description: "Query across Enterprise, Mobile, and ICS ATT&CK domains. Get comprehensive coverage of threats across different platforms.",
      highlights: ["Enterprise domain", "Mobile threats", "ICS/OT security"]
    },
    {
      title: "High Performance",
      description: "Optimized with O(1) lookups using pre-built indices. Experience 80-95% faster technique lookups compared to linear scanning.",
      highlights: ["Indexed data", "Fast responses", "Efficient caching"]
    },
    {
      title: "Comprehensive Tooling",
      description: "Access all 9 MCP tools including tactics, techniques, groups, software, and mitigations through a unified conversational interface.",
      highlights: ["9 powerful tools", "Unified interface", "Complete coverage"]
    }
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-black mb-4">
            Powerful Features
          </h2>
          <div className="h-1 w-20 bg-black mb-6"></div>
          <p className="text-lg text-gray-700 max-w-2xl">
            Everything you need to interact with MITRE ATT&CK framework through natural language
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white border-2 border-gray-300 p-6 shadow-lg hover:shadow-xl transition-shadow duration-300"
            >
              {/* Title */}
              <h3 className="text-lg font-bold text-black mb-3">
                {feature.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-gray-700 mb-4 leading-relaxed">
                {feature.description}
              </p>

              {/* Highlights */}
              <ul className="space-y-2">
                {feature.highlights.map((highlight, idx) => (
                  <li key={idx} className="flex items-start text-xs text-gray-600">
                    <span className="text-black mr-2 font-bold">—</span>
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Additional Info */}
        <div className="mt-16">
          <div className="border-2 border-gray-300 p-8 max-w-3xl mx-auto shadow-md bg-gray-50">
            <p className="text-sm text-gray-700 leading-relaxed">
              <span className="font-bold text-black">Built with modern technologies:</span>
              {" "}React.js, Vite, Tailwind CSS, LangGraphJS, and the Model Context Protocol (MCP) for
              seamless integration with MITRE ATT&CK data.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
