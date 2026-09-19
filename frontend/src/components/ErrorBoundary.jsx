/**
 * ErrorBoundary Component
 *
 * Catches render errors anywhere below it and shows a recovery screen
 * instead of unmounting the whole app.
 */
import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Uncaught render error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-paper bg-grain p-4">
          <div className="w-full max-w-md border border-rule bg-paper-card p-8 shadow-sheet">
            <h1 className="font-display text-2xl font-semibold text-ink">
              Something went wrong
            </h1>
            <div className="dossier-rule my-5" />
            <p className="mb-4 text-sm leading-relaxed text-gray-600">
              The application hit an unexpected error. Reload to try again.
            </p>
            {this.state.error?.message && (
              <p className="mb-5 break-words border border-rule bg-paper p-3 font-mono text-xs text-gray-500">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleReload}
              className="bg-black px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white transition-colors hover:bg-gray-800"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
