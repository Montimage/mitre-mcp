/**
 * Main App Component
 *
 * Landing page with integrated chatbox for MITRE ATT&CK Intelligence Assistant.
 * The dedicated chat view is a hash branch (`#/chat`), not a path route, so
 * it reloads on GitHub Pages without a 404.html SPA fallback (F-UX-020).
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import Navbar from './components/landing/Navbar';
import Hero from './components/landing/Hero';
import Features from './components/landing/Features';
import Playbooks from './components/landing/Playbooks';
import Footer from './components/landing/Footer';

// Lazy ChatPage keeps the dedicated-view shell out of the landing chunk
// (F-PERF-007). ChatPage then lazy-loads ChatBox the same way Hero does.
const ChatPage = lazy(() => import('./components/chat/ChatPage'));

// Distinct from the landing embed's id="chat" (`#chat`).
const DEDICATED_CHAT_HASH = '#/chat';

const isDedicatedChatHash = (hash = window.location.hash) =>
  hash === DEDICATED_CHAT_HASH;

export default function App() {
  const [dedicatedChat, setDedicatedChat] = useState(() => isDedicatedChatHash());

  useEffect(() => {
    const syncHash = () => setDedicatedChat(isDedicatedChatHash());
    window.addEventListener('hashchange', syncHash);
    window.addEventListener('load', syncHash);
    return () => {
      window.removeEventListener('hashchange', syncHash);
      window.removeEventListener('load', syncHash);
    };
  }, []);

  if (dedicatedChat) {
    return (
      <Suspense
        fallback={
          <div className="flex h-dvh items-center justify-center bg-paper bg-grain">
            <p role="status" className="font-mono text-xs uppercase tracking-[0.14em] text-gray-500">
              Loading chat…
            </p>
          </div>
        }
      >
        <ChatPage />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-paper bg-grain">
      {/* Navigation Bar */}
      <Navbar />

      {/* Hero Section with Integrated ChatBox */}
      <Hero />

      {/* Features Section */}
      <div id="features">
        <Features />
      </div>

      {/* Playbooks Section */}
      <div id="playbooks">
        <Playbooks />
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
