/**
 * Click-to-ask bridge between landing sections and the chat input.
 *
 * The landing page mounts the chat and the Playbooks section as siblings in
 * one scrollable page, so a prompt has no prop path between them that does
 * not cross components with no interest in it. A DOM event is the seam:
 * askChat(prompt) dispatches ASK_CHAT_EVENT on window and the chat input
 * listens for it, fills itself with the prompt, and scrolls into view.
 */

export const ASK_CHAT_EVENT = 'mitre-mcp:ask-chat';

/**
 * Ask the chat to take a prompt: the chat input fills with `prompt` and
 * scrolls into view so the user can review and send it.
 *
 * @param {string} prompt - The prompt text to place in the chat input
 */
export const askChat = (prompt) => {
  window.dispatchEvent(new CustomEvent(ASK_CHAT_EVENT, { detail: prompt }));
};
