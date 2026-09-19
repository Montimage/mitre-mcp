/**
 * ChatMessage Component
 *
 * Displays individual chat messages with different styling based on message type
 */
import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

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
      ? { card: 'bg-paper-card border-rule-strong', icon: 'text-blue-600', header: 'text-gray-500', time: 'text-gray-500', inner: 'border-rule', divider: 'border-rule' }
      : { card: 'bg-paper-sunk border-rule-strong border-l-2 border-l-brass', icon: 'text-amber-700', header: 'text-brass-700', time: 'text-gray-500', inner: 'border-rule-strong', divider: 'border-rule-strong' };

    return (
      <div className={`mr-auto mb-3 max-w-[90%] border p-4 shadow-sheet ${palette.card}`}>
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
            <span className={`font-mono text-[11px] uppercase tracking-[0.14em] ${palette.header}`}>
              {allReadOnly ? 'Read-only lookup' : 'Tool Execution Request'}
            </span>
          </div>
          <span className={`font-mono text-[10px] ${palette.time}`}>{formatTime(timestamp)}</span>
        </div>

        {/* Tool Call Details — plain-language first, raw JSON tucked behind a disclosure */}
        <p className="text-sm text-gray-700 mb-3">
          {allReadOnly
            ? 'The agent wants to look up data — read-only tools cannot change anything:'
            : `The agent wants to execute the following tool${toolCalls.length > 1 ? 's' : ''}:`}
        </p>

        <div className="space-y-2 mb-4">
          {toolCalls.map((toolCall, index) => (
            <div key={toolCall.id ?? index} className={`border ${palette.inner} bg-paper-card p-3`}>
              <div className="text-sm font-medium text-ink">
                {toolCall.title || toolCall.name}
              </div>
              {toolCall.description && (
                <div className="text-xs text-gray-600 mt-0.5">{toolCall.description}</div>
              )}
              <details className="mt-1">
                <summary className="text-xs text-gray-500 cursor-pointer select-none">Arguments</summary>
                <div className="mt-1 border border-rule bg-paper p-2 font-mono text-xs text-gray-600">
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
            <div className={`px-4 py-2 text-center font-mono text-[11px] uppercase tracking-[0.14em] ${
              decision === 'approved'
                ? 'border border-green-300 bg-green-50 text-green-800'
                : 'border border-red-300 bg-red-50 text-red-800'
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
                className="flex-1 bg-black px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white transition-colors hover:bg-gray-800"
              >
                ✓ Approve
              </button>
              {allReadOnly && onAlwaysAllow && (
                <button
                  onClick={onAlwaysAllow}
                  className="flex-1 border border-blue-600 bg-paper-card px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-blue-700 transition-colors hover:bg-blue-50"
                >
                  Always allow lookups
                </button>
              )}
              <button
                onClick={onDeny}
                className="flex-1 border border-rule-strong bg-paper-card px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-gray-600 transition-colors hover:border-ink hover:text-ink"
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
      container: 'mr-auto bg-paper-card border border-rule text-gray-800',
      maxWidth: 'max-w-[85%]'
    },
    system: {
      container: 'mx-auto bg-paper-sunk border border-rule text-gray-600',
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
    <div role={type === 'error' ? 'alert' : undefined} className={`${currentStyle.maxWidth} ${currentStyle.container} mb-3 p-3.5 shadow-sheet`}>
      {/* Message Header — the error bubble leads with a warning icon so the
          failure reads as an alert at a glance, not by colour alone (F-UX-008). */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] opacity-70">
          {type === 'error' && (
            <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          {type === 'user' ? 'You' : type === 'assistant' ? 'Assistant' : type === 'system' ? 'System' : (ERROR_KIND_LABELS[errorKind] || 'Error')}
        </span>
        <span className="font-mono text-[10px] opacity-50">{formatTime(timestamp)}</span>
      </div>

      {/* Message Content — rendered via react-markdown (safe: never injects raw HTML);
          remark-breaks preserves the one-line-per-block visual structure, and
          remark-gfm adds tables, which both the scripted demo answers and real
          model output use constantly — without it they render as raw pipes.
          Neither plugin enables raw HTML, so the sanitisation guarantee holds. */}
      <div className="text-sm leading-relaxed">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          components={{
            code: ({ children }) => (
              <code className="border border-rule bg-paper-sunk px-1 font-mono text-[0.85em]">{children}</code>
            ),
            // Tables get the page's hairline treatment rather than the
            // browser default, which has no borders at all.
            table: ({ children }) => (
              <div className="my-3 overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">{children}</table>
              </div>
            ),
            th: ({ children }) => (
              <th className="border-b border-rule-strong px-2 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em] opacity-70">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border-b border-rule px-2 py-1.5 align-top">{children}</td>
            ),
            ul: ({ children }) => (
              <ul className="my-2 list-disc space-y-1 pl-5 marker:opacity-50">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="my-2 list-decimal space-y-1 pl-5 marker:opacity-50">{children}</ol>
            ),
            li: ({ children }) => <li className="pl-0.5">{children}</li>,
            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                {children}
              </a>
            ),
          }}
        >
          {message || ''}
        </ReactMarkdown>
      </div>

      {/* Message Actions — assistant answers get Copy; retryable failures
          get Retry and never a Copy button (F-UX-009). */}
      {type === 'assistant' && (
        <div className="mt-3 flex justify-end border-t border-rule pt-2">
          <button
            onClick={handleCopy}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-500 transition-colors hover:text-ink"
            title="Copy message"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
      {type === 'error' && retryable !== false && retryQuery && onRetry && (
        <div className="mt-3 flex justify-end border-t border-red-300 pt-2">
          <button
            onClick={() => onRetry(retryQuery)}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-red-800 transition-colors hover:text-ink"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
});

export default ChatMessage;
