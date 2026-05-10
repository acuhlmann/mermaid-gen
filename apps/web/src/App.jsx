import { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  playGoMadCompletionChime,
  playGoMadStreamStart,
  playGoMadTokenTick,
  playInnovateStreamStart,
  playRefineStreamStart,
  playStreamStartChime,
  playTokenTickChime,
  playToolEndChime,
  playToolStartChime
} from './utils/agentChimes.js';
import { splitCritiqueActionableSections } from './utils/critiqueActionable.js';
import { collapseConsecutiveApplyPatchActions } from './utils/collapsePatchTechnicalActions.js';
import { diffMermaidFlowcharts } from './utils/mermaidFlowchartDiff.js';

const TOOL_LABELS = {
  get_diagram_state: 'Read diagram snapshot',
  apply_mermaid_patch: 'Apply diagram update'
};

function formatToolLabel(name, repeatCount = 1) {
  if (!name) return 'Tool action';
  const base = TOOL_LABELS[name] ?? name.replaceAll('_', ' ');
  if (name === 'apply_mermaid_patch' && repeatCount > 1) {
    const shown = Math.min(repeatCount, 3);
    return `${base} (×${shown})`;
  }
  return base;
}

const STREAM_DEBUG_LS_KEY = 'mermaid-architect-stream-debug';

const NODE_PANEL_EDGE_MARGIN = 12;
const NODE_PANEL_NODE_GAP = 10;
const NODE_ACTIONS_IDLE_MS = 8000;
/** Auto-show diagram diff highlights after the final SVG for an agent-applied revision is on screen. */
const AUTO_DIAGRAM_CHANGE_HIGHLIGHT_MS = 7000;
/** Avoid keeping a stale render handshake armed forever if the SVG never confirms. */
const AUTO_DIAGRAM_CHANGE_HIGHLIGHT_PENDING_TIMEOUT_MS = 10000;
/** Revision-changing agent variants that should auto-show change highlights. */
const AUTO_DIAGRAM_HIGHLIGHT_VARIANTS = new Set(['intent', 'refine', 'innovate', 'goMad']);

function getVisualViewportBounds() {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  if (vv) {
    const left = vv.offsetLeft;
    const top = vv.offsetTop;
    return {
      left,
      top,
      right: left + vv.width,
      bottom: top + vv.height
    };
  }
  if (typeof window !== 'undefined') {
    return {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight
    };
  }
  return { left: 0, top: 0, right: 0, bottom: 0 };
}

function computeNodePanelPlacement(toolbarAnchor, panelWidth, panelHeight, vv) {
  const margin = NODE_PANEL_EDGE_MARGIN;
  const gap = NODE_PANEL_NODE_GAP;
  const height = panelHeight;
  const width = panelWidth;
  const anchorLeft = toolbarAnchor.left;
  const anchorTopBelow = toolbarAnchor.top;

  let finalTop = anchorTopBelow;
  const bottomIfBelow = anchorTopBelow + height;
  if (bottomIfBelow > vv.bottom - margin) {
    finalTop = toolbarAnchor.nodeTop - gap - height;
  }
  if (finalTop < vv.top + margin) {
    finalTop = vv.top + margin;
  }
  if (finalTop + height > vv.bottom - margin) {
    finalTop = vv.bottom - margin - height;
  }

  let nudgeX = 0;
  let rightEdge = anchorLeft + nudgeX + width / 2;
  if (rightEdge > vv.right - margin) {
    nudgeX -= rightEdge - (vv.right - margin);
  }
  let leftEdge = anchorLeft + nudgeX - width / 2;
  if (leftEdge < vv.left + margin) {
    nudgeX += vv.left + margin - leftEdge;
  }

  return { top: finalTop, nudgeX };
}

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
  if (node.kind === 'edge' && node.edgeFrom && node.edgeTo) {
    return {
      id: node.id,
      label: node.label,
      selectionKind: 'edge',
      edgeFrom: node.edgeFrom,
      edgeTo: node.edgeTo
    };
  }
  return {
    id: node.id,
    label: node.label,
    ...(node.kind === 'cluster' ? { selectionKind: 'cluster' } : { selectionKind: 'node' }),
    ...(node.dataId ? { dataId: node.dataId } : {})
  };
}

/** Works with diagram canvas selection (`kind`) or API focus payloads (`selectionKind`). */
/** Button label for repeated Go Mad (streak = completed Go Mad count since last reset). */
function goMadShapeLabel(streak) {
  if (streak <= 0) return 'Go Mad';
  if (streak === 1) return 'Go Madder';
  if (streak === 2) return 'Go Maddest';
  return 'Max madness';
}

