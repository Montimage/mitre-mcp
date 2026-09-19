/**
 * Regression tests for the Ollama probe's URL resolution
 * (frontend/src/services/llmProbes.js).
 *
 * The bug: on a first run ChatBox builds its config as
 * `{ host, port, llmProvider: 'ollama' }` — no `ollamaBaseUrl`, because the
 * defaults for it lived in the settings dialog and in the agent, but not in
 * the probe. `probeOllama` then built the URL
 * `` `${undefined}/api/tags` `` → `"undefined/api/tags"`, a *relative* URL.
 * The dev server and GitHub Pages both answer an unknown path with
 * index.html and status 200, so `response.json()` threw and the hero
 * checklist reported:
 *
 *   Cannot connect to Ollama: Unexpected token '<', "<!doctype "... is not valid JSON
 *
 * — a message about JSON syntax for what is really "Ollama is not running".
 *
 * Two independent guarantees are pinned here: the probe resolves its own
 * defaults, and an HTML body is reported as a wrong-URL problem whatever
 * produced it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { probeOllama, probeLlmProvider } from './llmProbes.js';
import { DEFAULT_OLLAMA_BASE_URL, DEFAULT_OLLAMA_MODEL } from './llmProviders.js';

const jsonResponse = (body) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

// A web server answering a probe URL: status 200, HTML body. `json()`
// rejects exactly as the real Response does.
const htmlResponse = (url = 'http://localhost:5173/undefined/api/tags') => {
  const body = '<!doctype html>\n<html lang="en"><head><title>app</title></head></html>';
  const make = () => ({
    ok: true,
    status: 200,
    url,
    clone: () => make(),
    text: async () => body,
    json: async () => JSON.parse(body),
  });
  return make();
};

const urlOf = (fetchMock) => fetchMock.mock.calls[0][0];

describe('probeOllama default resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('never builds a URL from an undefined base — the first-run config has none', async () => {
    fetch.mockResolvedValue(jsonResponse({ models: [{ name: DEFAULT_OLLAMA_MODEL }] }));

    const result = await probeOllama({});

    const url = urlOf(fetch);
    expect(url).not.toContain('undefined');
    // Either the dev proxy path or the absolute default, never a relative
    // path the app itself would answer.
    expect(['/ollama/api/tags', `${DEFAULT_OLLAMA_BASE_URL}/api/tags`]).toContain(url);
    expect(result.type).toBe('success');
  });

  it('defaults the model name too, so messages never read "undefined"', async () => {
    fetch.mockResolvedValue(jsonResponse({ models: [{ name: 'some-other-model' }] }));

    const result = await probeOllama({});

    expect(result.type).toBe('error');
    expect(result.message).toContain(DEFAULT_OLLAMA_MODEL);
    expect(result.message).not.toContain('undefined');
  });

  it('routes an empty config through to the Ollama probe with defaults applied', async () => {
    fetch.mockResolvedValue(jsonResponse({ models: [{ name: DEFAULT_OLLAMA_MODEL }] }));

    const result = await probeLlmProvider({});

    expect(urlOf(fetch)).not.toContain('undefined');
    expect(result.type).toBe('success');
  });

  it('an explicit base URL still wins over the default', async () => {
    fetch.mockResolvedValue(jsonResponse({ models: [] }));

    await probeOllama({ ollamaBaseUrl: 'http://ollama.internal:11434' });

    expect(urlOf(fetch)).toBe('http://ollama.internal:11434/api/tags');
  });
});

describe('probeOllama non-JSON responses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('reports an HTML page as a wrong-URL problem, not a JSON syntax error', async () => {
    fetch.mockResolvedValue(htmlResponse());

    const result = await probeOllama({ ollamaBaseUrl: 'http://wrong.example' });

    expect(result.type).toBe('error');
    expect(result.message).toMatch(/returned a web page, not the Ollama API/);
    expect(result.message).toMatch(/Check the server URL in Settings/);
    // The old message leaked the JSON parser's complaint to the user.
    expect(result.message).not.toMatch(/Unexpected token/);
    expect(result.message).not.toMatch(/doctype/i);
  });

  it('still names the service when the body is neither JSON nor HTML', async () => {
    const make = () => ({
      ok: true,
      status: 200,
      url: 'http://wrong.example/api/tags',
      clone: () => make(),
      text: async () => 'not json at all',
      json: async () => { throw new SyntaxError('Unexpected token o'); },
    });
    fetch.mockResolvedValue(make());

    const result = await probeOllama({ ollamaBaseUrl: 'http://wrong.example' });

    expect(result.message).toMatch(/did not return valid Ollama JSON/);
    expect(result.message).not.toMatch(/Unexpected token/);
  });

  it('reports a gateway failure as Ollama being unreachable, not a raw 502', async () => {
    // In dev the request goes through Vite's /ollama proxy, which answers
    // 502 when Ollama is not running. The user never configured a gateway,
    // so the status alone is not actionable.
    fetch.mockResolvedValue({ ok: false, status: 502 });

    const result = await probeOllama({});

    expect(result.message).toContain(`${DEFAULT_OLLAMA_BASE_URL} is not responding`);
    expect(result.message).toMatch(/ollama serve/);
  });

  it('keeps the actionable "is Ollama running" hint on every failure', async () => {
    fetch.mockResolvedValue(htmlResponse());

    const result = await probeOllama({});

    expect(result.message).toMatch(/ollama serve/);
  });
});
