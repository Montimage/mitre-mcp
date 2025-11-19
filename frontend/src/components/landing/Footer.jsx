/**
 * Footer Component
 *
 * Application footer with links, attribution, and copyright information
 */
export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About Section */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">
              MITRE ATT&CK Intelligence Assistant
            </h3>
            <p className="text-sm text-gray-400">
              An AI-powered interface for querying the MITRE ATT&CK framework using natural language.
              Built with React, LangGraphJS, and the Model Context Protocol.
            </p>
          </div>

          {/* Links Section */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://github.com/montimage/mitre-mcp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-400 transition-colors"
                >
                  GitHub Repository
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/montimage/mitre-mcp#readme"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-400 transition-colors"
                >
                  Documentation
                </a>
              </li>
              <li>
                <a
                  href="https://attack.mitre.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-400 transition-colors"
                >
                  MITRE ATT&CK Framework
                </a>
              </li>
              <li>
                <a
                  href="https://pypi.org/project/mitre-mcp/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-400 transition-colors"
                >
                  PyPI Package
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Section */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">Developed By</h3>
            <p className="text-sm text-gray-400 mb-2">
              <a
                href="https://www.montimage.eu"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition-colors font-semibold"
              >
                Montimage
              </a>
            </p>
            <p className="text-sm text-gray-400 mb-4">
              A cybersecurity company specializing in network monitoring, security analysis,
              and AI-driven threat detection.
            </p>
            <a
              href="mailto:luong.nguyen@montimage.eu"
              className="text-sm text-gray-400 hover:text-blue-400 transition-colors"
            >
              luong.nguyen@montimage.eu
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm text-gray-500">
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