function selectionActionTitle(selectionLike, verbLabel) {
  if (!selectionLike) return `${verbLabel} — diagram`;
  const edgeLike =
    selectionLike.kind === 'edge' ||
    (selectionLike.selectionKind === 'edge' && selectionLike.edgeFrom && selectionLike.edgeTo);
  if (edgeLike) {
    return `${verbLabel} — edge ${selectionLike.edgeFrom} → ${selectionLike.edgeTo}`;
  }
  const clusterLike = selectionLike.kind === 'cluster' || selectionLike.selectionKind === 'cluster';
  if (clusterLike) {
    return `${verbLabel} — subgraph “${selectionLike.label || selectionLike.id}”`;
  }
  return `${verbLabel} — node “${selectionLike.label || selectionLike.id}”`;
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
  const [diagramChangeHighlightEntryId, setDiagramChangeHighlightEntryId] = useState(null);
  /** Auto pulse focuses on newly added nodes; manual "Highlight changes" shows full diff. */
  const [diagramChangeHighlightAddedOnly, setDiagramChangeHighlightAddedOnly] = useState(false);
  const [latestCritique, setLatestCritique] = useState(() => {
    const cachedCritique = cacheRef.current?.latestCritique;
    return cachedCritique?.text ? cachedCritique : null;
  });
  const [critiqueActionableSelected, setCritiqueActionableSelected] = useState([]);
  /** Successful consecutive Go Mad transforms; resets after Refine/Innovate/Intent/Clear/fix-from-critique. */
  const [goMadStreak, setGoMadStreak] = useState(0);
  const [selectedNode, setSelectedNode] = useState(null);
  const [toolbarAnchor, setToolbarAnchor] = useState(null);
  const [nodePanelPlacement, setNodePanelPlacement] = useState(null);
  const [viewportClampEpoch, setViewportClampEpoch] = useState(0);
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
  /** AbortController for in-flight `streamDiagramAgent` (Thinking panel / transforms). */
  const streamAgentAbortRef = useRef(null);
  const autoFixTimerRef = useRef(null);
  const stateRef = useRef(state);
  const lastAutoFixSourceRef = useRef(null);
  /** Mirrors latest client-side Mermaid render validation (debounced in DiagramCanvas). */
  const clientValidationRef = useRef({ source: null, error: null });
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
  const goMadTokenTickIndexRef = useRef(0);
  const nodeActionsPanelRef = useRef(null);
  const nodePanelIdleTimerRef = useRef(null);
  const diagramAutoHighlightTimerRef = useRef(null);
  /** Until SVG renders, { entryId, revisionId } — arms highlights via `onDiagramSvgRendered`. */
  const pendingAutoDiagramHighlightRef = useRef(null);
  /** Watchdog that clears stale pending highlights if the SVG-render handshake never matches. */
  const pendingAutoDiagramHighlightTimeoutRef = useRef(null);
  /** Forward ref so the streaming `final` callback can call the latest arm fn without dep churn. */
  const armAutoDiagramChangeHighlightRef = useRef(null);

  const clearPendingAutoDiagramHighlight = useCallback(() => {
    pendingAutoDiagramHighlightRef.current = null;
    if (pendingAutoDiagramHighlightTimeoutRef.current != null) {
      window.clearTimeout(pendingAutoDiagramHighlightTimeoutRef.current);
      pendingAutoDiagramHighlightTimeoutRef.current = null;
    }
  }, []);

  useSyncVisualViewportHeight();

  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  useEffect(() => {
    if (!latestCritique?.text) {
      setCritiqueActionableSelected([]);
      return;
    }
    const { items } = splitCritiqueActionableSections(latestCritique.text);
    setCritiqueActionableSelected(items.map(() => false));
  }, [latestCritique?.createdAt, latestCritique?.text]);

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
      if (streamTimerRef.current != null) {
        cancelAnimationFrame(streamTimerRef.current);
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
      if (nodePanelIdleTimerRef.current != null) {
        window.clearTimeout(nodePanelIdleTimerRef.current);
        nodePanelIdleTimerRef.current = null;
      }
      if (diagramAutoHighlightTimerRef.current != null) {
        window.clearTimeout(diagramAutoHighlightTimerRef.current);
        diagramAutoHighlightTimerRef.current = null;
      }
      if (pendingAutoDiagramHighlightTimeoutRef.current != null) {
        window.clearTimeout(pendingAutoDiagramHighlightTimeoutRef.current);
        pendingAutoDiagramHighlightTimeoutRef.current = null;
      }
      pendingAutoDiagramHighlightRef.current = null;
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
    (entryId, variant = 'general') => {
      setCelebratingEntryId(entryId);
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
      const dwellMs = variant === 'goMad' ? 1100 : 900;
      celebrationTimerRef.current = setTimeout(() => setCelebratingEntryId(null), dwellMs);
      if (variant === 'goMad') tryAgentSound(playGoMadCompletionChime);
      else tryAgentSound(playCompletionChimeTone);
    },
    [tryAgentSound]
  );

  const animateAcceptedSource = useCallback((nextState, onFullyApplied, opts = {}) => {
    const previousState = stateRef.current;
    const nextSource = nextState.mermaidSource;

    if (streamTimerRef.current != null) {
      cancelAnimationFrame(streamTimerRef.current);
      streamTimerRef.current = null;
    }

    if (previousState.revisionId === nextState.revisionId || previousState.mermaidSource === nextSource) {
      setState(nextState);
      setStreamingPreview(false);
      setLoading(false);
      setActiveRequest(null);
      queueMicrotask(() => onFullyApplied?.());
      return;
    }

    const reduceMotion =
      typeof globalThis.matchMedia === 'function' &&
      globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      setState(nextState);
      setStreamingPreview(false);
      setLoading(false);
      setActiveRequest(null);
      queueMicrotask(() => onFullyApplied?.());
      return;
    }

    /** Fewer steps than legacy ÷90 so acceptance finishes sooner; Go Mad uses even fewer (heavy agents). */
    const stepBudget = opts.denseSteps ? 26 : 40;
    const chunkSize = Math.max(1, Math.ceil(nextSource.length / stepBudget));
    let cursor = 0;

    setStreamingPreview(true);

    function pump() {
      cursor = Math.min(nextSource.length, cursor + chunkSize);
      if (cursor >= nextSource.length) {
        streamTimerRef.current = null;
        setState(nextState);
        setStreamingPreview(false);
        setLoading(false);
        setActiveRequest(null);
        queueMicrotask(() => onFullyApplied?.());
        return;
      }

      startTransition(() => {
        setState((prev) => {
          const slice = nextSource.slice(0, cursor);
          if (prev.mermaidSource === slice && prev.revisionId === nextState.revisionId) {
            return prev;
          }
          return {
            ...nextState,
            mermaidSource: slice,
            updatedAt: nextState.updatedAt ?? previousState.updatedAt
          };
        });
      });

      streamTimerRef.current = requestAnimationFrame(pump);
    }

    streamTimerRef.current = requestAnimationFrame(pump);
  }, []);

  const appendInsightEntry = useCallback((title, variant = 'general', options = {}) => {
    const { diagramUndoBaseline } = options;
    const id = globalThis.crypto?.randomUUID?.() ?? `ins-${Date.now()}`;
    setInsightsEntries((prev) => [
      ...prev,
      {
        id,
        title,
        variant,
        content: '',
        statusText: 'Working on your request...',
        status: 'running',
        technicalActions: [],
        phases: [],
        artifacts: [],
        streamDebugLog: [],
        startedAt: Date.now(),
        completedAt: null,
        ...(diagramUndoBaseline
          ? {
              diagramUndoBaseline: { ...diagramUndoBaseline },
              diagramRevisionApplied: false,
              diagramUndoConsumed: false
            }
          : {})
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
            return {
              ...entry,
              technicalActions: collapseConsecutiveApplyPatchActions(nextActions, formatToolLabel)
            };
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

  const stopStreamingAgentRequest = useCallback(() => {
    streamAgentAbortRef.current?.abort();
  }, []);

  const runStreamingAgent = useCallback(
    async ({ operation, payload, title, onFinal, variant = 'general', diagramUndoBaseline }) => {
      setInsightsOpen(true);
      const sectionId = appendInsightEntry(title, variant, { diagramUndoBaseline });
      if (variant === 'goMad') tryAgentSound(playGoMadStreamStart);
      else if (variant === 'innovate') tryAgentSound(playInnovateStreamStart);
      else if (variant === 'refine') tryAgentSound(playRefineStreamStart);
      else tryAgentSound(playStreamStartChime);
      lastTokenSoundAtRef.current = 0;
      goMadTokenTickIndexRef.current = 0;
      let streamedText = '';
      const abortCtrl = new AbortController();
      streamAgentAbortRef.current = abortCtrl;
      try {
        await streamDiagramAgent(
          payload,
          (evt) => {
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
            const reduceMotion =
              typeof globalThis.matchMedia === 'function' &&
              globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const goMadDense = variant === 'goMad' && !reduceMotion;
            const minGapMs = goMadDense ? 140 : 210;
            if (now - lastTokenSoundAtRef.current >= minGapMs) {
              lastTokenSoundAtRef.current = now;
              if (goMadDense) {
                const idx = goMadTokenTickIndexRef.current;
                goMadTokenTickIndexRef.current = idx + 1;
                tryAgentSound((ctx) => playGoMadTokenTick(ctx, idx));
              } else {
                tryAgentSound(playTokenTickChime);
              }
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
            if (variant === 'goMad' && evt.revisionChanged) {
              setGoMadStreak((s) => s + 1);
            }
            if (evt.revisionChanged && evt.state) {
              const shouldAutoHighlight =
                Boolean(diagramUndoBaseline) && AUTO_DIAGRAM_HIGHLIGHT_VARIANTS.has(variant);
              animateAcceptedSource(
                evt.state,
                shouldAutoHighlight
                  ? () => {
                      pendingAutoDiagramHighlightRef.current = {
                        entryId: sectionId,
                        revisionId: evt.state.revisionId
                      };
                      if (pendingAutoDiagramHighlightTimeoutRef.current != null) {
                        window.clearTimeout(pendingAutoDiagramHighlightTimeoutRef.current);
                      }
                      pendingAutoDiagramHighlightTimeoutRef.current = window.setTimeout(() => {
                        pendingAutoDiagramHighlightTimeoutRef.current = null;
                        const stillPending = pendingAutoDiagramHighlightRef.current;
                        if (!stillPending || stillPending.entryId !== sectionId) return;
                        pendingAutoDiagramHighlightRef.current = null;
                      }, AUTO_DIAGRAM_CHANGE_HIGHLIGHT_PENDING_TIMEOUT_MS);
                    }
                  : undefined,
                { denseSteps: variant === 'goMad' }
              );
            }
            if (evt.message && operation !== 'analyze') {
              appendToInsight(sectionId, `\n\n— _${evt.message}_`);
            }
            patchInsightEntry(sectionId, (entry) => ({
              ...entry,
              status: 'done',
              statusText: 'Done',
              completedAt: Date.now(),
              ...(evt.revisionChanged && evt.state && entry.diagramUndoBaseline
                ? { diagramRevisionApplied: true }
                : {})
            }));
            triggerCompletionDelight(sectionId, variant);
            if (typeof onFinal === 'function') {
              const finalText =
                streamedText.trim() || (typeof evt.analyzeText === 'string' ? evt.analyzeText.trim() : '');
              onFinal({ evt, finalText });
            }
          }
        },
          { signal: abortCtrl.signal }
        );
      } catch (err) {
        const aborted =
          err?.name === 'AbortError' ||
          (typeof DOMException !== 'undefined' &&
            err instanceof DOMException &&
            err.name === 'AbortError');
        if (aborted) {
          patchInsightEntry(sectionId, (entry) => ({
            ...entry,
            status: 'cancelled',
            statusText: 'Stopped.',
            completedAt: Date.now()
          }));
        } else {
          appendToInsight(sectionId, `\n\n**Error:** ${err.message}\n`);
          tryAgentSound(playFailureChime);
          patchInsightEntry(sectionId, (entry) => ({
            ...entry,
            status: 'failed',
            statusText: 'Something failed. You can retry.',
            completedAt: Date.now()
          }));
        }
      } finally {
        if (streamAgentAbortRef.current === abortCtrl) {
          streamAgentAbortRef.current = null;
        }
      }
    },
    [
      animateAcceptedSource,
      appendInsightEntry,
      appendStreamDebugLog,
      appendTechnicalAction,
      appendToInsight,
      patchInsightEntry,
      setGoMadStreak,
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
    clientValidationRef.current = nextError ? { source, error: nextError } : { source: null, error: null };
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
    let scheduledSource = null;

    setState((currentState) => {
      if (nextSource === currentState.mermaidSource) {
        return currentState;
      }
      scheduledSource = nextSource;
      const nextState = {
        ...currentState,
        mermaidSource: nextSource,
        updatedAt: new Date().toISOString()
      };
      stateRef.current = nextState;
      return nextState;
    });

    if (!scheduledSource) {
      return;
    }

    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }

    syncTimerRef.current = setTimeout(async () => {
      const cv = clientValidationRef.current;
      if (cv.error && cv.source === scheduledSource) {
        return;
      }
      try {
        const synced = await syncClientDiagramState({
          mermaidSource: scheduledSource
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

    setGoMadStreak(0);
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
        title: selectionActionTitle(selectedNode, 'Go'),
        variant: 'intent',
        diagramUndoBaseline: { ...syncedState }
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

    if (mode !== 'goMad') setGoMadStreak(0);

    const focusNode = focusPayload(selectedNode);
    setLoading(true);
    setActiveRequest(`transform:${mode}`);
    setError('');

    try {
      const syncedState = await syncDiagramOrThrow();
      const labels = { refine: 'Refine', innovate: 'Innovate', goMad: 'Go Mad' };
      const goMadDepth = mode === 'goMad' ? goMadStreak + 1 : undefined;
      const transformTitleVerb =
        mode === 'goMad' && goMadDepth > 1 ? `Go Mad (×${goMadDepth})` : labels[mode];
      await runStreamingAgent({
        operation: 'transform',
        payload: {
          operation: 'transform',
          mode,
          revisionId: syncedState.revisionId,
          mermaidSource: syncedState.mermaidSource,
          focusNode,
          modelProfile,
          ...(mode === 'goMad' ? { goMadDepth } : {})
        },
        title: selectionActionTitle(selectedNode, transformTitleVerb),
        variant: mode,
        diagramUndoBaseline: { ...syncedState }
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
        title: selectionActionTitle(selectedNode, labels[kind]),
        variant: kind,
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

  const handleFixFromCritique = useCallback(
    async (scope = 'all') => {
      hasInteractedRef.current = true;
      if (!latestCritique?.text || loadingRef.current || streamingPreviewRef.current) return;

      const split = splitCritiqueActionableSections(latestCritique.text);
      const actionableItems = split.items;

      if (scope === 'selected') {
        if (actionableItems.length === 0) return;
        const chosen = actionableItems.filter((_, i) => critiqueActionableSelected[i]);
        if (chosen.length === 0) return;
      }

      let critiqueBlock = latestCritique.text;
      const useSelectedOnly = scope === 'selected' && actionableItems.length > 0;
      if (useSelectedOnly) {
        critiqueBlock = actionableItems
          .filter((_, i) => critiqueActionableSelected[i])
          .map((t) => `- ${t}`)
          .join('\n');
      }

      const intro = useSelectedOnly
        ? 'Improve the current Mermaid diagram by applying ONLY the following improvements. Do not implement other critique suggestions.'
        : 'Improve the current Mermaid diagram based on this critique. Apply concrete fixes as a single complete diagram update.';
      const critiqueLabel = useSelectedOnly ? 'Improvements to apply:' : 'Critique:';
      const requirementsBlock = useSelectedOnly
        ? `- Implement only the improvements listed above.
- Preserve the original intent and main flow.
- Prioritize readability and clarity within that scope.
- Output one full valid Mermaid diagram in a single apply step, then briefly summarize — do not iterate multiple cosmetic patches.
- Keep Mermaid syntax valid and deliver the entire diagram source in one go.`
        : `- Preserve the original intent and main flow.
- Address the critique fully: topology and labels, and also any diagram-type or visual/style points raised (e.g. adopt a suggested diagram type when appropriate, improve contrast, simplify clutter, adjust classDef/theme/init styling).
- Prioritize readability and clarity improvements first.
- Output one full valid Mermaid diagram in a single apply step, then briefly summarize — do not iterate multiple cosmetic patches.
- Keep Mermaid syntax valid and deliver the entire diagram source in one go.`;

      const fixPrompt = `${intro}

${critiqueLabel}
${critiqueBlock}

Requirements:
${requirementsBlock}`;

      setLoading(true);
      setActiveRequest('fix');
      setError('');
      setGoMadStreak(0);

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
          title: selectionActionTitle(latestCritique.focusNode, 'Fix from critique'),
          variant: 'intent',
          diagramUndoBaseline: { ...syncedState }
        });
        setLatestCritique(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setActiveRequest(null);
      }
    },
    [critiqueActionableSelected, latestCritique, modelProfile, runStreamingAgent, syncDiagramOrThrow]
  );

  async function handleClearDiagram() {
    if (loadingRef.current || streamingPreviewRef.current) return;
    setGoMadStreak(0);
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
    if (diagramAutoHighlightTimerRef.current != null) {
      window.clearTimeout(diagramAutoHighlightTimerRef.current);
      diagramAutoHighlightTimerRef.current = null;
    }
    clearPendingAutoDiagramHighlight();
    setDiagramChangeHighlightEntryId(null);
    setDiagramChangeHighlightAddedOnly(false);
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

  const handleDiagramUndo = useCallback(
    async (entryId) => {
      if (loadingRef.current) return;

      const entry = insightsEntries.find((e) => e.id === entryId);
      const baseline = entry?.diagramUndoBaseline;
      if (!baseline || typeof baseline.mermaidSource !== 'string') return;

      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      if (streamTimerRef.current != null) {
        cancelAnimationFrame(streamTimerRef.current);
        streamTimerRef.current = null;
      }
      setStreamingPreview(false);

      try {
        const payload = { mermaidSource: baseline.mermaidSource };
        if (baseline.styleConfig != null) {
          payload.styleConfig = baseline.styleConfig;
        }
        const synced = await syncClientDiagramState(payload);
        setState(synced);
        patchInsightEntry(entryId, (e) => ({ ...e, diagramUndoConsumed: true }));
        if (diagramAutoHighlightTimerRef.current != null) {
          window.clearTimeout(diagramAutoHighlightTimerRef.current);
          diagramAutoHighlightTimerRef.current = null;
        }
        clearPendingAutoDiagramHighlight();
        setDiagramChangeHighlightEntryId((prev) => (prev === entryId ? null : prev));
      } catch (err) {
        setError(err.message);
      }
    },
    [clearPendingAutoDiagramHighlight, insightsEntries, patchInsightEntry]
  );

  const handleToggleDiagramChangeHighlight = useCallback(
    (entryId) => {
      clearPendingAutoDiagramHighlight();
      if (diagramAutoHighlightTimerRef.current != null) {
        window.clearTimeout(diagramAutoHighlightTimerRef.current);
        diagramAutoHighlightTimerRef.current = null;
      }
      setDiagramChangeHighlightAddedOnly(false);
      setDiagramChangeHighlightEntryId((prev) => (prev === entryId ? null : entryId));
    },
    [clearPendingAutoDiagramHighlight]
  );

  const changeHighlightDiff = useMemo(() => {
    if (!diagramChangeHighlightEntryId) return null;
    const entry = insightsEntries.find((e) => e.id === diagramChangeHighlightEntryId);
    const baseline = entry?.diagramUndoBaseline?.mermaidSource;
    if (typeof baseline !== 'string') return null;
    return diffMermaidFlowcharts(baseline, state.mermaidSource ?? '');
  }, [diagramChangeHighlightEntryId, insightsEntries, state.mermaidSource]);

  const changeHighlightForCanvas = useMemo(() => {
    if (!diagramChangeHighlightEntryId || !changeHighlightDiff) return null;
    if (diagramChangeHighlightAddedOnly) {
      return {
        addedIds: changeHighlightDiff.addedIds,
        modifiedIds: [],
        removedIds: changeHighlightDiff.removedIds
      };
    }
    return {
      addedIds: changeHighlightDiff.addedIds,
      modifiedIds: changeHighlightDiff.modifiedIds,
      removedIds: changeHighlightDiff.removedIds
    };
  }, [changeHighlightDiff, diagramChangeHighlightEntryId, diagramChangeHighlightAddedOnly]);

  const diagramChangeHighlightSummary = useMemo(() => {
    if (!diagramChangeHighlightEntryId || !changeHighlightDiff) return null;
    const { addedIds, modifiedIds, removedIds } = changeHighlightDiff;
    const isStructuralEmpty =
      addedIds.length === 0 && modifiedIds.length === 0 && removedIds.length === 0;
    return { removedIds, isStructuralEmpty };
  }, [changeHighlightDiff, diagramChangeHighlightEntryId]);

  useEffect(() => {
    if (!diagramChangeHighlightEntryId) return;
    const entry = insightsEntries.find((e) => e.id === diagramChangeHighlightEntryId);
    const shouldClear =
      !entry?.diagramUndoBaseline ||
      entry.diagramUndoConsumed ||
      (entry.status ?? 'running') === 'failed' ||
      (entry.status ?? 'running') === 'cancelled' ||
      ((entry.status ?? 'running') === 'done' && !entry.diagramRevisionApplied);
    if (shouldClear) {
      clearPendingAutoDiagramHighlight();
      setDiagramChangeHighlightEntryId(null);
    }
  }, [clearPendingAutoDiagramHighlight, diagramChangeHighlightEntryId, insightsEntries]);

  useEffect(() => {
    if (!diagramChangeHighlightEntryId) {
      setDiagramChangeHighlightAddedOnly(false);
    }
  }, [diagramChangeHighlightEntryId]);

  useEffect(() => {
    if (!state.mermaidSource?.trim()) {
      clearPendingAutoDiagramHighlight();
    }
  }, [clearPendingAutoDiagramHighlight, state.mermaidSource]);

  const busy = loading || streamingPreview;

  const dismissNodePanel = useCallback(() => {
    setSelectedNode(null);
    setToolbarAnchor(null);
  }, []);

  const clearNodePanelIdleTimer = useCallback(() => {
    if (nodePanelIdleTimerRef.current != null) {
      window.clearTimeout(nodePanelIdleTimerRef.current);
      nodePanelIdleTimerRef.current = null;
    }
  }, []);

  const armAutoDiagramChangeHighlight = useCallback(
    (entryId) => {
      if (diagramAutoHighlightTimerRef.current != null) {
        window.clearTimeout(diagramAutoHighlightTimerRef.current);
        diagramAutoHighlightTimerRef.current = null;
      }
      if (pendingAutoDiagramHighlightTimeoutRef.current != null) {
        window.clearTimeout(pendingAutoDiagramHighlightTimeoutRef.current);
        pendingAutoDiagramHighlightTimeoutRef.current = null;
      }
      clearNodePanelIdleTimer();
      setSelectedNode(null);
      setToolbarAnchor(null);
      setNodePanelPlacement(null);
      setDiagramChangeHighlightAddedOnly(false);
      setDiagramChangeHighlightEntryId(entryId);
      diagramAutoHighlightTimerRef.current = window.setTimeout(() => {
        diagramAutoHighlightTimerRef.current = null;
        setDiagramChangeHighlightEntryId((prev) => (prev === entryId ? null : prev));
      }, AUTO_DIAGRAM_CHANGE_HIGHLIGHT_MS);
    },
    [clearNodePanelIdleTimer]
  );

  useEffect(() => {
    armAutoDiagramChangeHighlightRef.current = armAutoDiagramChangeHighlight;
  }, [armAutoDiagramChangeHighlight]);

  /**
   * Confirms a pending auto-highlight when DiagramCanvas reports that the matching revision's SVG is on screen.
   *
   * Notes:
   * - Only revisionId is matched; the source string is intentionally not compared because chunked streaming
   *   plus React commit ordering can leave a transient editorSource snapshot, while the *next* render fires
   *   with the final source under the same revisionId.
   * - A non-matching revisionId is ignored so a stale render notification cannot wipe out a still-correct
   *   pending arming. The watchdog set in the streaming `final` handler only clears stale pending state;
   *   it does not start the pulse on an old SVG.
   */
  const handleDiagramSvgRendered = useCallback(
    ({ revisionId: renderedRevisionId }) => {
      const pending = pendingAutoDiagramHighlightRef.current;
      if (!pending) return;
      if (renderedRevisionId !== pending.revisionId) return;
      pendingAutoDiagramHighlightRef.current = null;
      if (pendingAutoDiagramHighlightTimeoutRef.current != null) {
        window.clearTimeout(pendingAutoDiagramHighlightTimeoutRef.current);
        pendingAutoDiagramHighlightTimeoutRef.current = null;
      }
      armAutoDiagramChangeHighlight(pending.entryId);
    },
    [armAutoDiagramChangeHighlight]
  );

  const scheduleNodePanelIdleDismiss = useCallback(() => {
    clearNodePanelIdleTimer();
    nodePanelIdleTimerRef.current = window.setTimeout(() => {
      nodePanelIdleTimerRef.current = null;
      dismissNodePanel();
    }, NODE_ACTIONS_IDLE_MS);
  }, [clearNodePanelIdleTimer, dismissNodePanel]);

  const hasToolbarAnchor = toolbarAnchor != null;
  const critiquePresent = Boolean(latestCritique?.text);

  useLayoutEffect(() => {
    if (
      !toolbarAnchor ||
      selectedNode == null ||
      typeof toolbarAnchor.nodeTop !== 'number' ||
      typeof toolbarAnchor.nodeBottom !== 'number'
    ) {
      return;
    }
    const el = nodeActionsPanelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vv = getVisualViewportBounds();
    const next = computeNodePanelPlacement(toolbarAnchor, rect.width, rect.height, vv);
    const stamped = { ...next, forNodeId: selectedNode.id };
    setNodePanelPlacement((prev) => {
      if (
        prev?.forNodeId === selectedNode.id &&
        Math.abs(prev.top - stamped.top) < 0.5 &&
        Math.abs(prev.nudgeX - stamped.nudgeX) < 0.5
      ) {
        return prev;
      }
      return stamped;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toolbarAnchor primitives listed; object identity changes each pan tick from DiagramCanvas
  }, [
    toolbarAnchor?.left,
    toolbarAnchor?.top,
    toolbarAnchor?.nodeTop,
    toolbarAnchor?.nodeBottom,
    selectedNode?.id,
    critiquePresent,
    viewportClampEpoch
  ]);

  useEffect(() => {
    function bumpClampEpoch() {
      setViewportClampEpoch((n) => n + 1);
    }
    window.addEventListener('resize', bumpClampEpoch);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', bumpClampEpoch);
    vv?.addEventListener('scroll', bumpClampEpoch);
    return () => {
      window.removeEventListener('resize', bumpClampEpoch);
      vv?.removeEventListener('resize', bumpClampEpoch);
      vv?.removeEventListener('scroll', bumpClampEpoch);
    };
  }, []);

  useEffect(() => {
    if (!selectedNode?.id || toolbarAnchor == null) {
      clearNodePanelIdleTimer();
      return undefined;
    }
    if (busy) {
      clearNodePanelIdleTimer();
      return undefined;
    }
    scheduleNodePanelIdleDismiss();
    return () => clearNodePanelIdleTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hasToolbarAnchor covers anchor presence; toolbarAnchor identity churns each pan frame
  }, [
    busy,
    clearNodePanelIdleTimer,
    scheduleNodePanelIdleDismiss,
    selectedNode?.id,
    hasToolbarAnchor
  ]);

  const bumpNodePanelIdleDismiss = useCallback(() => {
    if (!selectedNode?.id || !hasToolbarAnchor || busy) return;
    scheduleNodePanelIdleDismiss();
  }, [busy, hasToolbarAnchor, scheduleNodePanelIdleDismiss, selectedNode?.id]);

  const agentThinkingChrome = useMemo(
    () => loading || insightsEntries.some((e) => (e.status ?? 'running') === 'running'),
    [loading, insightsEntries]
  );
  const hasDiagramText = Boolean(state.mermaidSource?.trim());
  const canFixFromCritique = Boolean(latestCritique?.text) && !busy;

  const critiqueActionableSplit = useMemo(
    () => (latestCritique?.text ? splitCritiqueActionableSections(latestCritique.text) : null),
    [latestCritique?.text]
  );

  const critiqueActionableUi = useMemo(() => {
    if (
      !latestCritique?.text ||
      !critiqueActionableSplit?.hasSection ||
      critiqueActionableSplit.items.length === 0
    ) {
      return null;
    }
    const items = critiqueActionableSplit.items;
    const alignedSelected = items.map((_, i) => critiqueActionableSelected[i] ?? false);
    return {
      critiqueText: latestCritique.text,
      headingText: critiqueActionableSplit.headingText,
      items,
      prefix: critiqueActionableSplit.prefix,
      suffix: critiqueActionableSplit.suffix,
      selected: alignedSelected,
      onToggle: (index) => {
        setCritiqueActionableSelected((prev) => {
          const next = items.map((_, i) => prev[i] ?? false);
          if (index < 0 || index >= next.length) return prev;
          next[index] = !next[index];
          return next;
        });
      },
      busy,
      onFixSelected: () => handleFixFromCritique('selected'),
      onFixAll: () => handleFixFromCritique('all')
    };
  }, [busy, critiqueActionableSplit, critiqueActionableSelected, handleFixFromCritique, latestCritique?.text]);

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

  const streamingAgentStoppable = useMemo(() => {
    if (!loading || !activeRequest) return false;
    return (
      activeRequest === 'intent' ||
      activeRequest === 'fix' ||
      activeRequest.startsWith('transform:') ||
      activeRequest.startsWith('analyze:')
    );
  }, [activeRequest, loading]);

  const insightsSlot = insightsOpen ? (
    <InsightsPane
      entries={insightsEntries}
      soundEnabled={soundEnabled}
      onSoundEnabledChange={setSoundEnabled}
      celebratingEntryId={celebratingEntryId}
      streamDebugEnabled={streamDebugEnabled}
      critiqueActionableUi={critiqueActionableUi}
      diagramUndoDisabled={loading}
      onDiagramUndo={handleDiagramUndo}
      diagramChangeHighlightEntryId={diagramChangeHighlightEntryId}
      diagramChangeHighlightSummary={diagramChangeHighlightSummary}
      diagramChangeHighlightDisabled={loading}
      onToggleDiagramChangeHighlight={handleToggleDiagramChangeHighlight}
      onStopStreamingAgent={streamingAgentStoppable ? stopStreamingAgentRequest : undefined}
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
        changeHighlight={changeHighlightForCanvas}
        onDiagramSvgRendered={handleDiagramSvgRendered}
      />

      {toolbarAnchor && selectedNode ? (
        <div
          ref={nodeActionsPanelRef}
          className="corner-control node-toolbar-anchor node-actions-panel"
          style={{
            left: toolbarAnchor.left,
            top:
              nodePanelPlacement?.forNodeId === selectedNode.id
                ? nodePanelPlacement.top
                : toolbarAnchor.top,
            transform: `translate(calc(-50% + ${
              nodePanelPlacement?.forNodeId === selectedNode.id ? nodePanelPlacement.nudgeX : 0
            }px), 0)`
          }}
          role="dialog"
          aria-label="Diagram selection actions"
          onPointerEnter={bumpNodePanelIdleDismiss}
          onPointerDown={bumpNodePanelIdleDismiss}
          onFocusCapture={bumpNodePanelIdleDismiss}
        >
          <div className="node-actions-panel-surface">
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
                    {goMadShapeLabel(goMadStreak)}
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
                    <button
                      type="button"
                      className="overlay-button compact-button"
                      disabled={!canFixFromCritique}
                      onClick={() => handleFixFromCritique('all')}
                    >
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
            <button
              type="button"
              className="overlay-button node-actions-panel-close"
              onClick={dismissNodePanel}
              aria-label="Close node actions"
            >
              <ButtonIcon>x</ButtonIcon>
            </button>
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
            <div className="overlay-status-row">
              <p id="app-status" className={`overlay-status ${error ? 'is-error' : ''}`} role="status">
                {status}
              </p>
              {streamingAgentStoppable && !insightsOpen ? (
                <button
                  type="button"
                  className="overlay-button compact-button overlay-status-stop"
                  onClick={stopStreamingAgentRequest}
                >
                  Stop request
                </button>
              ) : null}
            </div>
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
                {goMadShapeLabel(goMadStreak)}
              </button>
            </div>
            <span className="button-group-label">Read</span>
            <div className="button-group">
              <button type="button" className="overlay-button compact-button" disabled={busy} onClick={() => runAnalyze('critique')}>
                <ButtonIcon>?</ButtonIcon>
                Critique
              </button>
              {latestCritique?.text ? (
                <button
                  type="button"
                  className="overlay-button compact-button"
                  disabled={!canFixFromCritique}
                  onClick={() => handleFixFromCritique('all')}
                >
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
