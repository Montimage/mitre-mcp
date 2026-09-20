/**
 * ChatBox Component
 *
 * Main chat interface integrating all chat components
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import ServerConfig from './ServerConfig';
import LangGraphAgent, { LLM_PROVIDERS } from '../../services/langGraphAgent';
import { isAgentErrorResult } from '../../services/agentMessages';
import { getApiKey } from '../../services/storage';
import { probeLlmProvider } from '../../services/llmProbes';
import { createPortal } from 'react-dom';
import { releaseMcpClient } from '../../services/mcpClientCache';
import { DEFAULT_MCP_HOST, DEFAULT_MCP_PORT, MCP_CONFIG_STORAGE_KEY } from '../../services/mcpConfig';
import { SIMULATION_TOOL_PREFIX, SIMULATION_WELCOME, getSimulatedAnswer } from '../../services/simulation';

// Helper to get display name for LLM provider and model.
// `accent` is a complete literal class so Tailwind's scanner can see it —
// it tints only the model tag's left edge; the tag itself stays unfilled.
const getModelDisplayInfo = (config) => {
  const provider = config.llmProvider || 'ollama';

  switch (provider) {
    case LLM_PROVIDERS.GEMINI:
      return {
        provider: 'Gemini',
        model: config.geminiModel || 'gemini-2.5-flash',
        accent: 'border-l-blue-600'
      };
    case LLM_PROVIDERS.OPENROUTER:
      return {
        provider: 'OpenRouter',
        model: config.openrouterModel || 'anthropic/claude-3.5-sonnet',
        accent: 'border-l-purple-600'
      };
    case LLM_PROVIDERS.OPENAI_COMPATIBLE:
      return {
        provider: 'OpenAI-compatible',
        model: config.openaiCompatibleModel || 'custom endpoint',
        accent: 'border-l-teal-600'
      };
    case LLM_PROVIDERS.OLLAMA:
    default:
      return {
        provider: 'Ollama',
        model: config.ollamaModel || 'llama3.1:8b',
        accent: 'border-l-green-600'
      };
  }
};

// Text for the header status pills (F-UX-016): the dot's colour is only a
// hint — the state must also read as words, both on screen and to assistive
// tech (each pill is a role="status" live region). 'unknown' is the
// pre-probe state: the LLM probe always settles so it reads "Checking…",
// while MCP can stay unchecked on a failed agent build, so it reads
// "Not checked".
const MCP_STATUS_TEXT = {
  connected: 'Connected',
  disconnected: 'Offline',
  unknown: 'Not checked'
};
const LLM_STATUS_TEXT = {
  ready: 'Ready',
  'not-configured': 'Not set up',
  unknown: 'Checking…'
};

// Stable message ids (F-PERF-012): the list is keyed by id, not index, so a
// message keeps its identity as the array grows and the memoised
// ChatMessage components are never remounted by reordering.
let messageIdCounter = 0;
const makeMessage = (msg) => ({ id: `msg-${++messageIdCounter}`, ...msg });

export default function ChatBox({ onSetupStatusChange }) {
  // `expanded` fills the viewport with a fixed overlay (F-UX-020); the
  // default keeps the in-page 500px / 70dvh message-pane cap (F-UX-019).
  // Expanding in place keeps ChatBox mounted, so the transcript survives.
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [serverConfig, setServerConfig] = useState({ host: DEFAULT_MCP_HOST, port: DEFAULT_MCP_PORT, llmProvider: 'ollama' });
  const [agent, setAgent] = useState(null);
  const [pendingToolCalls, setPendingToolCalls] = useState(null);
  const [toolApprovalResolver, setToolApprovalResolver] = useState(null);
  const [mcpServerStatus, setMcpServerStatus] = useState('unknown'); // 'connected', 'disconnected', 'unknown'
  const [llmStatus, setLlmStatus] = useState('unknown'); // 'ready', 'not-configured', 'unknown'
  // Why the LLM is not ready (probe or construction message) — surfaced in the
  // "not set up yet" banner and the send-path error (F-UX-002, F-UX-004).
  const [llmSetupError, setLlmSetupError] = useState(null);
  // Simulation mode: the chat replays curated sample answers because the
  // MCP probe reported the server unreachable, so the real agent has no
  // ATT&CK data to query even with a working LLM.
  //
  // Keyed to 'disconnected' specifically, never 'unknown': 'unknown' is the
  // pre-probe state and also what a failed agent construction leaves behind
  // (an invalid LLM config, such as a missing API key). Simulating there
  // would hide a configuration error behind a demo (F-UX-004). The default
  // Ollama provider constructs without a key, so a visitor with nothing
  // installed still reaches 'disconnected' and gets the demo.
  const simulationMode = mcpServerStatus === 'disconnected';

  // The simulated replay pauses on timers between its messages; without
  // this it could setMessages after unmount — the same class of bug the
  // init effect's `cancelled` flag exists to prevent (F-BUG-023). Set in
  // the effect body, not just the cleanup, so a StrictMode remount
  // restores it.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // While expanded: Esc collapses and the page behind the overlay stops
  // scrolling (F-UX-020). Collapsing returns focus to the Expand control.
  const expandButtonRef = useRef(null);
  const wasExpandedRef = useRef(false);
  useEffect(() => {
    if (wasExpandedRef.current && !expanded) {
      expandButtonRef.current?.focus();
    }
    wasExpandedRef.current = expanded;
    if (!expanded) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [expanded]);

  const settingsButtonRef = useRef(null);
  const settingsDialogRef = useRef(null);
  // Session-scoped "always allow lookups" opt-in (F-UX-010): once the user
  // chooses it on a read-only approval card, later batches where every call
  // is read-only are auto-approved without a card. A ref, not state — it is
  // read inside the approval callback, never rendered, and must not cause
  // re-renders. Deliberately not persisted: the opt-in ends with the page.
  const alwaysAllowLookupsRef = useRef(false);

  // Closing the dialog returns focus to the Settings trigger (F-UX-014).
  const closeSettings = useCallback(() => {
    setShowConfig(false);
    setSettingsDirty(false);
    settingsButtonRef.current?.focus();
  }, []);

  // Closing with unsaved edits warns first (F-UX-007).
  const requestCloseSettings = useCallback(() => {
    if (settingsDirty && !window.confirm('You have unsaved changes in Settings. Discard them?')) {
      return;
    }
    closeSettings();
  }, [settingsDirty, closeSettings]);

  // Move focus into the dialog when it opens.
  useEffect(() => {
    if (showConfig) {
      settingsDialogRef.current?.focus();
    }
  }, [showConfig]);

  // Esc closes the dialog — through the same unsaved-changes guard. Tab is
  // trapped inside: aria-modal promises the page behind is inert, so focus
  // must cycle within the dialog instead of reaching background controls.
  useEffect(() => {
    if (!showConfig) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        requestCloseSettings();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = settingsDialogRef.current;
      if (!dialog) return;
      const focusables = dialog.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const inside = active === dialog || dialog.contains(active);
      if (event.shiftKey) {
        // The dialog container itself holds focus on open — Shift+Tab from it
        // must wrap, not step backwards into the page behind the modal.
        if (active === first || active === dialog || !inside) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || active === dialog || !inside) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showConfig, requestCloseSettings]);

  // Initialize agent
  useEffect(() => {
    // StrictMode double-mounts this effect in dev: the stale run must bail at
    // every await boundary so the last *live* finisher wins and nothing sets
    // state after unmount.
    let cancelled = false;

    const initAgent = async () => {
      // Load config from localStorage
      const savedConfig = localStorage.getItem(MCP_CONFIG_STORAGE_KEY);
      let config = { host: DEFAULT_MCP_HOST, port: DEFAULT_MCP_PORT, llmProvider: 'ollama' };

      if (savedConfig) {
        try {
          config = { ...config, ...JSON.parse(savedConfig) };
        } catch (error) {
          console.error('Failed to load config:', error);
        }
      }

      // Load API keys from IndexedDB
      const [geminiKey, openrouterKey, openaiCompatibleKey] = await Promise.all([
        getApiKey('geminiApiKey'),
        getApiKey('openrouterApiKey'),
        getApiKey('openaiCompatibleApiKey')
      ]);

      if (cancelled) return;

      config.geminiApiKey = geminiKey;
      config.openrouterApiKey = openrouterKey;
      config.openaiCompatibleApiKey = openaiCompatibleKey;

      setServerConfig(config);

      // Create agent instance with full config
      let llmReady = false;
      let mcpUnreachable = false;
      try {
        const newAgent = new LangGraphAgent(config.host, config.port, config);
        setAgent(newAgent);

        // Probe the configured provider before claiming the LLM is ready —
        // the constructor only proves the config validates; it says nothing
        // about reachability or the model being installed (F-UX-002).
        try {
          const llmProbe = await probeLlmProvider(config);
          if (cancelled) return;
          if (llmProbe.type === 'success') {
            llmReady = true;
            setLlmStatus('ready');
            setLlmSetupError(null);
          } else {
            setLlmStatus('not-configured');
            setLlmSetupError(llmProbe.message);
          }
        } catch (probeError) {
          // Probes resolve result objects and never throw — a rejection here
          // is a bug, but still means "not ready", not a crashed init.
          if (cancelled) return;
          setLlmStatus('not-configured');
          setLlmSetupError(probeError.message);
        }

        // Test MCP server connection
        try {
          const connected = await newAgent.testConnection();
          if (cancelled) return;
          if (connected) {
            setMcpServerStatus('connected');
          } else {
            console.warn('MCP server not reachable');
            mcpUnreachable = true;
            setMcpServerStatus('disconnected');
          }
        } catch (error) {
          if (cancelled) return;
          console.warn('MCP server not reachable:', error);
          mcpUnreachable = true;
          setMcpServerStatus('disconnected');
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to initialize agent:', error);
        setLlmStatus('not-configured');
        setLlmSetupError(error.message);
        setMcpServerStatus('unknown');
      }

      if (cancelled) return;

      const opening = [];
      // The welcome still depends only on the provider having answered.
      if (llmReady) {
        opening.push(makeMessage({
          type: 'system',
          message: 'Welcome to the MITRE ATT&CK Intelligence Assistant! Ask me anything about tactics, techniques, groups, or mitigations.',
          timestamp: new Date().toISOString()
        }));
      }
      // No reachable server: say so and open the scripted demo rather than
      // leave the visitor an inert box. Needs no LLM, so it is independent
      // of llmReady above.
      if (mcpUnreachable) {
        opening.push(makeMessage({
          type: 'system',
          message: SIMULATION_WELCOME,
          timestamp: new Date().toISOString()
        }));
      }
      if (opening.length > 0) {
        setMessages(opening);
      }
    };

    initAgent();

    // Teardown closes the shared MCP client (F-PERF-009). Under StrictMode
    // this first cleanup runs while the async init is still parked on the
    // IndexedDB read, so the cache is still empty and nothing is lost — the
    // live mount's agent then populates it.
    return () => { cancelled = true; releaseMcpClient(); };
  }, []);

  // Report setup status upward so the landing "first-run checklist" reflects
  // the same LLM probe / MCP connection results as the status dots
  // (F-UX-003). Optional prop — Hero is the only consumer; the checklist
  // reads "checking" until the lazy chunk mounts and this first fires.
  useEffect(() => {
    onSetupStatusChange?.({
      llm: llmStatus,
      llmError: llmSetupError,
      mcp: mcpServerStatus,
    });
  }, [llmStatus, llmSetupError, mcpServerStatus, onSetupStatusChange]);

  // Scroll to bottom of messages container (not the page)
  const messagesContainerRef = useRef(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle config change.
  //
  // The agent is rebuilt BEFORE the live config is swapped: when the build
  // fails, `serverConfig` (and the provider badge it drives) keeps describing
  // the still-working agent, and the caller keeps the settings dialog open
  // with the error shown inside it (F-UX-005). Returns `{ ok, error? }` so
  // the dialog can make that stay-open/show-error decision.
  const handleConfigChange = async (newConfig) => {
    // Captured before the probes run below: crossing the simulation
    // boundary has to be announced, or demo answers and live answers sit in
    // one transcript with nothing separating them.
    const wasSimulating = mcpServerStatus === 'disconnected';
    let newAgent;
    try {
      newAgent = new LangGraphAgent(newConfig.host, newConfig.port, newConfig);
    } catch (error) {
      console.error('Failed to create agent:', error);
      return { ok: false, error: error.message };
    }

    // Build succeeded — now it is safe to swap the live config and agent.
    setAgent(newAgent);
    setServerConfig(newConfig);

    // Probe the new provider so the LLM dot tells the truth here too
    // (F-UX-002). A failed probe marks the dot but does not fail the save.
    try {
      const llmProbe = await probeLlmProvider(newConfig);
      if (llmProbe.type === 'success') {
        setLlmStatus('ready');
        setLlmSetupError(null);
      } else {
        setLlmStatus('not-configured');
        setLlmSetupError(llmProbe.message);
      }
    } catch (probeError) {
      setLlmStatus('not-configured');
      setLlmSetupError(probeError.message);
    }

    // Test MCP server connection
    let nowSimulating = false;
    try {
      const connected = await newAgent.testConnection();
      if (connected) {
        setMcpServerStatus('connected');
      } else {
        console.warn('MCP server not reachable');
        nowSimulating = true;
        setMcpServerStatus('disconnected');
      }
    } catch (error) {
      console.warn('MCP server not reachable:', error);
      nowSimulating = true;
      setMcpServerStatus('disconnected');
    }

    // Get model display info
    const modelInfo = getModelDisplayInfo(newConfig);

    const updates = [makeMessage({
      type: 'system',
      message: `Configuration updated:\n- MCP Server: ${newConfig.host}:${newConfig.port}\n- LLM Provider: ${modelInfo.provider}\n- Model: ${modelInfo.model}`,
      timestamp: new Date().toISOString()
    })];

    // Name the switch in both directions, so nothing above the line is
    // mistaken for something below it.
    if (nowSimulating && !wasSimulating) {
      updates.push(makeMessage({
        type: 'system',
        message: SIMULATION_WELCOME,
        timestamp: new Date().toISOString()
      }));
    } else if (wasSimulating && !nowSimulating) {
      updates.push(makeMessage({
        type: 'system',
        message:
          `Connected to ${newConfig.host}:${newConfig.port} — answers from here on query live ATT&CK data. ` +
          'Everything above this line was a simulated sample.',
        timestamp: new Date().toISOString()
      }));
    }

    setMessages(prev => [...prev, ...updates]);

    return { ok: true };
  };

  // Handle tool approval — useCallback keeps the identity stable while no
  // approval is pending, so memoised ChatMessage props stay referentially
  // equal across unrelated re-renders (F-PERF-012).
  const handleToolApproval = useCallback((approved) => {
    if (toolApprovalResolver) {
      // Update the tool-approval message to show the decision
      setMessages(prev => prev.map(msg => {
        if (msg.type === 'tool-approval' && msg.toolCalls === pendingToolCalls) {
          return { ...msg, decision: approved ? 'approved' : 'denied' };
        }
        return msg;
      }));

      toolApprovalResolver.resolve(approved);
      setPendingToolCalls(null);
      setToolApprovalResolver(null);
    }
  }, [toolApprovalResolver, pendingToolCalls]);

  const handleApprove = useCallback(() => handleToolApproval(true), [handleToolApproval]);
  const handleDeny = useCallback(() => handleToolApproval(false), [handleToolApproval]);
  // "Always allow lookups" approves the pending card AND opts the session
  // into auto-approving later all-read-only batches (F-UX-010).
  const handleAlwaysAllow = useCallback(() => {
    alwaysAllowLookupsRef.current = true;
    handleToolApproval(true);
  }, [handleToolApproval]);

  // Run one query through the agent and append the outcome.
  //
  // A typed failure result renders as an error bubble carrying the failed
  // query so the Retry action can re-run it in place (F-UX-009); a
  // successful string still renders as an assistant answer.
  const sendQuery = useCallback(async (text) => {
    setIsLoading(true);

    // Callback for tool approval
    const requestToolApproval = async (toolCalls) => {
      // Session opt-in (F-UX-010): once the user chose "always allow
      // lookups", a batch where every call is read-only is approved
      // without posting a card — the approval is proportionate to a
      // read-only lookup. Mixed or non-read-only batches still prompt.
      if (
        alwaysAllowLookupsRef.current &&
        toolCalls.length > 0 &&
        toolCalls.every((tc) => tc.readOnly === true)
      ) {
        return true;
      }

      // Add approval request message to chat
      setMessages(prev => [...prev, makeMessage({
        type: 'tool-approval',
        toolCalls: toolCalls,
        timestamp: new Date().toISOString()
      })]);

      return new Promise((resolve) => {
        setPendingToolCalls(toolCalls);
        setToolApprovalResolver({ resolve });
      });
    };

    try {
      // Process query with agent
      const response = await agent.processQuery(text, requestToolApproval);

      if (isAgentErrorResult(response)) {
        // Typed failure — an error bubble with Retry, not an assistant
        // answer with Copy (F-UX-009).
        setMessages(prev => [...prev, makeMessage({
          type: 'error',
          message: response.message,
          errorKind: response.kind,
          retryable: response.retryable !== false,
          retryQuery: text,
          timestamp: new Date().toISOString()
        })]);
      } else {
        // Add assistant response
        setMessages(prev => [...prev, makeMessage({
          type: 'assistant',
          message: response,
          timestamp: new Date().toISOString()
        })]);
      }
    } catch (error) {
      console.error('Error processing message:', error);

      // A rejection means the failure escaped the agent's own typed
      // classification — render a generic retryable error bubble rather
      // than guess at a subsystem label (F-UX-009).
      setMessages(prev => [...prev, makeMessage({
        type: 'error',
        message: `Error: ${error.message}`,
        retryable: true,
        retryQuery: text,
        timestamp: new Date().toISOString()
      })]);
    } finally {
      setIsLoading(false);
    }
  }, [agent]);

  // Replay one scripted answer. Deliberately separate from sendQuery: it
  // never touches the agent, posts its tool trace as a plain system message
  // rather than a tool-approval card (no resolver exists to settle one), and
  // never produces an error bubble — Retry would call a null agent.
  const sendSimulatedQuery = useCallback(async (text) => {
    setIsLoading(true);
    const { tools, answer } = getSimulatedAnswer(text);

    // A short pause so the trace and the answer arrive in sequence rather
    // than appearing fully formed the instant the user hits send.
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (!mountedRef.current) return;

    if (tools.length > 0) {
      setMessages(prev => [...prev, makeMessage({
        type: 'system',
        message: tools.map((call) => `${SIMULATION_TOOL_PREFIX} · ${call}`).join('\n'),
        timestamp: new Date().toISOString()
      })]);
      await new Promise((resolve) => setTimeout(resolve, 350));
      if (!mountedRef.current) return;
    }

    setMessages(prev => [...prev, makeMessage({
      type: 'assistant',
      message: answer,
      timestamp: new Date().toISOString()
    })]);
    setIsLoading(false);
  }, []);

  // sendQuery changes identity with the agent — a ref lets handleRetry
  // keep a stable identity for the memoised ChatMessage list (F-PERF-012).
  const sendQueryRef = useRef(sendQuery);
  useEffect(() => {
    sendQueryRef.current = sendQuery;
  }, [sendQuery]);

  // Retry a failed query in place (F-UX-009): the failed error bubble is
  // dropped and the same query re-runs — the original user message stays,
  // so the transcript never duplicates the user turn.
  const handleRetry = useCallback((query) => {
    setMessages(prev => prev.filter((m) => !(m.type === 'error' && m.retryQuery === query)));
    void sendQueryRef.current?.(query);
  }, []);

  // Handle sending message
  const handleSendMessage = async (text) => {
    if (simulationMode) {
      setMessages(prev => [...prev, makeMessage({
        type: 'user',
        message: text,
        timestamp: new Date().toISOString()
      })]);
      await sendSimulatedQuery(text);
      return;
    }

    if (!agent) {
      // Name the real cause (missing key, unreachable provider) instead of
      // telling the user to refresh — a refresh fails the same way, so the
      // actionable path is opening Settings (F-UX-004).
      setMessages(prev => [...prev, makeMessage({
        type: 'error',
        message: `The agent is not set up${llmSetupError ? `: ${llmSetupError}` : '.'} Open Settings to configure the LLM provider.`,
        action: 'open-settings',
        timestamp: new Date().toISOString()
      })]);
      return;
    }

    // Add user message
    setMessages(prev => [...prev, makeMessage({
      type: 'user',
      message: text,
      timestamp: new Date().toISOString()
    })]);

    await sendQuery(text);
  };

  // Handle clear chat
  const handleClearChat = () => {
    if (window.confirm('Clear all messages?')) {
      // Resolve any pending tool approval so the input is not left disabled
      if (toolApprovalResolver) {
        toolApprovalResolver.resolve(false);
        setPendingToolCalls(null);
        setToolApprovalResolver(null);
      }

      setMessages([makeMessage({
        type: 'system',
        message: simulationMode ? SIMULATION_WELCOME : 'Chat cleared. How can I help you?',
        timestamp: new Date().toISOString()
      })]);

      if (agent) {
        agent.clearHistory();
      }
    }
  };

  return (
    <div
      role={expanded ? 'dialog' : undefined}
      aria-modal={expanded ? true : undefined}
      aria-label={expanded ? 'Chat — expanded view' : undefined}
      className={expanded
        ? 'fixed inset-0 z-50 flex min-h-0 w-full flex-col border border-rule bg-paper-card shadow-sheet-lifted'
        : 'w-full border border-rule bg-paper-card shadow-sheet-lifted'}
    >
      {/* Header — flex-wrap lets the controls drop below the title on
          narrow screens instead of overflowing (F-UX-019). */}
      <div className="shrink-0 border-b border-ink bg-black px-5 py-4 text-white">
        <div className="flex flex-wrap justify-between items-center gap-x-3 gap-y-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass">AI-Powered</p>
            <h2 className="mt-1 font-display text-xl font-semibold">Ask a Question</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Simulation badge — the mode must be unmissable, because the
                answers below it are samples rather than live ATT&CK data. */}
            {simulationMode && (
              <span className="flex items-center gap-1.5 border border-brass px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-brass">
                <span aria-hidden="true" className="h-1 w-1 rotate-45 bg-brass" />
                Simulation
              </span>
            )}

            {/* Status Indicators */}
            <div className="flex items-center gap-3 border border-gray-700 bg-gray-900 px-3 py-1.5">
              {/* MCP Server Status — the state also reads as words; the dot is
                  only a colour hint (F-UX-016). role="status" announces the
                  probe outcome when it lands. */}
              <div role="status" className="flex items-center gap-1.5" title={`MCP Server: ${mcpServerStatus}`}>
                <div className={`w-2 h-2 rounded-full ${
                  mcpServerStatus === 'connected' ? 'bg-green-500' :
                  mcpServerStatus === 'disconnected' ? 'bg-red-500' :
                  'bg-gray-400'
                }`}></div>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-300">MCP</span>
                <span className="text-[11px] text-gray-400">{MCP_STATUS_TEXT[mcpServerStatus] || mcpServerStatus}</span>
              </div>

              {/* LLM Status */}
              <div role="status" className="flex items-center gap-1.5" title={`LLM: ${llmStatus}`}>
                <div className={`w-2 h-2 rounded-full ${
                  llmStatus === 'ready' ? 'bg-green-500' :
                  llmStatus === 'not-configured' ? 'bg-red-500' :
                  'bg-gray-400'
                }`}></div>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-300">LLM</span>
                <span className="text-[11px] text-gray-400">{LLM_STATUS_TEXT[llmStatus] || llmStatus}</span>
              </div>
            </div>

            {/* Expand / collapse — the in-place full-viewport toggle
                (F-UX-020). Same mounted ChatBox, so the transcript and the
                agent session are untouched. */}
            {expanded ? (
              <button
                onClick={() => setExpanded(false)}
                className="px-3 py-1.5 min-h-11 sm:min-h-0 border border-gray-700 font-mono text-[10px] uppercase tracking-[0.14em] text-gray-300 transition-colors hover:border-brass hover:text-white"
                title="Return to embedded size (Esc)"
              >
                Collapse
              </button>
            ) : (
              <button
                ref={expandButtonRef}
                onClick={() => setExpanded(true)}
                className="px-3 py-1.5 min-h-11 sm:min-h-0 border border-gray-700 font-mono text-[10px] uppercase tracking-[0.14em] text-gray-300 transition-colors hover:border-brass hover:text-white"
                title="Expand chat to full size"
              >
                Expand
              </button>
            )}

            {/* Clear Chat Button — min-h-11 keeps the tap target at least
                44px tall on small screens (F-UX-019). */}
            <button
              onClick={handleClearChat}
              className="px-3 py-1.5 min-h-11 sm:min-h-0 border border-gray-700 font-mono text-[10px] uppercase tracking-[0.14em] text-gray-300 transition-colors hover:border-brass hover:text-white"
              title="Clear chat history"
            >
              Clear
            </button>

            {/* Config Button — same 44px small-screen floor as Clear. */}
            <button
              ref={settingsButtonRef}
              onClick={() => (showConfig ? requestCloseSettings() : setShowConfig(true))}
              className="px-3 py-1.5 min-h-11 sm:min-h-0 border border-gray-700 font-mono text-[10px] uppercase tracking-[0.14em] text-gray-300 transition-colors hover:border-brass hover:text-white"
              title="Configure server"
            >
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* Not-set-up banner — the provider probe failed at init/rebuild, so the
          chat is usable but the LLM will not answer until configured
          (F-UX-002). The settings action is the fix path. */}
      {simulationMode ? (
        <div role="status" className="flex shrink-0 items-center justify-between gap-3 border-b border-l-4 border-rule border-l-brass bg-paper-sunk px-5 py-2.5">
          <p className="text-xs text-ink">
            No mitre-mcp server connected — answers are curated samples, not live ATT&CK data.
          </p>
          <button
            onClick={() => setShowConfig(true)}
            className="shrink-0 px-3 py-1 min-h-11 sm:min-h-0 bg-black font-mono text-[10px] uppercase tracking-[0.14em] text-white transition-colors hover:bg-gray-800"
          >
            Connect
          </button>
        </div>
      ) : llmStatus === 'not-configured' ? (
        <div role="status" className="flex shrink-0 items-center justify-between gap-3 border-b border-l-4 border-rule border-l-brass bg-paper-sunk px-5 py-2.5">
          <p className="text-xs text-ink">
            The LLM provider is not set up yet{llmSetupError ? ` — ${llmSetupError.split('\n')[0]}` : '.'}
          </p>
          <button
            onClick={() => setShowConfig(true)}
            className="shrink-0 px-3 py-1 min-h-11 sm:min-h-0 bg-black font-mono text-[10px] uppercase tracking-[0.14em] text-white transition-colors hover:bg-gray-800"
          >
            Open Settings
          </button>
        </div>
      ) : null}

      {/* Settings Modal — portalled to <body>: the hero mounts the chat in a
          `lg:sticky` wrapper, and a sticky element always creates a stacking
          context, which would otherwise trap this z-50 overlay beneath the
          z-40 navbar. */}
      {showConfig && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Modal — clicks on the backdrop (the flex container around the
              dialog) close it through the unsaved-changes guard. */}
          <div
            className="flex min-h-full items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) requestCloseSettings();
            }}
          >
            <div
              ref={settingsDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-dialog-title"
              tabIndex={-1}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-rule bg-paper-card shadow-sheet-lifted focus:outline-none"
            >
              {/* Modal Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink bg-black px-6 py-4 text-white">
                <h3 id="settings-dialog-title" className="font-display text-xl font-semibold">Settings</h3>
                <button
                  onClick={requestCloseSettings}
                  aria-label="Close settings"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg aria-hidden="true" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content — the dialog only closes when the agent rebuild
                  succeeded; on failure ServerConfig shows the error inside the
                  dialog and the live config/badge stay untouched (F-UX-005). */}
              <ServerConfig
                onConfigChange={async (config) => {
                  const result = await handleConfigChange(config);
                  if (result.ok) {
                    closeSettings();
                  }
                  return result;
                }}
                onDirtyChange={setSettingsDirty}
                initialConfig={serverConfig}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Messages Container — aria-live so appended messages are announced.
          Embedded height caps at 70% of the dynamic viewport below the 500px
          desktop size so the input stays reachable on small screens
          (F-UX-019). Expanded fills the remaining overlay viewport instead
          (F-UX-020). */}
      <div
        ref={messagesContainerRef}
        aria-live="polite"
        className={expanded
          ? 'min-h-0 flex-1 overflow-y-auto border-b border-rule bg-paper p-4'
          : 'h-[min(500px,70dvh)] overflow-y-auto border-b border-rule bg-paper p-4'}
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-500">
            <p className="font-mono text-xs uppercase tracking-[0.14em]">Start a conversation...</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id}>
                <ChatMessage
                  message={msg.message}
                  type={msg.type}
                  timestamp={msg.timestamp}
                  toolCalls={msg.toolCalls}
                  decision={msg.decision}
                  errorKind={msg.errorKind}
                  retryable={msg.retryable}
                  retryQuery={msg.retryQuery}
                  onApprove={handleApprove}
                  onDeny={handleDeny}
                  onAlwaysAllow={handleAlwaysAllow}
                  onRetry={handleRetry}
                />
                {/* Error messages can carry a fix action — "Open Settings"
                    points at the real remedy (F-UX-004). */}
                {msg.action === 'open-settings' && (
                  <div className="mr-auto mb-3 -mt-1 max-w-[85%]">
                    <button
                      onClick={() => setShowConfig(true)}
                      className="px-3 py-1.5 min-h-11 sm:min-h-0 bg-black font-mono text-[10px] uppercase tracking-[0.14em] text-white transition-colors hover:bg-gray-800"
                    >
                      Open Settings
                    </button>
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2.5 p-4 font-mono text-xs uppercase tracking-[0.12em] text-gray-500">
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
                {/* While an approval card is parked the agent is not
                    "thinking" — it is blocked on the user (F-UX-010). */}
                <span>
                  {pendingToolCalls
                    ? 'Waiting for your approval'
                    : simulationMode
                      ? 'Simulating…'
                      : 'Thinking...'}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input — shrink-0 so the expanded-view pane, not the composer, yields
          when the viewport is short (F-UX-020). */}
      <div className="shrink-0">
        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          modelInfo={
            simulationMode
              ? { provider: 'Simulation', model: 'sample answers', accent: 'border-l-brass' }
              : getModelDisplayInfo(serverConfig)
          }
        />
      </div>
    </div>
  );
}
