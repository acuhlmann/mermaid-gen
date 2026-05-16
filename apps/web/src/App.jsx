import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DiagramCanvas from './components/DiagramCanvas.jsx';
import InsightsPane from './components/InsightsPane.jsx';
import RadialActionMenu from './components/RadialActionMenu.jsx';
import AgentHandshakeDialog from './components/AgentHandshakeDialog.jsx';
import AgentPresenceBar from './components/AgentPresenceBar.jsx';
import InviteAgentDialog from './components/InviteAgentDialog.jsx';
import {
  openSessionEventsStream,
  approveHandshake,
  denyHandshake,
  acceptProposal as acceptProposalApi,
  rejectProposal as rejectProposalApi,
  joinRoomByPairingCode
} from './state/sessionEventsClient.js';
import { partKindLabel } from './utils/partKindLabel.js';
import {
  buildIntentPeerContext,
  createSessionId,
  fallbackState,
  fetchSessionDiagramState,
  isSlotInSyncForTopic,
  normalizeSessionId,
  peerRequiresModeSwitchTranslation,
  readDiagramCache,
  SESSION_NOT_FOUND_CODE,
  shouldAutoSubmitModeSwitchIntent,
  slotLastTopic,
  streamDiagramAgent,
  syncClientDiagramState,
  submitDiagramIntent,
  wipeClientCachesAfterLostServerSession,
  writeDiagramCache
} from './state/diagramStore.js';
import { applyAgentStreamInsightEvent } from './state/applyAgentStreamInsightEvent.js';
import './App.css';
import {
  playAchievementFanfare,
  playKonamiRainbow,
  playRefinePolishLoop,
  playInnovateSynthLoop,
  playGoMadKlaxonLoop,
  playGoMadAirhornBlast,
  playCritiqueScribbleLoop,
  playCritiquePenStab,
  playExplainPageFlipLoop,
  playComboStinger,
  playCompletionChime as playCompletionChimeTone,
  playConfettiPop,
  playCritiqueBoot,
  playCritiqueCompletion,
  playDraftTick,
  playExplainBoot,
  playExplainCompletion,
  playFailureChime,
  playGoMadBoot,
  playGoMadCompletionChime,
  playGoMadStreamStart,
  playGoMadTokenTick,
  playCritiqueTokenTick,
  playExplainTokenTick,
  playInnovateBoot,
  playInnovateCompletion,
  playInnovateStreamStart,
  playInnovateTokenTick,
  playModeSwoosh,
  playPhaseChangePluck,
  playRefineBoot,
  playRefineCompletion,
  playRefineStreamStart,
  playRefineTokenTick,
  playStreakStinger,
  playStreamStartChime,
  playSubmitThunk,
  playTokenTickChime,
  playToolEndChime,
  playToolStartChime
} from './utils/agentChimes.js';
import ActionBootSequence from './components/ActionBootSequence.jsx';
import StreakHud from './components/StreakHud.jsx';
import SlopitectCompanion from './components/SlopitectCompanion.jsx';
import LiveRunHud from './components/LiveRunHud.jsx';
import {
  applyCompletedRun,
  createInitialState as createInitialGamificationState,
  readFromStorage as readGamificationFromStorage,
  writeToStorage as writeGamificationToStorage
} from './state/runGamificationStore.js';
import { CONSOLE_STAMP_LINES, PROMPT_EASTER_EGGS, IDLE_TIPS, KONAMI_ACHIEVEMENT } from './utils/slopitectCopy.js';
import confetti from 'canvas-confetti';

// canvas-confetti uses HTMLCanvasElement.getContext('2d') and trips on jsdom
// (which returns null). Gate so test runs don't see async confetti errors.
let _confettiSupportCache = null;
function canvasConfettiAvailable() {
  if (_confettiSupportCache !== null) return _confettiSupportCache;
  if (typeof document === 'undefined') {
    _confettiSupportCache = false;
    return false;
  }
  try {
    const c = document.createElement('canvas');
    _confettiSupportCache = Boolean(c.getContext?.('2d'));
  } catch {
    _confettiSupportCache = false;
  }
  return _confettiSupportCache;
}
import {
  createInitialDiagramState,
  diffInfographicSources,
  LEGACY_STREAM_TYPE_A2UI,
  splitCritiqueActionableSections
} from '@archislop/shared';
import { collapseConsecutiveApplyPatchActions } from './utils/collapsePatchTechnicalActions.js';
import { diffMermaidFlowcharts } from './utils/mermaidFlowchartDiff.js';
import { goIntentInsightTitle } from './utils/goIntentInsightTitle.js';
import { resolveAgentStreamFailureStatus } from './utils/agentStreamFailureStatus.js';
import { buildInsightRetryDescriptor } from './utils/insightRetryDescriptor.js';
import { MOBILE_MEDIA_QUERY } from './utils/layoutBreakpoints.js';
import { useDelayedUnmount } from './utils/useDelayedUnmount.js';

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

const STREAM_DEBUG_LS_KEY = 'archislop-stream-debug';

const RADIAL_MENU_CLOSE_GRACE_MS = 450;
/** Auto-show diagram diff highlights after the final SVG for an agent-applied revision is on screen. */
const AUTO_DIAGRAM_CHANGE_HIGHLIGHT_MS = 7000;
/** Avoid keeping a stale render handshake armed forever if the SVG never confirms. */
const AUTO_DIAGRAM_CHANGE_HIGHLIGHT_PENDING_TIMEOUT_MS = 10000;

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
      state: { revisionId: evt.state.revisionId, diagramSource: '[omitted]' }
    };
  }
  return evt;
}

function proposalToInsightEntry(proposal) {
  return {
    id: proposal.proposalId,
    kind: 'proposal',
    variant: 'general',
    status: 'running',
    statusText: 'Awaiting your decision.',
    createdAt: proposal.createdAt ?? new Date().toISOString(),
    proposal,
    proposalStatus: 'pending'
  };
}

function attributedInsightToInsightEntry(insight) {
  return {
    id: insight.insightId,
    kind: 'attributed-note',
    variant: insight.variant === 'critique' ? 'critique' : 'general',
    status: 'done',
    statusText: 'Note',
    createdAt: insight.createdAt ?? new Date().toISOString(),
    content: insight.text ?? '',
    origin: insight.origin ?? null
  };
}

