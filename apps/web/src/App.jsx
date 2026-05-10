import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useCopilotAdditionalInstructions,
  useCopilotChat
} from '@copilotkit/react-core';
import { CopilotChat, CopilotKit, useAgent } from '@copilotkit/react-core/v2';
import { parseMermaidStyleConfig } from '@mermaid-architect/shared';
import DiagramCanvas from './components/DiagramCanvas.jsx';
import {
  API_BASE_URL,
  fallbackState,
  fetchDiagramState,
  getOrCreateBrowserSessionId,
  SESSION_HEADER,
  syncClientDiagramState,
  submitDiagramIntent,
  submitCoAuthorIntent
} from './state/diagramStore.js';
import './App.css';

const defaultCoAuthorPrompt =
  'Creatively extend the current diagram into a bigger system while preserving existing structure and concepts.';

const HELPER_INSTRUCTIONS =
  'You are Mermaid Architect (Helper agent). Stream concise commentary while editing the current Mermaid diagram. Apply diagram changes with the server-side patch tool before summarizing.';

const SURPRISE_SCALE_LABELS = ['Subtle', 'Mild', 'Balanced', 'Bold', 'Wild'];

/** Only remount chat when reconnecting may help; broad patterns reset the thread and hide the user's message. */
function shouldRemountHelperChatFromCopilotEvent(payload) {
  const code = typeof payload?.code === 'string' ? payload.code : '';
  const msg = String(payload?.error?.message ?? '');
  if (code === 'agent_connect_failed') return true;
  if (/already errored/i.test(msg)) return true;
  return false;
}

