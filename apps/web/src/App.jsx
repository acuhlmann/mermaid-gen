import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DiagramCanvas from './components/DiagramCanvas.jsx';
import DiagramFullscreenButton from './components/DiagramFullscreenButton.jsx';
import DiagramFullscreenOverlay from './components/DiagramFullscreenOverlay.jsx';
import { useDiagramFullscreen } from './hooks/useDiagramFullscreen.js';
import InsightsPane from './components/InsightsPane.jsx';
import RadialActionMenu from './components/RadialActionMenu.jsx';
import AgentHandshakeDialog from './components/AgentHandshakeDialog.jsx';
import InviteAgentDialog from './components/InviteAgentDialog.jsx';
import SlopNextPrompt from './components/SlopNextPrompt.jsx';
import ClearConfirmDialog from './components/ClearConfirmDialog.jsx';
import StakeholdersMascot from './components/StakeholdersMascot.jsx';
import { useAdvisorOrchestrator } from './hooks/useAdvisorOrchestrator.js';
import { readAdvisorMuted } from './utils/advisorMuteStorage.js';
import { applyDiagramHighlightToSvg } from './utils/applyDiagramHighlightToSvg.js';
import {
  openSessionEventsStream,
  approveHandshake,
  denyHandshake,
  acceptProposal as acceptProposalApi,
  rejectProposal as rejectProposalApi,
  joinRoomByPairingCode
} from './state/sessionEventsClient.js';
import {
  buildIntentPeerContext,
  createEmptyCrossModeSyncMarkers,
  createSessionId,
  fallbackState,
  fetchSessionDiagramState,
  isSlotInSyncForTopic,
  needsModeSwitchPeerSync,
  normalizeSessionId,
  peerRequiresModeSwitchTranslation,
  pickPrimaryPeerMode,
  resolveModeSwitchCandidate,
  isDiagramCacheSubstantial,
  isServerSessionPristine,
  mintFreshServerSession,
  readDiagramCache,
  SESSION_NOT_FOUND_CODE,
  shouldAutoSubmitModeSwitchIntent,
  streamDiagramAgent,
  syncClientDiagramState,
  submitDiagramIntent,
  submitDiagramRenderRepair,
  writeDiagramCache
} from './state/diagramStore.js';
import { isMermaidInfrastructureError } from './utils/mermaidRenderErrors.js';
import { buildAutoFixPrompt } from './utils/autoFixPrompt.js';
import { applyAgentStreamInsightEvent } from './state/applyAgentStreamInsightEvent';
import { buildAgentStreamInsightContext } from './state/agentStreamInsightContext';
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
  playLevelUpFanfare,
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
  playToolStartChime,
  playXpPickup
} from './utils/agentChimes.js';
import RunCeremonyOverlays from './components/RunCeremonyOverlays.jsx';
import ErrorToast from './components/ErrorToast.jsx';
import HotkeyOverlay from './components/HotkeyOverlay.jsx';
import { pushError } from './state/errorToastStore.js';
import { useDiagramHotkeys } from './hooks/useDiagramHotkeys.js';
import XpProgressBar from './components/XpProgressBar.jsx';
import LevelUpInfoPanel from './components/LevelUpInfoPanel.jsx';
import {
  applyCompletedRun,
  clearStorage as clearGamificationStorage,
  createInitialState as createInitialGamificationState,
  readFromStorage as readGamificationFromStorage,
  writeToStorage as writeGamificationToStorage
} from './state/runGamificationStore.js';
import {
  CONSOLE_STAMP_LINES,
  PROMPT_ACTION_COPY,
  PROMPT_EASTER_EGGS,
  IDLE_TIPS,
  KONAMI_ACHIEVEMENT,
  STAKEHOLDERS_MUTE_COPY,
  getVariantPersona
} from './utils/slopitectCopy.js';
import confetti from 'canvas-confetti';
import { canvasConfettiAvailable } from './utils/appConfetti.js';
import { formatToolLabel } from './utils/appToolLabels.js';
import { coercePatchApplyDisplayStats, formatPatchApplyDetail } from './utils/formatTechnicalActionDetail.js';
import { readStreamDebugEnabled, snapshotStreamEventForDebug } from './utils/appStreamDebug.js';
import {
  proposalToInsightEntry,
  enrichProposalForInsight,
  attributedInsightToInsightEntry,
  focusPayload,
  goMadShapeLabel,
  selectionActionTitle,
  topicFromDescriptor
} from './utils/appInsightHelpers.js';
import {
  MODEL_PROFILE_STORAGE_KEY,
  CONTENT_MODE_STORAGE_KEY,
  sessionPathFor,
  ensureUrlBackedSession,
  readStoredModelProfile,
  readStoredContentMode
} from './utils/appSessionLocation.js';
import {
  createInitialDiagramState,
  splitCritiqueActionableSections
} from '@archislop/shared';
import { collapseConsecutiveApplyPatchActions } from './utils/collapsePatchTechnicalActions.js';
import { computeDiagramStructuralDiff } from './utils/diagramChangeDiff.js';
import { goIntentInsightTitle } from './utils/goIntentInsightTitle.js';
import { resolveAgentStreamFailureStatus } from './utils/agentStreamFailureStatus.js';
import { buildInsightRetryDescriptor } from './utils/insightRetryDescriptor.js';
import { resolveAdvisorAcceptOperation } from './utils/advisorAcceptRouting.js';
import {
  buildAdvisorIntentPrompt,
  resolveAdvisorFocusNode
} from './utils/advisorActionContext.js';
import { useCompactBrandLayout, useNarrowLayout } from './hooks/useAppLayoutMedia.js';
import { useDelayedUnmount } from './utils/useDelayedUnmount.js';
import {
  ButtonIcon,
  ArchiSlopMarkIcon,
  PromptIcon,
  MicIcon,
  MicActiveIcon,
  CodeEditorIcon,
  CodeCloseIcon
} from './components/AppIcons.jsx';
import { ActionPersonaIcon, ActionPersonaRole } from './components/ActionPersonaBits.jsx';
import { AiCornerControlsInner } from './components/AiCornerControlsInner.jsx';
import { TopShell } from './components/TopShell.jsx';
import { BottomRow } from './components/BottomRow.jsx';
import { useSyncVisualViewportHeight } from './hooks/useSyncVisualViewportHeight.js';
import {
  actionPersonaName,
  actionPersonaEmoji,
  actionPersonaTitle
} from './utils/appActionPersonas.js';

const RADIAL_MENU_CLOSE_GRACE_MS = 450;
/** Auto-show diagram diff highlights after the final SVG for an agent-applied revision is on screen. */
const AUTO_DIAGRAM_CHANGE_HIGHLIGHT_MS = 7000;

const SpeechRecognitionCtor = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

