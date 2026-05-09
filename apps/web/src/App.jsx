import { useEffect, useMemo, useRef, useState } from 'react';
import { CopilotKit } from '@copilotkit/react-core';
import { applyMermaidStyleDirective, parseMermaidStyleConfig } from '@mermaid-architect/shared';
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

function App() {
  const [state, setState] = useState(fallbackState);
  const [lastCommittedState, setLastCommittedState] = useState(fallbackState);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [coAuthorSettings, setCoAuthorSettings] = useState(defaultCoAuthorSettings);
  const [loading, setLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState(null);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const syncTimerRef = useRef(null);

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
    },
    []
  );

  async function runIntent(promptInput) {
    setLoading(true);
    setActiveAgent('intent');
    setError('');

    const optimisticState = deriveOptimisticState(state, promptInput);
    setState(optimisticState);

    try {
      const payload = await submitDiagramIntent({
        prompt: promptInput,
        revisionId: lastCommittedState.revisionId,
        mermaidSource: lastCommittedState.mermaidSource,
        settings: {}
      });

      setState(payload.state);
      setLastCommittedState(payload.state);
    } catch (err) {
      setState(lastCommittedState);
      setError(err.message);
    } finally {
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

      const payload = await submitCoAuthorIntent({
        prompt: coAuthorPrompt,
        revisionId: syncedState.revisionId,
        mermaidSource: syncedState.mermaidSource,
        settings: coAuthorSettings
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
    if (loading && activeAgent === 'style') return 'Style agent is updating the diagram appearance...';
    if (loading) return 'Intent agent is applying your requested update...';
    if (error) return error;
    return `Last updated: ${new Date(state.updatedAt).toLocaleTimeString()}`;
  }, [activeAgent, error, loading, state.updatedAt]);

  function handleSettingChange(key, value) {
    setCoAuthorSettings((current) => ({
      ...current,
      [key]: key === 'maxNodes' ? Math.max(1, Math.min(200, Number(value) || 1)) : value
    }));
  }

  return (
    <CopilotKit runtimeUrl={`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'}/api/copilotkit`}>
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
          />
          <p className={`status ${error ? 'status-error' : ''}`}>{status}</p>

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
                onUndo={handleRevertToLastCommitted}
                loading={loading}
              />
            </div>
          ) : null}
        </section>
      </main>
    </CopilotKit>
  );
}

export default App;
