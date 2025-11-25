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

            {/* PyPI & Status Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <a href="https://pypi.org/project/mitre-mcp/" target="_blank" rel="noopener noreferrer">
                <img src="https://img.shields.io/pypi/v/mitre-mcp.svg?label=PyPI&logo=pypi" alt="PyPI version" className="h-5" />
              </a>
              <a href="https://pepy.tech/projects/mitre-mcp" target="_blank" rel="noopener noreferrer">
                <img src="https://static.pepy.tech/badge/mitre-mcp" alt="PyPI Downloads" className="h-5" />
              </a>
              <a href="https://pypi.org/project/mitre-mcp/" target="_blank" rel="noopener noreferrer">
                <img src="https://img.shields.io/pypi/pyversions/mitre-mcp.svg?logo=python&logoColor=white" alt="Python versions" className="h-5" />
              </a>
              <a href="https://github.com/montimage/mitre-mcp/actions/workflows/test.yml" target="_blank" rel="noopener noreferrer">
                <img src="https://github.com/montimage/mitre-mcp/actions/workflows/test.yml/badge.svg?branch=main" alt="Test status" className="h-5" />
              </a>
              <a href="https://github.com/montimage/mitre-mcp/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">
                <img src="https://img.shields.io/github/license/montimage/mitre-mcp.svg" alt="License" className="h-5" />
              </a>
            </div>

            {/* Subtitle */}
            <p className="text-xl text-gray-700 leading-relaxed">
              Interact with the MITRE ATT&CK framework using natural language powered by AI
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


            {/* Getting Started Instructions */}
            <div className="mt-8 p-6 bg-gray-50 border border-gray-200 shadow-sm">
              <h4 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide">
                Getting Started
              </h4>
              <ol className="list-decimal list-inside space-y-3 text-sm text-gray-700">
                <li>
                  <span className="font-medium">Install mitre-mcp:</span>
                  <div className="mt-1 ml-5 p-2 bg-white border border-gray-300 text-xs text-gray-900 font-mono">
                    pip install mitre-mcp
                  </div>
                </li>
                <li>
                  <span className="font-medium">Start the server:</span>
                  <div className="mt-1 ml-5 p-2 bg-white border border-gray-300 text-xs text-gray-900 font-mono">
                    mitre-mcp --http --host 0.0.0.0 --port 8000
                  </div>
                </li>
                <li>
                  <span className="font-medium">Open the website and ask questions:</span>
                  <div className="mt-1 ml-5">
                    <a
                      href="https://mitre-mcp.montimage.eu"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline text-xs font-medium"
                    >
                      mitre-mcp.montimage.eu
                    </a>
                    <span className="text-xs text-gray-500 ml-2">- Ask questions about MITRE ATT&CK</span>
                  </div>
                </li>
              </ol>
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
