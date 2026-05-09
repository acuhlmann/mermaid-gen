import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CopilotKit, useCopilotChat } from '@copilotkit/react-core';
import { CopilotSidebar } from '@copilotkit/react-ui';
import DiagramCanvas from './components/DiagramCanvas.jsx';
import ControlsPanel from './components/ControlsPanel.jsx';
import StylePanel from './components/StylePanel.jsx';
import {
  fallbackState,
  fetchDiagramState,
  syncClientDiagramState,
  submitDiagramIntent,
  submitCoAuthorIntent,
  submitStyleIntent,
  deriveOptimisticState
} from './state/diagramStore.js';
import './App.css';

const defaultPrompt = 'Describe a diagram change';
const defaultCoAuthorSettings = {
  temperature: 1.1,
  topP: 1,
  maxNodes: 40,
  styleGuide: 'bold',
  persona: 'playful co-author'
};
const defaultCoAuthorPrompt =
  'Creatively extend the current diagram into a bigger system while preserving existing structure and concepts.';

function MermaidArchitect() {
  const [state, setState] = useState(fallbackState);
  const [lastCommittedState, setLastCommittedState] = useState(fallbackState);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [coAuthorSettings, setCoAuthorSettings] = useState(defaultCoAuthorSettings);
  const [loading, setLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState(null);
  const [error, setError] = useState('');
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [streamingPreview, setStreamingPreview] = useState(false);
  const [autoFixEnabled, setAutoFixEnabled] = useState(true);
  const [validationError, setValidationError] = useState(null);
  const [autoFixAttempted, setAutoFixAttempted] = useState(false);
  const { isLoading: copilotLoading } = useCopilotChat();
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
  const autoFixEnabledRef = useRef(true);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    streamingPreviewRef.current = streamingPreview;
  }, [streamingPreview]);

  useEffect(() => {
    copilotLoadingRef.current = copilotLoading;
  }, [copilotLoading]);

  useEffect(() => {
    autoFixEnabledRef.current = autoFixEnabled;
  }, [autoFixEnabled]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    fetchDiagramState()
      .then((data) => {
        setState(data);
        setLastCommittedState(data);
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
      setLastCommittedState(nextState);
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
        setLastCommittedState(nextState);
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
    if (copilotLoading) {
      hasStartedCopilotRunRef.current = true;
      return;
    }

    if (!hasStartedCopilotRunRef.current) {
      return;
    }

    hasStartedCopilotRunRef.current = false;
    refreshDiagramFromAgentStream();
  }, [copilotLoading, refreshDiagramFromAgentStream]);

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
        setLastCommittedState(syncedState);

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

      if (!autoFixEnabledRef.current) return;
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
          !autoFixEnabledRef.current ||
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
  }, [autoFixEnabled, copilotLoading, loading, scheduleAutoFix, streamingPreview, validationError]);

  function manualAutoFix() {
    if (!validationError) return;
    if (loading || copilotLoading || streamingPreview) return;
    if (autoFixTimerRef.current) {
      clearTimeout(autoFixTimerRef.current);
      autoFixTimerRef.current = null;
    }
    runAutoFix(validationError.source, validationError.error);
  }

  async function runIntent(promptInput) {
    setLoading(true);
    setActiveAgent('agui');
    setError('');

    const optimisticState = deriveOptimisticState(state, promptInput);
    setState(optimisticState);
    try {
      const syncedState = await syncClientDiagramState({
        mermaidSource: state.mermaidSource
      });
      setState(syncedState);
      setLastCommittedState(syncedState);

      const result = await submitDiagramIntent({
        prompt: promptInput,
        revisionId: syncedState.revisionId,
        mermaidSource: syncedState.mermaidSource
      });
      animateAcceptedSource(result.state);
    } catch (err) {
      setError(err.message);
      setLoading(false);
      setActiveAgent(null);
    }
  }

  async function runCoAuthor(promptInput) {
    const coAuthorPrompt = promptInput?.trim() || defaultCoAuthorPrompt;
    setLoading(true);
    setActiveAgent('coauthor');
    setError('');

    try {
      const syncedState = await syncClientDiagramState({
        mermaidSource: state.mermaidSource,
        styleConfig: state.styleConfig
      });
      setState(syncedState);
      setLastCommittedState(syncedState);
      const result = await submitCoAuthorIntent({
        prompt: coAuthorPrompt,
        revisionId: syncedState.revisionId,
        mermaidSource: syncedState.mermaidSource,
        settings: coAuthorSettings
      });
      animateAcceptedSource(result.state);
    } catch (err) {
      setError(err.message);
      setLoading(false);
      setActiveAgent(null);
    }
  }

  function clearPendingSync() {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
  }

  async function runStylePrompt(promptInput) {
    const stylePrompt = promptInput?.trim();
    if (!stylePrompt) return;

    setLoading(true);
    setActiveAgent('style');
    setError('');
    clearPendingSync();

    try {
      const syncedState = await syncClientDiagramState({
        mermaidSource: state.mermaidSource,
        styleConfig: state.styleConfig
      });
      setState(syncedState);
      setLastCommittedState(syncedState);

      const payload = await submitStyleIntent({
        prompt: stylePrompt,
        revisionId: syncedState.revisionId,
        mermaidSource: syncedState.mermaidSource,
        settings: {}
      });

      setState(payload.state);
      setLastCommittedState(payload.state);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setActiveAgent(null);
    }
  }

  function handleManualEdit(nextSource) {
    const parsedStyle = parseMermaidStyleConfig(nextSource);
    setState((currentState) => ({
      ...currentState,
      mermaidSource: nextSource,
      styleConfig: parsedStyle.accepted ? parsedStyle.styleConfig : currentState.styleConfig,
      updatedAt: new Date().toISOString()
    }));

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
        setLastCommittedState(synced);
      } catch {
        // Keep local edits even if sync fails; user can still retry with Surprise me.
      }
    }, 350);
  }

  async function handleStyleApply(nextStyleConfig) {
    clearPendingSync();

    const styled = applyMermaidStyleDirective({
      mermaidSource: state.mermaidSource,
      styleConfig: nextStyleConfig
    });

    setState((currentState) => ({
      ...currentState,
      mermaidSource: styled.mermaidSource,
      styleConfig: styled.styleConfig,
      updatedAt: new Date().toISOString()
    }));

    try {
      const synced = await syncClientDiagramState(styled);
      setState(synced);
      setLastCommittedState(synced);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  function handleRevertToLastCommitted() {
    clearPendingSync();
    setState(lastCommittedState);
  }

  const status = useMemo(() => {
    if (loading && activeAgent === 'coauthor') return 'Co-author surprise mode is extending your diagram...';
    if (loading && activeAgent === 'autofix') return 'AG-UI agent is auto-fixing the Mermaid syntax error...';
    if (copilotLoading || streamingPreview || (loading && activeAgent === 'agui')) {
      return 'AG-UI stream is coordinating the agent and diagram update...';
    }
    if (loading) return 'Agent is applying your requested update...';
    if (error) return error;
    if (validationError) {
      if (autoFixAttempted) {
        return `Auto-fix already tried. Please edit the Mermaid manually or click Fix now. Error: ${validationError.error}`;
      }
      if (autoFixEnabled) return 'Mermaid syntax error detected. Auto-fix will run shortly...';
      return `Mermaid syntax error: ${validationError.error}`;
    }
    return `Last updated: ${new Date(state.updatedAt).toLocaleTimeString()}`;
  }, [
    activeAgent,
    autoFixAttempted,
    autoFixEnabled,
    copilotLoading,
    error,
    loading,
    state.updatedAt,
    streamingPreview,
    validationError
  ]);

  function handleSettingChange(key, value) {
    setCoAuthorSettings((current) => ({
      ...current,
      [key]: key === 'maxNodes' ? Math.max(1, Math.min(200, Number(value) || 1)) : value
    }));
  }

  return (
    <CopilotSidebar
      defaultOpen
      instructions="You are Mermaid Architect. Stream concise commentary while editing the current Mermaid diagram. Apply diagram changes with the server-side patch tool before summarizing."
      labels={{
        title: 'AG-UI Mermaid Agent',
        initial: 'Ask for a diagram change here, or use the prompt bar. I will stream commentary while the Mermaid patch is validated.'
      }}
    >
      <main className="layout">
        <section className="workspace">
          <header className="workspace-header">
            <div>
              <h1>Mermaid Architect</h1>
              <p className="subtitle">Collaborative diagram generation with agentic controls.</p>
            </div>
            <div className="floating-toggles">
              <button type="button" onClick={() => setShowStylePanel((value) => !value)}>
                {showStylePanel ? 'Hide Style' : 'Style'}
              </button>
              <button type="button" onClick={() => setShowSettings((value) => !value)}>
                {showSettings ? 'Hide Co-Author Settings' : 'Co-Author Settings'}
              </button>
              <button type="button" onClick={() => runCoAuthor(prompt)} disabled={loading}>
                Surprise me
              </button>
            </div>
          </header>
          <form
            className="intent-bar"
            onSubmit={(event) => {
              event.preventDefault();
              runIntent(prompt);
            }}
          >
            <input
              aria-label="Describe a diagram change"
              type="text"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe a diagram change"
            />
            <button type="submit" disabled={loading || !prompt.trim()}>
              Draw with agent
            </button>
          </form>
          <DiagramCanvas
            mermaidSource={state.mermaidSource}
            styleConfig={state.styleConfig}
            revisionId={state.revisionId}
            onManualEdit={handleManualEdit}
            onValidationChange={handleValidationChange}
            streamingPreview={streamingPreview}
          />
          <div className="autofix-bar">
            <label className="autofix-toggle">
              <input
                type="checkbox"
                checked={autoFixEnabled}
                onChange={(event) => setAutoFixEnabled(event.target.checked)}
              />
              Auto-fix Mermaid errors with the agent
            </label>
            <button
              type="button"
              onClick={manualAutoFix}
              disabled={!validationError || loading || copilotLoading || streamingPreview}
            >
              Fix now with agent
            </button>
          </div>
          <p className={`status ${error || validationError ? 'status-error' : ''}`}>{status}</p>

          {showStylePanel ? (
            <div className="floating-panel floating-style">
              <StylePanel
                key={JSON.stringify(state.styleConfig)}
                styleConfig={state.styleConfig}
                onApply={handleStyleApply}
                onRevert={handleRevertToLastCommitted}
                onStylePrompt={runStylePrompt}
                loading={loading}
              />
            </div>
          ) : null}

          {showSettings ? (
            <div className="floating-panel floating-controls">
              <ControlsPanel
                settings={coAuthorSettings}
                onSettingsChange={handleSettingChange}
                onUndo={() => setState(lastCommittedState)}
                onCoAuthorExtend={runCoAuthor}
                prompt={prompt}
                loading={loading}
              />
            </div>
          ) : null}
        </section>
      </main>
    </CopilotSidebar>
  );
}

function App() {
  return (
    <CopilotKit runtimeUrl={`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'}/api/copilotkit`}>
      <MermaidArchitect />
    </CopilotKit>
  );
}

export default App;
