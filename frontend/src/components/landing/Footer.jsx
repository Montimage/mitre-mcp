/**
 * Footer Component
 *
 * Application footer with links, attribution, and copyright information
 */
import logo from '../../assets/logo.svg';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About Section */}
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <img src={logo} alt="MITRE MCP Logo" className="h-10 w-auto" />
              <h3 className="text-white font-bold text-sm uppercase tracking-wide">
                MITRE MCP
              </h3>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              An AI-powered interface for querying the MITRE ATT&CK framework using natural language.
              Built with React, LangGraphJS, and the Model Context Protocol.
            </p>
          </div>

          {/* Links Section */}
          <div>
            <h3 className="text-white font-bold text-sm mb-4 uppercase tracking-wide">Resources</h3>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="https://github.com/montimage/mitre-mcp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors border-b border-transparent hover:border-white inline-block"
                >
                  GitHub Repository
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/montimage/mitre-mcp#readme"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors border-b border-transparent hover:border-white inline-block"
                >
                  Documentation
                </a>
              </li>
              <li>
                <a
                  href="https://attack.mitre.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors border-b border-transparent hover:border-white inline-block"
                >
                  MITRE ATT&CK Framework
                </a>
              </li>
              <li>
                <a
                  href="https://pypi.org/project/mitre-mcp/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors border-b border-transparent hover:border-white inline-block"
                >
                  PyPI Package
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Section */}
          <div>
            <h3 className="text-white font-bold text-sm mb-4 uppercase tracking-wide">Developed By</h3>
            <p className="text-xs text-gray-400 mb-2">
              <a
                href="https://www.montimage.eu"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-gray-300 transition-colors font-bold border-b border-white hover:border-gray-300"
              >
                Montimage
              </a>
            </p>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              A cybersecurity company specializing in network monitoring, security analysis,
              and AI-driven threat detection.
            </p>
            <a
              href="mailto:luong.nguyen@montimage.eu"
              className="text-xs text-gray-400 hover:text-white transition-colors border-b border-transparent hover:border-white inline-block"
            >
              luong.nguyen@montimage.eu
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t border-gray-800 text-center text-xs text-gray-500">
          <p>
            © {currentYear} Montimage. Released under MIT License.
          </p>
          <p className="mt-2">
            MITRE ATT&CK® is a registered trademark of The MITRE Corporation.
          </p>
        </div>
      </div>
    </footer>
  );
}
