/**
 * Tests for frontend/src/services/mcpConfig.js — MCP server config helpers.
 *
 * F-BUG-020 (#74): the server URL is assembled with `new URL` so invalid
 * host/port components surface as null instead of a silently malformed
 * endpoint like `http://host:null/mcp`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildMcpServerUrl,
  getMcpServerAddress,
  getMcpServerConfig,
  isLoopbackHost,
  pageCannotReachLoopback,
  MCP_CONFIG_STORAGE_KEY,
} from './mcpConfig.js';

describe('mcpConfig', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('buildMcpServerUrl builds the endpoint with new URL', () => {
    const url = buildMcpServerUrl('example.com', 9000);
    expect(url).toBe('http://example.com:9000/mcp');
  });

  it('buildMcpServerUrl passes a full-URL host through verbatim', () => {
    expect(buildMcpServerUrl('https://mcp.example.com/mcp', 9000)).toBe('https://mcp.example.com/mcp');
  });

  it('buildMcpServerUrl returns null for an empty host instead of a malformed URL', () => {
    expect(buildMcpServerUrl('', 8000)).toBeNull();
  });

  it('isLoopbackHost recognises hostnames and loopback URLs', () => {
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('http://localhost:20128/v1')).toBe(true);
    expect(isLoopbackHost('mcp.example.com')).toBe(false);
  });

  it('buildMcpServerUrl pins loopback to http when the page is https', () => {
    const previous = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        origin: 'https://montimage.github.io',
        hostname: 'montimage.github.io',
        protocol: 'https:',
      },
    });
    try {
      expect(buildMcpServerUrl('localhost', 8000)).toBe('http://localhost:8000/mcp');
      expect(buildMcpServerUrl('mcp.example.com', 9000)).toBe('https://mcp.example.com:9000/mcp');
      expect(pageCannotReachLoopback()).toBe(true);
    } finally {
      if (previous) Object.defineProperty(window, 'location', previous);
    }
  });

  it('getMcpServerConfig falls back to defaults and merges a saved config', () => {
    expect(getMcpServerConfig()).toEqual({ host: 'localhost', port: 8000 });

    localStorage.setItem(MCP_CONFIG_STORAGE_KEY, JSON.stringify({ host: 'mcp.local', port: 9001 }));
    expect(getMcpServerConfig()).toEqual({ host: 'mcp.local', port: 9001 });
  });

  it('getMcpServerAddress renders host:port or a verbatim full URL', () => {
    expect(getMcpServerAddress()).toBe('localhost:8000');

    localStorage.setItem(MCP_CONFIG_STORAGE_KEY, JSON.stringify({ host: 'https://mcp.example.com/mcp', port: 8000 }));
    expect(getMcpServerAddress()).toBe('https://mcp.example.com/mcp');
  });
});