function ArchiSlop() {
  const initialSessionIdRef = useRef(null);
  // Tracks session ids that the client minted (server hasn't seen them yet). The hydration
  // 404 handler uses this to decide whether to keep the same id or rotate to a new one.
  const freshlyMintedSessionIdsRef = useRef(new Set());
  /** True when the boot URL already contained `/sessions/:id` (bookmark / share link). */
  const sessionIdFromUrlRef = useRef(false);
  if (initialSessionIdRef.current == null) {
    const { sessionId: bootId, fromUrl } = ensureUrlBackedSession();
    initialSessionIdRef.current = bootId;
    sessionIdFromUrlRef.current = fromUrl;
    if (!fromUrl) freshlyMintedSessionIdsRef.current.add(bootId);
  }
  const [activeSessionId, setActiveSessionId] = useState(initialSessionIdRef.current);
  /** Skip local cache for URL-backed sessions until hydrate proves the server still has that room. */
  const cacheRef = useRef(
    sessionIdFromUrlRef.current ? null : readDiagramCache(initialSessionIdRef.current)
  );
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const [state, setState] = useState(fallbackState);
  const [prompt, setPrompt] = useState('');
  /** Fresh instruction for the inline “slop next” prompt — never prefilled from the session topic. */
  const [slopNextPrompt, setSlopNextPrompt] = useState('');
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
  /** Bumped on every mode switch so the diagram canvas can remount renderers for a fresh layout pass. */
  const [rendererRefreshKey, setRendererRefreshKey] = useState(0);
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
  /** Successful consecutive Go Mad transforms; resets after Refine/Innovate/Intent/Clear/fix-from-critique. */
  const [goMadStreak, setGoMadStreak] = useState(0);
  /** Slopitect gamification state (persisted) + transient emissions queue for StreakHud. */
  const [gamification, setGamification] = useState(() => {
    if (typeof window === 'undefined') return createInitialGamificationState();
    return readGamificationFromStorage(window.localStorage) ?? createInitialGamificationState();
  });
  const [streakHudToasts, setStreakHudToasts] = useState([]);
  const [streakHudAchievement, setStreakHudAchievement] = useState(null);
  const [streakHudLevelUp, setStreakHudLevelUp] = useState(null);
  /** Bumped each time the player crosses a level. The XP bar uses it as a flash key. */
  const [xpBarFlashKey, setXpBarFlashKey] = useState(0);
  /** Mobile-only: XP bar starts collapsed below the brand row; toggled by tapping the role badge. */
  const [xpBarMobileOpen, setXpBarMobileOpen] = useState(false);
  /** Click-to-open level/XP info popover anchored to the XP bar. */
  const [xpInfoPanelOpen, setXpInfoPanelOpen] = useState(false);
  const streakEmissionSeqRef = useRef(0);
  /** Boot-sequence trigger: counter + variant. Each pick increments → overlay re-mounts. */
  const [bootSeq, setBootSeq] = useState({ trigger: 0, variant: null });
  const [selectedNode, setSelectedNode] = useState(null);
  const [hotkeyOverlayOpen, setHotkeyOverlayOpen] = useState(false);
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
  /** Inline slop-next prompt expanded from the action bar or radial menu. */
  const [slopPromptExpanded, setSlopPromptExpanded] = useState(false);
  const [slopPromptSource, setSlopPromptSource] = useState(null);
  /** Demolition confirmation overlay shown before the Clear action wipes the session. */
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  /** Currently-displayed Slopitect Tip™ chip rendered below the brand control. */
  const [slopitectTip, setSlopitectTip] = useState(null);

  const syncTimerRef = useRef(null);
  const streamTimerRef = useRef(null);
  /** AbortController for in-flight `streamDiagramAgent` (Thinking panel / transforms). */
  const streamAgentAbortRef = useRef(null);
  const autoCloseActiveEntryIdRef = useRef(null);
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
  const voiceAccumulatedRef = useRef('');
  const micSessionRef = useRef(0);
  const slopPromptExpandedRef = useRef(false);
  const slopPromptSourceRef = useRef(null);
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
  const crossModeSyncRef = useRef(createEmptyCrossModeSyncMarkers());

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
  const compactBrand = useCompactBrandLayout();

  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  useEffect(() => {
    slopPromptExpandedRef.current = slopPromptExpanded;
  }, [slopPromptExpanded]);

  useEffect(() => {
    slopPromptSourceRef.current = slopPromptSource;
  }, [slopPromptSource]);

  const closeSlopPrompt = useCallback(() => {
    setSlopPromptExpanded(false);
    setSlopPromptSource(null);
    setSlopNextPrompt('');
  }, []);

  const openChromeSlopPrompt = useCallback(() => {
    setSlopNextPrompt('');
    setSlopPromptSource('chrome');
    setSlopPromptExpanded(true);
  }, []);

  const toggleChromeSlopPrompt = useCallback(() => {
    if (slopPromptExpanded && slopPromptSource === 'chrome') {
      closeSlopPrompt();
    } else {
      openChromeSlopPrompt();
    }
  }, [slopPromptExpanded, slopPromptSource, closeSlopPrompt, openChromeSlopPrompt]);

  const openRadialSlopPrompt = useCallback(() => {
    setSlopNextPrompt('');
    setSlopPromptSource('radial');
    setSlopPromptExpanded(true);
  }, []);

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

  // Tip chip lives below the brand logo. A single click on the logo brings up
  // a fresh tip; the idle scheduler below cycles them on its own.
  const SLOPITECT_TIP_TTL_MS = 7000;
  const tipSeqRef = useRef(0);
  const tipDismissTimerRef = useRef(null);
  const slopitectTipRef = useRef(null);
  const showSlopitectTip = useCallback(() => {
    const tip = IDLE_TIPS[Math.floor(Math.random() * IDLE_TIPS.length)] || '';
    if (!tip) return;
    const seq = tipSeqRef.current + 1;
    tipSeqRef.current = seq;
    const next = {
      id: `tip-${Date.now()}-${seq}`,
      text: tip
    };
    setSlopitectTip(next);
    if (tipDismissTimerRef.current) clearTimeout(tipDismissTimerRef.current);
    tipDismissTimerRef.current = setTimeout(() => {
      setSlopitectTip((current) => (current?.id === next.id ? null : current));
      tipDismissTimerRef.current = null;
    }, SLOPITECT_TIP_TTL_MS);
  }, []);

  const handleBrandClick = useCallback(() => {
    showSlopitectTip();
  }, [showSlopitectTip]);

  const dismissSlopitectTip = useCallback(() => {
    if (tipDismissTimerRef.current) {
      clearTimeout(tipDismissTimerRef.current);
      tipDismissTimerRef.current = null;
    }
    setSlopitectTip(null);
  }, []);

  useEffect(() => {
    if (!slopitectTip) return undefined;
    const onDocPointer = (event) => {
      if (slopitectTipRef.current?.contains(event.target)) return;
      if (event.target?.closest?.('.brand-control')) return;
      dismissSlopitectTip();
    };
    document.addEventListener('pointerdown', onDocPointer);
    return () => document.removeEventListener('pointerdown', onDocPointer);
  }, [slopitectTip, dismissSlopitectTip]);

  // Auto-show a Slopitect Tip™ roughly every other minute, with jitter so it
  // doesn't feel metronome-y. Range: ~60s–180s between tips.
  useEffect(() => {
    let cancelled = false;
    let timeoutId = null;
    function scheduleNext() {
      if (cancelled) return;
      const jitterMs = 60_000 + Math.random() * 120_000;
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        showSlopitectTip();
        scheduleNext();
      }, jitterMs);
    }
    scheduleNext();
    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [showSlopitectTip]);

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
  // One always-open SSE stream per active session (after hydrate so SSE cannot register a phantom room).
  useEffect(() => {
    if (!activeSessionId || !sessionHydrated) return undefined;

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
            fetchSessionDiagramState({ sessionId: activeSessionId })
              .then((session) => {
                setInsightsEntries((prev) => {
                  const existingIds = new Set(prev.map((e) => e.id));
                  const additions = proposals
                    .filter((p) => !existingIds.has(p.proposalId))
                    .map((p) =>
                      proposalToInsightEntry(
                        enrichProposalForInsight(p, session, activeSessionId)
                      )
                    );
                  return additions.length > 0 ? [...prev, ...additions] : prev;
                });
              })
              .catch(() => {
                setInsightsEntries((prev) => {
                  const existingIds = new Set(prev.map((e) => e.id));
                  const additions = proposals
                    .filter((p) => !existingIds.has(p.proposalId))
                    .map((p) => proposalToInsightEntry(p));
                  return additions.length > 0 ? [...prev, ...additions] : prev;
                });
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
          fetchSessionDiagramState({ sessionId: activeSessionId })
            .then((session) => {
              setInsightsEntries((prev) => {
                if (prev.some((e) => e.id === payload.proposalId)) return prev;
                return [
                  ...prev,
                  proposalToInsightEntry(
                    enrichProposalForInsight(payload, session, activeSessionId)
                  )
                ];
              });
            })
            .catch(() => {
              setInsightsEntries((prev) => {
                if (prev.some((e) => e.id === payload.proposalId)) return prev;
                return [...prev, proposalToInsightEntry(payload)];
              });
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
  }, [activeSessionId, sessionHydrated]);

  const handleApproveHandshake = useCallback(async () => {
    if (!pendingHandshake) return;
    try {
      await approveHandshake({ sessionId: activeSessionId, requestId: pendingHandshake.requestId });
    } catch (err) {
      console.error('handshake approve failed', err);
      pushError(`Handshake approve failed: ${err?.message ?? 'unknown error'}`);
    }
    setPendingHandshake(null);
  }, [pendingHandshake, activeSessionId]);

  const handleDenyHandshake = useCallback(async () => {
    if (!pendingHandshake) return;
    try {
      await denyHandshake({ sessionId: activeSessionId, requestId: pendingHandshake.requestId });
    } catch (err) {
      console.error('handshake deny failed', err);
      pushError(`Handshake deny failed: ${err?.message ?? 'unknown error'}`);
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
    setSessionHydrated(false);
    setLoading(true);
    setActiveRequest('hydrate');
    fetchSessionDiagramState({ sessionId: activeSessionId })
      .then((session) => {
        if (cancelled) return;
        freshlyMintedSessionIdsRef.current.delete(activeSessionId);
        const staleLocalCache = readDiagramCache(activeSessionId);
        if (
          sessionIdFromUrlRef.current &&
          isServerSessionPristine(session) &&
          isDiagramCacheSubstantial(staleLocalCache)
        ) {
          const err = new Error('Session not found');
          err.code = SESSION_NOT_FOUND_CODE;
          throw err;
        }
        const data = session?.[contentMode];
        if (!data) {
          throw new Error('Invalid session state');
        }
        stateRef.current = data;
        setState(data);

        const trimmedAtSwitch = (promptAtSwitch ?? '').trim();
        let candidate = resolveModeSwitchCandidate({
          contentMode,
          session,
          sessionTopic: sessionTopicRef.current,
          promptAtSwitch: trimmedAtSwitch
        });

        if (candidate) {
          sessionTopicRef.current = candidate;
        }

        const primaryPeerMode = pickPrimaryPeerMode({ contentMode, session, candidate });
        const peerSlot = primaryPeerMode ? session?.[primaryPeerMode] : null;

        const newSlotInSync = isSlotInSyncForTopic(data, candidate);
        const textareaDirty = trimmedAtSwitch.length > 0 && trimmedAtSwitch !== candidate;
        const peerRequiresTranslation = peerRequiresModeSwitchTranslation({
          contentMode,
          session,
          candidate,
          syncMarkers: crossModeSyncRef.current
        });
        const needsPeerSync = needsModeSwitchPeerSync({
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
            peerRequiresTranslation,
            needsPeerSync
          })
        ) {
          const peerRevisionAtSubmit = peerSlot?.revisionId ?? 0;
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
                modeSwitchPeerRevisionId: peerRevisionAtSubmit,
                modeSwitchPeerMode: primaryPeerMode
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
          setInsightsEntries([]);
          setLatestCritique(null);
          setCritiqueActionableSelected([]);
          setPrompt('');
          promptRef.current = '';
          setLiveDraftSource('');
          setLiveDraftContentType(null);
          setGoMadStreak(0);
          sessionTopicRef.current = null;
          crossModeSyncRef.current = createEmptyCrossModeSyncMarkers();
          cacheRef.current = null;
          sessionIdFromUrlRef.current = false;
          clearGamificationStorage(window.localStorage);
          setGamification(createInitialGamificationState());
          setModelProfile('fast');
          setContentMode('mermaid');
          // Two cases:
          //  (a) Stale URL/bookmark after a server restart — rotate to a new room id + wipe storage.
          //  (b) Client-minted id on first visit — 404 is expected; keep id and prime the server.
          const wasFreshlyMinted = freshlyMintedSessionIdsRef.current.has(activeSessionId);
          let targetId = activeSessionId;
          if (!wasFreshlyMinted) {
            const fresh = createInitialDiagramState('mermaid');
            stateRef.current = fresh;
            setState(fresh);
            try {
              targetId = await mintFreshServerSession();
            } catch {
              targetId = normalizeSessionId(createSessionId()) ?? `session-${Date.now()}`;
            }
            freshlyMintedSessionIdsRef.current.add(targetId);
          } else {
            try {
              await Promise.all([
                syncClientDiagramState({ contentType: 'mermaid', diagramSource: '', sessionId: targetId }),
                syncClientDiagramState({ contentType: 'infographic', diagramSource: '', sessionId: targetId }),
                syncClientDiagramState({ contentType: 'metaphor3d', diagramSource: '', sessionId: targetId }),
                syncClientDiagramState({ contentType: 'chart', diagramSource: '', sessionId: targetId }),
                syncClientDiagramState({ contentType: 'anything', diagramSource: '', sessionId: targetId })
              ]);
            } catch {
              // best-effort — if priming sync fails the next user action will create the session
            }
          }
          if (cancelled) return;
          if (targetId !== activeSessionId) {
            // Keep targetId in freshlyMintedSessionIdsRef so the next hydration cycle
            // treats it as client-minted and primes the server if it lands on a different
            // Cloud Run instance. The .then() path cleans it up after a successful fetch.
            window.history.replaceState({}, '', `${sessionPathFor(targetId)}`);
            setActiveSessionId(targetId);
          } else {
            freshlyMintedSessionIdsRef.current.delete(targetId);
            const fresh = createInitialDiagramState('mermaid');
            stateRef.current = fresh;
            setState(fresh);
          }
          return;
        }
        setError(err?.message ?? String(err));
      })
      .finally(() => {
        if (cancelled) return;
        sessionIdFromUrlRef.current = false;
        setSessionHydrated(true);
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
      diagramSource: contentMode === 'anything' ? '' : state.diagramSource,
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

  const appendActivePromptText = useCallback((text) => {
    if (!text) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    if (slopPromptExpandedRef.current) {
      setSlopNextPrompt((current) => (current ? `${current.trimEnd()} ${trimmed}` : trimmed));
      return;
    }
    setPrompt((current) => {
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
        exec: ['#1e3a8a', '#94a3b8', '#cbd5e1', '#1e293b'],
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
      const knownVariants = ['refine', 'innovate', 'goMad', 'critique', 'explain', 'exec'];
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
            const levelUpEmission = stamped.find((e) => e.kind === 'levelUp');
            if (toasts.length > 0) {
              setStreakHudToasts((q) => [...q, ...toasts]);
              for (const t of toasts) {
                setTimeout(() => {
                  setStreakHudToasts((q) => q.filter((x) => x.id !== t.id));
                }, 1800);
              }
            }
            if (levelUpEmission) {
              setStreakHudLevelUp(levelUpEmission);
              setXpBarFlashKey((n) => n + 1);
              setTimeout(() => {
                setStreakHudLevelUp((current) =>
                  current?.id === levelUpEmission.id ? null : current
                );
              }, 5200);
            }
            if (banner) {
              setStreakHudAchievement(banner);
              setTimeout(() => {
                setStreakHudAchievement((current) => (current?.id === banner.id ? null : current));
              }, 3200);
            }
            // Audio: xp pickup / streak / combo / level-up / achievement.
            for (const e of emissions) {
              if (e.kind === 'xp') {
                tryAgentSound(playXpPickup);
              } else if (e.kind === 'streak' && e.streak >= 2) {
                tryAgentSound((ctx) => playStreakStinger(ctx, e.streak));
              } else if (e.kind === 'combo') {
                tryAgentSound((ctx) => playComboStinger(ctx, e.combo));
              } else if (e.kind === 'levelUp') {
                tryAgentSound(playLevelUpFanfare);
                if (!reduceMotion && canvasConfettiAvailable()) {
                  try {
                    // Two-side burst so level-ups feel different from achievements.
                    confetti({
                      particleCount: 110,
                      spread: 75,
                      startVelocity: 55,
                      ticks: 220,
                      origin: { x: 0.18, y: 0.55 },
                      colors: ['#fde68a', '#fcd34d', '#f59e0b', '#ec4899', '#a855f7']
                    });
                    confetti({
                      particleCount: 110,
                      spread: 75,
                      startVelocity: 55,
                      ticks: 220,
                      origin: { x: 0.82, y: 0.55 },
                      colors: ['#22d3ee', '#60a5fa', '#a855f7', '#f472b6', '#fde68a']
                    });
                  } catch {
                    // ignore
                  }
                }
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
    const { diagramUndoBaseline, topic, retryDescriptor, contentType, modelProfile } = options;
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
        planBeats: [],
        artifacts: [],
        streamDebugLog: [],
        startedAt: Date.now(),
        completedAt: null,
        contentType: contentType ?? null,
        modelProfile: modelProfile ?? null,
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
    (id, name, status, opts = {}) => {
      patchInsightEntry(id, (entry) => {
        const current = Array.isArray(entry.technicalActions) ? entry.technicalActions : [];
        if (status === 'done') {
          const toolCallId = opts.toolCallId;
          const actionIndex = [...current].reverse().findIndex((action) => {
            if (toolCallId && action.toolCallId === toolCallId) {
              return action.status === 'running';
            }
            if (!name) return action.status === 'running';
            return action.name === name && action.status === 'running';
          });
          if (actionIndex >= 0) {
            const realIndex = current.length - 1 - actionIndex;
            const runningAction = current[realIndex];
            const startedAt = Number.isFinite(runningAction.startedAt)
              ? runningAction.startedAt
              : Date.now();
            const durationMs = Math.max(0, Date.now() - startedAt);
            const nextActions = current.map((action, idx) =>
              idx === realIndex ? { ...action, status: 'done', durationMs } : action
            );
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
              status,
              startedAt: status === 'running' ? Date.now() : undefined,
              ...(opts.toolCallId ? { toolCallId: opts.toolCallId } : {}),
              ...(opts.contextNote ? { contextNote: opts.contextNote } : {})
            }
          ]
        };
      });
    },
    [patchInsightEntry]
  );

  const enrichTechnicalActionDetail = useCallback(
    (id, name, { toolCallId, patchStats, outcomeDetail } = {}) => {
      patchInsightEntry(id, (entry) => {
        const current = Array.isArray(entry.technicalActions) ? entry.technicalActions : [];
        const actionIndex = [...current].reverse().findIndex((action) => {
          if (toolCallId && action.toolCallId === toolCallId) return true;
          return action.name === name;
        });
        if (actionIndex < 0) return entry;
        const realIndex = current.length - 1 - actionIndex;
        const action = current[realIndex];
        const mergedStats = {
          ...(action.patchStats && typeof action.patchStats === 'object' ? action.patchStats : {}),
          ...(patchStats && typeof patchStats === 'object' ? patchStats : {})
        };
        const detail =
          (typeof outcomeDetail === 'string' && outcomeDetail.trim()) ||
          formatPatchApplyDetail(
            coercePatchApplyDisplayStats(mergedStats, action.durationMs)
          );
        const nextActions = current.map((item, idx) =>
          idx === realIndex
            ? {
                ...item,
                ...(Object.keys(mergedStats).length > 0 ? { patchStats: mergedStats } : {}),
                ...(detail ? { outcomeDetail: detail } : {})
              }
            : item
        );
        return { ...entry, technicalActions: nextActions };
      });
    },
    [patchInsightEntry]
  );

  const finalizeTechnicalActionResult = useCallback(
    (id, name, { status = 'done', validationError, outcomeDetail, toolCallId } = {}) => {
      const errorText = typeof validationError === 'string' ? validationError.trim() : '';
      const detailText = typeof outcomeDetail === 'string' ? outcomeDetail.trim() : '';
      if (!errorText && !detailText && status === 'done') {
        patchInsightEntry(id, (entry) => {
          const current = Array.isArray(entry.technicalActions) ? entry.technicalActions : [];
          const actionIndex = [...current].reverse().findIndex((action) => {
            if (toolCallId && action.toolCallId === toolCallId) return action.status === 'running';
            return action.name === name && action.status === 'running';
          });
          if (actionIndex < 0) return entry;
          const realIndex = current.length - 1 - actionIndex;
          const nextActions = current.map((action, idx) =>
            idx === realIndex ? { ...action, status: 'done' } : action
          );
          return { ...entry, technicalActions: nextActions };
        });
        return;
      }
      patchInsightEntry(id, (entry) => {
        const current = Array.isArray(entry.technicalActions) ? entry.technicalActions : [];
        const actionIndex = [...current].reverse().findIndex((action) => {
          if (toolCallId && action.toolCallId === toolCallId) return action.status === 'running';
          return action.name === name && action.status === 'running';
        });
        if (actionIndex < 0) return entry;
        const realIndex = current.length - 1 - actionIndex;
        const nextActions = current.map((action, idx) =>
          idx === realIndex
            ? {
                ...action,
                status: status === 'rejected' ? 'rejected' : 'done',
                ...(errorText ? { validationError: errorText } : {}),
                ...(detailText ? { outcomeDetail: detailText } : {})
              }
            : action
        );
        return { ...entry, technicalActions: nextActions };
      });
    },
    [patchInsightEntry]
  );

  const annotateTechnicalActionResult = useCallback(
    (id, name, { validationError, toolCallId } = {}) => {
      const errorText = typeof validationError === 'string' ? validationError.trim() : '';
      if (!errorText) return;
      patchInsightEntry(id, (entry) => {
        const current = Array.isArray(entry.technicalActions) ? entry.technicalActions : [];
        const actionIndex = [...current].reverse().findIndex((action) => {
          if (toolCallId && action.toolCallId === toolCallId) return true;
          return action.name === name;
        });
        if (actionIndex < 0) return entry;
        const realIndex = current.length - 1 - actionIndex;
        const nextActions = current.map((action, idx) =>
          idx === realIndex
            ? { ...action, status: 'rejected', validationError: errorText }
            : action
        );
        return { ...entry, technicalActions: nextActions };
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
      // Force renderers to fully recompute layout on every mode switch — the
      // infographic engine in particular caches per-instance layout state and
      // a fresh render is the only way to guarantee a clean layout pass.
      setRendererRefreshKey((n) => n + 1);
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
      modeSwitchPeerRevisionId = null,
      modeSwitchPeerMode = null
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
        modeSwitchPeerMode,
        focusNode: payload.focusNode
      });
      const sectionId = appendInsightEntry(title, variant, {
        diagramUndoBaseline,
        topic,
        retryDescriptor,
        contentType: payload.contentType ?? contentMode,
        modelProfile: payload.modelProfile ?? modelProfile
      });
      if (diagramUndoBaseline) {
        autoCloseActiveEntryIdRef.current = sectionId;
      }
      if (variant === 'goMad') tryAgentSound(playGoMadStreamStart);
      else if (variant === 'innovate') tryAgentSound(playInnovateStreamStart);
      else if (variant === 'refine') tryAgentSound(playRefineStreamStart);
      else tryAgentSound(playStreamStartChime);
      lastTokenSoundAtRef.current = 0;
      goMadTokenTickIndexRef.current = 0;
      const streamAcc = { text: '' };
      const abortCtrl = new AbortController();
      streamAgentAbortRef.current = abortCtrl;
      const streamCtx = buildAgentStreamInsightContext(
        sectionId,
        operation,
        variant,
        diagramUndoBaseline,
        {
          patchInsightEntry,
          appendToInsight,
          setInsightStatus,
          appendTechnicalAction,
          annotateTechnicalActionResult,
          finalizeTechnicalActionResult,
          enrichTechnicalActionDetail,
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
          modeSwitchPeerMode,
          animateAcceptedSource,
          pendingAutoDiagramHighlightRef,
          pendingAutoDiagramHighlightTimeoutRef,
          triggerCompletionDelight,
          onFinal
        }
      );
      try {
        await streamDiagramAgent(
          payload,
          (evt) => {
            appendStreamDebugLog(sectionId, evt);
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
      annotateTechnicalActionResult,
      finalizeTechnicalActionResult,
      enrichTechnicalActionDetail,
      appendToInsight,
      activeSessionId,
      contentMode,
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
            modeSwitchPeerRevisionId: desc.modeSwitchPeerRevisionId,
            modeSwitchPeerMode: desc.modeSwitchPeerMode
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

        // Fast path: ask the cheap syntax-fixer model directly via the render-error endpoint.
        // One LLM call vs an entire agent turn. Fall back to the full intent pipeline only when
        // the fixer rejects (e.g., fixer model not configured, repair didn't validate, stale).
        if (contentMode === 'mermaid') {
          const fast = await submitDiagramRenderRepair({
            revisionId: syncedState.revisionId,
            source: syncedState.diagramSource,
            renderError: errorMessage,
            sessionId: activeSessionId
          });
          if (fast?.repaired && fast.state) {
            animateAcceptedSource(fast.state);
            return;
          }
        }

        const result = await submitDiagramIntent({
          contentType: contentMode,
          prompt: buildAutoFixPrompt({ contentType: contentMode, errorMessage, brokenSource }),
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
      if (isMermaidInfrastructureError(nextError)) return;
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

    setInsightsOpen(true);
    tryAgentSound(playSubmitThunk);
    setGoMadStreak(0);
    const focusNode = resolveAdvisorFocusNode({
      advisorFocusDescriptor: options.advisorFocusDescriptor,
      focusTarget: options.focusTarget,
      selectedNode
    });
    const titleSelection =
      options.focusTarget ??
      (options.advisorFocusDescriptor?.id ? options.advisorFocusDescriptor : null) ??
      selectedNode;
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
          ...(options.peerContext ? { peerContext: options.peerContext } : {}),
          ...(options.transformPersona ? { transformPersona: options.transformPersona } : {})
        },
        title: goIntentInsightTitle(trimmed, titleSelection),
        variant: options.variantOverride ?? 'intent',
        diagramUndoBaseline: { ...syncedState },
        topic: topicFromDescriptor(titleSelection),
        modeSwitchSync: Boolean(options.modeSwitchSync),
        modeSwitchPeerRevisionId:
          options.modeSwitchPeerRevisionId != null ? options.modeSwitchPeerRevisionId : null,
        modeSwitchPeerMode: options.modeSwitchPeerMode ?? null
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

  async function runIntentChange(event) {
    event.preventDefault();
    hasInteractedRef.current = true;
    await submitIntentWithPrompt(prompt.trim());
  }

  async function handleSlopPromptSubmit(text) {
    const trimmed = (text ?? '').trim();
    if (!trimmed) return;
    const radialDescriptor =
      slopPromptSource === 'radial' ? radialMenuSession?.descriptor ?? null : null;
    closeSlopPrompt();
    setInsightsOpen(true);
    if (radialDescriptor) {
      closeRadialMenu();
    }
    hasInteractedRef.current = true;
    if (radialDescriptor) {
      setSelectedNode(radialDescriptor);
    }
    await submitIntentWithPrompt(trimmed);
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
        const interimFlush = lastSpeechInterimRef.current?.trim();
        lastSpeechInterimRef.current = '';
        if (interimFlush) {
          voiceAccumulatedRef.current = voiceAccumulatedRef.current
            ? `${voiceAccumulatedRef.current.trimEnd()} ${interimFlush}`
            : interimFlush;
          appendActivePromptText(interimFlush);
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
  }, [appendActivePromptText]);

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
              appendActivePromptText(trimmed);
            }
            lastSpeechInterimRef.current = '';
          } else {
            lastSpeechInterimRef.current = transcript;
          }
        }
      };
      recognition.onerror = (event) => {
        if (event?.error === 'no-speech' || event?.error === 'aborted') return;
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
          appendActivePromptText(interimFlush);
        }

        try {
          recognition.onresult = null;
          recognition.onerror = null;
          recognition.onend = null;
        } catch {
          // ignore
        }
        if (recognitionRef.current === recognition) recognitionRef.current = null;

        setVoiceListening(false);
      };
      recognitionRef.current = recognition;
      recognition.start();
      setVoiceListening(true);
    } catch {
      micSessionRef.current += 1;
      setVoiceError('Voice input is unavailable in this browser.');
      voicePressedRef.current = false;
    }
  }, [appendActivePromptText, voiceSupported]);

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

  // Mobile uses tap-to-toggle (touch taps are too brief for the hold-to-speak flow
  // to actually capture audio before pointerup stops it).
  function handleMicToggleClick(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!voiceSupported || loadingRef.current || streamingPreviewRef.current) return;
    if (voiceListening) {
      stopVoiceInput({ immediate: true });
      return;
    }
    startVoiceInput();
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      active.blur();
    }
  }

  async function runTransform(mode, options = {}) {
    const useDiagramFocus = Boolean(options.useDiagramFocus);
    hasInteractedRef.current = true;
    if (loadingRef.current || streamingPreviewRef.current) return;
    if (!stateRef.current.diagramSource.trim()) return;

    if (mode !== 'goMad') setGoMadStreak(0);

    const focusOverride = options.focusTarget ?? null;
    const baseFocus = focusOverride || selectedNode;
    const focusNode = useDiagramFocus
      ? undefined
      : resolveAdvisorFocusNode({
          advisorFocusDescriptor: options.advisorFocusDescriptor,
          focusTarget: focusOverride,
          selectedNode: baseFocus
        });
    const titleSelection = useDiagramFocus
      ? null
      : options.advisorFocusDescriptor?.id
        ? options.advisorFocusDescriptor
        : baseFocus;
    const advisorPrompt =
      typeof options.advisorPrompt === 'string' ? options.advisorPrompt.trim().slice(0, 400) : '';
    setLoading(true);
    setActiveRequest(`transform:${mode}`);
    setError('');

    try {
      const syncedState = await syncDiagramOrThrow();
      const labels = { refine: 'Refine', innovate: 'Innovate', goMad: 'Go Mad', exec: 'Co-Design' };
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
          ...(mode === 'goMad' ? { goMadDepth } : {}),
          ...(advisorPrompt ? { advisorPrompt } : {})
        },
        title: selectionActionTitle(titleSelection, transformTitleVerb),
        variant: options.variantOverride ?? mode,
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
    const focusNode = useDiagramFocus
      ? undefined
      : resolveAdvisorFocusNode({
          advisorFocusDescriptor: options.advisorFocusDescriptor,
          focusTarget: focusOverride,
          selectedNode: baseFocus
        });
    const titleSelection = useDiagramFocus
      ? null
      : options.advisorFocusDescriptor?.id
        ? options.advisorFocusDescriptor
        : baseFocus;
    const advisorPrompt =
      typeof options.advisorPrompt === 'string' ? options.advisorPrompt.trim().slice(0, 400) : '';
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
          modelProfile,
          ...(advisorPrompt ? { advisorPrompt } : {})
        },
        title: selectionActionTitle(titleSelection, labels[kind]),
        variant: kind,
        topic: topicFromDescriptor(titleSelection),
        onFinal: ({ finalText, sectionId: critiqueEntryId }) => {
          if (kind !== 'critique') return;
          const cleaned = finalText.trim();
          if (!cleaned) return;
          setLatestCritique({
            text: cleaned,
            insightEntryId: critiqueEntryId,
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

      const contentLabelByMode = {
        mermaid: 'Mermaid diagram',
        infographic: 'infographic',
        metaphor3d: '3D metaphor view',
        chart: 'Vega-Lite chart'
      };
      const contentLabel = contentLabelByMode[contentMode] ?? 'diagram';
      const outputHintByMode = {
        mermaid:
          'Output one full valid Mermaid diagram in a single apply step, then briefly summarize — do not iterate multiple cosmetic patches.\n- Keep Mermaid syntax valid and deliver the entire diagram source in one go.',
        infographic:
          'Output one full valid AntV Infographic DSL in a single apply step, then briefly summarize — do not iterate multiple cosmetic patches.',
        metaphor3d:
          'Output one full valid metaphor JSON DSL in a single apply step, then briefly summarize — do not iterate multiple cosmetic patches.',
        chart:
          'Output one full valid chart JSON wrapper (Vega-Lite spec inside) in a single apply step, then briefly summarize — do not iterate multiple cosmetic patches.'
      };
      const outputHint =
        outputHintByMode[contentMode] ??
        'Output one full valid diagram update in a single apply step, then briefly summarize.';

      const intro = useActionableBullets
        ? `Improve the current ${contentLabel} by applying ONLY the following improvements. Do not implement other critique suggestions.`
        : `Improve the current ${contentLabel} based on this critique. Apply concrete fixes as a single complete update.`;
      const critiqueLabel = useActionableBullets ? 'Improvements to apply:' : 'Critique:';
      const requirementsBlock = useActionableBullets
        ? `- Implement only the improvements listed above.
- Preserve the original intent and main story.
- Prioritize readability and clarity within that scope.
- ${outputHint}`
        : `- Preserve the original intent and main story.
- Address the critique fully, including structure, labels, and any visual/style points raised.
- Prioritize readability and clarity improvements first.
- ${outputHint}`;

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
    [contentMode, critiqueActionableSelected, latestCritique, modelProfile, runStreamingAgent, syncDiagramOrThrow]
  );

  function handleClearDiagram() {
    if (loadingRef.current || streamingPreviewRef.current) return;
    setClearConfirmOpen(true);
  }

  const diagramSurfaceRef = useRef(null);
  const { fullscreenSupported, isFullscreen, toggleFullscreen } = useDiagramFullscreen(diagramSurfaceRef);

  const advisorPause =
    loading ||
    streamingPreview ||
    voiceListening ||
    slopPromptExpanded ||
    clearConfirmOpen ||
    editorOpen ||
    // Fullscreen hides the advisor bubble + cast chrome entirely, so pause the
    // proactive loop — otherwise stakeholders keep pulsing nodes (and chiming)
    // over the bare canvas with no visible way to mute them.
    isFullscreen;

  // Focus priority: an explicit click (selectedNode) is a strong signal — comment
  // on THAT. A hover (hoverDescriptor) is weaker — comment on it after a debounce
  // so rapid pointer travel doesn't spam the LLM. Nothing focused → viewport mode.
  const advisorFocusDescriptor = selectedNode
    ? { ...focusPayload(selectedNode), source: 'selected' }
    : hoverDescriptor?.id
      ? { ...focusPayload(hoverDescriptor), source: 'hover' }
      : null;
  const advisorFocusKey = advisorFocusDescriptor
    ? `${advisorFocusDescriptor.source}:${advisorFocusDescriptor.id}`
    : null;

  const advisor = useAdvisorOrchestrator({
    getDiagramSource: () => stateRef.current?.diagramSource ?? '',
    getContentType: () => contentMode,
    getSessionId: () => activeSessionId,
    getFocusDescriptor: () => advisorFocusDescriptor,
    focusKey: advisorFocusKey,
    focusSource: advisorFocusDescriptor?.source ?? null,
    getSvgRoot: () => (typeof document !== 'undefined' ? document : null),
    pause: advisorPause,
    initialMuted: readAdvisorMuted(),
    onAccept: (text, persona) => {
      const hasDiagram = Boolean((stateRef.current?.diagramSource ?? '').trim());
      const operation = resolveAdvisorAcceptOperation(persona, hasDiagram);
      const advisorCtx = {
        advisorPrompt: text,
        advisorFocusDescriptor
      };
      if (operation === 'transform') {
        void runTransform(persona, { ...advisorCtx, variantOverride: persona });
        return;
      }
      if (operation === 'analyze') {
        void runAnalyze(persona, advisorCtx);
        return;
      }
      void submitIntentWithPrompt(buildAdvisorIntentPrompt(text), {
        variantOverride: persona,
        transformPersona: persona,
        ...advisorCtx
      });
    }
  });

  const advisorBubbleProps = useMemo(() => {
    if (!advisor.suggestion) return null;
    return {
      persona: advisor.activePersona,
      suggestion: advisor.suggestion,
      kind: advisor.suggestionKind,
      isPinned: advisor.isPinned,
      isDumbingDown: advisor.isDumbingDown,
      architectDumbLevel: advisor.architectDumbLevel,
      onGo: advisor.accept,
      onDismiss: advisor.dismiss,
      onTogglePin: advisor.togglePin,
      onPauseTimer: advisor.pauseTimer,
      onResumeTimer: advisor.resumeTimer,
      onDumbDown: advisor.dumbDown,
      onDrillDeeper: () => {
        const suggestion = advisor.suggestion;
        advisor.dismiss();
        void runAnalyze('explain', {
          advisorPrompt: suggestion ?? '',
          advisorFocusDescriptor
        });
      },
      showHistoryNav: advisor.showHistoryNav,
      canGoBack: advisor.canGoBack,
      canPromptNext: advisor.canPromptNext,
      historyPositionLabel: advisor.historyPositionLabel,
      onHistoryBack: advisor.goBack,
      onPromptNext: () => advisor.promptNext(),
      onSelectVariant: (variant) => advisor.promptNext({ persona: variant }),
      castDisabled: false
    };
  }, [advisor, advisorFocusDescriptor]);

  const advisorPinFocusIds = useMemo(() => {
    if (!advisor.isPinned || !(advisor.highlightIds?.length > 0)) return null;
    return advisor.highlightIds;
  }, [advisor.highlightIds, advisor.isPinned]);

  const advisorDiagramHighlight = useMemo(() => {
    const ids = advisor.highlightIds ?? [];
    const active =
      ids.length > 0 &&
      Boolean(advisor.suggestion || advisor.isPinned || advisor.thinkingPersona);
    return active ? { addedIds: ids } : null;
  }, [
    advisor.highlightIds,
    advisor.isPinned,
    advisor.suggestion,
    advisor.thinkingPersona
  ]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const root = document.querySelector('.diagram-zoom-layer') ?? document;
    const diagramOutput = document.querySelector('.diagram-output');
    const accentPersona = advisor.activePersona ?? advisor.thinkingPersona;
    const accentMeta = accentPersona ? getVariantPersona(accentPersona) : null;
    const accentVar = accentMeta?.accentColorVar;
    if (diagramOutput) {
      if (advisorDiagramHighlight && accentVar) {
        const resolved = accentVar.startsWith('--') ? `var(${accentVar})` : accentVar;
        diagramOutput.style.setProperty('--advisor-highlight-accent', resolved);
        diagramOutput.classList.toggle('has-advisor-highlight', true);
        diagramOutput.classList.toggle('has-advisor-highlight-pinned', advisor.isPinned);
      } else {
        diagramOutput.style.removeProperty('--advisor-highlight-accent');
        diagramOutput.classList.remove('has-advisor-highlight', 'has-advisor-highlight-pinned');
      }
    }
    applyDiagramHighlightToSvg(root, advisorDiagramHighlight, {
      addedClass: 'is-advisor-pointing',
      modifiedClass: 'is-advisor-pointing'
    });
    return () => {
      applyDiagramHighlightToSvg(root, null, {
        addedClass: 'is-advisor-pointing',
        modifiedClass: 'is-advisor-pointing'
      });
      if (diagramOutput) {
        diagramOutput.style.removeProperty('--advisor-highlight-accent');
        diagramOutput.classList.remove('has-advisor-highlight', 'has-advisor-highlight-pinned');
      }
    };
  }, [advisor.activePersona, advisor.isPinned, advisor.thinkingPersona, advisorDiagramHighlight, state.revisionId, state.diagramSource]);

  async function performClearDiagram() {
    setClearConfirmOpen(false);
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
    crossModeSyncRef.current = createEmptyCrossModeSyncMarkers();
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
        syncClientDiagramState({ contentType: 'infographic', diagramSource: '', sessionId: nid }),
        syncClientDiagramState({ contentType: 'metaphor3d', diagramSource: '', sessionId: nid }),
        syncClientDiagramState({ contentType: 'chart', diagramSource: '', sessionId: nid }),
        syncClientDiagramState({ contentType: 'anything', diagramSource: '', sessionId: nid })
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
      if (
        contentType !== 'mermaid' &&
        contentType !== 'infographic' &&
        contentType !== 'metaphor3d' &&
        contentType !== 'chart' &&
        contentType !== 'anything'
      )
        return;

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
      if (
        targetContentType !== 'mermaid' &&
        targetContentType !== 'infographic' &&
        targetContentType !== 'metaphor3d' &&
        targetContentType !== 'chart' &&
        targetContentType !== 'anything'
      ) return;

      const baseline = entry?.diagramUndoBaseline;
      await applyDiagramSnapshotToCanvas({
        diagramSource: targetSource,
        contentType: targetContentType,
        styleConfig: baseline?.styleConfig
      });

      if (narrowLayout && insightsOpen) {
        setInsightsOpen(false);
      }
    },
    [applyDiagramSnapshotToCanvas, insightsEntries, insightsOpen, narrowLayout]
  );

  const handleRestoreDiagramSnapshot = useCallback(
    async ({ diagramSource, contentType }) => {
      if (loadingRef.current) return;
      await applyDiagramSnapshotToCanvas({ diagramSource, contentType });

      if (narrowLayout && insightsOpen) {
        setInsightsOpen(false);
      }
    },
    [applyDiagramSnapshotToCanvas, insightsOpen, narrowLayout]
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

      const isClearing = diagramChangeHighlightEntryId === entryId;
      if (isClearing) {
        setDiagramChangeHighlightEntryId(null);
        return;
      }

      const entry = insightsEntries.find((e) => e.id === entryId);
      const targetContentType = entry?.diagramAfterContentType;
      if (
        targetContentType === 'mermaid' ||
        targetContentType === 'infographic' ||
        targetContentType === 'chart' ||
        targetContentType === 'metaphor3d'
      ) {
        if (targetContentType !== contentMode) {
          suppressNextModeSwitchRerunRef.current = true;
          setContentMode(targetContentType);
          setRendererRefreshKey((n) => n + 1);
        }
      }

      setDiagramChangeHighlightEntryId(entryId);

      if (narrowLayout && insightsOpen) {
        setInsightsOpen(false);
      }
    },
    [
      clearPendingAutoDiagramHighlight,
      contentMode,
      diagramChangeHighlightEntryId,
      insightsEntries,
      insightsOpen,
      narrowLayout
    ]
  );

  const changeHighlightDiff = useMemo(() => {
    if (!diagramChangeHighlightEntryId) return null;
    const entry = insightsEntries.find((e) => e.id === diagramChangeHighlightEntryId);
    const baseline = entry?.diagramUndoBaseline?.diagramSource;
    const after =
      typeof entry?.diagramAfterSource === 'string'
        ? entry.diagramAfterSource
        : state.diagramSource ?? '';
    const kind = entry?.diagramAfterContentType ?? contentMode;
    return computeDiagramStructuralDiff(kind, baseline, after);
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

  const changeHighlightContentType = useMemo(() => {
    if (!diagramChangeHighlightEntryId) return null;
    const entry = insightsEntries.find((e) => e.id === diagramChangeHighlightEntryId);
    return entry?.diagramAfterContentType ?? contentMode;
  }, [contentMode, diagramChangeHighlightEntryId, insightsEntries]);

  const diagramChangeHighlightSummary = useMemo(() => {
    if (!diagramChangeHighlightEntryId || !changeHighlightDiff) return null;
    const { addedIds, modifiedIds, removedIds } = changeHighlightDiff;
    const isStructuralEmpty =
      addedIds.length === 0 && modifiedIds.length === 0 && removedIds.length === 0;
    return { addedIds, modifiedIds, removedIds, isStructuralEmpty };
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
      const diff = computeDiagramStructuralDiff(kind, baseline, after);
      if (diff) map[entry.id] = diff;
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
  const autoCloseRunStartRevisionRef = useRef(state.revisionId);
  useEffect(() => {
    const activeEntryId = autoCloseActiveEntryIdRef.current;
    const activeAutoCloseEntry = insightsEntries.find((e) => e.id === activeEntryId);
    const activeEntryStatus = activeAutoCloseEntry?.status ?? null;
    const activeEntryRunning = activeEntryStatus === 'running';
    const wasRunning = prevAutoCloseRunningRef.current;
    if (activeEntryRunning && !wasRunning) {
      autoCloseRunStartRevisionRef.current = state.revisionId;
    }
    const revisionChanged = state.revisionId !== autoCloseRunStartRevisionRef.current;
    const completedActiveMutation =
      activeEntryStatus === 'done' &&
      Boolean(activeAutoCloseEntry?.diagramRevisionApplied);
    const runProducedCanvasResult = revisionChanged || completedActiveMutation;
    if (
      narrowLayout &&
      insightsOpen &&
      !activeEntryRunning &&
      Boolean(activeEntryId) &&
      runProducedCanvasResult &&
      Boolean(state.diagramSource?.trim())
    ) {
      setInsightsOpen(false);
      autoCloseActiveEntryIdRef.current = null;
    } else if (
      !activeEntryRunning &&
      activeAutoCloseEntry &&
      ['failed', 'cancelled'].includes(activeEntryStatus)
    ) {
      autoCloseActiveEntryIdRef.current = null;
    }
    prevAutoCloseRunningRef.current = activeEntryRunning;
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
    setRadialMenuSession({ descriptor: selectedNode, anchor: toolbarAnchor });
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
      if (next?.id && selectedNode?.id && next.id !== selectedNode.id) {
        setRadialMenuSession(null);
        setRadialMenuVisible(true);
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
    if (slopPromptExpandedRef.current && slopPromptSourceRef.current === 'radial') {
      return;
    }
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
    const critiqueEntry = latestCritique.insightEntryId
      ? insightsEntries.find((e) => e.id === latestCritique.insightEntryId)
      : null;
    const streamMessages =
      Array.isArray(critiqueEntry?.a2uiMessages) && critiqueEntry.a2uiMessages.length > 0
        ? critiqueEntry.a2uiMessages
        : null;
    return {
      critiqueText: latestCritique.text,
      insightEntryId: latestCritique.insightEntryId ?? null,
      headingText: critiqueActionableSplit.headingText,
      items,
      prefix: critiqueActionableSplit.prefix,
      suffix: critiqueActionableSplit.suffix,
      a2uiMessages: streamMessages,
      busy: loading && activeRequest === 'fix',
      onFixSelected: (mask) => {
        if (Array.isArray(mask)) {
          handleFixFromCritique('selected', { checkValues: mask });
        } else {
          handleFixFromCritique('selected');
        }
      },
      onFixAll: () => handleFixFromCritique('all')
    };
  }, [activeRequest, critiqueActionableSplit, handleFixFromCritique, insightsEntries, latestCritique?.insightEntryId, latestCritique?.text, loading]);

  const handleApplyStyleEdits = useCallback(
    (entry) => {
      const edits = entry?.styleEdits;
      if (!Array.isArray(edits) || edits.length === 0) return;
      const lines = edits.map((e, i) => {
        const step = e.id ?? String(i + 1);
        if (e.kind === 'icon_replace') {
          return `${step}. Replace icon ${e.from} with ${e.to}`;
        }
        if (e.kind === 'color_shift') {
          const varPart = e.variable ? `${e.variable} ` : '';
          const toPart = e.to ? `from ${e.from} to ${e.to}` : `use ${e.from}`;
          return `${step}. Adjust ${varPart}${toPart}`;
        }
        return `${step}. ${e.text}`;
      });
      submitIntentWithPrompt(`Apply these style tweaks to the diagram:\n${lines.join('\n')}`, {
        variantOverride: 'refine'
      });
    },
    [submitIntentWithPrompt]
  );

  const status = useMemo(() => {
    if (loading && activeRequest === 'intent') return 'Applying diagram change.';
    if (loading && activeRequest?.startsWith?.('transform')) return 'Transforming diagram.';
    if (loading && activeRequest?.startsWith?.('analyze')) return 'Analyzing diagram.';
    if (loading && activeRequest === 'fix') return 'Applying critique fixes.';
    if (loading && activeRequest === 'clear') return 'Resetting diagram.';
    if (loading && activeRequest === 'autofix')
      return contentMode === 'anything' ? 'Fixing page runtime error.' : 'Fixing Mermaid syntax.';
    if (loading && activeRequest === 'hydrate') return 'Loading shared session.';
    if (streamingPreview) return 'Refreshing diagram.';
    if (error) return error;
    if (voiceError) return voiceError;
    if (validationError && autoFixAttempted)
      return contentMode === 'anything'
        ? `Page needs manual edit: ${validationError.error}`
        : `Mermaid syntax needs manual edit: ${validationError.error}`;
    return '';
  }, [activeRequest, autoFixAttempted, contentMode, error, loading, streamingPreview, validationError, voiceError]);

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
    if (action.id === 'prompt') {
      openRadialSlopPrompt();
      return;
    }
    closeRadialMenu();
    const runOpts = { focusTarget: descriptor };
    const variantForBoot =
      action.id === 'refine' || action.id === 'innovate' || action.id === 'goMad' ||
      action.id === 'critique' || action.id === 'explain' || action.id === 'exec'
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
    else if (action.id === 'exec') runTransform('exec', runOpts);
    else if (action.id === 'critique') runAnalyze('critique', runOpts);
    else if (action.id === 'explain') runAnalyze('explain', runOpts);
    else if (action.id === 'fix') handleFixFromCritique('all');
  };

  useDiagramHotkeys({
    enabled: Boolean(radialMenuVisible && selectedNode && !busy),
    descriptor: selectedNode,
    onAction: handleRadialAction,
    onToggleHelp: () => setHotkeyOverlayOpen((v) => !v)
  });

  const radialActions = useMemo(() => {
    const list = [
      {
        id: 'definition',
        label: 'What is this?',
        icon: <span className="action-persona-icon is-definition" aria-hidden="true">?</span>,
        variant: 'definition',
        group: 'primary',
        behavior: 'showExplanation',
        persona: 'Quick Reference',
        personaTitle: 'Quick Reference · What does this element mean?'
      },
      {
        id: 'stakeholders',
        label: 'Stakeholders',
        icon: <span className="action-persona-icon is-stakeholders" aria-hidden="true">👥</span>,
        variant: 'stakeholders',
        group: 'primary',
        behavior: 'expandStakeholders',
        persona: 'Stakeholders',
        personaTitle: 'Stakeholders · Tap to summon the roundtable'
      },
      {
        id: 'prompt',
        label: PROMPT_ACTION_COPY.label,
        icon: <span className="action-persona-icon is-prompt" aria-hidden="true">💬</span>,
        variant: 'prompt',
        group: 'primary',
        persona: PROMPT_ACTION_COPY.roleTag,
        personaEmoji: PROMPT_ACTION_COPY.roleEmoji,
        personaTitle: PROMPT_ACTION_COPY.title
      },
      {
        id: 'refine',
        label: 'Refine',
        icon: <ActionPersonaIcon variant="refine" />,
        variant: 'refine',
        persona: actionPersonaName('refine'),
        personaEmoji: actionPersonaEmoji('refine'),
        personaTitle: actionPersonaTitle('refine')
      },
      {
        id: 'innovate',
        label: 'Innovate',
        icon: <ActionPersonaIcon variant="innovate" />,
        variant: 'innovate',
        persona: actionPersonaName('innovate'),
        personaEmoji: actionPersonaEmoji('innovate'),
        personaTitle: actionPersonaTitle('innovate')
      },
      {
        id: 'goMad',
        label: goMadShapeLabel(goMadStreak),
        icon: <ActionPersonaIcon variant="goMad" />,
        variant: 'go-mad',
        persona: actionPersonaName('goMad'),
        personaEmoji: actionPersonaEmoji('goMad'),
        personaTitle: actionPersonaTitle('goMad')
      },
      {
        id: 'exec',
        label: 'Co-Design',
        icon: <ActionPersonaIcon variant="exec" />,
        variant: 'exec',
        persona: actionPersonaName('exec'),
        personaEmoji: actionPersonaEmoji('exec'),
        personaTitle: actionPersonaTitle('exec')
      },
      {
        id: 'critique',
        label: 'Critique',
        icon: <ActionPersonaIcon variant="critique" />,
        variant: 'critique',
        persona: actionPersonaName('critique'),
        personaEmoji: actionPersonaEmoji('critique'),
        personaTitle: actionPersonaTitle('critique')
      },
      {
        id: 'fix',
        label: 'Fix',
        icon: <span className="action-persona-icon is-fix" aria-hidden="true">🛠️</span>,
        variant: 'fix',
        persona: 'Site Foreman',
        personaEmoji: '🛠️',
        personaTitle: 'Site Foreman · Fixing the slop',
        hidden: !latestCritique?.text,
        disabled: !canFixFromCritique
      },
      {
        id: 'explain',
        label: 'Explain',
        icon: <ActionPersonaIcon variant="explain" />,
        variant: 'explain',
        persona: actionPersonaName('explain'),
        personaEmoji: actionPersonaEmoji('explain'),
        personaTitle: actionPersonaTitle('explain')
      }
    ];
    return list;
  }, [canFixFromCritique, goMadStreak, latestCritique?.text]);

  const { mounted: insightsMounted, closing: insightsClosing } = useDelayedUnmount(insightsOpen, 240);
  const liveStreamingEntry = insightsEntries.find((e) => (e.status ?? 'running') === 'running');
  const liveVariant = liveStreamingEntry?.variant ?? null;
  const ceremonyAnchor =
    insightsMounted && insightsOpen
      ? narrowLayout
        ? 'insights'
        : 'canvas'
      : 'viewport';
  const ceremonyOverlays = (
    <RunCeremonyOverlays
      anchor={ceremonyAnchor}
      bootSeq={bootSeq}
      toasts={streakHudToasts}
      achievement={streakHudAchievement}
      levelUp={streakHudLevelUp}
      liveVariant={liveVariant}
      liveStreaming={Boolean(liveStreamingEntry)}
      showLiveRunHud={Boolean(liveStreamingEntry) && !insightsOpen}
      liveStreak={gamification?.streakByVariant?.[liveVariant] ?? 0}
    />
  );
  const insightsSlot = insightsMounted ? (
    <InsightsPane
      ceremonySlot={null}
      entries={insightsEntries}
      streakByVariant={gamification?.streakByVariant}
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
      onApplyStyleEdits={handleApplyStyleEdits}
      styleEditsApplyBusy={loading}
      closing={insightsClosing}
      liveDraftSource={liveDraftSource}
      liveDraftContentType={liveDraftContentType}
      activeContentType={contentMode}
    />
  ) : null;

  return (
    <main
      className={`app-shell ${editorOpen ? 'is-editor-open' : ''} ${insightsOpen ? 'is-insights-open' : ''}${hasDiagramText || editorOpen ? ' has-edit-control' : ''}${slopPromptExpanded && slopPromptSource === 'chrome' ? ' has-slop-prompt-chrome' : ''}`}
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
        rendererRefreshKey={rendererRefreshKey}
        onManualEdit={handleManualEdit}
        onValidationChange={handleValidationChange}
        streamingPreview={streamingPreview || (Boolean(liveDraftSource) && liveDraftContentType === contentMode)}
        agentThinking={agentThinkingChrome && !streamingPreview}
        editorOpen={editorOpen}
        insightsOpen={insightsMounted && Boolean(insightsSlot)}
        insightsSlot={insightsSlot}
        ceremonySlot={null}
        selectedNode={selectedNode}
        hoverDescriptor={hoverDescriptor}
        onSelectedNodeChange={handleSelectedNodeChange}
        onHoverTargetChange={handleHoverTargetChange}
        onPanGestureStart={dismissRadialMenu}
        onNodeToolbarAnchor={setToolbarAnchor}
        onEditorClose={() => setEditorOpen(false)}
        changeHighlight={changeHighlightForCanvas}
        changeHighlightContentType={changeHighlightContentType}
        onDiagramSvgRendered={handleDiagramSvgRendered}
        runFx={{
          variant: liveVariant,
          streaming: Boolean(liveStreamingEntry),
          intensity:
            (gamification?.streakByVariant?.[liveVariant] ?? 0) >= 2 || goMadStreak >= 2
              ? 'high'
              : 'normal'
        }}
        advisorPinFocusIds={advisorPinFocusIds}
        diagramSurfaceRef={diagramSurfaceRef}
        isFullscreen={isFullscreen}
      />

      <DiagramFullscreenOverlay
        isFullscreen={isFullscreen}
        host={diagramSurfaceRef.current}
        onExit={toggleFullscreen}
      >
      <RadialActionMenu
        key={radialMenuSession?.descriptor?.id ?? 'radial-closed'}
        descriptor={radialMenuSession?.descriptor ?? null}
        anchor={radialMenuSession?.anchor ?? null}
        actions={radialActions}
        busy={busy}
        diagramSource={state.diagramSource}
        contentType={contentMode}
        sessionId={activeSessionId}
        slopPromptOpen={slopPromptExpanded && slopPromptSource === 'radial'}
        onSlopPromptClose={closeSlopPrompt}
        slopPrompt={
          slopPromptExpanded && slopPromptSource === 'radial' ? (
            <SlopNextPrompt
              layout="radial"
              prompt={slopNextPrompt}
              busy={busy}
              voiceSupported={voiceSupported}
              voiceListening={voiceListening}
              narrowLayout={narrowLayout}
              speechRecognitionCtor={SpeechRecognitionCtor}
              PromptIcon={PromptIcon}
              MicIcon={MicIcon}
              MicActiveIcon={MicActiveIcon}
              ButtonIcon={ButtonIcon}
              onPromptChange={setSlopNextPrompt}
              onSubmit={handleSlopPromptSubmit}
              onClose={closeSlopPrompt}
              onMicToggleClick={handleMicToggleClick}
              onMicPointerDown={handleMicPointerDown}
              onMicPointerUp={handleMicPointerUp}
              onMicLostPointerCapture={() => stopVoiceInput()}
            />
          ) : null
        }
        onActionPick={handleRadialAction}
        onDrillDeeper={(descriptor) => {
          if (!descriptor) return;
          setSelectedNode(descriptor);
          closeRadialMenu();
          setBootSeq((prev) => ({ trigger: prev.trigger + 1, variant: 'explain' }));
          tryAgentSound(playExplainBoot);
          runAnalyze('explain', { focusTarget: descriptor });
        }}
        onHoverHold={cancelMenuClose}
        onHoverRelease={scheduleMenuClose}
        onBackdropPointerDown={() => {
          if (slopPromptExpanded && slopPromptSource === 'radial') {
            closeSlopPrompt();
            return;
          }
          dismissRadialMenu();
        }}
        onClose={closeRadialMenu}
      />
      </DiagramFullscreenOverlay>

      {ceremonyOverlays}
      <ErrorToast />
      <HotkeyOverlay open={hotkeyOverlayOpen} onClose={() => setHotkeyOverlayOpen(false)} />

      <TopShell>
      <div
        className={`brand-control ${narrowLayout ? 'is-mobile' : ''} ${narrowLayout && compactBrand ? 'is-compact' : ''} ${narrowLayout && (xpBarMobileOpen || !compactBrand) ? 'is-xp-open' : ''} ${slopitectTip ? 'has-tip' : ''} ${xpInfoPanelOpen ? 'is-info-panel-open' : ''}`}
        aria-label="ArchiSlop"
        onClick={handleBrandClick}
      >
        <div className="brand-control-chip">
          <div className="brand-control-chip-row">
            <span className="brand-mark" aria-hidden="true">
              <ArchiSlopMarkIcon />
            </span>
            <span className="brand-name">ArchiSlop</span>
          {gamification?.prestigeShortLabel ? (
            narrowLayout && compactBrand ? (
            <button
              type="button"
              className="brand-prestige-badge"
              title={`${gamification.totalRuns ?? 0} total slop runs · tap to ${xpBarMobileOpen ? 'hide' : 'show'} XP`}
              data-testid="brand-prestige-badge"
              aria-expanded={xpBarMobileOpen}
              aria-controls="brand-xp-mobile-slot"
              onClick={(event) => {
                event.stopPropagation();
                setXpBarMobileOpen((current) => !current);
              }}
            >
              {gamification.prestigeShortLabel}
            </button>
            ) : (
              <span
                className="brand-prestige-badge"
                title={`${gamification.totalRuns ?? 0} total slop runs`}
                data-testid="brand-prestige-badge"
              >
                {gamification.prestigeShortLabel}
              </span>
            )
          ) : null}
          {gamification?.level && !narrowLayout ? (
            <XpProgressBar
              level={gamification.level}
              short={gamification.levelShortLabel}
              flair={gamification.levelFlair}
              progressRatio={gamification.levelProgressRatio}
              xpInto={gamification.xpIntoLevel}
              xpForNext={gamification.xpForNextLevel}
              totalXp={gamification.xp}
              isMaxLevel={gamification.xpForNextLevel == null}
              flashKey={xpBarFlashKey}
              variant={liveVariant}
              onClick={() => setXpInfoPanelOpen((open) => !open)}
              expanded={xpInfoPanelOpen}
              controlsId="levelup-info-panel"
            />
          ) : null}
        </div>
        {gamification?.level && narrowLayout ? (
          <div
            id="brand-xp-mobile-slot"
            className={`brand-xp-mobile-slot ${xpBarMobileOpen || !compactBrand ? 'is-open' : ''} ${compactBrand ? '' : 'is-always-on'}`}
            aria-hidden={compactBrand ? !xpBarMobileOpen : false}
          >
            <XpProgressBar
              level={gamification.level}
              short={gamification.levelShortLabel}
              flair={gamification.levelFlair}
              progressRatio={gamification.levelProgressRatio}
              xpInto={gamification.xpIntoLevel}
              xpForNext={gamification.xpForNextLevel}
              totalXp={gamification.xp}
              isMaxLevel={gamification.xpForNextLevel == null}
              flashKey={xpBarFlashKey}
              variant={liveVariant}
              onClick={() => setXpInfoPanelOpen((open) => !open)}
              expanded={xpInfoPanelOpen}
              controlsId="levelup-info-panel"
            />
            </div>
          ) : null}
        </div>
        {xpInfoPanelOpen && gamification?.level ? (
          <div
            id="levelup-info-panel"
            className="levelup-info-panel-mount"
            onClick={(event) => event.stopPropagation()}
          >
            <LevelUpInfoPanel
              level={gamification.level}
              levelTitle={gamification.levelTitle}
              levelFlair={gamification.levelFlair}
              levelShortLabel={gamification.levelShortLabel}
              progressRatio={gamification.levelProgressRatio}
              xpInto={gamification.xpIntoLevel}
              xpForNext={gamification.xpForNextLevel}
              totalXp={gamification.xp}
              isMaxLevel={gamification.xpForNextLevel == null}
              prestigeShortLabel={gamification.prestigeShortLabel}
              totalRuns={gamification.totalRuns}
              runsByVariant={gamification.runsByVariant}
              achievements={gamification.achievements}
              onClose={() => setXpInfoPanelOpen(false)}
            />
          </div>
        ) : null}
        {slopitectTip ? (
          <div
            ref={slopitectTipRef}
            className="slopitect-tip-chip"
            role="status"
            aria-live="polite"
            data-testid="slopitect-tip-chip"
            onClick={(event) => {
              event.stopPropagation();
              dismissSlopitectTip();
            }}
          >
            <span className="slopitect-tip-chip-label" aria-hidden="true">
              Slopitect Tip™
            </span>
            <span className="slopitect-tip-chip-text">{slopitectTip.text}</span>
          </div>
        ) : null}
      </div>

      {fullscreenSupported || hasDiagramText || editorOpen ? (
        <div className="top-corner-controls" aria-label="Diagram surface controls">
          {fullscreenSupported ? (
            <DiagramFullscreenButton
              isFullscreen={isFullscreen}
              disabled={streamingPreview}
              onToggle={toggleFullscreen}
            />
          ) : null}
          {hasDiagramText || editorOpen ? (
            <button
              type="button"
              className={`overlay-button code-toggle-button${editorOpen ? ' is-open' : ''}`}
              onClick={() => setEditorOpen((current) => !current)}
              aria-expanded={editorOpen}
              aria-label={editorOpen ? 'Close code editor' : 'Open code editor'}
              title={editorOpen ? 'Close code editor' : 'Code · edit diagram source'}
            >
              <ButtonIcon>{editorOpen ? <CodeCloseIcon /> : <CodeEditorIcon />}</ButtonIcon>
              <span className="button-label">{editorOpen ? 'Close' : 'Code'}</span>
            </button>
          ) : null}
        </div>
      ) : null}
      </TopShell>

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

      <ClearConfirmDialog
        key={clearConfirmOpen ? 'clear-confirm-open' : 'clear-confirm-closed'}
        open={clearConfirmOpen}
        onConfirm={() => {
          void performClearDiagram();
        }}
        onCancel={() => setClearConfirmOpen(false)}
      />

      {editorOpen ? (
        <div className="corner-control editor-done-bar">
          <button type="button" className="overlay-button primary-button" onClick={() => setEditorOpen(false)}>
            Done editing
          </button>
        </div>
      ) : null}

      <BottomRow
        narrowLayout={narrowLayout}
        statusRow={status ? (
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
        promptPopover={hasDiagramText && slopPromptExpanded && slopPromptSource === 'chrome' ? (
          <div className="bottom-row-popover bottom-row-popover--prompt">
            <SlopNextPrompt
              layout="chrome"
              prompt={slopNextPrompt}
              busy={busy}
              voiceSupported={voiceSupported}
              voiceListening={voiceListening}
              narrowLayout={narrowLayout}
              speechRecognitionCtor={SpeechRecognitionCtor}
              PromptIcon={PromptIcon}
              MicIcon={MicIcon}
              MicActiveIcon={MicActiveIcon}
              ButtonIcon={ButtonIcon}
              onPromptChange={setSlopNextPrompt}
              onSubmit={handleSlopPromptSubmit}
              onClose={closeSlopPrompt}
              onMicToggleClick={handleMicToggleClick}
              onMicPointerDown={handleMicPointerDown}
              onMicPointerUp={handleMicPointerUp}
              onMicLostPointerCapture={() => stopVoiceInput()}
            />
          </div>
        ) : null}
        actions={
          !hasDiagramText && !insightsOpen ? (
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
                  {...(narrowLayout
                    ? {
                        onPointerUp: (event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleMicToggleClick(event);
                        }
                      }
                    : {
                        onPointerDown: handleMicPointerDown,
                        onPointerUp: handleMicPointerUp,
                        onPointerCancel: handleMicPointerUp,
                        onLostPointerCapture: () => stopVoiceInput(),
                        onKeyDown: (event) => {
                          if (event.repeat) return;
                          if (event.key === ' ' || event.key === 'Enter') {
                            event.preventDefault();
                            startVoiceInput();
                          }
                        },
                        onKeyUp: (event) => {
                          if (event.key === ' ' || event.key === 'Enter') {
                            event.preventDefault();
                            stopVoiceInput();
                          }
                        }
                      })}
                  aria-label={narrowLayout ? (voiceListening ? 'Tap to stop dictation' : 'Tap to dictate') : 'Hold to speak'}
                  aria-pressed={narrowLayout ? voiceListening : undefined}
                  title={
                    voiceSupported
                      ? narrowLayout
                        ? voiceListening
                          ? 'Tap to stop dictation'
                          : 'Tap to dictate prompt'
                        : 'Hold to dictate prompt'
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
                  <span className="button-label">Do it</span>
                </button>
              </div>
            </form>
          ) : hasDiagramText && !narrowLayout ? (
            <div className="prompt-actions prompt-actions--desktop">
              <div className="button-group">
                <button
                  type="button"
                  className={`overlay-button compact-button slop-action-button is-prompt${slopPromptExpanded && slopPromptSource === 'chrome' ? ' is-expanded' : ''}`}
                  disabled={busy}
                  onClick={toggleChromeSlopPrompt}
                  aria-expanded={slopPromptExpanded && slopPromptSource === 'chrome'}
                  aria-label={PROMPT_ACTION_COPY.label}
                  title={PROMPT_ACTION_COPY.title}
                >
                  <ButtonIcon>
                    <span className="action-persona-icon is-prompt" aria-hidden="true">💬</span>
                  </ButtonIcon>
                  <span className="button-label">{PROMPT_ACTION_COPY.label}</span>
                  <span className="slop-action-role">
                    <span className="slop-action-role-emoji" aria-hidden="true">{PROMPT_ACTION_COPY.roleEmoji}</span>
                    {PROMPT_ACTION_COPY.roleTag}
                  </span>
                </button>
              </div>
              <div className="button-group">
                <StakeholdersMascot
                  personas={[
                    { variant: 'refine', onClick: () => runTransform('refine', { useDiagramFocus: true }) },
                    { variant: 'innovate', onClick: () => runTransform('innovate', { useDiagramFocus: true }) },
                    { variant: 'goMad', label: goMadShapeLabel(goMadStreak), onClick: () => runTransform('goMad', { useDiagramFocus: true }) },
                    { variant: 'exec', onClick: () => runTransform('exec', { useDiagramFocus: true }) },
                    { variant: 'critique', onClick: () => runAnalyze('critique', { useDiagramFocus: true }) },
                    { variant: 'explain', onClick: () => runAnalyze('explain', { useDiagramFocus: true }) }
                  ]}
                  activeAdvisorVariant={advisor.activePersona}
                  thinkingPersona={advisor.thinkingPersona}
                  busy={busy}
                  bubbleProps={advisorBubbleProps}
                  onSelectVariant={(variant) => advisor.promptNext({ persona: variant })}
                  castDisabled={busy || Boolean(advisor.thinkingPersona)}
                />
                <button
                  type="button"
                  className={`overlay-button compact-button slop-action-button is-advisor-mute ${advisor.isMuted ? 'is-muted' : ''}`}
                  onClick={advisor.toggleMute}
                  aria-pressed={advisor.isMuted}
                  aria-label={advisor.isMuted ? 'Unmute stakeholders' : 'Mute stakeholders'}
                  title={advisor.isMuted ? 'Stakeholders muted · click to unmute' : 'Stakeholders watching · click to mute'}
                >
                  <ButtonIcon>
                    <span className="action-persona-icon is-advisor-mute" aria-hidden="true">
                      {advisor.isMuted ? '🔇' : '🔊'}
                    </span>
                  </ButtonIcon>
                  <span className="button-label">{advisor.isMuted ? 'Unmute' : 'Mute'}</span>
                  <span className="slop-action-role">
                    <span className="slop-action-role-emoji" aria-hidden="true">
                      {advisor.isMuted ? STAKEHOLDERS_MUTE_COPY.stakeholdersEmoji : STAKEHOLDERS_MUTE_COPY.watchingEmoji}
                    </span>
                    {STAKEHOLDERS_MUTE_COPY.stakeholdersTag}
                  </span>
                </button>
              </div>
              {latestCritique?.text ? (
                <div className="button-group">
                  <button
                    type="button"
                    className="overlay-button compact-button slop-action-button is-fix"
                    disabled={!canFixFromCritique}
                    onClick={() => handleFixFromCritique('all')}
                    aria-label="Fix"
                    title="Site Foreman · Fixing the slop"
                  >
                    <ButtonIcon>
                      <span className="action-persona-icon is-fix" aria-hidden="true">🛠️</span>
                    </ButtonIcon>
                    <span className="button-label">Fix</span>
                    <ActionPersonaRole fallback="Site Foreman" />
                  </button>
                </div>
              ) : null}
              <div className="button-group">
                <button
                  type="button"
                  className="overlay-button compact-button slop-action-button is-clear"
                  disabled={busy}
                  onClick={() => handleClearDiagram()}
                  aria-label="Clear"
                  title="Clear · Demolish the slop and start fresh"
                >
                  <ButtonIcon>
                    <span className="action-persona-icon is-clear" aria-hidden="true">🧨</span>
                  </ButtonIcon>
                  <span className="button-label">Clear</span>
                  <span className="slop-action-role">
                    <span className="slop-action-role-emoji" aria-hidden="true">🧨</span>
                    Demolish
                  </span>
                </button>
              </div>
            </div>
          ) : hasDiagramText && narrowLayout ? (
            <div className="prompt-actions prompt-actions--mobile">
              <div className="button-group">
                <button
                  type="button"
                  className={`overlay-button compact-button slop-action-button is-prompt${slopPromptExpanded && slopPromptSource === 'chrome' ? ' is-expanded' : ''}`}
                  disabled={busy}
                  onClick={toggleChromeSlopPrompt}
                  aria-expanded={slopPromptExpanded && slopPromptSource === 'chrome'}
                  aria-label={PROMPT_ACTION_COPY.label}
                  title={PROMPT_ACTION_COPY.title}
                >
                  <ButtonIcon>
                    <span className="action-persona-icon is-prompt" aria-hidden="true">💬</span>
                  </ButtonIcon>
                  <span className="button-label">{PROMPT_ACTION_COPY.label}</span>
                  <span className="slop-action-role">
                    <span className="slop-action-role-emoji" aria-hidden="true">{PROMPT_ACTION_COPY.roleEmoji}</span>
                    {PROMPT_ACTION_COPY.roleTag}
                  </span>
                </button>
                <StakeholdersMascot
                  personas={[
                    { variant: 'refine', onClick: () => runTransform('refine', { useDiagramFocus: true }) },
                    { variant: 'innovate', onClick: () => runTransform('innovate', { useDiagramFocus: true }) },
                    { variant: 'goMad', label: goMadShapeLabel(goMadStreak), onClick: () => runTransform('goMad', { useDiagramFocus: true }) },
                    { variant: 'exec', onClick: () => runTransform('exec', { useDiagramFocus: true }) },
                    { variant: 'critique', onClick: () => runAnalyze('critique', { useDiagramFocus: true }) },
                    { variant: 'explain', onClick: () => runAnalyze('explain', { useDiagramFocus: true }) }
                  ]}
                  activeAdvisorVariant={advisor.activePersona}
                  thinkingPersona={advisor.thinkingPersona}
                  busy={busy}
                  bubbleProps={advisorBubbleProps}
                  onSelectVariant={(variant) => advisor.promptNext({ persona: variant })}
                  castDisabled={busy || Boolean(advisor.thinkingPersona)}
                />
                <button
                  type="button"
                  className={`overlay-button compact-button slop-action-button is-advisor-mute ${advisor.isMuted ? 'is-muted' : ''}`}
                  onClick={advisor.toggleMute}
                  aria-pressed={advisor.isMuted}
                  aria-label={advisor.isMuted ? 'Unmute stakeholders' : 'Mute stakeholders'}
                  title={advisor.isMuted ? 'Stakeholders muted · tap to unmute' : 'Stakeholders watching · tap to mute'}
                >
                  <ButtonIcon>
                    <span className="action-persona-icon is-advisor-mute" aria-hidden="true">
                      {advisor.isMuted ? '🔇' : '🔊'}
                    </span>
                  </ButtonIcon>
                  <span className="button-label">{advisor.isMuted ? 'Unmute' : 'Mute'}</span>
                  <span className="slop-action-role">
                    <span className="slop-action-role-emoji" aria-hidden="true">
                      {advisor.isMuted ? STAKEHOLDERS_MUTE_COPY.stakeholdersEmoji : STAKEHOLDERS_MUTE_COPY.watchingEmoji}
                    </span>
                    {STAKEHOLDERS_MUTE_COPY.stakeholdersTag}
                  </span>
                </button>
                {latestCritique?.text ? (
                  <button
                    type="button"
                    className="overlay-button compact-button slop-action-button is-fix"
                    disabled={!canFixFromCritique}
                    onClick={() => handleFixFromCritique('all')}
                    aria-label="Fix"
                    title="Site Foreman · Fixing the slop"
                  >
                    <ButtonIcon>
                      <span className="action-persona-icon is-fix" aria-hidden="true">🛠️</span>
                    </ButtonIcon>
                    <span className="button-label">Fix</span>
                    <ActionPersonaRole fallback="Site Foreman" />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="overlay-button compact-button slop-action-button is-clear"
                  disabled={busy}
                  onClick={() => handleClearDiagram()}
                  aria-label="Clear"
                  title="Clear · Demolish the slop and start fresh"
                >
                  <ButtonIcon>
                    <span className="action-persona-icon is-clear" aria-hidden="true">🧨</span>
                  </ButtonIcon>
                  <span className="button-label">Clear</span>
                  <span className="slop-action-role">
                    <span className="slop-action-role-emoji" aria-hidden="true">🧨</span>
                    Demolish
                  </span>
                </button>
              </div>
            </div>
          ) : null
        }
        aiControls={
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
            includeThinkingToggle={insightsEntries.length > 0}
          />
        }
      />
    </main>
  );
}

function App() {
  return <ArchiSlop />;
}

export default App;
