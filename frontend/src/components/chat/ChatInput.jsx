/**
 * ChatInput Component
 *
 * Multi-line text input for sending messages with keyboard shortcuts
 */
import { useState, useRef, useEffect } from 'react';

export default function ChatInput({ onSendMessage, isLoading = false, placeholder = "Ask about MITRE ATT&CK..." }) {
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);

  // Auto-focus on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();

    const trimmedInput = input.trim();
    if (trimmedInput && !isLoading) {
      onSendMessage(trimmedInput);
      setInput('');

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e) => {
    // Enter to send (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }

    // Shift+Enter for new line (default behavior, no need to handle)
  };

  // Character count
  const charCount = input.length;
  const maxChars = 1000;

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4">
      <div className="flex flex-col space-y-3">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          maxLength={maxChars}
          rows={1}
          className="w-full px-4 py-3 border-2 border-gray-300 resize-none focus:outline-none focus:border-black disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
          style={{
            minHeight: '52px',
            maxHeight: '200px'
          }}
        />

        {/* Bottom Bar */}
        <div className="flex items-center justify-between">
          {/* Character Count */}
          <span className="text-xs text-gray-500">
            {charCount} / {maxChars}
          </span>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {/* Keyboard Hint */}
            <span className="text-xs text-gray-500 hidden sm:inline">
              Enter to send
            </span>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-6 py-2 bg-black text-white font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none"
            >
              {isLoading ? (
                <span className="flex items-center space-x-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Sending...</span>
                </span>
              ) : (
                'Send'
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
