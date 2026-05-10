import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DiagramCanvas from './components/DiagramCanvas.jsx';
import InsightsPane from './components/InsightsPane.jsx';
import {
  fallbackState,
  fetchDiagramState,
  readDiagramCache,
  streamDiagramAgent,
  syncClientDiagramState,
  submitDiagramIntent,
  writeDiagramCache
} from './state/diagramStore.js';
import './App.css';

function focusPayload(node) {
  if (!node?.id) return undefined;
  return { id: node.id, label: node.label };
}

function hydrateStateFromCache(cached) {
  if (!cached || typeof cached !== 'object') return fallbackState;
  const source = typeof cached.mermaidSource === 'string' ? cached.mermaidSource : fallbackState.mermaidSource;
  return {
    ...fallbackState,
    mermaidSource: source,
    updatedAt: new Date().toISOString()
  };
}

function MermaidArchitect() {
  const cacheRef = useRef(readDiagramCache());
  const [state, setState] = useState(() => hydrateStateFromCache(cacheRef.current));
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeRequest, setActiveRequest] = useState(null);
  const [error, setError] = useState('');
  const [streamingPreview, setStreamingPreview] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [autoFixAttempted, setAutoFixAttempted] = useState(false);
  const [editorOpen, setEditorOpen] = useState(Boolean(cacheRef.current?.editorOpen));
  const [insightsOpen, setInsightsOpen] = useState(Boolean(cacheRef.current?.insightsOpen));
  const [insightsEntries, setInsightsEntries] = useState(() =>
    Array.isArray(cacheRef.current?.insightsEntries) ? cacheRef.current.insightsEntries : []
  );
  const [latestCritique, setLatestCritique] = useState(() => {
    const cachedCritique = cacheRef.current?.latestCritique;
    return cachedCritique?.text ? cachedCritique : null;
  });
  const [selectedNode, setSelectedNode] = useState(null);
  const [toolbarAnchor, setToolbarAnchor] = useState(null);

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
        const cachedSource = cacheRef.current?.mermaidSource;
        if (typeof cachedSource === 'string') {
          setState({
            ...data,
            mermaidSource: cachedSource,
            updatedAt: new Date().toISOString()
          });
        } else {
          setState(data);
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    writeDiagramCache({
      mermaidSource: state.mermaidSource,
      insightsEntries,
      latestCritique,
      editorOpen,
      insightsOpen
    });
  }, [editorOpen, insightsEntries, insightsOpen, latestCritique, state.mermaidSource]);

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

  const appendInsightEntry = useCallback((title) => {
    const id = globalThis.crypto?.randomUUID?.() ?? `ins-${Date.now()}`;
    setInsightsEntries((prev) => [...prev, { id, title, content: '' }]);
    return id;
  }, []);

  const appendToInsight = useCallback((id, text) => {
    setInsightsEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, content: entry.content + text } : entry))
    );
  }, []);

  const runStreamingAgent = useCallback(
    async ({ operation, payload, title, onFinal }) => {
      setInsightsOpen(true);
      const sectionId = appendInsightEntry(title);
      let streamedText = '';
      try {
        await streamDiagramAgent(payload, (evt) => {
          if (evt.type === 'token' && evt.text) {
            streamedText += evt.text;
            appendToInsight(sectionId, evt.text);
          }
          else if (evt.type === 'status' && evt.text) appendToInsight(sectionId, `\n\n_${evt.text}_\n\n`);
          else if (evt.type === 'tool_start' && evt.name) appendToInsight(sectionId, `\n→ ${evt.name} …\n`);
          else if (evt.type === 'tool_end' && evt.name) appendToInsight(sectionId, `\n← ${evt.name}\n`);
          else if (evt.type === 'error' && evt.message) appendToInsight(sectionId, `\n\n**Error:** ${evt.message}\n\n`);
          else if (evt.type === 'final') {
            if (evt.revisionChanged && evt.state) {
              animateAcceptedSource(evt.state);
            }
            if (evt.message && operation !== 'analyze') {
              appendToInsight(sectionId, `\n\n— _${evt.message}_`);
            }
            if (typeof onFinal === 'function') {
              const finalText =
                streamedText.trim() || (typeof evt.analyzeText === 'string' ? evt.analyzeText.trim() : '');
              onFinal({ evt, finalText });
            }
          }
        });
      } catch (err) {
        appendToInsight(sectionId, `\n\n**Error:** ${err.message}\n`);
      }
    },
    [animateAcceptedSource, appendInsightEntry, appendToInsight]
  );

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
    setState((currentState) => {
      const nextState = {
        ...currentState,
        mermaidSource: nextSource,
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
          mermaidSource: nextSource
        });
        setState(synced);
      } catch {
        // Local editing stays responsive even when background sync is unavailable.
      }
    }, 350);
  }

  async function syncDiagramOrThrow() {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    const currentState = stateRef.current;
    const syncedState = await syncClientDiagramState({
      mermaidSource: currentState.mermaidSource
    });
    setState(syncedState);
    return syncedState;
  }

  async function runIntentChange(event) {
    event.preventDefault();
    const nextPrompt = prompt.trim();
    if (!nextPrompt || loadingRef.current || streamingPreviewRef.current) return;

    const focusNode = focusPayload(selectedNode);
    setLoading(true);
    setActiveRequest('intent');
    setError('');

    try {
      const syncedState = await syncDiagramOrThrow();
      await runStreamingAgent({
        operation: 'intent',
        payload: {
          operation: 'intent',
          prompt: nextPrompt,
          revisionId: syncedState.revisionId,
          mermaidSource: syncedState.mermaidSource,
          settings: {},
          focusNode
        },
        title: selectedNode ? `Go — node “${selectedNode.label || selectedNode.id}”` : 'Go — diagram'
      });
      setPrompt('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLatestCritique(null);
      setLoading(false);
      setActiveRequest(null);
    }
  }

  async function runTransform(mode) {
    if (loadingRef.current || streamingPreviewRef.current) return;
    if (!stateRef.current.mermaidSource.trim()) return;

    const focusNode = focusPayload(selectedNode);
    setLoading(true);
    setActiveRequest(`transform:${mode}`);
    setError('');

    try {
      const syncedState = await syncDiagramOrThrow();
      const labels = { refine: 'Refine', innovate: 'Innovate', goMad: 'Go Mad' };
      await runStreamingAgent({
        operation: 'transform',
        payload: {
          operation: 'transform',
          mode,
          revisionId: syncedState.revisionId,
          mermaidSource: syncedState.mermaidSource,
          focusNode
        },
        title: selectedNode
          ? `${labels[mode]} — node “${selectedNode.label || selectedNode.id}”`
          : `${labels[mode]} — diagram`
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setActiveRequest(null);
    }
  }

  async function runAnalyze(kind) {
    if (loadingRef.current || streamingPreviewRef.current) return;
    if (!stateRef.current.mermaidSource.trim()) return;

    const focusNode = focusPayload(selectedNode);
    setLoading(true);
    setActiveRequest(`analyze:${kind}`);
    setError('');

    try {
      const syncedState = await syncDiagramOrThrow();
      const labels = { critique: 'Critique', explain: 'Explain' };
      await runStreamingAgent({
        operation: 'analyze',
        payload: {
          operation: 'analyze',
          kind,
          revisionId: syncedState.revisionId,
          mermaidSource: syncedState.mermaidSource,
          focusNode
        },
        title: selectedNode
          ? `${labels[kind]} — node “${selectedNode.label || selectedNode.id}”`
          : `${labels[kind]} — diagram`,
        onFinal: ({ finalText }) => {
          if (kind !== 'critique') return;
          const cleaned = finalText.trim();
          if (!cleaned) return;
          setLatestCritique({
            text: cleaned,
            focusNode,
            createdAt: Date.now()
          });
        }
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setActiveRequest(null);
    }
  }

  async function handleFixFromCritique() {
    if (!latestCritique?.text || loadingRef.current || streamingPreviewRef.current) return;

    setLoading(true);
    setActiveRequest('fix');
    setError('');

    const fixPrompt = `Improve the current Mermaid diagram based on this critique. Apply concrete fixes directly to the diagram with apply_mermaid_patch.

Critique:
${latestCritique.text}

Requirements:
- Preserve the original intent and main flow.
- Prioritize readability and clarity improvements first.
- Keep Mermaid syntax valid and output a complete diagram.`;

    try {
      const syncedState = await syncDiagramOrThrow();
      await runStreamingAgent({
        operation: 'intent',
        payload: {
          operation: 'intent',
          prompt: fixPrompt,
          revisionId: syncedState.revisionId,
          mermaidSource: syncedState.mermaidSource,
          settings: {},
          focusNode: latestCritique.focusNode
        },
        title: latestCritique.focusNode
          ? `Fix from critique — node “${latestCritique.focusNode.label || latestCritique.focusNode.id}”`
          : 'Fix from critique — diagram'
      });
      setLatestCritique(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setActiveRequest(null);
    }
  }

  async function handleClearDiagram() {
    if (loadingRef.current || streamingPreviewRef.current) return;
    setSelectedNode(null);
    setToolbarAnchor(null);
    setLatestCritique(null);
    setError('');
    setLoading(true);
    setActiveRequest('clear');
    try {
      const synced = await syncClientDiagramState({
        mermaidSource: ''
      });
      setState(synced);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setActiveRequest(null);
    }
  }

  const busy = loading || streamingPreview;
  const hasDiagramText = Boolean(state.mermaidSource?.trim());
  const canFixFromCritique = Boolean(latestCritique?.text) && !busy;

  const status = useMemo(() => {
    if (loading && activeRequest === 'intent') return 'Applying diagram change.';
    if (loading && activeRequest?.startsWith?.('transform')) return 'Transforming diagram.';
    if (loading && activeRequest?.startsWith?.('analyze')) return 'Analyzing diagram.';
    if (loading && activeRequest === 'fix') return 'Applying critique fixes.';
    if (loading && activeRequest === 'clear') return 'Resetting diagram.';
    if (loading && activeRequest === 'autofix') return 'Fixing Mermaid syntax.';
    if (streamingPreview) return 'Refreshing diagram.';
    if (error) return error;
    if (validationError && autoFixAttempted) return `Mermaid syntax needs manual edit: ${validationError.error}`;
    return '';
  }, [activeRequest, autoFixAttempted, error, loading, streamingPreview, validationError]);

  const insightsSlot = insightsOpen ? (
    <InsightsPane entries={insightsEntries} onClose={() => setInsightsOpen(false)} />
  ) : null;

  return (
    <main
      className={`app-shell ${editorOpen ? 'is-editor-open' : ''} ${insightsOpen ? 'is-insights-open' : ''}`}
      aria-label="MermaidGen"
    >
      <DiagramCanvas
        mermaidSource={state.mermaidSource}
        onManualEdit={handleManualEdit}
        onValidationChange={handleValidationChange}
        streamingPreview={streamingPreview}
        editorOpen={editorOpen}
        insightsOpen={insightsOpen && Boolean(insightsSlot)}
        insightsSlot={insightsSlot}
        selectedNode={selectedNode}
        onSelectedNodeChange={(next) => {
          setSelectedNode(next);
          if (!next) setToolbarAnchor(null);
        }}
        onNodeToolbarAnchor={setToolbarAnchor}
      />

      {toolbarAnchor && selectedNode ? (
        <div
          className="corner-control node-toolbar-anchor"
          style={{
            left: toolbarAnchor.left,
            top: toolbarAnchor.top
          }}
          role="toolbar"
          aria-label="Actions for selected node"
        >
          <div className="prompt-actions node-toolbar-actions">
            <span className="button-group-label">Shape</span>
            <div className="button-group">
              <button type="button" className="overlay-button compact-button" disabled={busy} onClick={() => runTransform('refine')}>
                Refine
              </button>
              <button type="button" className="overlay-button compact-button" disabled={busy} onClick={() => runTransform('innovate')}>
                Innovate
              </button>
              <button type="button" className="overlay-button compact-button" disabled={busy} onClick={() => runTransform('goMad')}>
                Go Mad
              </button>
            </div>
            <span className="button-group-label">Read</span>
            <div className="button-group">
              <button type="button" className="overlay-button compact-button" disabled={busy} onClick={() => runAnalyze('critique')}>
                Critique
              </button>
              {latestCritique?.text ? (
                <button type="button" className="overlay-button compact-button" disabled={!canFixFromCritique} onClick={handleFixFromCritique}>
                  Fix
                </button>
              ) : null}
              <button type="button" className="overlay-button compact-button" disabled={busy} onClick={() => runAnalyze('explain')}>
                Explain
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="corner-control brand-control" aria-label="MermaidGen brand">
        MermaidGen
      </div>

      <div className="corner-control edit-control">
        <button type="button" className="overlay-button" onClick={() => setEditorOpen((current) => !current)}>
          {editorOpen ? 'Close Code' : 'Edit Code'}
        </button>
      </div>

      <div className="corner-control prompt-stack">
        <form className="prompt-control" onSubmit={runIntentChange}>
          <label className="sr-only" htmlFor="diagram-change-prompt">
            Set the Topic, Describe Your Change
          </label>
          <input
            id="diagram-change-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Set the Topic, Describe Your Change"
            disabled={busy}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={status ? 'app-status' : undefined}
          />
          <div className="prompt-actions-main">
            <button type="button" className="overlay-button" disabled={busy} onClick={() => handleClearDiagram()}>
              Clear
            </button>
            <button type="submit" className="overlay-button primary-button" disabled={busy || !prompt.trim()}>
              Go
            </button>
          </div>
          {status ? (
            <p id="app-status" className={`overlay-status ${error ? 'is-error' : ''}`} role="status">
              {status}
            </p>
          ) : null}
        </form>

        {hasDiagramText ? (
          <div className="prompt-actions">
            <span className="button-group-label">Shape</span>
            <div className="button-group">
              <button type="button" className="overlay-button compact-button" disabled={busy} onClick={() => runTransform('refine')}>
                Refine
              </button>
              <button type="button" className="overlay-button compact-button" disabled={busy} onClick={() => runTransform('innovate')}>
                Innovate
              </button>
              <button type="button" className="overlay-button compact-button" disabled={busy} onClick={() => runTransform('goMad')}>
                Go Mad
              </button>
            </div>
            <span className="button-group-label">Read</span>
            <div className="button-group">
              <button type="button" className="overlay-button compact-button" disabled={busy} onClick={() => runAnalyze('critique')}>
                Critique
              </button>
              {latestCritique?.text ? (
                <button type="button" className="overlay-button compact-button" disabled={!canFixFromCritique} onClick={handleFixFromCritique}>
                  Fix
                </button>
              ) : null}
              <button type="button" className="overlay-button compact-button" disabled={busy} onClick={() => runAnalyze('explain')}>
                Explain
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="corner-control thinking-control">
        <button type="button" className="overlay-button" onClick={() => setInsightsOpen((v) => !v)}>
          {insightsOpen ? 'Hide Thinking' : 'Show Thinking'}
        </button>
      </div>
    </main>
  );
}

function App() {
  return <MermaidArchitect />;
}

export default App;
