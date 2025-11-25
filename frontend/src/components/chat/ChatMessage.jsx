/**
 * ChatMessage Component
 *
 * Displays individual chat messages with different styling based on message type
 */
import { useState } from 'react';

export default function ChatMessage({ message, type = 'user', timestamp, toolCalls, onApprove, onDeny, decision }) {
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

  // Format message text (convert markdown-like syntax to HTML)
  const formatMessage = (text) => {
    if (!text) return '';

    // Split by line breaks
    const lines = text.split('\n');
    return lines.map((line, i) => {
      // Bold text: **text**
      line = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

      // Italic text: *text*
      line = line.replace(/\*([^*]+)\*/g, '<em>$1</em>');

      // Code: `code`
      line = line.replace(/`([^`]+)`/g, '<code class="bg-gray-200 px-1 rounded text-sm">$1</code>');

      return line;
    });
  };

  // Handle tool-approval type message
  if (type === 'tool-approval' && toolCalls) {
    return (
      <div className="max-w-[90%] mr-auto bg-yellow-50 border-2 border-yellow-400 p-4 mb-3 shadow-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-semibold uppercase tracking-wide text-yellow-800">
              Tool Execution Request
            </span>
          </div>
          <span className="text-xs text-yellow-700">{formatTime(timestamp)}</span>
        </div>

        {/* Tool Call Details */}
        <p className="text-sm text-gray-700 mb-3">
          The agent wants to execute the following tool{toolCalls.length > 1 ? 's' : ''}:
        </p>

        <div className="space-y-2 mb-4">
          {toolCalls.map((toolCall, index) => (
            <div key={index} className="border border-yellow-300 bg-white p-3 rounded">
              <div className="font-medium text-sm text-black mb-1">
                📋 {toolCall.name}
              </div>
              <div className="text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded mt-1">
                {JSON.stringify(toolCall.args || {}, null, 2)}
              </div>
            </div>
          ))}
        </div>

        {/* Approval Buttons or Decision */}
        <div className="pt-3 border-t border-yellow-300">
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
            // Show buttons
            <div className="flex gap-3">
              <button
                onClick={onApprove}
                className="flex-1 px-4 py-2 bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                ✓ Approve
              </button>
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
      container: 'mr-auto bg-gray-200 border border-gray-400 text-gray-900',
      maxWidth: 'max-w-[85%]'
    }
  };

  const currentStyle = styles[type] || styles.user;

  return (
    <div className={`${currentStyle.maxWidth} ${currentStyle.container} p-3 mb-3 shadow-md`}>
      {/* Message Header */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-75">
          {type === 'user' ? 'You' : type === 'assistant' ? 'Assistant' : type === 'system' ? 'System' : 'Error'}
        </span>
        <span className="text-xs opacity-60">{formatTime(timestamp)}</span>
      </div>

      {/* Message Content */}
      <div className="text-sm leading-relaxed whitespace-pre-wrap">
        {formatMessage(message).map((line, i) => (
          <div
            key={i}
            dangerouslySetInnerHTML={{ __html: line }}
          />
        ))}
      </div>

      {/* Message Actions */}
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
    </div>
  );
}
