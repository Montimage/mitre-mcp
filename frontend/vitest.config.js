import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Vitest configuration — jsdom so components and the MCP client wrapper see a
// browser-like `window`/`document`; globals stay off so test files import the
// vitest API explicitly (keeps eslint happy with globals.browser only).
export default defineConfig({
  plugins: [
    react(),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
  },
})
