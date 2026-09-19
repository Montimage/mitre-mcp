/**
 * Features Section Component
 *
 * Showcases key features of the MITRE ATT&CK Intelligence Assistant
 *
 * Design: an index of numbered entries rather than a card grid. Each entry
 * is separated by hairlines only — the brass index number and a serif title
 * carry the hierarchy, so six items read as one ruled page instead of six
 * floating boxes.
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
      description: "Pre-built indices make technique lookups 80-95% faster than scanning the full dataset.",
      highlights: ["Indexed data", "Fast responses", "Efficient caching"]
    },
    {
      title: "Comprehensive Tooling",
      description: "Access all 9 MCP tools including tactics, techniques, groups, software, and mitigations through a unified conversational interface.",
      highlights: ["9 powerful tools", "Unified interface", "Complete coverage"]
    }
  ];

  return (
    <section className="border-b border-rule bg-paper px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
      <div className="max-w-7xl mx-auto">
        {/* Section Header — filed number, serif heading, ruled underline:
            the same three-part masthead every section repeats. */}
        <div className="max-w-2xl">
          <p className="dossier-eyebrow mb-5">02 — Capabilities</p>
          <h2 className="font-display text-4xl sm:text-5xl font-semibold text-ink">
            Powerful Features
          </h2>
          <div className="dossier-rule mt-6 mb-6" />
          <p className="text-lg leading-relaxed text-gray-600">
            Everything you need to interact with MITRE ATT&CK framework through natural language
          </p>
        </div>

        {/* Features Index — a ruled grid: hairlines between entries, no
            card borders or shadows. The hover state lifts the paper a shade
            and slides the index number, so the whole row reads as one
            target without pretending to be clickable. */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-l border-rule">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className="group border-b border-r border-rule p-7 lg:p-8 transition-colors duration-300 hover:bg-paper-sunk/60"
            >
              <span className="block font-mono text-[11px] tracking-[0.18em] text-brass-700 transition-transform duration-300 group-hover:translate-x-1">
                {String(index + 1).padStart(2, '0')}
              </span>

              <h3 className="mt-4 font-display text-2xl font-semibold leading-snug text-ink">
                {feature.title}
              </h3>

              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                {feature.description}
              </p>

              <ul className="mt-5 space-y-1.5 border-t border-rule pt-4">
                {feature.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2.5 text-xs text-gray-500">
                    <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rotate-45 bg-brass" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        {/* Colophon — the stack, set as a footnote rather than a callout
            box: small caps label, serif sentence, hairline above. */}
        <div className="mt-16 border-t border-rule pt-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">Built with</p>
          <p className="mt-3 max-w-3xl font-display text-xl leading-relaxed text-gray-600">
            React.js, Vite, Tailwind CSS, LangGraphJS, and the{' '}
            <span className="text-ink">Model Context Protocol</span> — for seamless integration with
            MITRE ATT&CK data.
          </p>
        </div>
      </div>
    </section>
  );
}
