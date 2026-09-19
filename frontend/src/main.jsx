import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted variable fonts (no third-party font CDN at runtime): Newsreader
// for display, Libre Franklin for body copy, JetBrains Mono for commands and
// micro-labels. Imported before index.css so the @font-face rules land ahead
// of the theme that references them.
import '@fontsource-variable/newsreader'
import '@fontsource-variable/newsreader/wght-italic.css'
import '@fontsource-variable/libre-franklin'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
