import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Enable polyfills for specific modules
      include: ['async_hooks', 'events', 'stream', 'util'],
      // Enable global polyfills
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    })
  ],
  server: {
    proxy: {
      '/mcp': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  resolve: {
    alias: {
      // Polyfill async_hooks for browser
      'async_hooks': 'vite-plugin-node-polyfills/shims/async-hooks',
    }
  }
})
