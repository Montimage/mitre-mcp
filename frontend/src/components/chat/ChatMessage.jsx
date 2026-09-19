/**
 * ChatMessage Component
 *
 * Displays individual chat messages with different styling based on message type
 */
import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';

// Header labels for the typed agent failures (F-UX-009) — they name the
// failing subsystem instead of a generic "Assistant" answer.
const ERROR_KIND_LABELS = {
  llm: 'LLM error',
  tool: 'Tool error',
  server: 'Server error'
};

// Memoised (F-PERF-012): the chat re-renders on every state change, so a
// message whose props are unchanged must not re-render with them. Keys on
// the message list are stable ids — see ChatBox.
const ChatMessage = memo(function ChatMessage({ message, type = 'user', timestamp, toolCalls, onApprove, onDeny, onAlwaysAllow, decision, errorKind, retryable, retryQuery, onRetry }) {
  const [copied, setCopied] = useState(false);

  // Format timestamp
  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Copy message to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Handle tool-approval type message
  if (type === 'tool-approval' && toolCalls) {
    // F-UX-010: proportionate approval. A batch where every call is a
    // read-only lookup gets a calm informational card — the warning
    // styling is kept for calls that could change something. The agent
    // attaches title/description/readOnly from tools/list metadata; a
    // call without metadata falls back to its raw name and the warning
    // treatment, exactly as before.
    const allReadOnly = toolCalls.length > 0 && toolCalls.every((tc) => tc.readOnly === true);
    const palette = allReadOnly
      ? { card: 'bg-blue-50 border-blue-400', icon: 'text-blue-600', header: 'text-blue-800', time: 'text-blue-700', inner: 'border-blue-300', divider: 'border-blue-300' }
      : { card: 'bg-yellow-50 border-yellow-400', icon: 'text-yellow-600', header: 'text-yellow-800', time: 'text-yellow-700', inner: 'border-yellow-300', divider: 'border-yellow-300' };

    return (
      <div className={`max-w-[90%] mr-auto border-2 p-4 mb-3 shadow-md ${palette.card}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {allReadOnly ? (
              <svg className={`w-5 h-5 ${palette.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className={`w-5 h-5 ${palette.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <span className={`text-sm font-semibold uppercase tracking-wide ${palette.header}`}>
              {allReadOnly ? 'Read-only lookup' : 'Tool Execution Request'}
            </span>
          </div>
          <span className={`text-xs ${palette.time}`}>{formatTime(timestamp)}</span>
        </div>

        {/* Tool Call Details — plain-language first, raw JSON tucked behind a disclosure */}
        <p className="text-sm text-gray-700 mb-3">
          {allReadOnly
            ? 'The agent wants to look up data — read-only tools cannot change anything:'
            : `The agent wants to execute the following tool${toolCalls.length > 1 ? 's' : ''}:`}
        </p>

        <div className="space-y-2 mb-4">
          {toolCalls.map((toolCall, index) => (
            <div key={toolCall.id ?? index} className={`border ${palette.inner} bg-white p-3 rounded`}>
              <div className="font-medium text-sm text-black">
                {toolCall.title || toolCall.name}
              </div>
              {toolCall.description && (
                <div className="text-xs text-gray-600 mt-0.5">{toolCall.description}</div>
              )}
              <details className="mt-1">
                <summary className="text-xs text-gray-500 cursor-pointer select-none">Arguments</summary>
                <div className="text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded mt-1">
                  {JSON.stringify(toolCall.args || {}, null, 2)}
                </div>
              </details>
            </div>
          ))}
        </div>

        {/* Approval Buttons or Decision */}
        <div className={`pt-3 border-t ${palette.divider}`}>
          {decision ? (
            // Show decision
            <div className={`px-4 py-2 text-sm font-medium text-center ${
              decision === 'approved'
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-red-100 text-red-800 border border-red-300'
            }`}>
              {decision === 'approved' ? '✓ Approved by user' : '✗ Denied by user'}
            </div>
          ) : (
            // Show buttons — "Always allow lookups" is only meaningful on an
            // all-read-only batch: it also opts the session into auto-approving
            // later read-only lookups (F-UX-010).
            <div className="flex gap-3">
              <button
                onClick={onApprove}
                className="flex-1 px-4 py-2 bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                ✓ Approve
              </button>
              {allReadOnly && onAlwaysAllow && (
                <button
                  onClick={onAlwaysAllow}
                  className="flex-1 px-4 py-2 bg-white text-blue-800 text-sm font-medium border border-blue-400 hover:bg-blue-100 transition-colors"
                >
                  Always allow lookups
                </button>
              )}
              <button
                onClick={onDeny}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-900 text-sm font-medium hover:bg-gray-400 transition-colors"
              >
                ✗ Deny
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Style variants for different message types
  const styles = {
    user: {
      container: 'ml-auto bg-black text-white border border-black',
      maxWidth: 'max-w-[80%]'
    },
    assistant: {
      container: 'mr-auto bg-white border border-gray-300 text-gray-900',
      maxWidth: 'max-w-[85%]'
    },
    system: {
      container: 'mx-auto bg-gray-100 border border-gray-400 text-gray-900',
      maxWidth: 'max-w-[90%]'
    },
    error: {
      // Distinct error styling (F-UX-009): a failure reads as an alert,
      // not as a muted assistant bubble.
      container: 'mr-auto bg-red-50 border border-red-400 text-red-900',
      maxWidth: 'max-w-[85%]'
    }
  };

  const currentStyle = styles[type] || styles.user;

  return (
    <div role={type === 'error' ? 'alert' : undefined} className={`${currentStyle.maxWidth} ${currentStyle.container} p-3 mb-3 shadow-md`}>
      {/* Message Header */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-75">
          {type === 'user' ? 'You' : type === 'assistant' ? 'Assistant' : type === 'system' ? 'System' : (ERROR_KIND_LABELS[errorKind] || 'Error')}
        </span>
        <span className="text-xs opacity-60">{formatTime(timestamp)}</span>
      </div>

      {/* Message Content — rendered via react-markdown (safe: never injects raw HTML);
          remark-breaks preserves the old one-line-per-block visual structure */}
      <div className="text-sm leading-relaxed whitespace-pre-wrap">
        <ReactMarkdown
          remarkPlugins={[remarkBreaks]}
          components={{
            code: ({ children }) => (
              <code className="bg-gray-200 px-1 rounded text-sm">{children}</code>
            ),
          }}
        >
          {message || ''}
        </ReactMarkdown>
      </div>

      {/* Message Actions — assistant answers get Copy; retryable failures
          get Retry and never a Copy button (F-UX-009). */}
      {type === 'assistant' && (
        <div className="mt-2 pt-2 border-t border-gray-300 flex justify-end">
          <button
            onClick={handleCopy}
            className="text-xs text-gray-600 hover:text-black transition-colors font-medium"
            title="Copy message"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
      {type === 'error' && retryable !== false && retryQuery && onRetry && (
        <div className="mt-2 pt-2 border-t border-red-300 flex justify-end">
          <button
            onClick={() => onRetry(retryQuery)}
            className="text-xs text-red-800 hover:text-black transition-colors font-medium"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
});

export default ChatMessage;
