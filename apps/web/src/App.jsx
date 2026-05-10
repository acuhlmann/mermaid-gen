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

function MermaidGenApp() {
  const [state, setState] = useState(fallbackState);
  const [surpriseScale, setSurpriseScale] = useState(3);
  const [loading, setLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState(null);
  const [error, setError] = useState('');
  const [streamingPreview, setStreamingPreview] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [autoFixAttempted, setAutoFixAttempted] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [changePrompt, setChangePrompt] = useState('');
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
          mermaidSource: syncedState.mermaidSource,
          settings: {}
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

  async function runDescribeChange() {
    const prompt = changePrompt.trim();
    if (!prompt || loadingRef.current || streamingPreviewRef.current) return;

    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    const currentState = stateRef.current;
    setLoading(true);
    setActiveAgent('intent');
    setError('');

    try {
      const syncedState = await syncClientDiagramState({
        mermaidSource: currentState.mermaidSource,
        styleConfig: currentState.styleConfig
      });
      setState(syncedState);
      const result = await submitDiagramIntent({
        prompt,
        revisionId: syncedState.revisionId,
        mermaidSource: syncedState.mermaidSource,
        settings: {}
      });
      animateAcceptedSource(result.state);
      setChangePrompt('');
    } catch (err) {
      setError(err.message);
      setLoading(false);
      setActiveAgent(null);
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

  const busyHint = useMemo(() => {
    if (loading && activeAgent === 'coauthor') return 'Extending diagram…';
    if (loading && activeAgent === 'autofix') return 'Fixing syntax…';
    if (loading && activeAgent === 'intent') return 'Applying your change…';
    if (streamingPreview) return 'Streaming update…';
    return '';
  }, [activeAgent, loading, streamingPreview]);

  return (
    <div className="app-viewport">
      <div className="app-canvas-layer">
        <DiagramCanvas
          mermaidSource={state.mermaidSource}
          styleConfig={state.styleConfig}
          revisionId={state.revisionId}
          onManualEdit={handleManualEdit}
          onValidationChange={handleValidationChange}
          streamingPreview={streamingPreview}
          editorOpen={editorOpen}
        />
      </div>

      <header className="corner-overlay corner-tl">
        <span className="app-brand">MermaidGen</span>
      </header>

      <div className="corner-overlay corner-tr">
        <button
          type="button"
          className="overlay-btn"
          onClick={() => setEditorOpen((open) => !open)}
          aria-expanded={editorOpen}
        >
          {editorOpen ? 'Done' : 'Edit Code'}
        </button>
      </div>

      <div className="corner-overlay corner-bl">
        <form
          className="change-form"
          onSubmit={(event) => {
            event.preventDefault();
            runDescribeChange();
          }}
        >
          <input
            type="text"
            className="change-input"
            placeholder="Describe your Change"
            value={changePrompt}
            onChange={(event) => setChangePrompt(event.target.value)}
            disabled={loading || streamingPreview}
            aria-label="Describe your change"
          />
          <button type="submit" className="overlay-btn overlay-btn-primary" disabled={loading || streamingPreview}>
            Go
          </button>
        </form>
      </div>

      <div className="corner-overlay corner-br">
        <div className="surprise-stack" role="group" aria-label="Surprise intensity">
          <div className="surprise-levels">
            {SURPRISE_SCALE_LABELS.map((label, index) => {
              const value = index + 1;
              const selected = surpriseScale === value;
              return (
                <button
                  key={label}
                  type="button"
                  title={label}
                  className={`surprise-level${selected ? ' surprise-level-active' : ''}`}
                  aria-pressed={selected}
                  onClick={() => setSurpriseScale(value)}
                >
                  {value}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="overlay-btn surprise-me-btn"
            onClick={() => runCoAuthor()}
            disabled={loading || streamingPreview}
            aria-busy={loading && activeAgent === 'coauthor'}
          >
            {loading && activeAgent === 'coauthor' ? '…' : 'Surprise me'}
          </button>
        </div>
      </div>

      {busyHint ? (
        <div className="app-busy-banner" role="status" aria-live="polite">
          {busyHint}
        </div>
      ) : null}

      {error ? (
        <div className="app-error-toast" role="alert">
          <span>{error}</span>
          <button type="button" className="toast-dismiss" onClick={() => setError('')} aria-label="Dismiss error">
            ×
          </button>
        </div>
      ) : null}

      {validationError && !error ? (
        <div className={`app-validation-hint${autoFixAttempted ? ' is-stale' : ''}`} role="status" aria-live="polite">
          {autoFixAttempted
            ? `Could not auto-fix: ${validationError.error}`
            : 'Syntax issue — auto-fix shortly…'}
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  return <MermaidGenApp />;
}
