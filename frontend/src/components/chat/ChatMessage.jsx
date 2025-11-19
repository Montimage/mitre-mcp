/**
 * ChatMessage Component
 *
 * Displays individual chat messages with different styling based on message type
 */
import { useState } from 'react';

export default function ChatMessage({ message, type = 'user', timestamp }) {
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

  // Style variants for different message types
  const styles = {
    user: {
      container: 'ml-auto bg-blue-600 text-white',
      maxWidth: 'max-w-[80%]'
    },
    assistant: {
      container: 'mr-auto bg-white border border-gray-200 text-gray-900',
      maxWidth: 'max-w-[85%]'
    },
    system: {
      container: 'mx-auto bg-yellow-50 border border-yellow-200 text-yellow-900',
      maxWidth: 'max-w-[90%]'
    },
    error: {
      container: 'mr-auto bg-red-50 border border-red-300 text-red-700',
      maxWidth: 'max-w-[85%]'
    }
  };

  const currentStyle = styles[type] || styles.user;

  return (
    <div className={`${currentStyle.maxWidth} ${currentStyle.container} rounded-lg p-3 mb-3 shadow-sm`}>
      {/* Message Header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold opacity-75">
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
        <div className="mt-2 pt-2 border-t border-gray-200 flex justify-end">
          <button
            onClick={handleCopy}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
            title="Copy message"
          >
            {copied ? '✓ Copied!' : '📋 Copy'}
          </button>
        </div>
      )}
    </div>
  );
}
