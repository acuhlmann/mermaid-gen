import { useEffect, useMemo, useState } from 'react';
import { CopilotKit } from '@copilotkit/react-core';
import DiagramCanvas from './components/DiagramCanvas.jsx';
import ControlsPanel from './components/ControlsPanel.jsx';
import {
  fallbackState,
  fetchDiagramState,
  submitDiagramIntent,
  submitCoAuthorIntent,
  deriveOptimisticState
} from './state/diagramStore.js';
import './App.css';

const defaultPrompt = 'Describe a diagram change';
const defaultSettings = {
  temperature: 0.7,
  topP: 1,
  maxNodes: 25,
  styleGuide: 'balanced',
  persona: 'creative architect'
};

function App() {
  const [state, setState] = useState(fallbackState);
  const [lastCommittedState, setLastCommittedState] = useState(fallbackState);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetchDiagramState()
      .then((data) => {
        setState(data);
        setLastCommittedState(data);
      })
      .catch((err) => setError(err.message));
  }, []);

  async function runIntent(promptInput) {
    setLoading(true);
    setError('');

    const optimisticState = deriveOptimisticState(state, promptInput);
    setState(optimisticState);

    try {
      const payload = await submitDiagramIntent({
        prompt: promptInput,
        revisionId: lastCommittedState.revisionId,
        mermaidSource: lastCommittedState.mermaidSource,
        settings
      });

      setState(payload.state);
      setLastCommittedState(payload.state);
    } catch (err) {
      setState(lastCommittedState);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function runCoAuthor(promptInput) {
    setLoading(true);
    setError('');

    try {
      const payload = await submitCoAuthorIntent({
        prompt: promptInput,
        revisionId: lastCommittedState.revisionId,
        mermaidSource: lastCommittedState.mermaidSource,
        settings
      });

      setState(payload.state);
      setLastCommittedState(payload.state);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleManualEdit(nextSource) {
    setState((currentState) => ({
      ...currentState,
      mermaidSource: nextSource,
      updatedAt: new Date().toISOString()
    }));
  }

  const status = useMemo(() => {
    if (loading) return 'Applying agent update...';
    if (error) return error;
    return `Last updated: ${new Date(state.updatedAt).toLocaleTimeString()}`;
  }, [error, loading, state.updatedAt]);

  function handleSettingChange(key, value) {
    setSettings((current) => ({
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
              <button type="button" onClick={() => setShowSettings((value) => !value)}>
                {showSettings ? 'Hide Settings' : 'Agent Settings'}
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
            revisionId={state.revisionId}
            onManualEdit={handleManualEdit}
          />
          <p className={`status ${error ? 'status-error' : ''}`}>{status}</p>

          {showSettings ? (
            <div className="floating-panel floating-controls">
              <ControlsPanel
                settings={settings}
                onSettingsChange={handleSettingChange}
                onUndo={() => setState(lastCommittedState)}
                onCoAuthorExtend={runCoAuthor}
                loading={loading}
                prompt={prompt}
              />
            </div>
          ) : null}
        </section>
      </main>
    </CopilotKit>
  );
}

export default App;
