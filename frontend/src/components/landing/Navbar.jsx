/**
 * Navbar Component
 *
 * Main navigation bar with logo and menu items.
 *
 * Design: the masthead of the "Ivory Dossier" system — translucent paper
 * over a hairline rule, mono uppercase nav labels that grow a brass
 * underline on hover, and a single filled-ink CTA. Height stays h-16 (64px)
 * because the hero's sticky chat clears exactly that (F-UX-019, lg:top-20).
 */
import { useState } from 'react';
import logo from '../../assets/logo.svg';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { name: 'Home', href: '#' },
    { name: 'Features', href: '#features' },
    { name: 'Playbooks', href: '#playbooks' },
  ];

  return (
    <nav className="sticky top-0 z-40 border-b border-rule bg-paper/85 backdrop-blur-md supports-[backdrop-filter]:bg-paper/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Masthead — logo plus a two-line wordmark: display serif name,
              mono micro-label underneath, the same pairing every section
              header uses. */}
          <div className="flex items-center">
            <a href="#" className="group flex items-center gap-3">
              <img src={logo} alt="MITRE MCP Logo" className="h-9 w-auto" />
              <span className="hidden sm:block border-l border-rule pl-3">
                <span className="block whitespace-nowrap font-display text-xl font-semibold leading-none text-ink">
                  MITRE MCP
                </span>
                <span className="mt-1 hidden whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500 lg:block">
                  Intelligence Assistant
                </span>
              </span>
            </a>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-1">
            {menuItems.map((item) => (
              <a
                key={item.name}
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                className="relative whitespace-nowrap px-2.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-gray-600 lg:px-3 transition-colors hover:text-ink after:absolute after:inset-x-3 after:bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-brass after:transition-transform after:duration-300 hover:after:scale-x-100"
              >
                {item.name}
                {item.external && (
                  <svg className="inline-block w-3 h-3 ml-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                )}
              </a>
            ))}

            {/* GitHub Button — secondary style: the filled CTA is reserved
                for the in-page chat so the primary action stays on-site
                (F-UX-012). Icon-first, hairline border, no fill. */}
            <a
              href="https://github.com/montimage/mitre-mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-3 flex shrink-0 items-center gap-2 whitespace-nowrap border border-rule-strong px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-gray-600 transition-colors hover:border-ink hover:text-ink"
            >
              <svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>GitHub</span>
            </a>

            {/* Primary CTA — filled, on-site: jump straight to the chat
                (F-UX-012). bg-black resolves to warm ink through the theme. */}
            <a
              href="#chat"
              className="group ml-2 flex shrink-0 items-center gap-2 whitespace-nowrap bg-black px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white transition-colors hover:bg-gray-800"
            >
              <span>Try it</span>
              <span aria-hidden="true" className="text-brass transition-transform duration-300 group-hover:translate-x-0.5">
                &rarr;
              </span>
            </a>
          </div>

          {/* Mobile Menu Button — min 44x44 so the icon-only target meets the
              small-screen touch-target minimum (F-UX-019). */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              className="p-2 min-w-11 min-h-11 inline-flex items-center justify-center border border-transparent text-gray-600 transition-colors hover:border-rule hover:text-ink"
            >
              {mobileMenuOpen ? (
                <svg aria-hidden="true" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg aria-hidden="true" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div id="mobile-menu" className="md:hidden border-t border-rule bg-paper">
          <div className="px-4 py-3 space-y-1">
            {menuItems.map((item) => (
              <a
                key={item.name}
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                onClick={() => setMobileMenuOpen(false)}
                className="block border-b border-rule px-1 py-3 font-mono text-xs uppercase tracking-[0.14em] text-gray-600 transition-colors hover:text-ink"
              >
                {item.name}
                {item.external && (
                  <svg className="inline-block w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                )}
              </a>
            ))}

            {/* Mobile primary CTA — same filled treatment as desktop, closes
                the menu on tap (F-UX-012). */}
            <a
              href="#chat"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-3 flex items-center justify-between bg-black px-4 py-3 font-mono text-xs uppercase tracking-[0.14em] text-white transition-colors hover:bg-gray-800"
            >
              <span>Try it</span>
              <span aria-hidden="true" className="text-brass">&rarr;</span>
            </a>

            {/* Mobile GitHub Button */}
            <a
              href="https://github.com/montimage/mitre-mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 border border-rule-strong px-4 py-3 font-mono text-xs uppercase tracking-[0.14em] text-gray-600 transition-colors hover:border-ink hover:text-ink"
            >
              <svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>GitHub</span>
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
