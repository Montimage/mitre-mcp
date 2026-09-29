/**
 * Build-time LLM defaults shared by the settings dialog and the chat's
 * first-run agent init, so a visitor with no saved config uses the same
 * provider the dialog shows.
 */

// A path default (e.g. /llm/v1, served by the dev-server proxy) resolves
// against the page origin, since the endpoint must be an absolute URL.
const resolveDefaultBaseUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('/') && typeof window !== 'undefined') return `${window.location.origin}${url}`;
  return url;
};

export const DEFAULT_LLM_PROVIDER = import.meta.env.VITE_LLM_DEFAULT_PROVIDER || 'ollama';
export const DEFAULT_OPENAI_COMPATIBLE_BASE_URL = resolveDefaultBaseUrl(import.meta.env.VITE_OPENAI_COMPATIBLE_DEFAULT_BASE_URL);
export const DEFAULT_OPENAI_COMPATIBLE_MODEL = import.meta.env.VITE_OPENAI_COMPATIBLE_DEFAULT_MODEL || '';
