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
