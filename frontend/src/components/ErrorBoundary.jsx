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
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
          <div className="border-2 border-gray-300 bg-white p-6 max-w-md w-full">
            <h1 className="text-lg font-bold text-black mb-2 uppercase tracking-wide">
              Something went wrong
            </h1>
            <p className="text-sm text-gray-700 mb-4">
              The application hit an unexpected error. Reload to try again.
            </p>
            {this.state.error?.message && (
              <p className="text-xs text-gray-500 font-mono mb-4 break-words">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleReload}
              className="px-4 py-2 bg-black text-white text-sm hover:bg-gray-800"
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