function focusPayload(node) {
  if (!node?.id) return undefined;
  if (node.kind === 'edge' && node.edgeFrom && node.edgeTo) {
    return {
      id: node.id,
      label: node.label,
      selectionKind: 'edge',
      edgeFrom: node.edgeFrom,
      edgeTo: node.edgeTo,
      ...(node.clickedLabel ? { clickedLabel: node.clickedLabel } : {})
    };
  }
  if (node.kind === 'infographic-item') {
    return {
      id: node.id,
      label: node.label,
      selectionKind: 'infographic-item',
      ...(node.indexes ? { indexes: node.indexes } : {}),
      ...(node.elementType ? { elementType: node.elementType } : {}),
      ...(node.clickedLabel ? { clickedLabel: node.clickedLabel } : {})
    };
  }
  return {
    id: node.id,
    label: node.label,
    ...(node.kind === 'cluster' ? { selectionKind: 'cluster' } : { selectionKind: 'node' }),
    ...(node.dataId ? { dataId: node.dataId } : {}),
    ...(node.clickedLabel ? { clickedLabel: node.clickedLabel } : {})
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
  if (selectionLike.partKind && selectionLike.partName) {
    return `${verbLabel} · ${partKindLabel(selectionLike.partKind)} · ${selectionLike.partName}`;
  }
  const edgeLike =
    selectionLike.kind === 'edge' ||
    (selectionLike.selectionKind === 'edge' && selectionLike.edgeFrom && selectionLike.edgeTo);
  if (edgeLike) {
    return `${verbLabel} — edge ${selectionLike.edgeFrom} → ${selectionLike.edgeTo}`;
  }
  const infographicLike =
    selectionLike.kind === 'infographic-item' || selectionLike.selectionKind === 'infographic-item';
  if (infographicLike) {
    const labelText = selectionLike.label || selectionLike.clickedLabel || selectionLike.id;
    const elementType = selectionLike.elementType || '';
    const noun =
      elementType === 'title' ? 'title'
      : elementType === 'desc' ? 'description'
      : elementType === 'item-desc' ? 'item desc'
      : elementType === 'item-value' ? 'item value'
      : elementType === 'item-icon' || elementType === 'item-icon-group' ? 'item icon'
      : 'item';
    return `${verbLabel} — ${noun} “${labelText}”`;
  }
  const clusterLike = selectionLike.kind === 'cluster' || selectionLike.selectionKind === 'cluster';
  if (clusterLike) {
    return `${verbLabel} — subgraph “${selectionLike.label || selectionLike.id}”`;
  }
  return `${verbLabel} — node “${selectionLike.label || selectionLike.id}”`;
}

function descriptorKey(descriptor) {
  if (!descriptor) return null;
  return `${descriptor.kind || 'node'}|${descriptor.id || ''}|${descriptor.partKind || ''}|${descriptor.partName || ''}`;
}

function topicFromDescriptor(descriptor) {
  if (!descriptor) return null;
  if (descriptor.partKind && descriptor.partName) {
    return { partKind: descriptor.partKind, partName: descriptor.partName };
  }
  return null;
}

const MODEL_PROFILE_STORAGE_KEY = 'archislop:model-profile';
const CONTENT_MODE_STORAGE_KEY = 'archislop:content-mode';
const SESSION_ROUTE_SEGMENT = 'sessions';

function decodePathSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeBasePath(baseUrl) {
  const raw = typeof baseUrl === 'string' ? baseUrl.trim() : '';
  if (!raw || raw === '/') return '';
  return `/${raw.replace(/^\/+|\/+$/g, '')}`;
}

function relativePathname(pathname) {
  const basePath = normalizeBasePath(import.meta.env.BASE_URL);
  const normalizedPath = pathname || '/';
  if (basePath && (normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`))) {
    return normalizedPath.slice(basePath.length) || '/';
  }
  return normalizedPath;
}

function readSessionIdFromLocation(locationLike = typeof window !== 'undefined' ? window.location : null) {
  if (!locationLike) return null;
  const segments = relativePathname(locationLike.pathname)
    .split('/')
    .filter(Boolean);
  if (segments[0] !== SESSION_ROUTE_SEGMENT) return null;
  return normalizeSessionId(decodePathSegment(segments[1] ?? ''));
}

function sessionPathFor(sessionId) {
  const basePath = normalizeBasePath(import.meta.env.BASE_URL);
  return `${basePath}/${SESSION_ROUTE_SEGMENT}/${encodeURIComponent(sessionId)}`;
}

/**
 * @returns {{sessionId: string, fromUrl: boolean}} `fromUrl` is true when the URL already had
 *   a session id we adopted; false when we minted a brand-new id (so the server hasn't seen it yet).
 */
function ensureUrlBackedSession() {
  const fallbackSessionId = normalizeSessionId(createSessionId()) ?? `session-${Date.now()}`;
  if (typeof window === 'undefined') return { sessionId: fallbackSessionId, fromUrl: false };

  const urlSessionId = readSessionIdFromLocation(window.location);
  const sessionId = urlSessionId ?? fallbackSessionId;
  const fromUrl = Boolean(urlSessionId);
  const nextPath = sessionPathFor(sessionId);
  if (window.location.pathname !== nextPath) {
    window.history.replaceState({}, '', `${nextPath}${window.location.search}${window.location.hash}`);
  }
  return { sessionId, fromUrl };
}

/** Default UI tier is Fast unless the user chose Quality and we persisted it. */
function readStoredModelProfile() {
  if (typeof window === 'undefined') return 'fast';
  const raw = window.localStorage.getItem(MODEL_PROFILE_STORAGE_KEY);
  return raw === 'quality' ? 'quality' : 'fast';
}

/** Default content mode is Diagram (Mermaid). Infographic is opt-in and persisted. */
function readStoredContentMode() {
  if (typeof window === 'undefined') return 'mermaid';
  const raw = window.localStorage.getItem(CONTENT_MODE_STORAGE_KEY);
  return raw === 'infographic' ? 'infographic' : 'mermaid';
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

function ArchiSlopMarkIcon() {
  return (
    <svg className="brand-helmet-svg" viewBox="0 0 24 24" width="36" height="36" aria-hidden="true">
      <path d="M5 16 Q5 7 12 6 Q19 7 19 16 Z" fill="#F4A300" />
      <ellipse cx="12" cy="16" rx="9" ry="1.4" fill="#C77A00" />
      <path d="M12 6 L11 16 L13 16 Z" fill="#C77A00" opacity="0.55" />
      <path d="M6 17 Q6 20 7 22 Q8 20 8 17 Z" fill="#7CFC00" />
      <path d="M11 17 Q11 22 12 23.5 Q13 22 13 17 Z" fill="#3FA700" />
      <path d="M16 17 Q16 20 17 22 Q18 20 18 17 Z" fill="#7CFC00" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        d="M8.5 3.4c-1.7 0-3 1.2-3 2.7 0 .3 0 .6.1.9-1.2.4-2.1 1.5-2.1 2.8 0 .8.3 1.5.8 2-.5.5-.8 1.2-.8 2 0 1.4 1 2.5 2.3 2.8.1 1.4 1.3 2.5 2.7 2.5.8 0 1.5-.3 2-.9V4.3c-.5-.5-1.2-.9-2-.9Zm7 0c-.8 0-1.5.4-2 .9v14c.5.5 1.2.9 2 .9 1.4 0 2.6-1.1 2.7-2.5 1.3-.3 2.3-1.4 2.3-2.8 0-.8-.3-1.5-.8-2 .5-.5.8-1.2.8-2 0-1.3-.9-2.4-2.1-2.8.1-.3.1-.6.1-.9 0-1.5-1.3-2.7-3-2.7Z"
        fill="#ff5fb0"
        stroke="#1f1235"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 7.5c.6.2 1 .6 1.2 1.2M8.2 11.2c.7 0 1.3.3 1.6.8M9.4 15.2c.5-.3 1-.4 1.5-.3M14.5 7.5c-.6.2-1 .6-1.2 1.2M15.8 11.2c-.7 0-1.3.3-1.6.8M14.6 15.2c-.5-.3-1-.4-1.5-.3M12 4.5v15"
        fill="none"
        stroke="#1f1235"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
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

function AiCornerControlsInner({
  contentMode,
  onSelectContentMode,
  modelProfile,
  onSelectModelProfile,
  modeSwitchDisabled,
  pendingHandshake,
  externalAgentPresence,
  onInviteAgent,
  agentThinkingChrome,
  insightsOpen,
  onToggleInsights,
  includeThinkingToggle = true
}) {
  return (
    <>
      <div className="model-profile-toggle" role="group" aria-label="Content mode">
        <span className="model-profile-label">Mode</span>
        <div className="model-profile-segment">
          <button
            type="button"
            className={`model-profile-option ${contentMode === 'mermaid' ? 'is-selected' : ''}`}
            aria-pressed={contentMode === 'mermaid'}
            disabled={modeSwitchDisabled}
            onClick={() => onSelectContentMode('mermaid')}
          >
            Diagram
          </button>
          <button
            type="button"
            className={`model-profile-option ${contentMode === 'infographic' ? 'is-selected' : ''}`}
            aria-pressed={contentMode === 'infographic'}
            disabled={modeSwitchDisabled}
            onClick={() => onSelectContentMode('infographic')}
          >
            Infographic
          </button>
        </div>
      </div>
      <div className="model-profile-toggle" role="group" aria-label="AI brain">
        <span className="model-profile-label model-profile-label--brain">
          <span className="model-profile-label-icon" aria-hidden="true">
            <BrainIcon />
          </span>
          Brain
        </span>
        <div className="model-profile-segment">
          <button
            type="button"
            className={`model-profile-option ${modelProfile === 'fast' ? 'is-selected' : ''}`}
            aria-pressed={modelProfile === 'fast'}
            onClick={() => onSelectModelProfile('fast')}
          >
            Fast
          </button>
          <button
            type="button"
            className={`model-profile-option ${modelProfile === 'quality' ? 'is-selected' : ''}`}
            aria-pressed={modelProfile === 'quality'}
            onClick={() => onSelectModelProfile('quality')}
          >
            Quality
          </button>
        </div>
      </div>
      <div className="model-profile-toggle agent-collab-toggle" role="group" aria-label="External agents">
        <span className="model-profile-label">Agents</span>
        <div className="agent-collab-segment">
          {pendingHandshake ? (
            <span className="agent-handshake-waiting" role="status">
              Waiting for handshake: {pendingHandshake.proposedName ?? 'External agent'}
            </span>
          ) : null}
          <AgentPresenceBar presence={externalAgentPresence} onInvite={onInviteAgent} />
        </div>
      </div>
      {includeThinkingToggle ? (
        <button
          type="button"
          className={`overlay-button thinking-toggle-button ${agentThinkingChrome ? 'is-agent-active' : ''}`}
          onClick={onToggleInsights}
          aria-label={insightsOpen ? 'Hide Thinking' : 'Show Thinking'}
        >
          <ButtonIcon>{insightsOpen ? '-' : '+'}</ButtonIcon>
          Thinking
        </button>
      ) : null}
    </>
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

function useNarrowLayout() {
  const [narrowLayout, setNarrowLayout] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(MOBILE_MEDIA_QUERY).matches
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(MOBILE_MEDIA_QUERY);
    const sync = () => setNarrowLayout(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return narrowLayout;
}

function ArchiSlop() {
  const initialSessionIdRef = useRef(null);
  // Tracks session ids that the client minted (server hasn't seen them yet). The hydration
  // 404 handler uses this to decide whether to keep the same id or rotate to a new one.
  const freshlyMintedSessionIdsRef = useRef(new Set());
  if (initialSessionIdRef.current == null) {
    const { sessionId: bootId, fromUrl } = ensureUrlBackedSession();
    initialSessionIdRef.current = bootId;
    if (!fromUrl) freshlyMintedSessionIdsRef.current.add(bootId);
  }
  const [activeSessionId, setActiveSessionId] = useState(initialSessionIdRef.current);
  const cacheRef = useRef(readDiagramCache(initialSessionIdRef.current));
  const [state, setState] = useState(fallbackState);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeRequest, setActiveRequest] = useState(null);
  const [error, setError] = useState('');
  const [streamingPreview, setStreamingPreview] = useState(false);
  // In-flight draft DSL streamed from the agent's tool-call args, used to render
  // an infographic incrementally before the final patch revision lands. Cleared
  // on final/error. Separate from `streamingPreview` (the post-patch typewriter).
  const [liveDraftSource, setLiveDraftSource] = useState('');
  const [liveDraftContentType, setLiveDraftContentType] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [autoFixAttempted, setAutoFixAttempted] = useState(false);
  const [editorOpen, setEditorOpen] = useState(Boolean(cacheRef.current?.editorOpen));
  const [insightsOpen, setInsightsOpen] = useState(Boolean(cacheRef.current?.insightsOpen));
  const [insightsEntries, setInsightsEntries] = useState(() =>
    Array.isArray(cacheRef.current?.insightsEntries) ? cacheRef.current.insightsEntries : []
  );
  const [soundEnabled, setSoundEnabled] = useState(cacheRef.current?.soundEnabled ?? true);
  const [modelProfile, setModelProfile] = useState(() => readStoredModelProfile());
  const [contentMode, setContentMode] = useState(() => readStoredContentMode());
  const [celebratingEntryId, setCelebratingEntryId] = useState(null);
  const [diagramChangeHighlightEntryId, setDiagramChangeHighlightEntryId] = useState(null);
  /** Auto pulse focuses on newly added nodes; manual "Highlight changes" shows full diff. */
  const [diagramChangeHighlightAddedOnly, setDiagramChangeHighlightAddedOnly] = useState(false);
  const [latestCritique, setLatestCritique] = useState(() => {
    const cachedCritique = cacheRef.current?.latestCritique;
    return cachedCritique?.text ? cachedCritique : null;
  });
  const [critiqueActionableSelected, setCritiqueActionableSelected] = useState([]);
  /** A2UI v0.9 messages from the latest critique stream (`CUSTOM a2ui`), when present. */
  const [latestCritiqueA2uiMessages, setLatestCritiqueA2uiMessages] = useState(null);
  /** Successful consecutive Go Mad transforms; resets after Refine/Innovate/Intent/Clear/fix-from-critique. */
  const [goMadStreak, setGoMadStreak] = useState(0);
  /** Slopitect gamification state (persisted) + transient emissions queue for StreakHud. */
  const [gamification, setGamification] = useState(() => {
    if (typeof window === 'undefined') return createInitialGamificationState();
    return readGamificationFromStorage(window.localStorage) ?? createInitialGamificationState();
  });
  const [streakHudToasts, setStreakHudToasts] = useState([]);
  const [streakHudAchievement, setStreakHudAchievement] = useState(null);
  const streakEmissionSeqRef = useRef(0);
  /** Boot-sequence trigger: counter + variant. Each pick increments → overlay re-mounts. */
  const [bootSeq, setBootSeq] = useState({ trigger: 0, variant: null });
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoverDescriptor, setHoverDescriptor] = useState(null);
  const [toolbarAnchor, setToolbarAnchor] = useState(null);
  /** Pinned radial menu; survives diagram hover leave until menu grace expires or explicit close. */
  const [radialMenuSession, setRadialMenuSession] = useState(null);
  const [voiceSupported] = useState(
    () =>
      Boolean(
        SpeechRecognitionCtor &&
          (typeof globalThis.isSecureContext === 'boolean' ? globalThis.isSecureContext : true)
      )
  );
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  /** External-agent collaboration: handshake awaiting user action, connected agents, ephemeral reactions, invite dialog. */
  const [pendingHandshake, setPendingHandshake] = useState(null);
  const [externalAgentPresence, setExternalAgentPresence] = useState([]);
  const [agentReactions, setAgentReactions] = useState([]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

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
  const lastDraftTickAtRef = useRef(0);
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
  const hoverCloseTimerRef = useRef(null);
  /** False after pan or menu pointer-leave; re-opens when selection id changes. */
  const [radialMenuVisible, setRadialMenuVisible] = useState(false);
  const prevSelectedNodeIdRef = useRef(null);
  const diagramAutoHighlightTimerRef = useRef(null);
  /** Until SVG renders, { entryId, revisionId } — arms highlights via `onDiagramSvgRendered`. */
  const pendingAutoDiagramHighlightRef = useRef(null);
  /** Watchdog that clears stale pending highlights if the SVG-render handshake never matches. */
  const pendingAutoDiagramHighlightTimeoutRef = useRef(null);
  /** Forward ref so the streaming `final` callback can call the latest arm fn without dep churn. */
  const armAutoDiagramChangeHighlightRef = useRef(null);

  /** Single session topic; seeded from hydrate and updated on successful intent revisions. */
  const sessionTopicRef = useRef(null);

  /**
   * Per target mode: revision ids of the last successful peer→target mode-switch translation.
   * Prevents ping-pong re-translation when toggling Diagram/Infographic without new edits.
   */
  const crossModeSyncRef = useRef({ mermaid: null, infographic: null });

  /**
   * One-shot flag set by handleRestoreToEntry when restoring across modes. The hydrate effect
   * fires on contentMode change and would otherwise auto-rerun the topic in the new mode,
   * clobbering the just-restored snapshot.
   */
  const suppressNextModeSwitchRerunRef = useRef(false);

  const clearPendingAutoDiagramHighlight = useCallback(() => {
    pendingAutoDiagramHighlightRef.current = null;
    if (pendingAutoDiagramHighlightTimeoutRef.current != null) {
      window.clearTimeout(pendingAutoDiagramHighlightTimeoutRef.current);
      pendingAutoDiagramHighlightTimeoutRef.current = null;
    }
  }, []);

  useSyncVisualViewportHeight();
  const narrowLayout = useNarrowLayout();

  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  // Slopitect console stamp on first mount — pure flavor, no functional effect.
  useEffect(() => {
    if (typeof console === 'undefined' || typeof console.log !== 'function') return;
    try {
      console.log('%c' + CONSOLE_STAMP_LINES.join('\n'), 'color:#c77a00;font-weight:700;');
    } catch {
      // ignore
    }
  }, []);

  // Slopitect prompt easter eggs: fire each keyword's toast at most once per session.
  const promptEasterEggsFiredRef = useRef(new Set());
  const promptEasterEggSeqRef = useRef(0);
  useEffect(() => {
    if (!prompt) return;
    for (const egg of PROMPT_EASTER_EGGS) {
      if (egg.match.test(prompt) && !promptEasterEggsFiredRef.current.has(egg.toast)) {
        promptEasterEggsFiredRef.current.add(egg.toast);
        const seq = promptEasterEggSeqRef.current + 1;
        promptEasterEggSeqRef.current = seq;
        const toast = { id: `easter-${Date.now()}-${seq}`, kind: 'text', label: egg.toast };
        setStreakHudToasts((q) => [...q, toast]);
        setTimeout(() => {
          setStreakHudToasts((q) => q.filter((x) => x.id !== toast.id));
        }, 1800);
      }
    }
  }, [prompt]);

  useEffect(() => {
    if (!latestCritique?.text) {
      setCritiqueActionableSelected([]);
      return;
    }
    const { items } = splitCritiqueActionableSections(latestCritique.text);
    setCritiqueActionableSelected(items.map(() => false));
  }, [latestCritique?.createdAt, latestCritique?.text]);

  // Konami code (↑↑↓↓←→←→BA) easter egg → "SLOPITECT AWAKENED" banner + rainbow body tint + fanfare.
  const konamiBufferRef = useRef([]);
  const konamiFiredRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const sequence = [
      'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
      'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
      'b', 'a'
    ];
    function isEditable(target) {
      if (!target) return false;
      const tag = (target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      return target.isContentEditable === true;
    }
    function handleKey(e) {
      if (konamiFiredRef.current) return;
      if (isEditable(e.target)) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      konamiBufferRef.current = [...konamiBufferRef.current, key].slice(-sequence.length);
      const buf = konamiBufferRef.current;
      if (buf.length !== sequence.length) return;
      for (let i = 0; i < sequence.length; i++) {
        if (buf[i] !== sequence[i]) return;
      }
      konamiFiredRef.current = true;
      const banner = { id: `konami-${Date.now()}`, title: KONAMI_ACHIEVEMENT.title, subtitle: KONAMI_ACHIEVEMENT.subtitle };
      setStreakHudAchievement(banner);
      setTimeout(() => {
        setStreakHudAchievement((current) => (current?.id === banner.id ? null : current));
      }, 3200);
      tryAgentSound(playAchievementFanfare);
      setTimeout(() => tryAgentSound(playKonamiRainbow), 120);
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.add('slopitect-rainbow-tint');
        setTimeout(() => document.body.classList.remove('slopitect-rainbow-tint'), 5200);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // tryAgentSound is stable enough for this listener and we want a one-shot lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Triple-click on brand logo → random tip toast.
  const brandTripleClickRef = useRef({ count: 0, lastAt: 0 });
  const handleBrandTripleClick = useCallback(() => {
    const now = Date.now();
    const state = brandTripleClickRef.current;
    if (now - state.lastAt > 600) {
      state.count = 1;
    } else {
      state.count += 1;
    }
    state.lastAt = now;
    if (state.count >= 3) {
      state.count = 0;
      const tip = IDLE_TIPS[Math.floor(Math.random() * IDLE_TIPS.length)] || '';
      const toast = { id: `tip-${now}`, kind: 'text', label: `Slopitect Tip™ — ${tip}` };
      setStreakHudToasts((q) => [...q, toast]);
      setTimeout(() => {
        setStreakHudToasts((q) => q.filter((x) => x.id !== toast.id));
      }, 2600);
    }
  }, []);

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
    function handlePopState() {
      const { sessionId: nextSessionId, fromUrl } = ensureUrlBackedSession();
      if (!fromUrl) freshlyMintedSessionIdsRef.current.add(nextSessionId);
      setActiveSessionId(nextSessionId);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const room = new URLSearchParams(window.location.search).get('room');
    if (!room) return undefined;
    let cancelled = false;
    joinRoomByPairingCode({ pairingCode: room })
      .then(({ sessionId }) => {
        if (cancelled || !sessionId) return;
        freshlyMintedSessionIdsRef.current.delete(sessionId);
        setActiveSessionId(sessionId);
        const nextPath = sessionPathFor(sessionId);
        const url = new URL(window.location.href);
        url.searchParams.delete('room');
        window.history.replaceState({}, '', `${nextPath}${url.search}${url.hash}`);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? 'Invalid or expired room code.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    if (streamTimerRef.current != null) {
      cancelAnimationFrame(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    streamAgentAbortRef.current?.abort();
    cacheRef.current = readDiagramCache(activeSessionId);
    setPrompt('');
    promptRef.current = '';
    setInsightsEntries(Array.isArray(cacheRef.current?.insightsEntries) ? cacheRef.current.insightsEntries : []);
    setLatestCritique(cacheRef.current?.latestCritique?.text ? cacheRef.current.latestCritique : null);
    setEditorOpen(Boolean(cacheRef.current?.editorOpen));
    setInsightsOpen(Boolean(cacheRef.current?.insightsOpen));
    setSoundEnabled(cacheRef.current?.soundEnabled ?? true);
    setSelectedNode(null);
    setHoverDescriptor(null);
    setToolbarAnchor(null);
    setDiagramChangeHighlightEntryId(null);
    setDiagramChangeHighlightAddedOnly(false);
    setStreamingPreview(false);
    setLoading(false);
    setActiveRequest(null);
    clearPendingAutoDiagramHighlight();
    setError('');
    setPendingHandshake(null);
    setExternalAgentPresence([]);
    setAgentReactions([]);
  }, [activeSessionId, clearPendingAutoDiagramHighlight]);

  // External-agent session events: handshake requests, proposals, presence, reactions, attributed insights.
  // One always-open SSE stream per active session.
  useEffect(() => {
    if (!activeSessionId) return undefined;

    const close = openSessionEventsStream({
      sessionId: activeSessionId,
      onEvent: (envelope) => {
        if (!envelope || typeof envelope !== 'object') return;
        const { type, payload } = envelope;

        if (type === 'snapshot') {
          setExternalAgentPresence(Array.isArray(payload?.presence) ? payload.presence : []);
          // Re-hydrate any proposals that arrived before this client connected.
          const proposals = Array.isArray(payload?.pendingProposals) ? payload.pendingProposals : [];
          if (proposals.length > 0) {
            setInsightsEntries((prev) => {
              const existingIds = new Set(prev.map((e) => e.id));
              const additions = proposals
                .filter((p) => !existingIds.has(p.proposalId))
                .map((p) => proposalToInsightEntry(p));
              return additions.length > 0 ? [...prev, ...additions] : prev;
            });
          }
          return;
        }

        if (type === 'pairing_rotated') {
          return;
        }

        if (type === 'handshake_request') {
          // Newest pending handshake wins (one modal at a time is enough for v1).
          setPendingHandshake(payload ?? null);
          return;
        }

        if (type === 'handshake_resolved') {
          setPendingHandshake((current) =>
            current && current.requestId === payload?.requestId ? null : current
          );
          return;
        }

        if (type === 'presence_update') {
          setExternalAgentPresence(Array.isArray(payload) ? payload : []);
          return;
        }

        if (type === 'proposal_received' && payload?.proposalId) {
          setInsightsEntries((prev) => {
            if (prev.some((e) => e.id === payload.proposalId)) return prev;
            return [...prev, proposalToInsightEntry(payload)];
          });
          return;
        }

        if (type === 'proposal_resolved' && payload?.proposalId) {
          setInsightsEntries((prev) =>
            prev.map((entry) =>
              entry.id === payload.proposalId
                ? {
                    ...entry,
                    proposalStatus: payload.status ?? 'rejected',
                    status: 'done',
                    statusText:
                      payload.status === 'accepted'
                        ? 'Proposal applied.'
                        : payload.status === 'rejected'
                          ? 'Proposal rejected.'
                          : payload.status === 'stale'
                            ? 'Proposal stale.'
                            : 'Proposal resolved.',
                    completedAt: Date.now()
                  }
                : entry
            )
          );
          return;
        }

        if (type === 'attributed_insight' && payload?.insightId) {
          setInsightsEntries((prev) => [
            ...prev,
            attributedInsightToInsightEntry(payload)
          ]);
          return;
        }

        if (type === 'reaction' && payload?.reactionId) {
          setAgentReactions((prev) => [...prev, payload]);
          // Auto-expire after 4s so the UI doesn't grow unbounded.
          setTimeout(() => {
            setAgentReactions((prev) => prev.filter((r) => r.reactionId !== payload.reactionId));
          }, 4000);
          return;
        }

        if (type === 'state_changed') {
          // An external proposal was accepted (or otherwise mutated state). Refetch session
          // state so the canvas + insights reflect the new revision.
          fetchSessionDiagramState({ sessionId: activeSessionId })
            .then((session) => {
              const data = session?.[contentMode];
              if (data) {
                stateRef.current = data;
                setState(data);
              }
            })
            .catch(() => {
              // Non-fatal; the next user action will resync.
            });
        }
      },
      onError: () => {
        // The browser auto-reconnects EventSource; nothing to do here for now.
      }
    });

    return close;
  }, [activeSessionId, contentMode]);

  const handleApproveHandshake = useCallback(async () => {
    if (!pendingHandshake) return;
    try {
      await approveHandshake({ sessionId: activeSessionId, requestId: pendingHandshake.requestId });
    } catch (err) {
      console.error('handshake approve failed', err);
    }
    setPendingHandshake(null);
  }, [pendingHandshake, activeSessionId]);

  const handleDenyHandshake = useCallback(async () => {
    if (!pendingHandshake) return;
    try {
      await denyHandshake({ sessionId: activeSessionId, requestId: pendingHandshake.requestId });
    } catch (err) {
      console.error('handshake deny failed', err);
    }
    setPendingHandshake(null);
  }, [pendingHandshake, activeSessionId]);

  const patchProposalInsightEntry = useCallback((proposalId, patch) => {
    if (!proposalId) return;
    setInsightsEntries((prev) =>
      prev.map((entry) => (entry.id === proposalId ? { ...entry, ...patch } : entry))
    );
  }, []);

  const handleAcceptProposal = useCallback(
    async (proposalId) => {
      if (!proposalId) throw new Error('Missing proposal id.');
      const body = await acceptProposalApi({ sessionId: activeSessionId, proposalId });
      patchProposalInsightEntry(proposalId, {
        proposalStatus: 'accepted',
        status: 'done',
        statusText: 'Proposal applied.',
        completedAt: Date.now()
      });
      if (body?.state?.diagramSource != null) {
        stateRef.current = body.state;
        setState(body.state);
      }
    },
    [activeSessionId, contentMode, patchProposalInsightEntry]
  );

  const handleRejectProposal = useCallback(
    async (proposalId) => {
      if (!proposalId) throw new Error('Missing proposal id.');
      await rejectProposalApi({ sessionId: activeSessionId, proposalId });
      patchProposalInsightEntry(proposalId, {
        proposalStatus: 'rejected',
        status: 'done',
        statusText: 'Proposal rejected.',
        completedAt: Date.now()
      });
    },
    [activeSessionId, patchProposalInsightEntry]
  );

  useEffect(() => {
    let cancelled = false;
    // Capture the textarea state at the moment the user toggled mode. Used below to gate
    // auto-rerun: if the user is actively typing a different prompt, don't clobber it.
    const promptAtSwitch = promptRef.current;
    setLoading(true);
    setActiveRequest('hydrate');
    fetchSessionDiagramState({ sessionId: activeSessionId })
      .then((session) => {
        if (cancelled) return;
        const data = session?.[contentMode];
        if (!data) {
          throw new Error('Invalid session state');
        }
        stateRef.current = data;
        setState(data);

        const otherMode = contentMode === 'mermaid' ? 'infographic' : 'mermaid';
        const otherSlot = session?.[otherMode];
        // "There should only be one topic at a time" — pick the slot whose `updatedAt` is most
        // recent so the topic the user most recently asked about always wins on a mode switch,
        // even if the destination slot has stale content from a different topic.
        const dataTopic = slotLastTopic(data);
        const otherTopic = slotLastTopic(otherSlot);
        const dataUpdatedAt = data?.updatedAt ?? '';
        const otherUpdatedAt = otherSlot?.updatedAt ?? '';
        let candidate = null;
        if (dataTopic && otherTopic) {
          candidate = otherUpdatedAt > dataUpdatedAt ? otherTopic : dataTopic;
        } else {
          candidate = dataTopic ?? otherTopic ?? sessionTopicRef.current ?? null;
        }

        if (candidate) {
          sessionTopicRef.current = candidate;
        }

        const trimmedAtSwitch = (promptAtSwitch ?? '').trim();
        if (!candidate && trimmedAtSwitch) {
          candidate = trimmedAtSwitch;
        }

        const newSlotInSync = isSlotInSyncForTopic(data, candidate);
        const textareaDirty = trimmedAtSwitch.length > 0 && trimmedAtSwitch !== candidate;
        const peerRequiresTranslation = peerRequiresModeSwitchTranslation({
          contentMode,
          session,
          candidate,
          syncMarkers: crossModeSyncRef.current
        });

        if (candidate && !textareaDirty) {
          setPrompt(candidate);
          promptRef.current = candidate;
        }

        const peerContext = buildIntentPeerContext(contentMode, session, candidate);
        // Cross-mode Restore intentionally jumps to a specific snapshot — don't let the auto
        // mode-switch rerun overwrite it on the very next hydrate pass.
        const restoreSuppressed = suppressNextModeSwitchRerunRef.current;
        if (restoreSuppressed) suppressNextModeSwitchRerunRef.current = false;
        if (
          !restoreSuppressed &&
          shouldAutoSubmitModeSwitchIntent({
            candidate,
            textareaDirty,
            newSlotInSync,
            peerRequiresTranslation
          })
        ) {
          const peerRevisionAtSubmit = otherSlot?.revisionId ?? 0;
          // Defer to a microtask so React has committed the state update before the auto
          // submit kicks off; pass the override anyway so revisionId is correct regardless.
          Promise.resolve().then(async () => {
            if (cancelled) return;
            try {
              if (!peerContext) {
                const cleared = await syncClientDiagramState({
                  contentType: contentMode,
                  diagramSource: '',
                  sessionId: activeSessionId
                });
                if (cancelled) return;
                stateRef.current = cleared;
                setState(cleared);
                await submitIntentWithPrompt(candidate, {
                  stateOverride: cleared,
                  skipLoadingGuard: true
                });
                return;
              }
              await submitIntentWithPrompt(candidate, {
                stateOverride: data,
                peerContext,
                skipLoadingGuard: true,
                modeSwitchSync: true,
                modeSwitchPeerRevisionId: peerRevisionAtSubmit
              });
            } catch (err) {
              if (!cancelled) setError(err.message);
            }
          });
        }
      })
      .catch(async (err) => {
        if (cancelled) return;
        if (err?.code === SESSION_NOT_FOUND_CODE) {
          // Two cases:
          //  (a) The URL had a stale session id (e.g., bookmark from before a server restart).
          //      We rotate to a fresh id so the user clearly leaves the dead session behind.
          //  (b) The session id we're hydrating is one WE just minted in ensureUrlBackedSession
          //      (first visit, no URL session), so the server has never seen it yet — the 404
          //      is expected. Keep the id (no URL flip) and just prime the server.
          const wasFreshlyMinted = freshlyMintedSessionIdsRef.current.has(activeSessionId);
          let targetId = activeSessionId;
          if (!wasFreshlyMinted) {
            wipeClientCachesAfterLostServerSession();
            sessionTopicRef.current = null;
            crossModeSyncRef.current = { mermaid: null, infographic: null };
            const fresh = createInitialDiagramState(contentMode);
            stateRef.current = fresh;
            setState(fresh);
            setLiveDraftSource('');
            setLiveDraftContentType(null);
            setLatestCritique(null);
            setInsightsEntries([]);
            setGoMadStreak(0);
            setCritiqueActionableSelected([]);
            cacheRef.current = null;
            targetId = normalizeSessionId(createSessionId()) ?? `session-${Date.now()}`;
            freshlyMintedSessionIdsRef.current.add(targetId);
          }
          // Prime the server BEFORE re-running the hydrate effect, so the next fetch finds
          // the session in the registry instead of 404'ing again.
          try {
            await Promise.all([
              syncClientDiagramState({ contentType: 'mermaid', diagramSource: '', sessionId: targetId }),
              syncClientDiagramState({ contentType: 'infographic', diagramSource: '', sessionId: targetId })
            ]);
          } catch {
            // best-effort — if priming sync fails the next user action will create the session
          }
          if (cancelled) return;
          freshlyMintedSessionIdsRef.current.delete(targetId); // server now knows about it
          if (targetId !== activeSessionId) {
            window.history.replaceState({}, '', `${sessionPathFor(targetId)}`);
            setActiveSessionId(targetId);
          } else {
            // Same id, server now primed — set empty state directly so we don't refetch.
            const fresh = createInitialDiagramState(contentMode);
            stateRef.current = fresh;
            setState(fresh);
          }
          return;
        }
        setError(err?.message ?? String(err));
      })
      .finally(() => {
        if (cancelled) return;
        loadingRef.current = false;
        setLoading(false);
        setActiveRequest(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, contentMode]);

  useEffect(() => {
    writeDiagramCache({
      diagramSource: state.diagramSource,
      contentMode,
      insightsEntries,
      latestCritique,
      editorOpen,
      insightsOpen,
      soundEnabled
    }, activeSessionId);
  }, [activeSessionId, contentMode, editorOpen, insightsEntries, insightsOpen, latestCritique, soundEnabled, state.diagramSource]);

  useEffect(() => {
    try {
      window.localStorage.setItem(MODEL_PROFILE_STORAGE_KEY, modelProfile);
    } catch {
      // ignore quota / privacy mode
    }
  }, [modelProfile]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CONTENT_MODE_STORAGE_KEY, contentMode);
    } catch {
      // ignore quota / privacy mode
    }
  }, [contentMode]);

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
      if (hoverCloseTimerRef.current != null) {
        window.clearTimeout(hoverCloseTimerRef.current);
        hoverCloseTimerRef.current = null;
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
    (entryId, variant = 'general', extras = {}) => {
      setCelebratingEntryId(entryId);
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
      const dwellMs = variant === 'goMad' ? 1100 : 900;
      celebrationTimerRef.current = setTimeout(() => setCelebratingEntryId(null), dwellMs);
      if (variant === 'goMad') tryAgentSound(playGoMadCompletionChime);
      else if (variant === 'refine') tryAgentSound(playRefineCompletion);
      else if (variant === 'innovate') tryAgentSound(playInnovateCompletion);
      else if (variant === 'critique') tryAgentSound(playCritiqueCompletion);
      else if (variant === 'explain') tryAgentSound(playExplainCompletion);
      else tryAgentSound(playCompletionChimeTone);

      const reduceMotion =
        typeof globalThis.matchMedia === 'function' &&
        globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const variantPalettes = {
        refine: ['#2563eb', '#60a5fa', '#bfdbfe', '#1d4ed8'],
        innovate: ['#9333ea', '#ec4899', '#f0abfc', '#a855f7'],
        goMad: ['#f97316', '#ec4899', '#a855f7', '#22d3ee', '#fde047'],
        critique: ['#b91c1c', '#f97316', '#fde68a', '#7c2d12'],
        explain: ['#0d9488', '#22d3ee', '#ccfbf1', '#0f766e'],
        general: ['#58cc02', '#1cb0f6', '#ffc800', '#ff4b4b', '#ce82ff']
      };
      const palette = variantPalettes[variant] || variantPalettes.general;
      if (!reduceMotion && canvasConfettiAvailable()) {
        try {
          const burstParticles = variant === 'goMad' ? 120 : 70;
          confetti({
            particleCount: burstParticles,
            spread: variant === 'goMad' ? 92 : 70,
            startVelocity: variant === 'goMad' ? 55 : 42,
            ticks: 200,
            origin: { x: 0.5, y: 0.4 },
            colors: palette
          });
        } catch {
          // canvas-confetti can throw in headless test envs; ignore.
        }
        tryAgentSound(playConfettiPop);
      }

      // Slopitect gamification: derive XP / streak / combo / achievement emissions.
      const knownVariants = ['refine', 'innovate', 'goMad', 'critique', 'explain'];
      if (knownVariants.includes(variant)) {
        const now = Date.now();
        // `goMadStreak` here is the closure-captured value at stream start (i.e. the
        // count of previous successful Go Mads); the just-completed run pushes depth to +1.
        const inferredGoMadDepth = variant === 'goMad' ? goMadStreak + 1 : undefined;
        setGamification((current) => {
          const { state, emissions } = applyCompletedRun(current, {
            variant,
            now,
            goMadDepth: extras?.goMadDepth ?? inferredGoMadDepth,
            critiquePerfect: extras?.critiquePerfect
          });
          if (typeof window !== 'undefined') {
            writeGamificationToStorage(window.localStorage, state);
          }
          if (emissions.length > 0) {
            const stamped = emissions.map((e) => {
              const seq = streakEmissionSeqRef.current + 1;
              streakEmissionSeqRef.current = seq;
              return { ...e, id: `slop-${now}-${seq}` };
            });
            const toasts = stamped.filter((e) =>
              e.kind === 'xp' || e.kind === 'streak' || e.kind === 'combo' || e.kind === 'text'
            );
            const banner = stamped.find((e) => e.kind === 'achievement' || e.kind === 'prestige');
            if (toasts.length > 0) {
              setStreakHudToasts((q) => [...q, ...toasts]);
              for (const t of toasts) {
                setTimeout(() => {
                  setStreakHudToasts((q) => q.filter((x) => x.id !== t.id));
                }, 1800);
              }
            }
            if (banner) {
              setStreakHudAchievement(banner);
              setTimeout(() => {
                setStreakHudAchievement((current) => (current?.id === banner.id ? null : current));
              }, 3200);
            }
            // Audio: streak / combo / achievement.
            for (const e of emissions) {
              if (e.kind === 'streak' && e.streak >= 2) {
                tryAgentSound((ctx) => playStreakStinger(ctx, e.streak));
              } else if (e.kind === 'combo') {
                tryAgentSound((ctx) => playComboStinger(ctx, e.combo));
              } else if (e.kind === 'achievement' || e.kind === 'prestige') {
                tryAgentSound(playAchievementFanfare);
                if (!reduceMotion && canvasConfettiAvailable()) {
                  try {
                    confetti({
                      particleCount: 160,
                      spread: 110,
                      startVelocity: 60,
                      ticks: 240,
                      origin: { x: 0.5, y: 0.35 },
                      colors: ['#fde68a', '#fcd34d', '#f59e0b', '#ec4899', '#a855f7', '#22d3ee']
                    });
                  } catch {
                    // ignore
                  }
                }
              }
            }
          }
          return state;
        });
      }
    },
    [tryAgentSound, goMadStreak]
  );


  const animateAcceptedSource = useCallback((nextState, onFullyApplied, opts = {}) => {
    const previousState = stateRef.current;
    const nextSource = nextState.diagramSource;

    if (streamTimerRef.current != null) {
      cancelAnimationFrame(streamTimerRef.current);
      streamTimerRef.current = null;
    }

    if (previousState.revisionId === nextState.revisionId || previousState.diagramSource === nextSource) {
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
          if (prev.diagramSource === slice && prev.revisionId === nextState.revisionId) {
            return prev;
          }
          return {
            ...nextState,
            diagramSource: slice,
            updatedAt: nextState.updatedAt ?? previousState.updatedAt
          };
        });
      });

      streamTimerRef.current = requestAnimationFrame(pump);
    }

    streamTimerRef.current = requestAnimationFrame(pump);
  }, []);

  const appendInsightEntry = useCallback((title, variant = 'general', options = {}) => {
    const { diagramUndoBaseline, topic, retryDescriptor } = options;
    const id = globalThis.crypto?.randomUUID?.() ?? `ins-${Date.now()}`;
    setInsightsEntries((prev) => [
      ...prev,
      {
        id,
        title,
        variant,
        topic: topic ?? null,
        content: '',
        statusText: 'Working on your request...',
        status: 'running',
        technicalActions: [],
        phases: [],
        artifacts: [],
        streamDebugLog: [],
        startedAt: Date.now(),
        completedAt: null,
        ...(retryDescriptor ? { retryDescriptor } : {}),
        ...(diagramUndoBaseline
          ? {
              diagramUndoBaseline: { ...diagramUndoBaseline },
              diagramRevisionApplied: false,
              diagramUndoConsumed: false,
              diagramAfterSource: null,
              diagramAfterContentType: null,
              diagramAfterRevisionId: null
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

  const handleSelectContentMode = useCallback(
    (nextMode) => {
      if (nextMode === contentMode) return;
      stopStreamingAgentRequest();
      setSelectedNode(null);
      setHoverDescriptor(null);
      setToolbarAnchor(null);
      setLatestCritique(null);
      tryAgentSound(playModeSwoosh);
      setContentMode(nextMode);
    },
    [contentMode, stopStreamingAgentRequest]
  );

  const runStreamingAgent = useCallback(
    async ({
      operation,
      payload,
      title,
      onFinal,
      variant = 'general',
      diagramUndoBaseline,
      topic,
      modeSwitchSync = false,
      modeSwitchPeerRevisionId = null
    }) => {
      setInsightsOpen(true);
      const retryDescriptor = buildInsightRetryDescriptor({
        operation,
        payload,
        variant,
        topic,
        modelProfile: payload.modelProfile ?? modelProfile,
        modeSwitchSync,
        modeSwitchPeerRevisionId,
        focusNode: payload.focusNode
      });
      const sectionId = appendInsightEntry(title, variant, {
        diagramUndoBaseline,
        topic,
        retryDescriptor
      });
      if (variant === 'goMad') tryAgentSound(playGoMadStreamStart);
      else if (variant === 'innovate') tryAgentSound(playInnovateStreamStart);
      else if (variant === 'refine') tryAgentSound(playRefineStreamStart);
      else tryAgentSound(playStreamStartChime);
      lastTokenSoundAtRef.current = 0;
      goMadTokenTickIndexRef.current = 0;
      const streamAcc = { text: '' };
      const abortCtrl = new AbortController();
      streamAgentAbortRef.current = abortCtrl;
      const streamCtx = {
        sectionId,
        operation,
        variant,
        diagramUndoBaseline,
        patchInsightEntry,
        appendToInsight,
        setInsightStatus,
        appendTechnicalAction,
        lastTokenSoundAtRef,
        goMadTokenTickIndexRef,
        lastDraftTickAtRef,
        tryAgentSound,
        playGoMadTokenTick,
        playTokenTickChime,
        playToolStartChime,
        playToolEndChime,
        playDraftTick,
        playFailureChime,
        playPhaseChangePluck,
        playRefineTokenTick,
        playInnovateTokenTick,
        playCritiqueTokenTick,
        playExplainTokenTick,
        playRefinePolishLoop,
        playInnovateSynthLoop,
        playGoMadKlaxonLoop,
        playGoMadAirhornBlast,
        playCritiqueScribbleLoop,
        playCritiquePenStab,
        playExplainPageFlipLoop,
        setLiveDraftSource,
        setLiveDraftContentType,
        setGoMadStreak,
        sessionTopicRef,
        crossModeSyncRef,
        modeSwitchSync,
        modeSwitchPeerRevisionId,
        animateAcceptedSource,
        pendingAutoDiagramHighlightRef,
        pendingAutoDiagramHighlightTimeoutRef,
        triggerCompletionDelight,
        onFinal
      };
      try {
        await streamDiagramAgent(
          payload,
          (evt) => {
            appendStreamDebugLog(sectionId, evt);
            if (
              evt?.type === LEGACY_STREAM_TYPE_A2UI &&
              Array.isArray(evt.messages) &&
              evt.messages.length > 0
            ) {
              setLatestCritiqueA2uiMessages(evt.messages);
            }
            applyAgentStreamInsightEvent(streamAcc, streamCtx, evt);
          },
          { signal: abortCtrl.signal, sessionId: activeSessionId }
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
          const failure = resolveAgentStreamFailureStatus({ operation, message: err.message });
          patchInsightEntry(sectionId, (entry) => ({
            ...entry,
            status: 'failed',
            statusText: failure.statusText,
            failureClass: failure.failureClass,
            failureDetail: failure.detail,
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
      activeSessionId,
      modelProfile,
      patchInsightEntry,
      setGoMadStreak,
      setInsightStatus,
      triggerCompletionDelight,
      tryAgentSound
    ]
  );

  const insightsEntriesRef = useRef(insightsEntries);
  useEffect(() => {
    insightsEntriesRef.current = insightsEntries;
  }, [insightsEntries]);

  const retryFailedInsight = useCallback(
    async (entryId, options = {}) => {
      const entry = insightsEntriesRef.current.find((e) => e.id === entryId);
      const desc = entry?.retryDescriptor;
      if (!desc || loadingRef.current || streamingPreviewRef.current) return;

      const useQuality = Boolean(options.useQuality);
      const profile = useQuality ? 'quality' : desc.modelProfile ?? modelProfile;

      setLoading(true);
      setActiveRequest(desc.operation === 'intent' ? 'intent' : `transform:${desc.mode}`);
      setError('');
      if (desc.variant !== 'goMad') setGoMadStreak(0);

      try {
        const syncedState = await syncDiagramOrThrow();
        const sharedPayload = {
          revisionId: syncedState.revisionId,
          diagramSource: syncedState.diagramSource,
          contentType: contentMode,
          modelProfile: profile,
          focusNode: desc.focusNode ?? undefined,
          ...(desc.peerContext ? { peerContext: desc.peerContext } : {})
        };

        if (desc.operation === 'intent') {
          await runStreamingAgent({
            operation: 'intent',
            payload: {
              operation: 'intent',
              prompt: desc.prompt,
              settings: desc.settings ?? {},
              ...sharedPayload
            },
            title: entry.title,
            variant: desc.variant,
            diagramUndoBaseline: { ...syncedState },
            topic: desc.topic,
            modeSwitchSync: desc.modeSwitchSync,
            modeSwitchPeerRevisionId: desc.modeSwitchPeerRevisionId
          });
        } else {
          await runStreamingAgent({
            operation: 'transform',
            payload: {
              operation: 'transform',
              mode: desc.mode,
              ...(desc.goMadDepth != null ? { goMadDepth: desc.goMadDepth } : {}),
              ...sharedPayload
            },
            title: entry.title,
            variant: desc.variant,
            diagramUndoBaseline: { ...syncedState },
            topic: desc.topic
          });
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setActiveRequest(null);
      }
    },
    [contentMode, modelProfile, runStreamingAgent, syncDiagramOrThrow]
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
          contentType: contentMode,
          diagramSource: brokenSource,
          sessionId: activeSessionId
        });
        setState(syncedState);

        const result = await submitDiagramIntent({
          contentType: contentMode,
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
          diagramSource: syncedState.diagramSource,
          settings: {},
          modelProfile,
          sessionId: activeSessionId
        });

        animateAcceptedSource(result.state);
      } catch (err) {
        setError(err.message);
        setLoading(false);
        setActiveRequest(null);
      }
    },
    [activeSessionId, animateAcceptedSource, contentMode, modelProfile]
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
      if (nextSource === currentState.diagramSource) {
        return currentState;
      }
      scheduledSource = nextSource;
      const nextState = {
        ...currentState,
        diagramSource: nextSource,
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
          contentType: contentMode,
          diagramSource: scheduledSource,
          sessionId: activeSessionId
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
      contentType: contentMode,
      diagramSource: currentState.diagramSource,
      sessionId: activeSessionId
    });
    setState(syncedState);
    return syncedState;
  }

  async function submitIntentWithPrompt(nextPrompt, options = {}) {
    const trimmed = (nextPrompt ?? '').trim();
    if (!trimmed) return;
    if (
      !options.skipLoadingGuard &&
      (loadingRef.current || streamingPreviewRef.current)
    ) {
      return;
    }

    tryAgentSound(playSubmitThunk);
    setGoMadStreak(0);
    const focusNode = focusPayload(selectedNode);
    setLoading(true);
    setActiveRequest('intent');
    setError('');

    try {
      // Mode-switch auto-rerun passes `stateOverride` so we don't need to wait for React's
      // setState flush. Without it, syncDiagramOrThrow would read stale `stateRef.current`
      // (the OLD mode's slot) and submit the wrong revisionId.
      const syncedState = options.stateOverride
        ? options.stateOverride
        : await syncDiagramOrThrow();
      await runStreamingAgent({
        operation: 'intent',
        payload: {
          operation: 'intent',
          prompt: trimmed,
          revisionId: syncedState.revisionId,
          diagramSource: syncedState.diagramSource,
          contentType: contentMode,
          settings: {},
          focusNode,
          modelProfile,
          ...(options.peerContext ? { peerContext: options.peerContext } : {})
        },
        title: goIntentInsightTitle(trimmed, selectedNode),
        variant: 'intent',
        diagramUndoBaseline: { ...syncedState },
        topic: topicFromDescriptor(selectedNode),
        modeSwitchSync: Boolean(options.modeSwitchSync),
        modeSwitchPeerRevisionId:
          options.modeSwitchPeerRevisionId != null ? options.modeSwitchPeerRevisionId : null
      });
      // Retain the prompt so the user can see and refine the current topic. Mode-switch
      // carry-over relies on this too — the textarea is the visible source of truth for
      // "the topic this session is currently about."
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
    // Voice always starts a FRESH dictation. With the prompt textarea now retaining the
    // last topic after submit, seeding from `promptRef.current` would compound text across
    // consecutive mic sessions ("topic A topic B topic C…"). Clear here so the user sees
    // an empty textarea fill in as they speak.
    setPrompt('');
    promptRef.current = '';
    voiceAccumulatedRef.current = '';

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

  async function runTransform(mode, options = {}) {
    const useDiagramFocus = Boolean(options.useDiagramFocus);
    hasInteractedRef.current = true;
    if (loadingRef.current || streamingPreviewRef.current) return;
    if (!stateRef.current.diagramSource.trim()) return;

    if (mode !== 'goMad') setGoMadStreak(0);

    const focusOverride = options.focusTarget ?? null;
    const baseFocus = focusOverride || selectedNode;
    const focusNode = useDiagramFocus ? undefined : focusPayload(baseFocus);
    const titleSelection = useDiagramFocus ? null : baseFocus;
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
          diagramSource: syncedState.diagramSource,
          contentType: contentMode,
          focusNode,
          modelProfile,
          ...(mode === 'goMad' ? { goMadDepth } : {})
        },
        title: selectionActionTitle(titleSelection, transformTitleVerb),
        variant: mode,
        diagramUndoBaseline: { ...syncedState },
        topic: topicFromDescriptor(titleSelection)
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setActiveRequest(null);
    }
  }

  async function runAnalyze(kind, options = {}) {
    const useDiagramFocus = Boolean(options.useDiagramFocus);
    hasInteractedRef.current = true;
    if (loadingRef.current || streamingPreviewRef.current) return;
    if (!stateRef.current.diagramSource.trim()) return;

    const focusOverride = options.focusTarget ?? null;
    const baseFocus = focusOverride || selectedNode;
    const focusNode = useDiagramFocus ? undefined : focusPayload(baseFocus);
    const titleSelection = useDiagramFocus ? null : baseFocus;
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
          diagramSource: syncedState.diagramSource,
          contentType: contentMode,
          focusNode,
          modelProfile
        },
        title: selectionActionTitle(titleSelection, labels[kind]),
        variant: kind,
        topic: topicFromDescriptor(titleSelection),
        onFinal: ({ finalText }) => {
          if (kind !== 'critique') return;
          const cleaned = finalText.trim();
          if (!cleaned) return;
          setLatestCritique({
            text: cleaned,
            focusNode,
            topic: topicFromDescriptor(titleSelection),
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
    async (scope = 'all', options = {}) => {
      hasInteractedRef.current = true;
      if (!latestCritique?.text || loadingRef.current || streamingPreviewRef.current) return;

      const split = splitCritiqueActionableSections(latestCritique.text);
      const actionableItems = split.items;
      const checkValues = options.checkValues;
      const selectedMask =
        checkValues != null
          ? actionableItems.map((_, i) => Boolean(checkValues[i]))
          : actionableItems.map((_, i) => Boolean(critiqueActionableSelected[i]));

      if (scope === 'selected') {
        if (actionableItems.length === 0) return;
        const chosen = actionableItems.filter((_, i) => selectedMask[i]);
        if (chosen.length === 0) return;
      }

      const itemsToApply =
        scope === 'selected'
          ? actionableItems.filter((_, i) => selectedMask[i])
          : actionableItems;

      const useActionableBullets = itemsToApply.length > 0;
      let critiqueBlock;
      if (useActionableBullets) {
        critiqueBlock = itemsToApply.map((t) => `- ${t}`).join('\n');
      } else {
        critiqueBlock = latestCritique.text;
      }

      const FIX_PROMPT_MAX_CRITIQUE_CHARS = 2000;
      if (critiqueBlock.length > FIX_PROMPT_MAX_CRITIQUE_CHARS) {
        critiqueBlock = `${critiqueBlock.slice(0, FIX_PROMPT_MAX_CRITIQUE_CHARS).trimEnd()}\n…`;
      }

      const intro = useActionableBullets
        ? 'Improve the current Mermaid diagram by applying ONLY the following improvements. Do not implement other critique suggestions.'
        : 'Improve the current Mermaid diagram based on this critique. Apply concrete fixes as a single complete diagram update.';
      const critiqueLabel = useActionableBullets ? 'Improvements to apply:' : 'Critique:';
      const requirementsBlock = useActionableBullets
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
            diagramSource: syncedState.diagramSource,
            contentType: contentMode,
            settings: {},
            focusNode: latestCritique.focusNode,
            modelProfile
          },
          title: selectionActionTitle(latestCritique.focusNode, 'Fix from critique'),
          variant: 'intent',
          diagramUndoBaseline: { ...syncedState },
          topic: latestCritique.topic ?? topicFromDescriptor(latestCritique.focusNode)
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
    if (streamTimerRef.current != null) {
      cancelAnimationFrame(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    stopVoiceInput({ immediate: true });
    setStreamingPreview(false);
    setLiveDraftSource('');
    setLiveDraftContentType(null);
    setPrompt('');
    promptRef.current = '';
    setSelectedNode(null);
    setHoverDescriptor(null);
    setToolbarAnchor(null);
    setLatestCritique(null);
    setInsightsEntries([]);
    setCritiqueActionableSelected([]);
    sessionTopicRef.current = null;
    crossModeSyncRef.current = { mermaid: null, infographic: null };
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
      // Spin up a fresh server-side session, seeded with empty state for BOTH slots so the
      // canvas, thinking pane, and the inactive mode all start blank — and so the next
      // hydration call (triggered by the activeSessionId change below) sees a created session
      // instead of 404'ing.
      const nid = normalizeSessionId(createSessionId()) ?? `session-${Date.now()}`;
      freshlyMintedSessionIdsRef.current.add(nid);
      await Promise.all([
        syncClientDiagramState({ contentType: 'mermaid', diagramSource: '', sessionId: nid }),
        syncClientDiagramState({ contentType: 'infographic', diagramSource: '', sessionId: nid })
      ]);
      freshlyMintedSessionIdsRef.current.delete(nid);
      const fresh = createInitialDiagramState(contentMode);
      stateRef.current = fresh;
      setState(fresh);
      cacheRef.current = null;
      window.history.replaceState({}, '', sessionPathFor(nid));
      setActiveSessionId(nid);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setActiveRequest(null);
    }
  }

  /**
   * Restore the canvas to the version produced by an entry's run — i.e., the diagram shown
   * in that entry's "Resulting diagram" preview. This is a per-version bookmark: the user
   * can click Restore on any past entry to jump back to that snapshot.
   *
   * If the entry was created in a different mode than the current one, switch modes first —
   * otherwise the restored DSL would be fed to the wrong renderer and fail to draw.
   */
  const applyDiagramSnapshotToCanvas = useCallback(
    async ({ diagramSource, contentType, styleConfig }) => {
      if (typeof diagramSource !== 'string' || !diagramSource.trim()) return;
      if (contentType !== 'mermaid' && contentType !== 'infographic') return;

      const needsModeSwitch = contentType !== contentMode;

      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      if (streamTimerRef.current != null) {
        cancelAnimationFrame(streamTimerRef.current);
        streamTimerRef.current = null;
      }
      setStreamingPreview(false);
      if (needsModeSwitch) suppressNextModeSwitchRerunRef.current = true;

      try {
        const payload = {
          contentType,
          diagramSource,
          sessionId: activeSessionId
        };
        if (styleConfig != null) {
          payload.styleConfig = styleConfig;
        }
        const synced = await syncClientDiagramState(payload);
        setState(synced);
        if (needsModeSwitch) setContentMode(contentType);
        if (diagramAutoHighlightTimerRef.current != null) {
          window.clearTimeout(diagramAutoHighlightTimerRef.current);
          diagramAutoHighlightTimerRef.current = null;
        }
        clearPendingAutoDiagramHighlight();
        setDiagramChangeHighlightEntryId(null);
      } catch (err) {
        if (needsModeSwitch) suppressNextModeSwitchRerunRef.current = false;
        setError(err.message);
      }
    },
    [activeSessionId, clearPendingAutoDiagramHighlight, contentMode]
  );

  const handleRestoreToEntry = useCallback(
    async (entryId) => {
      if (loadingRef.current) return;

      const entry = insightsEntries.find((e) => e.id === entryId);
      const targetSource = entry?.diagramAfterSource;
      const targetContentType = entry?.diagramAfterContentType;
      if (typeof targetSource !== 'string' || !targetSource.trim()) return;
      if (targetContentType !== 'mermaid' && targetContentType !== 'infographic') return;

      const baseline = entry?.diagramUndoBaseline;
      await applyDiagramSnapshotToCanvas({
        diagramSource: targetSource,
        contentType: targetContentType,
        styleConfig: baseline?.styleConfig
      });
    },
    [applyDiagramSnapshotToCanvas, insightsEntries]
  );

  const handleRestoreDiagramSnapshot = useCallback(
    async ({ diagramSource, contentType }) => {
      if (loadingRef.current) return;
      await applyDiagramSnapshotToCanvas({ diagramSource, contentType });
    },
    [applyDiagramSnapshotToCanvas]
  );

  const handleOpenProposalFullPreview = useCallback(
    async ({ diagramSource, contentType }) => {
      if (loadingRef.current) return;
      await applyDiagramSnapshotToCanvas({ diagramSource, contentType });
      requestAnimationFrame(() => {
        document.querySelector('.diagram-output')?.scrollIntoView?.({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      });
    },
    [applyDiagramSnapshotToCanvas]
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
    const baseline = entry?.diagramUndoBaseline?.diagramSource;
    if (typeof baseline !== 'string') return null;
    if (contentMode === 'mermaid') {
      return diffMermaidFlowcharts(baseline, state.diagramSource ?? '');
    }
    if (contentMode === 'infographic') {
      return diffInfographicSources(baseline, state.diagramSource ?? '');
    }
    return null;
  }, [contentMode, diagramChangeHighlightEntryId, insightsEntries, state.diagramSource]);

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

  // Per-entry structural diff used to auto-highlight changes inside the embedded
  // "Resulting diagram" preview. Mermaid uses flowchart parser; infographic walks the
  // indented item tree (see infographicDiff.js).
  const entryDiagramDiffById = useMemo(() => {
    const map = {};
    for (const entry of insightsEntries) {
      if (!entry?.diagramRevisionApplied) continue;
      const kind = entry.diagramAfterContentType;
      const baseline = entry.diagramUndoBaseline?.diagramSource;
      const after = entry.diagramAfterSource;
      if (typeof baseline !== 'string' || typeof after !== 'string') continue;
      try {
        if (kind === 'mermaid') {
          map[entry.id] = diffMermaidFlowcharts(baseline, after);
        } else if (kind === 'infographic') {
          map[entry.id] = diffInfographicSources(baseline, after);
        }
      } catch {
        // diff is best-effort; skip entry on failure
      }
    }
    return map;
  }, [insightsEntries]);

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
    if (!state.diagramSource?.trim()) {
      clearPendingAutoDiagramHighlight();
    }
  }, [clearPendingAutoDiagramHighlight, state.diagramSource]);

  // On mobile, when a run completes and produces a new diagram revision, auto-collapse the
  // insights pane so the freshly-rendered diagram becomes visible without the user manually
  // closing the thinking pane that otherwise covers the whole canvas.
  const prevAutoCloseRunningRef = useRef(false);
  const prevAutoCloseRevisionIdRef = useRef(state.revisionId);
  useEffect(() => {
    const anyRunning = insightsEntries.some((e) => (e.status ?? 'running') === 'running');
    const wasRunning = prevAutoCloseRunningRef.current;
    const prevRevisionId = prevAutoCloseRevisionIdRef.current;
    const revisionChanged = state.revisionId !== prevRevisionId;
    if (
      narrowLayout &&
      insightsOpen &&
      wasRunning &&
      !anyRunning &&
      revisionChanged &&
      Boolean(state.diagramSource?.trim())
    ) {
      setInsightsOpen(false);
    }
    prevAutoCloseRunningRef.current = anyRunning;
    prevAutoCloseRevisionIdRef.current = state.revisionId;
  }, [insightsEntries, narrowLayout, insightsOpen, state.revisionId, state.diagramSource]);

  const busy = loading || streamingPreview;

  const clearHoverCloseTimer = useCallback(() => {
    if (hoverCloseTimerRef.current != null) {
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const id = selectedNode?.id ?? null;
    if (id && id !== prevSelectedNodeIdRef.current) {
      setRadialMenuVisible(true);
    } else if (!id) {
      setRadialMenuVisible(false);
    }
    prevSelectedNodeIdRef.current = id;
  }, [selectedNode?.id]);

  useEffect(() => {
    if (!radialMenuVisible || !selectedNode?.id || !toolbarAnchor) {
      setRadialMenuSession(null);
      return;
    }
    const nextKey = descriptorKey(selectedNode);
    setRadialMenuSession((prev) => {
      const prevKey = prev ? descriptorKey(prev.descriptor) : null;
      if (prevKey === nextKey && prev?.anchor) return prev;
      return { descriptor: selectedNode, anchor: toolbarAnchor };
    });
  }, [radialMenuVisible, selectedNode, toolbarAnchor]);

  const handleHoverTargetChange = useCallback(
    (descriptor) => {
      if (descriptor) {
        clearHoverCloseTimer();
        setHoverDescriptor(descriptor);
        return;
      }
      clearHoverCloseTimer();
      hoverCloseTimerRef.current = window.setTimeout(() => {
        hoverCloseTimerRef.current = null;
        setHoverDescriptor(null);
      }, 120);
    },
    [clearHoverCloseTimer]
  );

  const dismissRadialMenu = useCallback(() => {
    clearHoverCloseTimer();
    setRadialMenuVisible(false);
  }, [clearHoverCloseTimer]);

  const handleSelectedNodeChange = useCallback(
    (next) => {
      if (next?.id && radialMenuVisible && selectedNode?.id && next.id === selectedNode.id) {
        dismissRadialMenu();
        return;
      }
      setSelectedNode(next);
      if (!next) setToolbarAnchor(null);
    },
    [dismissRadialMenu, radialMenuVisible, selectedNode?.id]
  );

  const cancelMenuClose = useCallback(() => {
    clearHoverCloseTimer();
  }, [clearHoverCloseTimer]);

  const scheduleMenuClose = useCallback(() => {
    clearHoverCloseTimer();
    hoverCloseTimerRef.current = window.setTimeout(() => {
      hoverCloseTimerRef.current = null;
      setRadialMenuVisible(false);
    }, RADIAL_MENU_CLOSE_GRACE_MS);
  }, [clearHoverCloseTimer]);

  const closeRadialMenu = useCallback(() => {
    clearHoverCloseTimer();
    setRadialMenuVisible(false);
    setHoverDescriptor(null);
  }, [clearHoverCloseTimer]);

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
      clearHoverCloseTimer();
      setRadialMenuVisible(false);
      setRadialMenuSession(null);
      setSelectedNode(null);
      setHoverDescriptor(null);
      setToolbarAnchor(null);
      setDiagramChangeHighlightAddedOnly(false);
      setDiagramChangeHighlightEntryId(entryId);
      diagramAutoHighlightTimerRef.current = window.setTimeout(() => {
        diagramAutoHighlightTimerRef.current = null;
        setDiagramChangeHighlightEntryId((prev) => (prev === entryId ? null : prev));
      }, AUTO_DIAGRAM_CHANGE_HIGHLIGHT_MS);
    },
    [clearHoverCloseTimer]
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

  const agentThinkingChrome = useMemo(
    () => loading || insightsEntries.some((e) => (e.status ?? 'running') === 'running'),
    [loading, insightsEntries]
  );
  const hasDiagramText = Boolean(state.diagramSource?.trim());
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
    const streamMessages =
      Array.isArray(latestCritiqueA2uiMessages) && latestCritiqueA2uiMessages.length > 0
        ? latestCritiqueA2uiMessages
        : null;
    return {
      critiqueText: latestCritique.text,
      headingText: critiqueActionableSplit.headingText,
      items,
      prefix: critiqueActionableSplit.prefix,
      suffix: critiqueActionableSplit.suffix,
      a2uiMessages: streamMessages,
      busy,
      onFixSelected: (mask) => {
        if (Array.isArray(mask)) {
          handleFixFromCritique('selected', { checkValues: mask });
        } else {
          handleFixFromCritique('selected');
        }
      },
      onFixAll: () => handleFixFromCritique('all')
    };
  }, [busy, critiqueActionableSplit, handleFixFromCritique, latestCritique?.text, latestCritiqueA2uiMessages]);

  const status = useMemo(() => {
    if (loading && activeRequest === 'intent') return 'Applying diagram change.';
    if (loading && activeRequest?.startsWith?.('transform')) return 'Transforming diagram.';
    if (loading && activeRequest?.startsWith?.('analyze')) return 'Analyzing diagram.';
    if (loading && activeRequest === 'fix') return 'Applying critique fixes.';
    if (loading && activeRequest === 'clear') return 'Resetting diagram.';
    if (loading && activeRequest === 'autofix') return 'Fixing Mermaid syntax.';
    if (loading && activeRequest === 'hydrate') return 'Loading shared session.';
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

  const handleRadialAction = (action, descriptor) => {
    if (!descriptor) return;
    setSelectedNode(descriptor);
    closeRadialMenu();
    const runOpts = { focusTarget: descriptor };
    const variantForBoot =
      action.id === 'refine' || action.id === 'innovate' || action.id === 'goMad' ||
      action.id === 'critique' || action.id === 'explain'
        ? action.id
        : null;
    if (variantForBoot) {
      setBootSeq((prev) => ({ trigger: prev.trigger + 1, variant: variantForBoot }));
      if (variantForBoot === 'refine') tryAgentSound(playRefineBoot);
      else if (variantForBoot === 'innovate') tryAgentSound(playInnovateBoot);
      else if (variantForBoot === 'goMad') tryAgentSound(playGoMadBoot);
      else if (variantForBoot === 'critique') tryAgentSound(playCritiqueBoot);
      else if (variantForBoot === 'explain') tryAgentSound(playExplainBoot);
    }
    if (action.id === 'refine') runTransform('refine', runOpts);
    else if (action.id === 'innovate') runTransform('innovate', runOpts);
    else if (action.id === 'goMad') runTransform('goMad', runOpts);
    else if (action.id === 'critique') runAnalyze('critique', runOpts);
    else if (action.id === 'explain') runAnalyze('explain', runOpts);
    else if (action.id === 'fix') handleFixFromCritique('all');
  };

  const radialActions = useMemo(() => {
    const list = [
      {
        id: 'refine',
        label: 'Refine',
        icon: <MermaidMarkIcon />,
        variant: 'refine'
      },
      {
        id: 'innovate',
        label: 'Innovate',
        icon: '+',
        variant: 'innovate',
        sizeClass: 'is-wide-label'
      },
      {
        id: 'goMad',
        label: goMadShapeLabel(goMadStreak),
        icon: '!',
        variant: 'go-mad'
      },
      {
        id: 'critique',
        label: 'Critique',
        icon: '?',
        variant: 'critique',
        sizeClass: 'is-wide-label'
      },
      {
        id: 'fix',
        label: 'Fix',
        icon: 'w',
        variant: 'fix',
        hidden: !latestCritique?.text,
        disabled: !canFixFromCritique
      },
      {
        id: 'explain',
        label: 'Explain',
        icon: 'i',
        variant: 'explain',
        sizeClass: 'is-wide-label'
      }
    ];
    return list;
  }, [canFixFromCritique, goMadStreak, latestCritique?.text]);

  const { mounted: insightsMounted, closing: insightsClosing } = useDelayedUnmount(insightsOpen, 240);
  const insightsSlot = insightsMounted ? (
    <InsightsPane
      entries={insightsEntries}
      soundEnabled={soundEnabled}
      onSoundEnabledChange={setSoundEnabled}
      celebratingEntryId={celebratingEntryId}
      streamDebugEnabled={streamDebugEnabled}
      critiqueActionableUi={critiqueActionableUi}
      diagramUndoDisabled={loading}
      onRestoreToEntry={handleRestoreToEntry}
      onRestoreDiagramSnapshot={handleRestoreDiagramSnapshot}
      onOpenProposalFullPreview={handleOpenProposalFullPreview}
      entryDiagramDiffById={entryDiagramDiffById}
      diagramChangeHighlightEntryId={diagramChangeHighlightEntryId}
      diagramChangeHighlightSummary={diagramChangeHighlightSummary}
      diagramChangeHighlightDisabled={loading}
      onToggleDiagramChangeHighlight={handleToggleDiagramChangeHighlight}
      onStopStreamingAgent={streamingAgentStoppable ? stopStreamingAgentRequest : undefined}
      onRetryInsightEntry={retryFailedInsight}
      onRetryInsightEntryWithQuality={(entryId) => retryFailedInsight(entryId, { useQuality: true })}
      retryActionsDisabled={loading}
      onDismiss={() => setInsightsOpen(false)}
      onAcceptProposal={handleAcceptProposal}
      onRejectProposal={handleRejectProposal}
      agentReactions={agentReactions}
      closing={insightsClosing}
    />
  ) : null;

  // Pick a variant for shell-level FX during an active stream.
  const liveStreamingEntry = insightsEntries.find((e) => (e.status ?? 'running') === 'running');
  const liveVariant = liveStreamingEntry?.variant ?? null;
  return (
    <main
      className={`app-shell ${editorOpen ? 'is-editor-open' : ''} ${insightsOpen ? 'is-insights-open' : ''}`}
      aria-label="ArchiSlop"
      data-live-variant={liveStreamingEntry ? liveVariant : undefined}
      data-streaming={liveStreamingEntry ? 'true' : undefined}
    >
      <DiagramCanvas
        revisionId={state.revisionId}
        diagramSource={
          liveDraftSource && liveDraftContentType === contentMode
            ? liveDraftSource
            : state.diagramSource
        }
        contentType={contentMode}
        onManualEdit={handleManualEdit}
        onValidationChange={handleValidationChange}
        streamingPreview={streamingPreview || (Boolean(liveDraftSource) && liveDraftContentType === contentMode)}
        agentThinking={agentThinkingChrome && !streamingPreview}
        editorOpen={editorOpen}
        insightsOpen={insightsMounted && Boolean(insightsSlot)}
        insightsSlot={insightsSlot}
        selectedNode={selectedNode}
        hoverDescriptor={hoverDescriptor}
        onSelectedNodeChange={handleSelectedNodeChange}
        onHoverTargetChange={handleHoverTargetChange}
        onPanGestureStart={dismissRadialMenu}
        onNodeToolbarAnchor={setToolbarAnchor}
        changeHighlight={changeHighlightForCanvas}
        onDiagramSvgRendered={handleDiagramSvgRendered}
        runFx={{
          variant: liveVariant,
          streaming: Boolean(liveStreamingEntry),
          intensity:
            (gamification?.streakByVariant?.[liveVariant] ?? 0) >= 2 || goMadStreak >= 2
              ? 'high'
              : 'normal'
        }}
      />

      <RadialActionMenu
        descriptor={radialMenuSession?.descriptor ?? null}
        anchor={radialMenuSession?.anchor ?? null}
        actions={radialActions}
        busy={busy}
        onActionPick={handleRadialAction}
        onHoverHold={cancelMenuClose}
        onHoverRelease={scheduleMenuClose}
        onBackdropPointerDown={dismissRadialMenu}
        onClose={closeRadialMenu}
      />

      <ActionBootSequence trigger={bootSeq.trigger} variant={bootSeq.variant} />
      <StreakHud toasts={streakHudToasts} achievement={streakHudAchievement} />
      <SlopitectCompanion
        key={`companion-${bootSeq.trigger}`}
        variant={liveVariant}
        streaming={Boolean(liveStreamingEntry)}
      />
      <LiveRunHud
        key={`live-${bootSeq.trigger}`}
        variant={liveVariant}
        streaming={Boolean(liveStreamingEntry)}
        streak={gamification?.streakByVariant?.[liveVariant] ?? 0}
      />

      <div
        className="corner-control brand-control"
        aria-label="ArchiSlop"
        onClick={handleBrandTripleClick}
      >
        <span className="brand-mark" aria-hidden="true">
          <ArchiSlopMarkIcon />
        </span>
        <span className="brand-name">ArchiSlop</span>
        {gamification?.prestigeShortLabel ? (
          <span
            className="brand-prestige-badge"
            title={`${gamification.totalRuns ?? 0} total slop runs`}
            data-testid="brand-prestige-badge"
          >
            {gamification.prestigeShortLabel}
          </span>
        ) : null}
      </div>

      <AgentHandshakeDialog
        request={pendingHandshake}
        onApprove={handleApproveHandshake}
        onDeny={handleDenyHandshake}
      />

      <InviteAgentDialog
        sessionId={activeSessionId}
        open={inviteDialogOpen}
        onClose={() => setInviteDialogOpen(false)}
      />

      <div className="corner-control edit-control">
        {narrowLayout ? (
          <button
            type="button"
            className={`overlay-button thinking-toggle-button ${agentThinkingChrome ? 'is-agent-active' : ''}`}
            onClick={() => setInsightsOpen((v) => !v)}
            aria-label={insightsOpen ? 'Hide Thinking' : 'Show Thinking'}
          >
            <ButtonIcon>{insightsOpen ? '-' : '+'}</ButtonIcon>
            Thinking
          </button>
        ) : null}
        <button type="button" className="overlay-button" onClick={() => setEditorOpen((current) => !current)}>
          <ButtonIcon>{editorOpen ? 'x' : '</>'}</ButtonIcon>
          {editorOpen ? 'Close' : 'Code'}
        </button>
      </div>

      {editorOpen ? (
        <div className="corner-control editor-done-bar">
          <button type="button" className="overlay-button primary-button" onClick={() => setEditorOpen(false)}>
            Done editing
          </button>
        </div>
      ) : null}

      <div className="corner-control bottom-chrome">
        <div className="prompt-stack">
          {!hasDiagramText ? (
            <form className="prompt-control" onSubmit={runIntentChange}>
              <label className="sr-only" htmlFor="diagram-change-prompt">
                Your Topic
              </label>
              <input
                id="diagram-change-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Your Topic"
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
                  <span className="button-label">Mic</span>
                </button>
                <button type="submit" className="overlay-button primary-button" disabled={busy || !prompt.trim()}>
                  <ButtonIcon>{'>'}</ButtonIcon>
                  <span className="button-label">Go</span>
                </button>
              </div>
            </form>
          ) : null}

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

          {hasDiagramText && !narrowLayout ? (
            <div className="prompt-actions prompt-actions--desktop">
              <span className="button-group-label">Shape</span>
              <div className="button-group">
                <button
                  type="button"
                  className="overlay-button compact-button"
                  disabled={busy}
                  onClick={() => runTransform('refine', { useDiagramFocus: true })}
                >
                  <ButtonIcon>
                    <MermaidMarkIcon />
                  </ButtonIcon>
                  Refine
                </button>
                <button
                  type="button"
                  className="overlay-button compact-button"
                  disabled={busy}
                  onClick={() => runTransform('innovate', { useDiagramFocus: true })}
                >
                  <ButtonIcon>+</ButtonIcon>
                  Innovate
                </button>
                <button
                  type="button"
                  className="overlay-button compact-button"
                  disabled={busy}
                  onClick={() => runTransform('goMad', { useDiagramFocus: true })}
                >
                  <ButtonIcon>!</ButtonIcon>
                  {goMadShapeLabel(goMadStreak)}
                </button>
              </div>
              <span className="button-group-label">Read</span>
              <div className="button-group">
                <button
                  type="button"
                  className="overlay-button compact-button"
                  disabled={busy}
                  onClick={() => runAnalyze('critique', { useDiagramFocus: true })}
                >
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
                <button
                  type="button"
                  className="overlay-button compact-button"
                  disabled={busy}
                  onClick={() => runAnalyze('explain', { useDiagramFocus: true })}
                >
                  <ButtonIcon>i</ButtonIcon>
                  Explain
                </button>
              </div>
              <div className="button-group">
                <button type="button" className="overlay-button compact-button" disabled={busy} onClick={() => handleClearDiagram()}>
                  <ButtonIcon>x</ButtonIcon>
                  Clear
                </button>
              </div>
            </div>
          ) : null}

          {hasDiagramText && narrowLayout ? (
            <div className="prompt-actions prompt-actions--mobile">
              <div className="button-group">
                <button
                  type="button"
                  className="overlay-button compact-button"
                  disabled={busy}
                  onClick={() => runTransform('refine', { useDiagramFocus: true })}
                  aria-label="Refine"
                  title="Refine"
                >
                  <ButtonIcon>
                    <MermaidMarkIcon />
                  </ButtonIcon>
                  <span className="button-label">Refine</span>
                </button>
                <button
                  type="button"
                  className="overlay-button compact-button"
                  disabled={busy}
                  onClick={() => runTransform('innovate', { useDiagramFocus: true })}
                  aria-label="Innovate"
                  title="Innovate"
                >
                  <ButtonIcon>+</ButtonIcon>
                  <span className="button-label">Innovate</span>
                </button>
                <button
                  type="button"
                  className="overlay-button compact-button"
                  disabled={busy}
                  onClick={() => runTransform('goMad', { useDiagramFocus: true })}
                  aria-label={goMadShapeLabel(goMadStreak)}
                  title={goMadShapeLabel(goMadStreak)}
                >
                  <ButtonIcon>!</ButtonIcon>
                  <span className="button-label">{goMadShapeLabel(goMadStreak)}</span>
                </button>
                <button
                  type="button"
                  className="overlay-button compact-button"
                  disabled={busy}
                  onClick={() => runAnalyze('critique', { useDiagramFocus: true })}
                  aria-label="Critique"
                  title="Critique"
                >
                  <ButtonIcon>?</ButtonIcon>
                  <span className="button-label">Critique</span>
                </button>
                {latestCritique?.text ? (
                  <button
                    type="button"
                    className="overlay-button compact-button"
                    disabled={!canFixFromCritique}
                    onClick={() => handleFixFromCritique('all')}
                    aria-label="Fix"
                    title="Fix"
                  >
                    <ButtonIcon>w</ButtonIcon>
                    <span className="button-label">Fix</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  className="overlay-button compact-button"
                  disabled={busy}
                  onClick={() => runAnalyze('explain', { useDiagramFocus: true })}
                  aria-label="Explain"
                  title="Explain"
                >
                  <ButtonIcon>i</ButtonIcon>
                  <span className="button-label">Explain</span>
                </button>
                <button
                  type="button"
                  className="overlay-button compact-button"
                  disabled={busy}
                  onClick={() => handleClearDiagram()}
                  aria-label="Clear"
                  title="Clear"
                >
                  <ButtonIcon>x</ButtonIcon>
                  <span className="button-label">Clear</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {!narrowLayout ? (
          <div className="ai-corner-controls ai-corner-controls--desktop" aria-label="AI model and thinking">
            <AiCornerControlsInner
              contentMode={contentMode}
              onSelectContentMode={handleSelectContentMode}
              modelProfile={modelProfile}
              onSelectModelProfile={setModelProfile}
              modeSwitchDisabled={loading || streamingPreview}
              pendingHandshake={pendingHandshake}
              externalAgentPresence={externalAgentPresence}
              onInviteAgent={() => setInviteDialogOpen(true)}
              agentThinkingChrome={agentThinkingChrome}
              insightsOpen={insightsOpen}
              onToggleInsights={() => setInsightsOpen((v) => !v)}
            />
          </div>
        ) : null}

        {narrowLayout ? (
          <div className="ai-corner-controls ai-corner-controls--mobile" aria-label="AI model and thinking">
            <AiCornerControlsInner
              contentMode={contentMode}
              onSelectContentMode={handleSelectContentMode}
              modelProfile={modelProfile}
              onSelectModelProfile={setModelProfile}
              modeSwitchDisabled={loading || streamingPreview}
              pendingHandshake={pendingHandshake}
              externalAgentPresence={externalAgentPresence}
              onInviteAgent={() => setInviteDialogOpen(true)}
              agentThinkingChrome={agentThinkingChrome}
              insightsOpen={insightsOpen}
              onToggleInsights={() => setInsightsOpen((v) => !v)}
              includeThinkingToggle={false}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}

function App() {
  return <ArchiSlop />;
}

export default App;
