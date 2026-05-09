import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CopilotKit } from '@copilotkit/react-core';
import { CopilotChat } from '@copilotkit/react-ui';
import DiagramCanvas from './components/DiagramCanvas.jsx';
import ControlsPanel from './components/ControlsPanel.jsx';
import {
  fallbackState,
  fetchDiagramState,
  submitDiagramIntent,
  deriveOptimisticState
} from './state/diagramStore.js';
import './App.css';

function App() {
  const [state, setState] = useState(fallbackState);
  const [lastCommittedState, setLastCommittedState] = useState(fallbackState);
  const [temperature, setTemperature] = useState(0.7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showControls, setShowControls] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const chatWasRunning = useRef(false);

  const refreshDiagramState = useCallback(() => {
    fetchDiagramState()
      .then((data) => {
        setState(data);
        setLastCommittedState(data);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    refreshDiagramState();
  }, [refreshDiagramState]);

  const handleChatProgress = useCallback(
    (inProgress) => {
      if (inProgress) {
        chatWasRunning.current = true;
        return;
      }

      if (chatWasRunning.current) {
        chatWasRunning.current = false;
        refreshDiagramState();
      }
    },
    [refreshDiagramState]
  );

  async function runIntent(prompt, mode = 'apply') {
    setLoading(true);
    setError('');

    const optimisticState = deriveOptimisticState(state, prompt);
    setState(optimisticState);

    try {
      const payload = await submitDiagramIntent({
        prompt: mode === 'regenerate' ? `Regenerate: ${prompt}` : prompt,
        revisionId: lastCommittedState.revisionId,
        mermaidSource: lastCommittedState.mermaidSource,
        temperature
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
              <button type="button" onClick={() => setShowControls((value) => !value)}>
                {showControls ? 'Hide Controls' : 'Show Controls'}
              </button>
              <button type="button" onClick={() => setShowChat((value) => !value)}>
                {showChat ? 'Hide Chat' : 'Show Chat'}
              </button>
            </div>
          </header>
          <DiagramCanvas
            mermaidSource={state.mermaidSource}
            revisionId={state.revisionId}
            onManualEdit={handleManualEdit}
          />
          <p className={`status ${error ? 'status-error' : ''}`}>{status}</p>

          {showControls ? (
            <div className="floating-panel floating-controls">
              <ControlsPanel
                temperature={temperature}
                onTemperatureChange={setTemperature}
                onApply={(prompt) => runIntent(prompt, 'apply')}
                onUndo={() => setState(lastCommittedState)}
                onRegenerate={(prompt) => runIntent(prompt, 'regenerate')}
                loading={loading}
              />
            </div>
          ) : null}

          {showChat ? (
            <section className="floating-panel floating-chat">
              <div className="panel-header">
                <h2>Copilot Chat</h2>
              </div>
              <CopilotChat
            labels={{ title: 'Mermaid Assistant', initial: 'Describe a diagram change.' }}
            onInProgress={handleChatProgress}
          />
            </section>
          ) : null}
        </section>
      </main>
    </CopilotKit>
  );
}

export default App;
