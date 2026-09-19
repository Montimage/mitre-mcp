/**
 * Dedicated full-viewport chat page.
 *
 * Reached via the `#/chat` hash (distinct from the landing `#chat` embed
 * anchor). ChatBox is lazy-loaded the same way Hero does (F-PERF-007) and
 * rendered with the full layout variant so the message pane uses the
 * remaining viewport (F-UX-020). No onSetupStatusChange — the landing
 * checklist lives on Hero only.
 */
import { Suspense, lazy } from 'react';

const ChatBox = lazy(() => import('./ChatBox'));

export default function ChatPage() {
  // Hash `#` matches Navbar Home: no basename needed. Vite `base` only
  // applies to path URLs; this view is intentionally hash-routed.
  return (
    <div className="flex h-dvh flex-col bg-paper bg-grain">
      <header className="flex shrink-0 items-center border-b border-rule bg-paper/85 px-4 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-paper/70">
        <a
          href="#"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-gray-600 transition-colors hover:text-ink"
        >
          ← Back to landing
        </a>
      </header>
      <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
        <Suspense
          fallback={
            <div className="flex h-full min-h-0 flex-col border border-rule bg-paper-card shadow-sheet-lifted">
              <div className="border-b border-ink bg-black px-5 py-4 text-white">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass">AI-Powered</p>
                <h2 className="mt-1 font-display text-xl font-semibold">Ask a Question</h2>
              </div>
              <div
                role="status"
                className="flex min-h-0 flex-1 items-center justify-center bg-paper text-gray-500"
              >
                <p className="font-mono text-xs uppercase tracking-[0.14em]">Loading chat…</p>
              </div>
            </div>
          }
        >
          <ChatBox layout="full" />
        </Suspense>
      </div>
    </div>
  );
}
