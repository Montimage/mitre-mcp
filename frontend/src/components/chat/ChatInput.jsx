/**
 * ChatInput Component
 *
 * Multi-line text input for sending messages with keyboard shortcuts
 */
import { useState, useRef, useEffect } from 'react';
import { ASK_CHAT_EVENT } from '../../services/askChat.js';

export default function ChatInput({ onSendMessage, isLoading = false, placeholder = "Ask about MITRE ATT&CK...", modelInfo = null }) {
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);
  const formRef = useRef(null);

  // No autofocus on mount (F-UX-019): focusing on load scrolls mobile users
  // into the chat and pops the keyboard before they choose to interact. The
  // click-to-ask handler below still focuses — on an explicit user action.

  // Click-to-ask: a landing section (e.g. Playbooks) dispatches
  // ASK_CHAT_EVENT with a prompt; fill the input with it and scroll the
  // chat into view so the user can review and send it.
  useEffect(() => {
    const handleAsk = (event) => {
      if (typeof event.detail !== 'string' || !event.detail.trim()) {
        return;
      }
      setInput(event.detail);
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // preventScroll keeps the smooth scroll above as the single scroll.
      textareaRef.current?.focus({ preventScroll: true });
    };
    window.addEventListener(ASK_CHAT_EVENT, handleAsk);
    return () => window.removeEventListener(ASK_CHAT_EVENT, handleAsk);
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

  // Character count — maxLength alone would truncate silently (F-UX-019),
  // so the counter turns amber at the limit and names it.
  const charCount = input.length;
  const maxChars = 1000;
  const atLimit = charCount >= maxChars;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="bg-paper-card p-4">
      <div className="flex flex-col space-y-3">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Chat message"
          disabled={isLoading}
          maxLength={maxChars}
          rows={1}
          className="w-full resize-none border border-rule-strong bg-paper px-4 py-3 text-sm text-ink placeholder:text-gray-500 transition-colors focus:border-ink focus:bg-paper-card focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
          style={{
            minHeight: '52px',
            maxHeight: '200px'
          }}
        />

        {/* Bottom Bar */}
        <div className="flex items-center justify-between">
          {/* Left side: Character Count and Model Info */}
          <div className="flex items-center gap-3">
            <span
              role={atLimit ? 'status' : undefined}
              className={`font-mono text-[11px] ${atLimit ? 'font-medium text-amber-700' : 'text-gray-500'}`}
            >
              {charCount} / {maxChars}
              {atLimit ? ' — character limit reached' : ''}
            </span>

            {/* Model Badge */}
            {modelInfo && (
              <span
                className={`inline-flex items-center gap-1.5 border border-rule-strong border-l-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-gray-600 ${modelInfo.accent}`}
                title={`Provider: ${modelInfo.provider}\nModel: ${modelInfo.model}`}
              >
                {modelInfo.provider}: {modelInfo.model.length > 20 ? modelInfo.model.substring(0, 20) + '...' : modelInfo.model}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {/* Keyboard Hint */}
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 sm:inline">
              Enter to send
            </span>

            {/* Send Button — min-h-11 keeps the tap target at least 44px
                tall on small screens (F-UX-019). */}
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-6 py-2 min-h-11 sm:min-h-0 bg-black font-mono text-[11px] uppercase tracking-[0.14em] text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
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
