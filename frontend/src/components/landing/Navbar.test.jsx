/**
 * Tests for the landing navbar (frontend/src/components/landing/Navbar.jsx).
 *
 * Regression covered:
 *  - F-UX-014 (#99): the icon-only mobile menu button must expose an
 *    accessible name (and expanded state) so screen readers announce it.
 *  - F-UX-012 (#98): the navbar's filled primary CTA must point at the
 *    in-page chat (#chat) — previously the only filled CTA led off-site to
 *    GitHub, and there was no "Chat"/"Try it" entry at all.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Navbar from './Navbar.jsx';

describe('Navbar', () => {
  it('the mobile menu button has an accessible name', () => {
    render(<Navbar />);
    expect(screen.getByRole('button', { name: /navigation menu/i })).toBeTruthy();
  });

  it('toggling the menu updates the accessible name and expanded state', () => {
    render(<Navbar />);
    const button = screen.getByRole('button', { name: /open navigation menu/i });
    expect(button.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(button);
    const expanded = screen.getByRole('button', { name: /close navigation menu/i });
    expect(expanded.getAttribute('aria-expanded')).toBe('true');
    expect(expanded.getAttribute('aria-controls')).toBe('mobile-menu');
  });

  it('F-UX-012: the primary CTA links to the in-page chat', () => {
    render(<Navbar />);
    const cta = screen.getByRole('link', { name: /try it/i });
    expect(cta.getAttribute('href')).toBe('#chat');
    // Primary-CTA styling: filled black on white, the same treatment the
    // GitHub button used to carry.
    expect(cta.className).toContain('bg-black');
    expect(cta.className).toContain('text-white');
  });

  it('F-UX-012: the GitHub link is demoted — no longer the filled CTA', () => {
    render(<Navbar />);
    const github = screen.getAllByRole('link', { name: /github/i })[0];
    expect(github.getAttribute('href')).toBe('https://github.com/montimage/mitre-mcp');
    expect(github.className).not.toContain('bg-black');
  });

  it('F-UX-012: the mobile menu also carries the chat CTA', () => {
    render(<Navbar />);
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));
    const mobileCta = document.querySelector('#mobile-menu a[href="#chat"]');
    expect(mobileCta).toBeTruthy();
    expect(mobileCta.className).toContain('bg-black');
  });
});
