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
import {
  playCompletionChime as playCompletionChimeTone,
  playFailureChime,
  playStreamStartChime,
  playTokenTickChime,
  playToolEndChime,
  playToolStartChime
} from './utils/agentChimes.js';

const TOOL_LABELS = {
  get_diagram_state: 'Read diagram snapshot',
  apply_mermaid_patch: 'Apply diagram update'
};

function formatToolLabel(name) {
  if (!name) return 'Tool action';
  return TOOL_LABELS[name] ?? name.replaceAll('_', ' ');
}

const STREAM_DEBUG_LS_KEY = 'mermaid-architect-stream-debug';

function readStreamDebugEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.localStorage?.getItem(STREAM_DEBUG_LS_KEY) === '1') return true;
    const q = new URLSearchParams(window.location.search);
    return q.get('streamDebug') === '1';
  } catch {
    return false;
  }
}

function snapshotStreamEventForDebug(evt) {
  if (!evt || typeof evt !== 'object') return evt;
  if (evt.type === 'token' && typeof evt.text === 'string') {
    const t = evt.text;
    return { ...evt, text: t.length > 160 ? `${t.slice(0, 160)}…` : t };
  }
  if (evt.type === 'final' && evt.state && typeof evt.state === 'object') {
    return {
      ...evt,
      state: { revisionId: evt.state.revisionId, mermaidSource: '[omitted]' }
    };
  }
  return evt;
}

function focusPayload(node) {
  if (!node?.id) return undefined;
  return { id: node.id, label: node.label };
}

const MODEL_PROFILE_STORAGE_KEY = 'mermaid-architect:model-profile';

/** Default UI tier is Fast unless the user chose Quality and we persisted it. */
function readStoredModelProfile() {
  if (typeof window === 'undefined') return 'fast';
  const raw = window.localStorage.getItem(MODEL_PROFILE_STORAGE_KEY);
  return raw === 'quality' ? 'quality' : 'fast';
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

const SpeechRecognitionCtor = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

function ButtonIcon({ children }) {
  return (
    <span className="button-icon" aria-hidden="true">
      {children}
    </span>
  );
}

function MermaidMarkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14">
      <path d="M3 7h18l-4 5 4 5H3l4-5-4-5Z" fill="currentColor" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
      />
    </svg>
  );
}

function MicActiveIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path fill="currentColor" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
      <circle cx="12" cy="19" r="2" fill="currentColor" />
    </svg>
  );
}

