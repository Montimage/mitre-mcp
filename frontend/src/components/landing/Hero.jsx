/**
 * Hero Section Component
 *
 * Main landing section with project branding, description, and integrated chatbox
 *
 * The chat is lazy-loaded (F-PERF-007): ChatBox pulls in the agent, the MCP
 * client and the LLM provider SDKs — nearly the whole app payload — so it is
 * split out of the landing entry chunk and fetched in parallel with first
 * paint. The Suspense fallback keeps the chat slot's dimensions so the
 * section does not reflow when the chunk lands.
 */
import { Suspense, lazy, useCallback, useState } from 'react';

const ChatBox = lazy(() => import('../chat/ChatBox'));

// Maps a reported setup status to a checklist dot colour: green once the
// chat's probes proved it works, red once they proved it does not, grey
// while the lazy chunk is still mounting or a probe is in flight.
const checklistDotClass = (status) =>
  status === 'connected' || status === 'ready'
    ? 'bg-green-500'
    : status === 'disconnected' || status === 'not-configured'
      ? 'bg-red-500'
      : 'bg-gray-400';

export default function Hero() {
  // First-run checklist state — populated by ChatBox's onSetupStatusChange
  // once the lazy chat chunk mounts and its init probes run (F-UX-003).
  const [setupStatus, setSetupStatus] = useState({ llm: 'checking', llmError: null, mcp: 'checking' });
  // Stable identity: ChatBox re-reports on every status change, and an
  // unstable callback would re-fire its effect on every render.
  const handleSetupStatus = useCallback((status) => setSetupStatus(status), []);

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
                  <span className="font-medium">Pick a model and ask in the chat:</span>
                  <div className="mt-1 ml-5 space-y-2">
                    <p className="text-xs text-gray-500">
                      Install Ollama and run{' '}
                      <code className="font-mono text-gray-900">ollama pull llama3.1:8b</code>
                      {' '}— or open Settings in the chat and set a Gemini or OpenRouter API key.
                    </p>
                    <div>
                      <a
                        href="#chat"
                        className="text-blue-600 hover:text-blue-800 underline text-xs font-medium"
                      >
                        Jump to the chat ↓
                      </a>
                      <span className="text-xs text-gray-500 ml-2">- Ask questions about MITRE ATT&CK</span>
                    </div>
                  </div>
                </li>
              </ol>

              {/* First-run checklist — mirrors the setup probes the lazy chat
                  runs (F-UX-003), so a first-time user sees whether the
                  assistant will actually answer before typing. ChatBox
                  reports through onSetupStatusChange once its chunk mounts;
                  until then every row reads "checking". */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h5 className="font-semibold text-gray-900 mb-2 text-xs uppercase tracking-wide">
                  First-run checklist
                </h5>
                <ul className="space-y-1.5 text-xs text-gray-700">
                  <li
                    className="flex items-start gap-2"
                    data-status={setupStatus.mcp}
                    title={`MCP Server: ${setupStatus.mcp}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${checklistDotClass(setupStatus.mcp)}`}
                    />
                    <span>MCP server reachable</span>
                  </li>
                  <li
                    className="flex items-start gap-2"
                    data-status={setupStatus.llm}
                    title={`LLM: ${setupStatus.llm}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${checklistDotClass(setupStatus.llm)}`}
                    />
                    <span>
                      LLM provider ready — model installed or API key set
                      {setupStatus.llm === 'not-configured' && setupStatus.llmError ? (
                        <span className="text-yellow-800"> — {setupStatus.llmError.split('\n')[0]}</span>
                      ) : null}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Right Column - ChatBox — id="chat" is the Getting Started
              anchor target (F-UX-017); scroll-mt keeps it clear of the
              sticky navbar. */}
          <div id="chat" className="lg:sticky lg:top-8 scroll-mt-24">
            <Suspense
              fallback={
                <div className="w-full bg-white border-2 border-gray-300 shadow-xl">
                  <div className="border-b-2 border-gray-300 bg-black text-white p-4">
                    <h2 className="text-lg font-bold">Ask a Question</h2>
                    <p className="text-xs text-gray-400 mt-1">AI-Powered MITRE ATT&CK Assistant</p>
                  </div>
                  <div
                    role="status"
                    className="h-[500px] flex items-center justify-center text-gray-400 bg-gray-50 border-b-2 border-gray-300"
                  >
                    <p className="text-sm">Loading chat…</p>
                  </div>
                </div>
              }
            >
              <ChatBox onSetupStatusChange={handleSetupStatus} />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  );
}
