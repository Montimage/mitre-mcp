/**
 * Footer Component
 *
 * Application footer with links, attribution, and copyright information
 *
 * Design: the colophon page — warm ink ground with a brass rule across the
 * top edge, serif column headings, and mono micro-labels. Link underlines
 * are brass and always present on hover, never colour-only.
 */
import logo from '../../assets/logo.svg';

const RESOURCES = [
  { label: 'GitHub Repository', href: 'https://github.com/montimage/mitre-mcp' },
  { label: 'Documentation', href: 'https://github.com/montimage/mitre-mcp#readme' },
  { label: 'MITRE ATT&CK Framework', href: 'https://attack.mitre.org/' },
  { label: 'PyPI Package', href: 'https://pypi.org/project/mitre-mcp/' },
];

const linkClass =
  'text-gray-400 underline decoration-transparent underline-offset-4 transition-colors hover:text-white hover:decoration-brass';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative bg-black text-white">
      {/* Brass hairline seals the page. */}
      <div aria-hidden="true" className="h-px w-full bg-brass/70" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
          {/* About Section */}
          <div>
            <div className="flex items-center gap-3">
              <img src={logo} alt="MITRE MCP Logo" className="h-9 w-auto" />
              <span className="border-l border-gray-700 pl-3 font-display text-xl font-semibold leading-none">
                MITRE MCP
              </span>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-gray-400">
              An AI-powered interface for querying the MITRE ATT&CK framework using natural language.
              Built with React, LangGraphJS, and the Model Context Protocol.
            </p>
          </div>

          {/* Links Section */}
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass">Resources</h3>
            <ul className="mt-5 space-y-3 text-sm">
              {RESOURCES.map((resource) => (
                <li key={resource.label}>
                  <a
                    href={resource.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    {resource.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Section */}
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass">Developed By</h3>
            <p className="mt-5">
              <a
                href="https://www.montimage.eu"
                target="_blank"
                rel="noopener noreferrer"
                className="font-display text-2xl font-semibold text-white underline decoration-brass underline-offset-4 transition-colors hover:text-brass-300"
              >
                Montimage
              </a>
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-gray-400">
              A cybersecurity company specializing in network monitoring, security analysis,
              and AI-driven threat detection.
            </p>
            <a
              href="mailto:luong.nguyen@montimage.eu"
              className={`mt-4 inline-block font-mono text-xs ${linkClass}`}
            >
              luong.nguyen@montimage.eu
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-14 flex flex-col gap-2 border-t border-gray-800 pt-8 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {currentYear} Montimage. Released under MIT License.</p>
          <p>MITRE ATT&CK® is a registered trademark of The MITRE Corporation.</p>
        </div>
      </div>
    </footer>
  );
}
