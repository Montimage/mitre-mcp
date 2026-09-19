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
      },
      '/ollama': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/ollama/, '')
      }
    }
  },
})
