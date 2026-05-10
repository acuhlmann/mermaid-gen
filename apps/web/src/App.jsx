import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseMermaidStyleConfig } from '@mermaid-architect/shared';
import DiagramCanvas from './components/DiagramCanvas.jsx';
import {
  fallbackState,
  fetchDiagramState,
  syncClientDiagramState,
  submitDiagramIntent,
  submitCoAuthorIntent
} from './state/diagramStore.js';
import './App.css';

const defaultCoAuthorPrompt =
  'Creatively extend the current diagram into a bigger system while preserving existing structure and concepts.';

const SURPRISE_SCALE_LABELS = ['Subtle', 'Mild', 'Balanced', 'Bold', 'Wild'];

function MermaidArchitect() {
  const [state, setState] = useState(fallbackState);
  const [prompt, setPrompt] = useState('');
  const [surpriseScale, setSurpriseScale] = useState(3);
  const [loading, setLoading] = useState(false);
  const [activeRequest, setActiveRequest] = useState(null);
  const [error, setError] = useState('');
  const [streamingPreview, setStreamingPreview] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [autoFixAttempted, setAutoFixAttempted] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const syncTimerRef = useRef(null);
  const streamTimerRef = useRef(null);
  const autoFixTimerRef = useRef(null);
  const stateRef = useRef(state);
  const lastAutoFixSourceRef = useRef(null);
  const autoFixAttemptedRef = useRef(false);
  const loadingRef = useRef(false);
  const streamingPreviewRef = useRef(false);
  const autoFixAlwaysOnRef = useRef(true);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    streamingPreviewRef.current = streamingPreview;
  }, [streamingPreview]);

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
      setActiveRequest(null);
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
        setActiveRequest(null);
        return;
      }

      setState({
        ...nextState,
        mermaidSource: nextSource.slice(0, cursor),
        updatedAt: new Date().toISOString()
      });
    }, 18);
  }, []);

  const runAutoFix = useCallback(
    async (brokenSource, errorMessage) => {
      lastAutoFixSourceRef.current = brokenSource;
      autoFixAttemptedRef.current = true;
      setAutoFixAttempted(true);
      setLoading(true);
      setActiveRequest('autofix');
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
        setActiveRequest(null);
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
      if (loadingRef.current || streamingPreviewRef.current) return;

      autoFixTimerRef.current = setTimeout(() => {
        autoFixTimerRef.current = null;
        if (
          loadingRef.current ||
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
  }, [loading, scheduleAutoFix, streamingPreview, validationError]);

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
        // Local editing stays responsive even when background sync is unavailable.
      }
    }, 350);
  }

  async function runIntentChange(event) {
    event.preventDefault();
    const nextPrompt = prompt.trim();
    if (!nextPrompt || loadingRef.current || streamingPreviewRef.current) return;

    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    const currentState = stateRef.current;
    setLoading(true);
    setActiveRequest('intent');
    setError('');

    try {
      const syncedState = await syncClientDiagramState({
        mermaidSource: currentState.mermaidSource,
        styleConfig: currentState.styleConfig
      });
      setState(syncedState);
      const result = await submitDiagramIntent({
        prompt: nextPrompt,
        revisionId: syncedState.revisionId,
        mermaidSource: syncedState.mermaidSource
      });
      setPrompt('');
      animateAcceptedSource(result.state);
    } catch (err) {
      setError(err.message);
      setLoading(false);
      setActiveRequest(null);
    }
  }

  async function runCoAuthor() {
    if (loadingRef.current || streamingPreviewRef.current) return;

    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    const currentState = stateRef.current;
    setLoading(true);
    setActiveRequest('coauthor');
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
      setActiveRequest(null);
    }
  }

  const busy = loading || streamingPreview;
  const status = useMemo(() => {
    if (loading && activeRequest === 'coauthor') return 'Surprise me is extending the diagram.';
    if (loading && activeRequest === 'intent') return 'Applying diagram change.';
    if (loading && activeRequest === 'autofix') return 'Fixing Mermaid syntax.';
    if (streamingPreview) return 'Refreshing diagram.';
    if (error) return error;
    if (validationError && autoFixAttempted) return `Mermaid syntax needs manual edit: ${validationError.error}`;
    return '';
  }, [activeRequest, autoFixAttempted, error, loading, streamingPreview, validationError]);

  return (
    <main className={`app-shell ${editorOpen ? 'is-editor-open' : ''}`} aria-label="MermaidGen">
      <DiagramCanvas
        mermaidSource={state.mermaidSource}
        styleConfig={state.styleConfig}
        revisionId={state.revisionId}
        onManualEdit={handleManualEdit}
        onValidationChange={handleValidationChange}
        streamingPreview={streamingPreview}
        editorOpen={editorOpen}
      />

      <div className="corner-control brand-control" aria-label="MermaidGen brand">
        MermaidGen
      </div>

      <div className="corner-control edit-control">
        <button type="button" className="overlay-button" onClick={() => setEditorOpen((current) => !current)}>
          {editorOpen ? 'Close Code' : 'Edit Code'}
        </button>
      </div>

      <form className="corner-control prompt-control" onSubmit={runIntentChange}>
        <label className="sr-only" htmlFor="diagram-change-prompt">
          Describe your Change
        </label>
        <input
          id="diagram-change-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Describe your Change"
          disabled={busy}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={status ? 'app-status' : undefined}
        />
        <button type="submit" className="overlay-button primary-button" disabled={busy || !prompt.trim()}>
          Go
        </button>
        {status ? (
          <p id="app-status" className={`overlay-status ${error ? 'is-error' : ''}`} role="status">
            {status}
          </p>
        ) : null}
      </form>

      <div className="corner-control surprise-control">
        <div className="surprise-scale" role="radiogroup" aria-label="Surprise scale">
          {SURPRISE_SCALE_LABELS.map((label, index) => {
            const value = index + 1;
            const selected = surpriseScale === value;
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-label={`${label} surprise level`}
                aria-checked={selected}
                className={`scale-dot ${selected ? 'is-selected' : ''}`}
                onClick={() => setSurpriseScale(value)}
              >
                {value}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="overlay-button surprise-button"
          onClick={() => runCoAuthor()}
          disabled={busy}
          aria-busy={loading && activeRequest === 'coauthor'}
        >
          Surprise me
        </button>
      </div>
    </main>
  );
}

function App() {
  return <MermaidArchitect />;
}

export default App;
