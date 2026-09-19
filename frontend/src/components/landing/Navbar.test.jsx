/**
 * Tests for the landing navbar (frontend/src/components/landing/Navbar.jsx).
 *
 * Regression covered:
 *  - F-UX-014 (#99): the icon-only mobile menu button must expose an
 *    accessible name (and expanded state) so screen readers announce it.
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
});