function useSyncVisualViewportHeight() {
  useEffect(() => {
    const root = document.documentElement;

    function applyHeight() {
      const vv = window.visualViewport;
      const h = vv ? vv.height : window.innerHeight;
      root.style.setProperty('--app-vvh', `${Math.round(h)}px`);
    }

    applyHeight();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', applyHeight);
      vv.addEventListener('scroll', applyHeight);
      return () => {
        vv.removeEventListener('resize', applyHeight);
        vv.removeEventListener('scroll', applyHeight);
      };
    }

    window.addEventListener('resize', applyHeight);
    return () => window.removeEventListener('resize', applyHeight);
  }, []);
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
  const [soundEnabled, setSoundEnabled] = useState(cacheRef.current?.soundEnabled ?? true);
  const [modelProfile, setModelProfile] = useState(() => readStoredModelProfile());
  const [celebratingEntryId, setCelebratingEntryId] = useState(null);
  const [latestCritique, setLatestCritique] = useState(() => {
    const cachedCritique = cacheRef.current?.latestCritique;
    return cachedCritique?.text ? cachedCritique : null;
  });
  const [selectedNode, setSelectedNode] = useState(null);
  const [toolbarAnchor, setToolbarAnchor] = useState(null);
  const [voiceSupported] = useState(
    () =>
      Boolean(
        SpeechRecognitionCtor &&
          (typeof globalThis.isSecureContext === 'boolean' ? globalThis.isSecureContext : true)
      )
  );
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');

  const syncTimerRef = useRef(null);
  const streamTimerRef = useRef(null);
  const autoFixTimerRef = useRef(null);
  const stateRef = useRef(state);
  const lastAutoFixSourceRef = useRef(null);
  const autoFixAttemptedRef = useRef(false);
  const loadingRef = useRef(false);
  const streamingPreviewRef = useRef(false);
  const autoFixAlwaysOnRef = useRef(true);
  const hasInteractedRef = useRef(false);
  const audioContextRef = useRef(null);
  const celebrationTimerRef = useRef(null);
  const recognitionRef = useRef(null);
  const voicePressedRef = useRef(false);
  const lastSpeechInterimRef = useRef('');
  const voiceStopTimerRef = useRef(null);
  const promptRef = useRef('');
  const voiceCapturedAnyRef = useRef(false);
  const voiceAutoSubmitEnabledRef = useRef(false);
  /** Sync transcript for voice auto-submit (promptRef can lag behind React state). */
  const voiceAccumulatedRef = useRef('');
  const micSessionRef = useRef(0);
  const submitIntentFromVoiceRef = useRef(async (_text) => {});
  const lastTokenSoundAtRef = useRef(0);

  useSyncVisualViewportHeight();

  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

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
      insightsOpen,
      soundEnabled
    });
  }, [editorOpen, insightsEntries, insightsOpen, latestCritique, soundEnabled, state.mermaidSource]);

  useEffect(() => {
    try {
      window.localStorage.setItem(MODEL_PROFILE_STORAGE_KEY, modelProfile);
    } catch {
      // ignore quota / privacy mode
    }
  }, [modelProfile]);

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
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current);
      }
      if (voiceStopTimerRef.current) {
        clearTimeout(voiceStopTimerRef.current);
        voiceStopTimerRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current = null;
      }
    },
    []
  );

  const appendPromptText = useCallback((text) => {
    if (!text) return;
    setPrompt((current) => {
      const trimmed = text.trim();
      if (!trimmed) return current;
      const next = current ? `${current.trimEnd()} ${trimmed}` : trimmed;
      promptRef.current = next;
      return next;
    });
  }, []);

  const tryAgentSound = useCallback(
    (playFn) => {
      if (!soundEnabled || !hasInteractedRef.current) return;
      try {
        playFn(audioContextRef);
      } catch {
        // Ignore audio issues (autoplay restrictions, unsupported browser, etc).
      }
    },
    [soundEnabled]
  );

  const triggerCompletionDelight = useCallback(
    (entryId) => {
      setCelebratingEntryId(entryId);
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
      celebrationTimerRef.current = setTimeout(() => setCelebratingEntryId(null), 900);
      tryAgentSound(playCompletionChimeTone);
    },
    [tryAgentSound]
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
        updatedAt: nextState.updatedAt ?? previousState.updatedAt
      });
    }, 18);
  }, []);

  const appendInsightEntry = useCallback((title) => {
    const id = globalThis.crypto?.randomUUID?.() ?? `ins-${Date.now()}`;
    setInsightsEntries((prev) => [
      ...prev,
      {
        id,
        title,
        content: '',
        statusText: 'Working on your request...',
        status: 'running',
        technicalActions: [],
        phases: [],
        artifacts: [],
        streamDebugLog: [],
        startedAt: Date.now(),
        completedAt: null
      }
    ]);
    return id;
  }, []);

  const patchInsightEntry = useCallback((id, patcher) => {
    setInsightsEntries((prev) =>
      prev.map((entry) => (entry.id === id ? patcher(entry) : entry))
    );
  }, []);

  const appendToInsight = useCallback(
    (id, text) => {
      patchInsightEntry(id, (entry) => ({ ...entry, content: entry.content + text }));
    },
    [patchInsightEntry]
  );

  const setInsightStatus = useCallback(
    (id, statusText) => {
      patchInsightEntry(id, (entry) => ({ ...entry, statusText }));
    },
    [patchInsightEntry]
  );

  const appendTechnicalAction = useCallback(
    (id, name, status) => {
      patchInsightEntry(id, (entry) => {
        const current = Array.isArray(entry.technicalActions) ? entry.technicalActions : [];
        if (status === 'done') {
          const actionIndex = [...current].reverse().findIndex((action) => action.name === name && action.status === 'running');
          if (actionIndex >= 0) {
            const realIndex = current.length - 1 - actionIndex;
            const nextActions = current.map((action, idx) => (idx === realIndex ? { ...action, status: 'done' } : action));
            return { ...entry, technicalActions: nextActions };
          }
        }
        const actionId = globalThis.crypto?.randomUUID?.() ?? `act-${Date.now()}-${current.length}`;
        return {
          ...entry,
          technicalActions: [
            ...current,
            {
              id: actionId,
              name,
              label: formatToolLabel(name),
              status
            }
          ]
        };
      });
    },
    [patchInsightEntry]
  );

  const appendStreamDebugLog = useCallback(
    (id, evt) => {
      if (!readStreamDebugEnabled()) return;
      patchInsightEntry(id, (entry) => {
        const log = Array.isArray(entry.streamDebugLog) ? entry.streamDebugLog : [];
        const next = [...log, { ...snapshotStreamEventForDebug(evt), _ts: Date.now() }];
        return { ...entry, streamDebugLog: next.slice(-50) };
      });
    },
    [patchInsightEntry]
  );

  const runStreamingAgent = useCallback(
    async ({ operation, payload, title, onFinal }) => {
      setInsightsOpen(true);
      const sectionId = appendInsightEntry(title);
      tryAgentSound(playStreamStartChime);
      lastTokenSoundAtRef.current = 0;
      let streamedText = '';
      try {
        await streamDiagramAgent(payload, (evt) => {
          appendStreamDebugLog(sectionId, evt);
          if (evt.type === 'phase' && evt.id && evt.label) {
            patchInsightEntry(sectionId, (entry) => ({
              ...entry,
              phases: [...(Array.isArray(entry.phases) ? entry.phases : []), { id: evt.id, label: evt.label }]
            }));
          } else if (evt.type === 'artifact' && evt.kind === 'patch_summary') {
            patchInsightEntry(sectionId, (entry) => ({
              ...entry,
              artifacts: [
                ...(Array.isArray(entry.artifacts) ? entry.artifacts : []),
                {
                  kind: evt.kind,
                  revisionId: evt.revisionId,
                  linesAdded: evt.linesAdded,
                  linesRemoved: evt.linesRemoved
                }
              ]
            }));
          } else if (evt.type === 'token' && evt.text) {
            streamedText += evt.text;
            appendToInsight(sectionId, evt.text);
            const now = Date.now();
            if (now - lastTokenSoundAtRef.current >= 210) {
              lastTokenSoundAtRef.current = now;
              tryAgentSound(playTokenTickChime);
            }
          } else if (evt.type === 'status' && evt.text) {
            setInsightStatus(sectionId, evt.text);
          } else if (evt.type === 'tool_start' && evt.name) {
            appendTechnicalAction(sectionId, evt.name, 'running');
            tryAgentSound(playToolStartChime);
          } else if (evt.type === 'tool_end' && evt.name) {
            appendTechnicalAction(sectionId, evt.name, 'done');
            tryAgentSound(playToolEndChime);
          } else if (evt.type === 'error' && evt.message) {
            appendToInsight(sectionId, `\n\n**Error:** ${evt.message}\n\n`);
            tryAgentSound(playFailureChime);
            patchInsightEntry(sectionId, (entry) => ({
              ...entry,
              status: 'failed',
              statusText: 'Something failed. You can retry.',
              completedAt: Date.now()
            }));
          } else if (evt.type === 'final') {
            if (evt.revisionChanged && evt.state) {
              animateAcceptedSource(evt.state);
            }
            if (evt.message && operation !== 'analyze') {
              appendToInsight(sectionId, `\n\n— _${evt.message}_`);
            }
            patchInsightEntry(sectionId, (entry) => ({
              ...entry,
              status: 'done',
              statusText: 'Done',
              completedAt: Date.now()
            }));
            triggerCompletionDelight(sectionId);
            if (typeof onFinal === 'function') {
              const finalText =
                streamedText.trim() || (typeof evt.analyzeText === 'string' ? evt.analyzeText.trim() : '');
              onFinal({ evt, finalText });
            }
          }
        });
      } catch (err) {
        appendToInsight(sectionId, `\n\n**Error:** ${err.message}\n`);
        tryAgentSound(playFailureChime);
        patchInsightEntry(sectionId, (entry) => ({
          ...entry,
          status: 'failed',
          statusText: 'Something failed. You can retry.',
          completedAt: Date.now()
        }));
      }
    },
    [
      animateAcceptedSource,
      appendInsightEntry,
      appendStreamDebugLog,
      appendTechnicalAction,
      appendToInsight,
      patchInsightEntry,
      setInsightStatus,
      triggerCompletionDelight,
      tryAgentSound
    ]
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
          mermaidSource: syncedState.mermaidSource,
          settings: {},
          modelProfile
        });

        animateAcceptedSource(result.state);
      } catch (err) {
        setError(err.message);
        setLoading(false);
        setActiveRequest(null);
      }
    },
    [animateAcceptedSource, modelProfile]
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

    if (streamingPreview) {
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

  async function submitIntentWithPrompt(nextPrompt) {
    const trimmed = (nextPrompt ?? '').trim();
    if (!trimmed || loadingRef.current || streamingPreviewRef.current) return;

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
          prompt: trimmed,
          revisionId: syncedState.revisionId,
          mermaidSource: syncedState.mermaidSource,
          settings: {},
          focusNode,
          modelProfile
        },
        title: selectedNode ? `Go — node “${selectedNode.label || selectedNode.id}”` : 'Go — diagram'
      });
      setPrompt('');
      promptRef.current = '';
    } catch (err) {
      setError(err.message);
    } finally {
      setLatestCritique(null);
      setLoading(false);
      setActiveRequest(null);
    }
  }

  submitIntentFromVoiceRef.current = submitIntentWithPrompt;

  async function runIntentChange(event) {
    event.preventDefault();
    hasInteractedRef.current = true;
    await submitIntentWithPrompt(prompt.trim());
  }

  const stopVoiceInput = useCallback((options = {}) => {
    const immediate = Boolean(options.immediate);
    voicePressedRef.current = false;
    if (voiceStopTimerRef.current) {
      clearTimeout(voiceStopTimerRef.current);
      voiceStopTimerRef.current = null;
    }

    const recognition = recognitionRef.current;
    if (!recognition) {
      setVoiceListening(false);
      return;
    }

    if (immediate) {
      micSessionRef.current += 1;
      voiceAutoSubmitEnabledRef.current = false;
      lastSpeechInterimRef.current = '';
      try {
        recognition.abort();
      } catch {
        try {
          recognition.stop();
        } catch {
          // ignore
        }
      }
      try {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
      } catch {
        // ignore
      }
      recognitionRef.current = null;
      setVoiceListening(false);
      return;
    }

    const recInstance = recognition;
    voiceStopTimerRef.current = globalThis.setTimeout(() => {
      voiceStopTimerRef.current = null;
      if (recognitionRef.current !== recInstance) return;
      try {
        recInstance.stop();
      } catch {
        micSessionRef.current += 1;
        voiceAutoSubmitEnabledRef.current = false;
        const interimFlush = lastSpeechInterimRef.current?.trim();
        lastSpeechInterimRef.current = '';
        if (interimFlush) {
          voiceAccumulatedRef.current = voiceAccumulatedRef.current
            ? `${voiceAccumulatedRef.current.trimEnd()} ${interimFlush}`
            : interimFlush;
          appendPromptText(interimFlush);
        }
        try {
          recInstance.onresult = null;
          recInstance.onerror = null;
          recInstance.onend = null;
        } catch {
          // ignore
        }
        if (recognitionRef.current === recInstance) recognitionRef.current = null;
        setVoiceListening(false);
      }
    }, 220);
  }, [appendPromptText]);

  const startVoiceInput = useCallback(() => {
    if (!voiceSupported || loadingRef.current || streamingPreviewRef.current) return;
    if (voiceStopTimerRef.current) {
      clearTimeout(voiceStopTimerRef.current);
      voiceStopTimerRef.current = null;
    }

    const stale = recognitionRef.current;
    if (stale) {
      micSessionRef.current += 1;
      try {
        stale.abort();
      } catch {
        // ignore
      }
      stale.onresult = null;
      stale.onerror = null;
      stale.onend = null;
      recognitionRef.current = null;
    }

    micSessionRef.current += 1;
    const sessionAtStart = micSessionRef.current;
    voiceCapturedAnyRef.current = false;
    voiceAutoSubmitEnabledRef.current = true;
    voiceAccumulatedRef.current = promptRef.current.trim();

    hasInteractedRef.current = true;
    setVoiceError('');
    voicePressedRef.current = true;
    lastSpeechInterimRef.current = '';
    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0]?.transcript ?? '';
          if (transcript.trim()) voiceCapturedAnyRef.current = true;
          if (result.isFinal) {
            const trimmed = transcript.trim();
            if (trimmed) {
              voiceAccumulatedRef.current = voiceAccumulatedRef.current
                ? `${voiceAccumulatedRef.current.trimEnd()} ${trimmed}`
                : trimmed;
              appendPromptText(trimmed);
            }
            lastSpeechInterimRef.current = '';
          } else {
            lastSpeechInterimRef.current = transcript;
          }
        }
      };
      recognition.onerror = (event) => {
        if (event?.error === 'no-speech' || event?.error === 'aborted') return;
        voiceAutoSubmitEnabledRef.current = false;
        if (event?.error === 'not-allowed') {
          setVoiceError('Microphone permission denied for speech recognition.');
          return;
        }
        setVoiceError('Voice input failed. Try again.');
      };
      recognition.onend = () => {
        if (sessionAtStart !== micSessionRef.current) return;

        const interimFlush = lastSpeechInterimRef.current?.trim();
        lastSpeechInterimRef.current = '';
        if (interimFlush) {
          voiceCapturedAnyRef.current = true;
          voiceAccumulatedRef.current = voiceAccumulatedRef.current
            ? `${voiceAccumulatedRef.current.trimEnd()} ${interimFlush}`
            : interimFlush;
          appendPromptText(interimFlush);
        }

        try {
          recognition.onresult = null;
          recognition.onerror = null;
          recognition.onend = null;
        } catch {
          // ignore
        }
        if (recognitionRef.current === recognition) recognitionRef.current = null;

        globalThis.setTimeout(() => {
          if (sessionAtStart !== micSessionRef.current) return;
          if (!voiceAutoSubmitEnabledRef.current) return;
          const captured = voiceCapturedAnyRef.current;
          voiceAutoSubmitEnabledRef.current = false;
          const text = voiceAccumulatedRef.current.trim();
          if (!captured || !text || loadingRef.current || streamingPreviewRef.current) return;
          hasInteractedRef.current = true;
          void submitIntentFromVoiceRef.current(text);
        }, 0);

        setVoiceListening(false);
      };
      recognitionRef.current = recognition;
      recognition.start();
      setVoiceListening(true);
    } catch {
      micSessionRef.current += 1;
      voiceAutoSubmitEnabledRef.current = false;
      setVoiceError('Voice input is unavailable in this browser.');
      voicePressedRef.current = false;
    }
  }, [appendPromptText, voiceSupported]);

  function handleMicPointerDown(event) {
    if (!voiceSupported || loadingRef.current || streamingPreviewRef.current) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers reject capture on unsupported targets.
    }
    startVoiceInput();
  }

  function handleMicPointerUp(event) {
    try {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // ignore
    }
    stopVoiceInput();
  }

  async function runTransform(mode) {
    hasInteractedRef.current = true;
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
          focusNode,
          modelProfile
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
    hasInteractedRef.current = true;
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
          focusNode,
          modelProfile
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
    hasInteractedRef.current = true;
    if (!latestCritique?.text || loadingRef.current || streamingPreviewRef.current) return;

    setLoading(true);
    setActiveRequest('fix');
    setError('');

    const fixPrompt = `Improve the current Mermaid diagram based on this critique. Apply concrete fixes as a single complete diagram update.

Critique:
${latestCritique.text}

Requirements:
- Preserve the original intent and main flow.
- Prioritize readability and clarity improvements first.
- Output one full valid Mermaid diagram in a single apply step, then briefly summarize — do not iterate multiple cosmetic patches.
- Keep Mermaid syntax valid and deliver the entire diagram source in one go.`;

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
          focusNode: latestCritique.focusNode,
          modelProfile
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
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    stopVoiceInput({ immediate: true });
    setPrompt('');
    promptRef.current = '';
    setSelectedNode(null);
    setToolbarAnchor(null);
    setLatestCritique(null);
    setInsightsEntries([]);
    setError('');
    setVoiceError('');
    setValidationError(null);
    setAutoFixAttempted(false);
    autoFixAttemptedRef.current = false;
    lastAutoFixSourceRef.current = null;
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
  const agentThinkingChrome = useMemo(
    () => loading || insightsEntries.some((e) => (e.status ?? 'running') === 'running'),
    [loading, insightsEntries]
  );
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
    if (voiceError) return voiceError;
    if (validationError && autoFixAttempted) return `Mermaid syntax needs manual edit: ${validationError.error}`;
    return '';
  }, [activeRequest, autoFixAttempted, error, loading, streamingPreview, validationError, voiceError]);

  const streamDebugEnabled = readStreamDebugEnabled();

  const insightsSlot = insightsOpen ? (
    <InsightsPane
      entries={insightsEntries}
      soundEnabled={soundEnabled}
      onSoundEnabledChange={setSoundEnabled}
      celebratingEntryId={celebratingEntryId}
      streamDebugEnabled={streamDebugEnabled}
    />
  ) : null;

  return (
    <main
      className={`app-shell ${editorOpen ? 'is-editor-open' : ''} ${insightsOpen ? 'is-insights-open' : ''}`}
      aria-label="MermaidGen"
    >
      <DiagramCanvas
        revisionId={state.revisionId}
        mermaidSource={state.mermaidSource}
        onManualEdit={handleManualEdit}
        onValidationChange={handleValidationChange}
        streamingPreview={streamingPreview}
        agentThinking={agentThinkingChrome && !streamingPreview}
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
          className="corner-control node-toolbar-anchor node-actions-panel"
          style={{
            left: toolbarAnchor.left,
            top: toolbarAnchor.top
          }}
          role="dialog"
          aria-label="Node actions"
        >
          <div className="node-actions-panel-surface">
            <button
              type="button"
              className="overlay-button node-actions-panel-close"
              onClick={() => {
                setSelectedNode(null);
                setToolbarAnchor(null);
              }}
              aria-label="Close node actions"
            >
              <ButtonIcon>x</ButtonIcon>
            </button>
            <div className="node-actions-panel-body">
              <section className="node-actions-section" aria-label="Shape diagram">
                <span className="button-group-label node-actions-section-label">Shape</span>
                <div className="button-group node-actions-button-row">
                  <button type="button" className="overlay-button compact-button" disabled={busy} onClick={() => runTransform('refine')}>
                    <ButtonIcon>
                      <MermaidMarkIcon />
                    </ButtonIcon>
                    Refine
                  </button>
                  <button type="button" className="overlay-button compact-button" disabled={busy} onClick={() => runTransform('innovate')}>
                    <ButtonIcon>+</ButtonIcon>
                    Innovate
                  </button>
                  <button type="button" className="overlay-button compact-button" disabled={busy} onClick={() => runTransform('goMad')}>
                    <ButtonIcon>!</ButtonIcon>
                    Go Mad
                  </button>
                </div>
              </section>
              <section className="node-actions-section" aria-label="Read diagram">
                <span className="button-group-label node-actions-section-label">Read</span>
                <div className="button-group node-actions-button-row">
                  <button type="button" className="overlay-button compact-button" disabled={busy} onClick={() => runAnalyze('critique')}>
                    <ButtonIcon>?</ButtonIcon>
                    Critique
                  </button>
                  {latestCritique?.text ? (
                    <button type="button" className="overlay-button compact-button" disabled={!canFixFromCritique} onClick={handleFixFromCritique}>
                      <ButtonIcon>w</ButtonIcon>
                      Fix
                    </button>
                  ) : null}
                  <button type="button" className="overlay-button compact-button" disabled={busy} onClick={() => runAnalyze('explain')}>
                    <ButtonIcon>i</ButtonIcon>
                    Explain
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      <div className="corner-control brand-control" aria-label="MermaidGen">
        <span className="brand-mark" aria-hidden="true">
          <MermaidMarkIcon />
        </span>
        <span className="brand-name">MermaidGen</span>
      </div>

      <div className="corner-control edit-control">
        <button type="button" className="overlay-button" onClick={() => setEditorOpen((current) => !current)}>
          <ButtonIcon>{editorOpen ? 'x' : '</>'}</ButtonIcon>
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
            <button
              type="button"
              className={`overlay-button ${voiceListening ? 'is-listening' : ''}`}
              disabled={!voiceSupported || busy}
              onPointerDown={handleMicPointerDown}
              onPointerUp={handleMicPointerUp}
              onPointerCancel={handleMicPointerUp}
              onLostPointerCapture={() => stopVoiceInput()}
              onKeyDown={(event) => {
                if (event.repeat) return;
                if (event.key === ' ' || event.key === 'Enter') {
                  event.preventDefault();
                  startVoiceInput();
                }
              }}
              onKeyUp={(event) => {
                if (event.key === ' ' || event.key === 'Enter') {
                  event.preventDefault();
                  stopVoiceInput();
                }
              }}
              aria-label="Hold to speak"
              title={
                voiceSupported
                  ? 'Hold to dictate prompt'
                  : SpeechRecognitionCtor
                    ? 'Voice input needs a secure connection (HTTPS), except on localhost'
                    : 'Voice input not supported in this browser'
              }
            >
              <ButtonIcon>{voiceListening ? <MicActiveIcon /> : <MicIcon />}</ButtonIcon>
              Mic
            </button>
            {hasDiagramText ? (
              <button type="button" className="overlay-button" disabled={busy} onClick={() => handleClearDiagram()}>
                <ButtonIcon>x</ButtonIcon>
                Clear
              </button>
            ) : null}
            <button type="submit" className="overlay-button primary-button" disabled={busy || !prompt.trim()}>
              <ButtonIcon>{'>'}</ButtonIcon>
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
                <ButtonIcon>
                  <MermaidMarkIcon />
                </ButtonIcon>
                Refine
              </button>
              <button type="button" className="overlay-button compact-button" disabled={busy} onClick={() => runTransform('innovate')}>
                <ButtonIcon>+</ButtonIcon>
                Innovate
              </button>
              <button type="button" className="overlay-button compact-button" disabled={busy} onClick={() => runTransform('goMad')}>
                <ButtonIcon>!</ButtonIcon>
                Go Mad
              </button>
            </div>
            <span className="button-group-label">Read</span>
            <div className="button-group">
              <button type="button" className="overlay-button compact-button" disabled={busy} onClick={() => runAnalyze('critique')}>
                <ButtonIcon>?</ButtonIcon>
                Critique
              </button>
              {latestCritique?.text ? (
                <button type="button" className="overlay-button compact-button" disabled={!canFixFromCritique} onClick={handleFixFromCritique}>
                  <ButtonIcon>w</ButtonIcon>
                  Fix
                </button>
              ) : null}
              <button type="button" className="overlay-button compact-button" disabled={busy} onClick={() => runAnalyze('explain')}>
                <ButtonIcon>i</ButtonIcon>
                Explain
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="corner-control ai-corner-controls" aria-label="AI model and thinking">
        <div className="model-profile-toggle" role="group" aria-label="AI model profile">
          <span className="model-profile-label">Model</span>
          <div className="model-profile-segment">
            <button
              type="button"
              className={`model-profile-option ${modelProfile === 'fast' ? 'is-selected' : ''}`}
              aria-pressed={modelProfile === 'fast'}
              onClick={() => setModelProfile('fast')}
            >
              Fast
            </button>
            <button
              type="button"
              className={`model-profile-option ${modelProfile === 'quality' ? 'is-selected' : ''}`}
              aria-pressed={modelProfile === 'quality'}
              onClick={() => setModelProfile('quality')}
            >
              Quality
            </button>
          </div>
        </div>
        <button
          type="button"
          className={`overlay-button thinking-toggle-button ${agentThinkingChrome ? 'is-agent-active' : ''}`}
          onClick={() => setInsightsOpen((v) => !v)}
        >
          <ButtonIcon>{insightsOpen ? '-' : '+'}</ButtonIcon>
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
