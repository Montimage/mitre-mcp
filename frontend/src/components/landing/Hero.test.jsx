/**
 * Tests for the hero section (frontend/src/components/landing/Hero.jsx).
 *
 * Regression covered:
 *  - F-PERF-007 (#88): the chat mounts through React.lazy + Suspense so the
 *    agent and provider SDKs stay out of the landing entry chunk — the hero
 *    must render its static content immediately and the chat once its chunk
 *    resolves.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Hero from './Hero.jsx';

// The lazy boundary still resolves through import() — mock the module so the
// test never pulls the real ChatBox (agent, MCP client, provider SDKs).
vi.mock('../chat/ChatBox.jsx', () => ({
  default: () => <div data-testid="chatbox-stub">ChatBox</div>,
}));

describe('Hero', () => {
  it('renders the landing content immediately', async () => {
    render(<Hero />);
    expect(screen.getByText('MITRE ATT&CK')).toBeTruthy();
    expect(screen.getByText('Intelligence Assistant')).toBeTruthy();
    // findBy* flushes the lazy resolution inside act() so the suspended
    // chunk does not resolve unwrapped after the synchronous assertions.
    expect(await screen.findByTestId('chatbox-stub')).toBeTruthy();
  });

  it('renders the lazily-loaded chat once its chunk resolves', async () => {
    render(<Hero />);
    expect(await screen.findByTestId('chatbox-stub')).toBeTruthy();
  });
});
