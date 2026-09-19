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
 *
 * Design: the dossier's opening spread — ruled-paper backdrop, a filed
 * section number, a serif masthead whose second line drops to italic, and
 * the chat presented as the one raised white sheet on the page.
 */
import { Suspense, lazy, useCallback, useState } from 'react';

const ChatBox = lazy(() => import('../chat/ChatBox'));

// Maps a reported setup status to a checklist dot colour: green once the
// chat's probes proved it works, red once they proved it does not, grey
// while the lazy chunk is still mounting or a probe is in flight.
const checklistDotClass = (status) =>
  status === 'connected' || status === 'ready'
    ? 'bg-green-600'
    : status === 'disconnected' || status === 'not-configured'
      ? 'bg-red-500'
      : 'bg-gray-400';

// Typographic chips: hairline-ruled, unfilled, brass tick — the page never
// uses brass as a fill behind text.
const CAPABILITIES = ['Real-time Data', 'AI-Powered', 'Fast & Efficient', 'Fully Configurable'];

export default function Hero() {
  // First-run checklist state — populated by ChatBox's onSetupStatusChange
  // once the lazy chat chunk mounts and its init probes run (F-UX-003).
  const [setupStatus, setSetupStatus] = useState({ llm: 'checking', llmError: null, mcp: 'checking' });
  // Stable identity: ChatBox re-reports on every status change, and an
  // unstable callback would re-fire its effect on every render.
  const handleSetupStatus = useCallback((status) => setSetupStatus(status), []);

  return (
    <section className="relative overflow-hidden border-b border-rule bg-paper">
      {/* Ruled-paper backdrop, faded out towards the fold so the hairlines
          read as texture rather than as a table. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-ledger opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_65%)]"
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-24">
        {/* Three grid children, ordered so the chat renders before Getting
            Started below lg (F-UX-012): single-column DOM order there is
            intro → chat → setup. On lg the intro and Getting Started stack
            in column 1 (rows 1-2, lg:gap-y-8 keeps the old space-y-8 rhythm)
            while the chat spans both rows in column 2. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-x-16 lg:gap-y-10 items-start">
          {/* Intro Column - Content */}
          <div className="space-y-8">
            {/* Masthead */}
            <div className="reveal">
              <p className="dossier-eyebrow mb-5">01 — Intelligence</p>
              <h1 className="font-display text-[2.5rem] sm:text-6xl lg:text-7xl font-semibold leading-[0.95] text-ink">
                MITRE ATT&CK
                <br />
                <span className="italic font-normal text-gray-500">Intelligence Assistant</span>
              </h1>
              <div className="dossier-rule mt-8" />
            </div>

            {/* Subtitle */}
            <p className="reveal max-w-xl text-lg sm:text-xl leading-relaxed text-gray-600" style={{ animationDelay: '90ms' }}>
              Interact with the MITRE ATT&CK framework using natural language powered by AI
            </p>

            {/* Capability chips — unfilled, hairline-ruled, brass tick. */}
            <ul className="reveal flex flex-wrap gap-x-2 gap-y-2" style={{ animationDelay: '150ms' }}>
              {CAPABILITIES.map((capability) => (
                <li
                  key={capability}
                  className="flex items-center gap-2 border border-rule-strong px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-gray-600"
                >
                  <span aria-hidden="true" className="h-1 w-1 shrink-0 rotate-45 bg-brass" />
                  {capability}
                </li>
              ))}
            </ul>

            {/* Release colophon — third-party status badges, desaturated so
                their stock colours do not fight the palette; they return to
                full colour on hover for anyone reading them closely. */}
            <div className="reveal space-y-3" style={{ animationDelay: '210ms' }}>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">Release</p>
              <div className="flex flex-wrap items-center gap-2 opacity-75 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0">
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
            </div>
          </div>

          {/* Chat — second grid child: below lg the single column follows
              DOM order, so the chat renders before Getting Started
              (F-UX-012). On lg it is the right column spanning both rows.
              top-20 clears the 64px sticky navbar (F-UX-019); id="chat" is
              the Getting Started anchor target (F-UX-017) and scroll-mt-24
              keeps it clear of the navbar. */}
          <div id="chat" className="reveal-fade lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-20 scroll-mt-24" style={{ animationDelay: '120ms' }}>
            <Suspense
              fallback={
                <div className="w-full border border-rule bg-paper-card shadow-sheet-lifted">
                  <div className="border-b border-ink bg-black px-5 py-4 text-white">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass">AI-Powered</p>
                    <h2 className="mt-1 font-display text-xl font-semibold">Ask a Question</h2>
                  </div>
                  <div
                    role="status"
                    className="h-[min(500px,70dvh)] flex items-center justify-center border-b border-rule bg-paper text-gray-500"
                  >
                    <p className="font-mono text-xs uppercase tracking-[0.14em]">Loading chat…</p>
                  </div>
                </div>
              }
            >
              <ChatBox onSetupStatusChange={handleSetupStatus} />
            </Suspense>
          </div>

          {/* Getting Started Instructions — third grid child: below lg it
              follows the chat; on lg it stacks under the intro in column 1,
              row 2 (the grid's lg:gap-y-10 keeps the vertical rhythm).
              The heading stays a direct child of this element, and the list
              its sibling, because Hero.test.jsx reads the steps through
              getByText('Getting Started').parentElement. */}
          <div className="reveal lg:col-start-1 lg:row-start-2 border border-rule bg-paper-card p-6 sm:p-8 shadow-sheet" style={{ animationDelay: '260ms' }}>
            <h4 className="dossier-section">
              Getting Started
            </h4>
            <ol className="mt-5 ml-4 list-decimal list-outside space-y-5 pl-2 text-sm text-gray-700 marker:font-mono marker:text-xs marker:text-brass-700">
              <li>
                <span className="font-medium text-ink">Install mitre-mcp:</span>
                <div className="mt-2 border border-rule bg-paper px-3 py-2 font-mono text-xs text-ink">
                  pip install mitre-mcp
                </div>
              </li>
              <li>
                <span className="font-medium text-ink">Start the server:</span>
                <div className="mt-2 border border-rule bg-paper px-3 py-2 font-mono text-xs text-ink">
                  mitre-mcp --http --host 0.0.0.0 --port 8000
                </div>
              </li>
              <li>
                <span className="font-medium text-ink">Pick a model and ask in the chat:</span>
                <div className="mt-2 space-y-2">
                  <p className="text-xs leading-relaxed text-gray-600">
                    Install Ollama and run{' '}
                    <code className="font-mono text-ink">ollama pull llama3.1:8b</code>
                    {' '}— or open Settings in the chat and set a Gemini or OpenRouter API key.
                  </p>
                  <div>
                    <a
                      href="#chat"
                      className="font-medium text-brass-700 underline decoration-brass underline-offset-4 transition-colors hover:text-ink hover:decoration-ink text-xs"
                    >
                      Jump to the chat ↓
                    </a>
                    <span className="ml-2 text-xs text-gray-500">- Ask questions about MITRE ATT&CK</span>
                  </div>
                </div>
              </li>
            </ol>

            {/* First-run checklist — mirrors the setup probes the lazy chat
                runs (F-UX-003), so a first-time user sees whether the
                assistant will actually answer before typing. ChatBox
                reports through onSetupStatusChange once its chunk mounts;
                until then every row reads "checking". */}
            <div className="mt-6 border-t border-rule pt-5">
              <h5 className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">
                First-run checklist
              </h5>
              <ul className="mt-3 space-y-2 text-xs text-gray-700">
                <li
                  className="flex items-start gap-2.5"
                  data-status={setupStatus.mcp}
                  title={`MCP Server: ${setupStatus.mcp}`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ring-2 ring-paper-sunk ${checklistDotClass(setupStatus.mcp)}`}
                  />
                  <span>MCP server reachable</span>
                </li>
                <li
                  className="flex items-start gap-2.5"
                  data-status={setupStatus.llm}
                  title={`LLM: ${setupStatus.llm}`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ring-2 ring-paper-sunk ${checklistDotClass(setupStatus.llm)}`}
                  />
                  <span>
                    LLM provider ready — model installed or API key set
                    {setupStatus.llm === 'not-configured' && setupStatus.llmError ? (
                      <span className="text-amber-700"> — {setupStatus.llmError.split('\n')[0]}</span>
                    ) : null}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
