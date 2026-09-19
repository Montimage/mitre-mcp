/**
 * Tests for the landing footer (frontend/src/components/landing/Footer.jsx).
 *
 * Regression covered:
 *  - #211 review: the bottom-bar legal text (copyright + MITRE trademark)
 *    sits on the ink footer, where text-gray-500 measures 3.78:1 — below
 *    the 4.5:1 WCAG AA floor for 12px text. It must stay on gray-400
 *    (6.8:1), the same muted tint the rest of the footer text uses.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from './Footer.jsx';

describe('Footer', () => {
  it('keeps the legal bottom bar at AA contrast on the ink ground', () => {
    render(<Footer />);
    const bar = screen.getByText(/MIT License/).parentElement;
    expect(bar.className).toContain('text-gray-400');
    expect(bar.className).not.toContain('text-gray-500');
  });

  it('renders the resource links and attribution', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: 'GitHub Repository' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'MITRE ATT&CK Framework' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Montimage' })).toBeTruthy();
    expect(screen.getByText(/registered trademark of The MITRE Corporation/)).toBeTruthy();
  });
});