function MermaidArchitect({ sessionId, helperChatKey = 0, onRemountHelperChat }) {
  const [state, setState] = useState(fallbackState);
  const [surpriseScale, setSurpriseScale] = useState(3);
  const [loading, setLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState(null);
  const [error, setError] = useState('');
  const [streamingPreview, setStreamingPreview] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [autoFixAttempted, setAutoFixAttempted] = useState(false);
  const { isLoading: legacyCopilotLoading } = useCopilotChat();
  const { agent: helperAgent } = useAgent();
  const helperRunning = helperAgent.isRunning === true;
  useCopilotAdditionalInstructions(HELPER_INSTRUCTIONS);
  const syncTimerRef = useRef(null);
  const streamTimerRef = useRef(null);
  const autoFixTimerRef = useRef(null);
  const stateRef = useRef(state);
  const hasStartedCopilotRunRef = useRef(false);
  const lastAutoFixSourceRef = useRef(null);
  const autoFixAttemptedRef = useRef(false);
  const loadingRef = useRef(false);
  const streamingPreviewRef = useRef(false);
  const copilotLoadingRef = useRef(false);
  const autoFixAlwaysOnRef = useRef(true);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    streamingPreviewRef.current = streamingPreview;
  }, [streamingPreview]);

  useEffect(() => {
    copilotLoadingRef.current = legacyCopilotLoading || helperRunning;
  }, [helperRunning, legacyCopilotLoading]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    fetchDiagramState()
      .then((data) => {
        setState(data);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(
    () => () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
      if (streamTimerRef.current) {
        clearInterval(streamTimerRef.current);
      }
      if (autoFixTimerRef.current) {
        clearTimeout(autoFixTimerRef.current);
      }
    },
    []
  );

  const animateAcceptedSource = useCallback((nextState) => {
    const previousState = stateRef.current;
    const nextSource = nextState.mermaidSource;

    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
    }

    if (previousState.revisionId === nextState.revisionId || previousState.mermaidSource === nextSource) {
      setState(nextState);
      setStreamingPreview(false);
      setLoading(false);
      setActiveAgent(null);
      return;
    }

    const chunkSize = Math.max(1, Math.ceil(nextSource.length / 90));
    let cursor = 0;
    setStreamingPreview(true);

    streamTimerRef.current = setInterval(() => {
      cursor += chunkSize;
      if (cursor >= nextSource.length) {
        clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
        setState(nextState);
        setStreamingPreview(false);
        setLoading(false);
        setActiveAgent(null);
        return;
      }

      setState({
        ...nextState,
        mermaidSource: nextSource.slice(0, cursor),
        updatedAt: new Date().toISOString()
      });
    }, 18);
  }, []);

  const refreshDiagramFromAgentStream = useCallback(async () => {
    try {
      const latestState = await fetchDiagramState();
      animateAcceptedSource(latestState);
    } catch (err) {
      setError(err.message);
      setLoading(false);
      setActiveAgent(null);
      setStreamingPreview(false);
    }
  }, [animateAcceptedSource]);

  useEffect(() => {
    if (legacyCopilotLoading || helperRunning) {
      hasStartedCopilotRunRef.current = true;
      return;
    }

    if (!hasStartedCopilotRunRef.current) {
      return;
    }

    hasStartedCopilotRunRef.current = false;
    refreshDiagramFromAgentStream();
  }, [helperRunning, legacyCopilotLoading, refreshDiagramFromAgentStream]);

  const runAutoFix = useCallback(
    async (brokenSource, errorMessage) => {
      lastAutoFixSourceRef.current = brokenSource;
      autoFixAttemptedRef.current = true;
      setAutoFixAttempted(true);
      setLoading(true);
      setActiveAgent('autofix');
      setError('');
      try {
        const syncedState = await syncClientDiagramState({
          mermaidSource: brokenSource
        });
        setState(syncedState);

        const result = await submitDiagramIntent({
          prompt: `The Mermaid editor currently shows a syntax error. Please fix the diagram and apply a corrected version with apply_mermaid_patch.

Mermaid renderer error:
${errorMessage}

Current invalid Mermaid source:
\`\`\`mermaid
${brokenSource}
\`\`\`

Hard requirements:
- Preserve the user's intent and as much of the structure as possible.
- Output complete, valid Mermaid source.
- Apply the fix with apply_mermaid_patch before summarizing.`,
          revisionId: syncedState.revisionId,
          mermaidSource: syncedState.mermaidSource
        });

        animateAcceptedSource(result.state);
      } catch (err) {
        setError(err.message);
        setLoading(false);
        setActiveAgent(null);
      }
    },
    [animateAcceptedSource]
  );

  const scheduleAutoFix = useCallback(
    ({ source, error: nextError }) => {
      if (autoFixTimerRef.current) {
        clearTimeout(autoFixTimerRef.current);
        autoFixTimerRef.current = null;
      }

      if (!autoFixAlwaysOnRef.current) return;
      if (!nextError) return;
      if (autoFixAttemptedRef.current) return;
      if (lastAutoFixSourceRef.current === source) return;
      if (loadingRef.current || copilotLoadingRef.current || streamingPreviewRef.current) return;

      autoFixTimerRef.current = setTimeout(() => {
        autoFixTimerRef.current = null;
        if (
          loadingRef.current ||
          copilotLoadingRef.current ||
          streamingPreviewRef.current ||
          !autoFixAlwaysOnRef.current ||
          autoFixAttemptedRef.current ||
          lastAutoFixSourceRef.current === source
        ) {
          return;
        }
        runAutoFix(source, nextError);
      }, 1500);
    },
    [runAutoFix]
  );

  const handleValidationChange = useCallback(({ source, error: nextError }) => {
    setValidationError(nextError ? { source, error: nextError } : null);

    if (!nextError) {
      autoFixAttemptedRef.current = false;
      setAutoFixAttempted(false);
      if (lastAutoFixSourceRef.current && lastAutoFixSourceRef.current !== source) {
        lastAutoFixSourceRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (!validationError) {
      if (autoFixTimerRef.current) {
        clearTimeout(autoFixTimerRef.current);
        autoFixTimerRef.current = null;
      }
      return;
    }

    scheduleAutoFix(validationError);
  }, [helperRunning, legacyCopilotLoading, loading, scheduleAutoFix, streamingPreview, validationError]);

  async function runCoAuthor() {
    if (loadingRef.current || streamingPreviewRef.current) return;

    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    const currentState = stateRef.current;
    setLoading(true);
    setActiveAgent('coauthor');
    setError('');

    try {
      const syncedState = await syncClientDiagramState({
        mermaidSource: currentState.mermaidSource,
        styleConfig: currentState.styleConfig
      });
      setState(syncedState);
      const result = await submitCoAuthorIntent({
        prompt: defaultCoAuthorPrompt,
        revisionId: syncedState.revisionId,
        mermaidSource: syncedState.mermaidSource,
        settings: { surpriseScale }
      });
      animateAcceptedSource(result.state);
    } catch (err) {
      setError(err.message);
      setLoading(false);
      setActiveAgent(null);
    }
  }

  function handleManualEdit(nextSource) {
    const parsedStyle = parseMermaidStyleConfig(nextSource);
    setState((currentState) => {
      const nextState = {
        ...currentState,
        mermaidSource: nextSource,
        styleConfig: parsedStyle.accepted ? parsedStyle.styleConfig : currentState.styleConfig,
        updatedAt: new Date().toISOString()
      };
      stateRef.current = nextState;
      return nextState;
    });

    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }

    syncTimerRef.current = setTimeout(async () => {
      try {
        const synced = await syncClientDiagramState({
          mermaidSource: nextSource,
          styleConfig: parsedStyle.accepted ? parsedStyle.styleConfig : undefined
        });
        setState(synced);
      } catch {
        // Keep local edits even if sync fails.
      }
    }, 350);
  }

  const status = useMemo(() => {
    if (loading && activeAgent === 'coauthor') return 'Surprise me agent is extending your diagram...';
    if (loading && activeAgent === 'autofix') return 'Helper agent is fixing a syntax error...';
    if (legacyCopilotLoading || helperRunning || streamingPreview) {
      return 'Helper agent is updating your diagram...';
    }
    if (loading) return 'Applying update...';
    if (error) return error;
    if (validationError) {
      if (autoFixAttempted) {
        return `Auto-fix already tried. Edit the Mermaid source or ask the Helper agent in chat. Error: ${validationError.error}`;
      }
      return 'Mermaid syntax error detected. Auto-fix will run shortly...';
    }
    return `Last updated: ${new Date(state.updatedAt).toLocaleTimeString()}`;
  }, [
    activeAgent,
    autoFixAttempted,
    helperRunning,
    legacyCopilotLoading,
    error,
    loading,
    state.updatedAt,
    streamingPreview,
    validationError
  ]);

  return (
    <div className="app-root-layout">
      <div className="workspace-main-wrap">
        <main className="layout app-shell">
          <section className="workspace-main">
            <header className="workspace-header">
              <div>
                <h1>Mermaid Architect</h1>
                <p className="subtitle">Editor, preview, Helper agent, and Surprise me.</p>
              </div>
            </header>

            <DiagramCanvas
              mermaidSource={state.mermaidSource}
              styleConfig={state.styleConfig}
              revisionId={state.revisionId}
              onManualEdit={handleManualEdit}
              onValidationChange={handleValidationChange}
              streamingPreview={streamingPreview}
            />

            <section className="surprise-agent-panel" aria-labelledby="surprise-agent-heading">
              <h2 id="surprise-agent-heading" className="surprise-agent-title">
                Surprise me agent
              </h2>
              <p className="surprise-agent-hint">How different should the creative extension be?</p>
              <div className="surprise-scale" role="radiogroup" aria-label="Surprise scale">
                {SURPRISE_SCALE_LABELS.map((label, index) => {
                  const value = index + 1;
                  const selected = surpriseScale === value;
                  return (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`surprise-scale-step${selected ? ' surprise-scale-step-active' : ''}`}
                      onClick={() => setSurpriseScale(value)}
                    >
                      <span className="surprise-scale-num">{value}</span>
                      <span className="surprise-scale-label">{label}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="surprise-me-btn"
                onClick={() => runCoAuthor()}
                disabled={loading || streamingPreview}
                aria-busy={loading && activeAgent === 'coauthor'}
              >
                {loading && activeAgent === 'coauthor' ? 'Surprising...' : 'Surprise me'}
              </button>
            </section>

            <p className={`status ${error || validationError ? 'status-error' : ''}`}>{status}</p>
          </section>
        </main>
      </div>

      <aside className="helper-chat-column" aria-label="Helper agent chat">
        <div className="helper-chat-heading">
          <div className="helper-chat-heading-row">
            <div>
              <h2 className="helper-chat-title">Helper agent</h2>
              <p className="helper-chat-subtitle">Validated Mermaid patches from chat.</p>
            </div>
            <button
              type="button"
              className="helper-chat-reset-btn"
              onClick={() => onRemountHelperChat?.()}
            >
              Reset chat
            </button>
          </div>
        </div>
        <div className="helper-chat-shell">
          <CopilotChat
            key={`helper-chat-${helperChatKey}`}
            threadId={sessionId}
            welcomeScreen={false}
            labels={{
              chatInputPlaceholder: 'Describe what you want, then send.',
              chatDisclaimerText: ''
            }}
            onError={(payload) => {
              if (shouldRemountHelperChatFromCopilotEvent(payload)) {
                onRemountHelperChat?.();
              }
            }}
          />
        </div>
      </aside>
    </div>
  );
}

function App() {
  const sessionId = useMemo(() => getOrCreateBrowserSessionId(), []);
  const [helperChatKey, setHelperChatKey] = useState(0);
  const lastHelperRemountRef = useRef(0);

  const remountHelperChat = useCallback(() => {
    const now = Date.now();
    if (now - lastHelperRemountRef.current < 1200) {
      return;
    }
    lastHelperRemountRef.current = now;
    setHelperChatKey((k) => k + 1);
  }, []);

  return (
    <CopilotKit
      useSingleEndpoint={false}
      runtimeUrl={`${API_BASE_URL}/api/copilotkit`}
      headers={() => ({ [SESSION_HEADER]: sessionId })}
      showDevConsole={false}
      enableInspector={false}
      onError={(payload) => {
        if (shouldRemountHelperChatFromCopilotEvent(payload)) {
          remountHelperChat();
        }
      }}
    >
      <MermaidArchitect
        sessionId={sessionId}
        helperChatKey={helperChatKey}
        onRemountHelperChat={remountHelperChat}
      />
    </CopilotKit>
  );
}

export default App;
