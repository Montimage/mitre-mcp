import process from 'node:process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Project sites on GitHub Pages are served under /<repo>/, so the Pages
  // workflow sets VITE_BASE_PATH=/mitre-mcp/. Everywhere else (dev, Netlify)
  // deploys at the domain root.
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    react(),
  ],
  build: {
    rollupOptions: {
      output: {
        // One named chunk per LLM provider SDK (F-PERF-007). The packages —
        // and their provider-exclusive dependencies — are only reachable via
        // the dynamic import() in services/llmProviders.js, so each chunk is
        // fetched solely when that provider is selected. Shared deps
        // (@langchain/core, zod, js-tiktoken) deliberately stay unmapped:
        // pinning them to a provider chunk would force that chunk to
        // download with the chat bundle.
        manualChunks(id) {
          if (id.includes('node_modules/@langchain/ollama') || id.includes('node_modules/ollama/')) {
            return 'provider-ollama';
          }
          if (id.includes('node_modules/@langchain/google-genai') || id.includes('node_modules/@google/generative-ai')) {
            return 'provider-google-genai';
          }
          if (id.includes('node_modules/@langchain/openai') || id.includes('node_modules/openai/')) {
            return 'provider-openai';
          }
        },
      },
    },
  },
  server: {
    proxy: {
      '/mcp': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        // A token-protected backend (MITRE_HTTP_AUTH_TOKEN) is reached through
        // this proxy, so the token stays server-side and never ships to the browser.
        headers: process.env.MITRE_HTTP_AUTH_TOKEN
          ? { Authorization: `Bearer ${process.env.MITRE_HTTP_AUTH_TOKEN}` }
          : {},
      },
      // Optional proxy to an OpenAI-compatible server that does not send CORS
      // headers; point VITE_OPENAI_COMPATIBLE_DEFAULT_BASE_URL at /llm/v1.
      ...(process.env.OPENAI_COMPATIBLE_PROXY_TARGET && {
        '/llm': {
          target: process.env.OPENAI_COMPATIBLE_PROXY_TARGET,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/llm/, ''),
        },
      }),
      '/ollama': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/ollama/, '')
      }
    }
  },
})
