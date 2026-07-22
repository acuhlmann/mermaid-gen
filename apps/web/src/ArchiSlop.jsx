import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from 'react';
import DiagramCanvas from './components/DiagramCanvas.jsx';
import DiagramFullscreenOverlay from './components/DiagramFullscreenOverlay.jsx';
import { useDiagramFullscreen } from './hooks/useDiagramFullscreen.js';
import RadialActionMenu from './components/RadialActionMenu.jsx';
import SlopNextPrompt from './components/SlopNextPrompt.jsx';
import ClearConfirmDialog from './components/ClearConfirmDialog.jsx';
import { joinRoomByPairingCode } from './state/sessionEventsClient.js';
import {
  createEmptyCrossModeSyncMarkers,
  createSessionId,
  fallbackState,
  normalizeSessionId,
  readDiagramCache,
  syncClientDiagramState,
  submitDiagramIntent,
  submitDiagramRenderRepair,
  writeDiagramCache
} from './state/diagramStore.js';
import { isMermaidInfrastructureError } from './utils/mermaidRenderErrors.js';
import { buildAutoFixPrompt } from './utils/autoFixPrompt.js';
import { getCachedAgentCostEstimates, loadAgentCostEstimates } from './state/agentCostEstimates';
import './App.css';
import './components/RunTimeline.css';
import {
  playCritiqueBoot,
  playExplainBoot,
  playGoMadBoot,
  playInnovateBoot,
  playModeSwoosh,
  playRefineBoot
} from './utils/agentChimes.js';
import { CeremonyOverlaysSlot } from './features/ceremony/CeremonyOverlaysSlot.jsx';
import { InsightsSlot } from './features/insights/InsightsSlot.jsx';
import { SessionCollaborationSlot } from './features/session/SessionCollaborationSlot.jsx';
import { useSessionCollaboration } from './features/session/useSessionCollaboration.js';
import { useSessionHydrate } from './features/session/useSessionHydrate.js';
import { useSlopitectTips } from './features/prompt/useSlopitectTips.js';
import { useRadialMenu } from './features/prompt/useRadialMenu.js';
import { useAdvisorShell } from './features/advisor/useAdvisorShell.js';
import { useRunCeremony } from './features/ceremony/useRunCeremony.js';
import { DeskBottomActionsSlot } from './features/desk/DeskBottomActionsSlot.jsx';
import { ModeRevealSlot } from './features/desk/ModeRevealSlot.jsx';
import { useEntryDeskFlow } from './features/desk/useEntryDeskFlow.js';
import { useOfficeBoot } from './features/desk/useOfficeBoot.js';
import { BrandChromeSlot } from './features/shell/BrandChromeSlot.jsx';
import { useRunStreamingAgent } from './features/streaming/useRunStreamingAgent.js';
import { useCritiqueActionableUi } from './features/insights/useCritiqueActionableUi.js';
import ErrorToast from './components/ErrorToast.jsx';
import HotkeyOverlay from './components/HotkeyOverlay.jsx';
import { useDiagramHotkeys } from './hooks/useDiagramHotkeys.js';
import {
  createInitialState as createInitialGamificationState,
  readFromStorage as readGamificationFromStorage,
  writeToStorage as writeGamificationToStorage,
  reconcileLifetimeLlmCostUsd
} from './state/runGamificationStore.js';
import OfficeDirectory from './components/OfficeDirectory.jsx';
import OfficeLayer from './components/OfficeLayer.jsx';
import { resolveUserName, subscribe as subscribeUserName } from './state/userIdentityStore.js';
import {
  getOfficeDirectoryUi,
  subscribeOfficeDirectoryUi
} from './state/officeDirectoryUiStore.js';
import { useUiCopy } from './i18n/useUiLocale.js';
import { formatToolLabel } from './utils/appToolLabels.js';
import {
  coercePatchApplyDisplayStats,
  formatPatchApplyDetail
} from './utils/formatTechnicalActionDetail.js';
import { readStreamDebugEnabled, snapshotStreamEventForDebug } from './utils/appStreamDebug.js';
import { selectionActionTitle, topicFromDescriptor } from './utils/appInsightHelpers.js';
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
  splitCritiqueActionableSections,
  isLabelExplainGiveUpLevel,
  LABEL_EXPLAIN_GIBBERISH_LEVEL,
  MAX_LABEL_EXPLAIN_DUMB_LEVEL,
  isConcreteContentType
} from '@archislop/shared';
import { collapseConsecutiveApplyPatchActions } from './utils/collapsePatchTechnicalActions.js';
import { computeDiagramStructuralDiff } from './utils/diagramChangeDiff.js';
import { fetchExplainDumbDown } from './utils/fetchExplainDumbDown.js';
import { explainEntryMarkdown } from './utils/explainEntryMarkdown.js';
import { reportAdvisorLlmUsage } from './utils/reportAdvisorLlmUsage.js';
import { buildAdvisorIntentPrompt } from './utils/advisorActionContext.js';
import {
  useCompactBrandLayout,
  useFoldableDualScreen,
  useNarrowLayout,
  usePhoneLayout,
  useWideMobileLayout
} from './hooks/useAppLayoutMedia.js';
import { useDelayedUnmount } from './utils/useDelayedUnmount.js';
import { ButtonIcon, PromptIcon, MicIcon, MicActiveIcon } from './components/AppIcons.jsx';
import { AiCornerControlsInner } from './components/AiCornerControlsInner.jsx';
import { BottomRow } from './components/BottomRow.jsx';
import { useSyncVisualViewportHeight } from './hooks/useSyncVisualViewportHeight.js';
import { useStyleEdits } from './hooks/useStyleEdits.js';
import { useSubmitIntent } from './hooks/useSubmitIntent.js';
import { useAnalyzeFlow } from './hooks/useAnalyzeFlow.js';
import { useVoiceInput } from './hooks/useVoiceInput.js';
import { useDeskSlotRef } from './hooks/useDeskSlotRef.js';
import { AUTO_DIAGRAM_CHANGE_HIGHLIGHT_MS, SpeechRecognitionCtor } from './utils/appConstants.js';
import { buildRadialActions } from './components/buildRadialActions.jsx';
import {
  buildContentModeOptions,
  buildRenderSelectionPrompt,
  isConcreteContentMode,
  isContentMode
} from './utils/renderModeAction.js';

export function ArchiSlop() {
  const { controls, slopitect, applyLocaleFromText, locale: uiLocale } = useUiCopy();
  const deskSlotRef = useDeskSlotRef();
  const contentModeOptions = useMemo(() => buildContentModeOptions(controls), [controls]);
  const { slopitectTip, slopitectTipRef, handleBrandClick, dismissSlopitectTip, focusTopicInput } =
    useSlopitectTips({ idleTips: slopitect.IDLE_TIPS });
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
  const [state, setState] = useState(fallbackState);
  const [prompt, setPrompt] = useState('');
  /** Fresh instruction for the inline “slop next” prompt — never prefilled from the session topic. */
  const [slopNextPrompt, setSlopNextPrompt] = useState('');
  /** The persistent desk Work Order (content mode) — its own buffer so the radial
   * prompt clearing slopNextPrompt on open can't wipe what you've typed here. */
  const [deskPrompt, setDeskPrompt] = useState('');
  const deskPromptRef = useRef('');
  const slopNextPromptRef = useRef('');
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
  /** Per explain insight entry: progressive dumb-down depth (0 = original Wise Architect brief). */
  const [explainDumbLevelByEntryId, setExplainDumbLevelByEntryId] = useState({});
  const [explainDumbLoadingEntryId, setExplainDumbLoadingEntryId] = useState(null);
  const [explainDumbSurrenderedEntryIds, setExplainDumbSurrenderedEntryIds] = useState({});
  const [soundEnabled, setSoundEnabled] = useState(cacheRef.current?.soundEnabled ?? true);
  const [modelProfile, setModelProfile] = useState(() => readStoredModelProfile());
  const [contentMode, setContentMode] = useState(() => readStoredContentMode());
  /** Mode the user switched from — drives peer takeover vs cached-slot reuse on hydrate. */
  const previousContentModeRef = useRef(contentMode);
  /** Per-mode revision id when the user last left that mode — detects unchanged source on return. */
  const sourceRevisionAtViewRef = useRef({});
  /**
   * Snapshot of the slot the user just left. Hydrate merges this when GET /session-state
   * is behind the client (debounced editor sync or a race with the final stream write).
   */
  const leavingSlotSnapshotRef = useRef({});
  /** Bumped on every mode switch so the diagram canvas can remount renderers for a fresh layout pass. */
  const [rendererRefreshKey, setRendererRefreshKey] = useState(0);
  // Bumped on every completed run so the office can ping the user about it.
  const [officeRunSignal, setOfficeRunSignal] = useState(null);
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
  /** Mobile-only: XP bar starts collapsed below the brand row; toggled by tapping the role badge. */
  const [xpBarMobileOpen, setXpBarMobileOpen] = useState(false);
  /** Click-to-open level/XP info popover anchored to the XP bar. */
  const [xpInfoPanelOpen, setXpInfoPanelOpen] = useState(false);
  /** Desk verbs bump these to open headless Outbox / Settings panels. */
  const [outboxOpenSignal, setOutboxOpenSignal] = useState(0);
  const [settingsOpenSignal, setSettingsOpenSignal] = useState(0);
  /** Bumped from Your Team menu to start a WG meeting via OfficeLayer. */
  const [callMeetingSignal, setCallMeetingSignal] = useState(0);
  const [costTrackingEnabled, setCostTrackingEnabled] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hotkeyOverlayOpen, setHotkeyOverlayOpen] = useState(false);
  const [hoverDescriptor, setHoverDescriptor] = useState(null);
  const [toolbarAnchor, setToolbarAnchor] = useState(null);
  const [voiceSupported] = useState(() =>
    Boolean(
      SpeechRecognitionCtor &&
      (typeof globalThis.isSecureContext === 'boolean' ? globalThis.isSecureContext : true)
    )
  );
  /** Inline slop-next prompt expanded from the action bar or radial menu. */
  const [slopPromptExpanded, setSlopPromptExpanded] = useState(false);
  const [slopPromptSource, setSlopPromptSource] = useState(null);
  /** Demolition confirmation overlay shown before the Clear action wipes the session. */
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const syncTimerRef = useRef(null);
  const streamTimerRef = useRef(null);
  /** AbortController for in-flight `streamDiagramAgent` (Thinking panel / transforms). */
  const streamAgentAbortRef = useRef(null);
  const agentCostEstimatesRef = useRef(getCachedAgentCostEstimates());
  const autoCloseActiveEntryIdRef = useRef(null);
  const autoFixTimerRef = useRef(null);
  const stateRef = useRef(state);
  const lastAutoFixSourceRef = useRef(null);
  /** Mirrors latest client-side Mermaid render validation (debounced in DiagramCanvas). */
  const clientValidationRef = useRef({ source: null, error: null });
  const autoFixAttemptedRef = useRef(false);
  const loadingRef = useRef(false);
  const submitIntentWithPromptRef = useRef(null);
  const closeRadialMenuRef = useRef(null);
  const streamingPreviewRef = useRef(false);
  const lastDraftTickAtRef = useRef(0);
  const autoFixAlwaysOnRef = useRef(true);
  const hasInteractedRef = useRef(false);
  const audioContextRef = useRef(null);
  const celebrationTimerRef = useRef(null);
  const promptRef = useRef('');
  const hasCanvasContentRef = useRef(false);
  const slopPromptExpandedRef = useRef(false);
  const slopPromptSourceRef = useRef(null);
  const lastTokenSoundAtRef = useRef(0);
  const goMadTokenTickIndexRef = useRef(0);
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
   * True when any sibling slot already has customized content. Used to keep the first-run
   * empty intro from reclaiming the chrome when switching into an empty sibling mode.
   */
  const [sessionHasPeerContent, setSessionHasPeerContent] = useState(false);

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
  /**
   * Skip one hydrate when Auto mode resolves mid-stream — changing contentMode must not
   * abort the in-flight agent run or overwrite live draft state.
   */
  const skipHydrateOnceRef = useRef(false);
  const pendingRenderModeRequestRef = useRef(null);

  const { sessionHydrated } = useSessionHydrate({
    activeSessionId,
    contentMode,
    freshlyMintedSessionIdsRef,
    sessionIdFromUrlRef,
    sessionTopicRef,
    previousContentModeRef,
    sourceRevisionAtViewRef,
    leavingSlotSnapshotRef,
    crossModeSyncRef,
    suppressNextModeSwitchRerunRef,
    skipHydrateOnceRef,
    pendingRenderModeRequestRef,
    stateRef,
    promptRef,
    loadingRef,
    submitIntentWithPromptRef,
    cacheRef,
    setActiveSessionId,
    setState,
    setSessionHasPeerContent,
    setLoading,
    setActiveRequest,
    setPrompt,
    setError,
    setInsightsEntries,
    setLatestCritique,
    setCritiqueActionableSelected,
    setLiveDraftSource,
    setLiveDraftContentType,
    setGoMadStreak,
    setModelProfile,
    setContentMode
  });

  const {
    pendingHandshake,
    externalAgentPresence,
    agentReactions,
    inviteDialogOpen,
    setInviteDialogOpen,
    handleApproveHandshake,
    handleDenyHandshake,
    handleAcceptProposal,
    handleRejectProposal,
    resetCollaborationState
  } = useSessionCollaboration({
    activeSessionId,
    sessionHydrated,
    contentMode,
    controlsLoading: controls.loading,
    setInsightsEntries,
    stateRef,
    setState
  });

  const clearPendingAutoDiagramHighlight = useCallback(() => {
    pendingAutoDiagramHighlightRef.current = null;
    if (pendingAutoDiagramHighlightTimeoutRef.current != null) {
      window.clearTimeout(pendingAutoDiagramHighlightTimeoutRef.current);
      pendingAutoDiagramHighlightTimeoutRef.current = null;
    }
  }, []);

  useSyncVisualViewportHeight();
  const narrowLayout = useNarrowLayout();
  const phoneLayout = usePhoneLayout();
  const wideMobileLayout = useWideMobileLayout();
  const foldableDualScreen = useFoldableDualScreen();
  const compactBrand = useCompactBrandLayout();

  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  useEffect(() => {
    deskPromptRef.current = deskPrompt;
  }, [deskPrompt]);

  useEffect(() => {
    slopNextPromptRef.current = slopNextPrompt;
  }, [slopNextPrompt]);

  useEffect(() => {
    slopPromptExpandedRef.current = slopPromptExpanded;
  }, [slopPromptExpanded]);

  useEffect(() => {
    slopPromptSourceRef.current = slopPromptSource;
  }, [slopPromptSource]);

  const {
    radialMenuSession,
    radialMenuVisible,
    openRadialSlopPrompt,
    handleHoverTargetChange,
    handleSelectedNodeChange,
    dismissRadialMenu,
    cancelMenuClose,
    scheduleMenuClose,
    closeRadialMenu,
    resetRadialChrome
  } = useRadialMenu({
    selectedNode,
    setSelectedNode,
    toolbarAnchor,
    setToolbarAnchor,
    setHoverDescriptor,
    setSlopNextPrompt,
    setSlopPromptSource,
    setSlopPromptExpanded,
    slopPromptExpandedRef,
    slopPromptSourceRef,
    closeRadialMenuRef
  });

  const {
    voiceListening,
    voiceError,
    stopVoiceInput,
    startVoiceInput,
    handleMicPointerDown,
    handleMicPointerUp,
    handleMicToggleClick,
    cleanupVoiceInput,
    clearVoiceError
  } = useVoiceInput({
    voiceSupported,
    controls,
    uiLocale,
    loadingRef,
    streamingPreviewRef,
    slopPromptExpandedRef,
    hasCanvasContentRef,
    setSlopNextPrompt,
    setDeskPrompt,
    setPrompt,
    promptRef,
    deskPromptRef,
    slopNextPromptRef,
    hasInteractedRef
  });

  useEffect(() => {
    let cancelled = false;
    loadAgentCostEstimates().then((payload) => {
      if (!cancelled) {
        agentCostEstimatesRef.current = payload;
        setCostTrackingEnabled(payload.enabled === true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!costTrackingEnabled) return;
    setGamification((current) => {
      const reconciled = reconcileLifetimeLlmCostUsd(current, insightsEntries);
      if (reconciled.lifetimeLlmCostUsd === current.lifetimeLlmCostUsd) return current;
      return reconciled;
    });
  }, [costTrackingEnabled, insightsEntries]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    writeGamificationToStorage(window.localStorage, gamification);
  }, [gamification]);

  const closeSlopPrompt = useCallback(() => {
    setSlopPromptExpanded(false);
    setSlopPromptSource(null);
    setSlopNextPrompt('');
  }, []);

  // Slopitect console stamp on first mount — pure flavor, no functional effect.
  useEffect(() => {
    if (typeof console === 'undefined' || typeof console.log !== 'function') return;
    const lines = slopitect.CONSOLE_STAMP_LINES;
    if (!Array.isArray(lines) || lines.length === 0) return;
    try {
      console.log('%c' + lines.join('\n'), 'color:#c77a00;font-weight:700;');
    } catch {
      // ignore
    }
  }, [slopitect.CONSOLE_STAMP_LINES]);

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
        if (!cancelled) setError(err?.message ?? controls.loading.invalidRoom);
      });
    return () => {
      cancelled = true;
    };
  }, [controls.loading.invalidRoom]);

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
    setInsightsEntries(
      Array.isArray(cacheRef.current?.insightsEntries) ? cacheRef.current.insightsEntries : []
    );
    setLatestCritique(
      cacheRef.current?.latestCritique?.text ? cacheRef.current.latestCritique : null
    );
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
    resetCollaborationState();
  }, [activeSessionId, clearPendingAutoDiagramHighlight, resetCollaborationState]);

  useEffect(() => {
    writeDiagramCache(
      {
        diagramSource: contentMode === 'anything' ? '' : state.diagramSource,
        contentMode,
        insightsEntries,
        latestCritique,
        editorOpen,
        insightsOpen,
        soundEnabled
      },
      activeSessionId
    );
  }, [
    activeSessionId,
    contentMode,
    editorOpen,
    insightsEntries,
    insightsOpen,
    latestCritique,
    soundEnabled,
    state.diagramSource
  ]);

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
      cleanupVoiceInput();
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

  const {
    bootSeq,
    setBootSeq,
    streakHudToasts,
    streakHudAchievement,
    streakHudLevelUp,
    xpBarFlashKey,
    celebratingEntryId,
    triggerCompletionDelight,
    handleOfficeEvent
  } = useRunCeremony({
    prompt,
    promptEasterEggs: slopitect.PROMPT_EASTER_EGGS,
    konamiAchievement: slopitect.KONAMI_ACHIEVEMENT,
    tryAgentSound,
    goMadStreak,
    setGamification,
    setOfficeRunSignal,
    celebrationTimerRef
  });

  const animateAcceptedSource = useCallback((nextState, onFullyApplied, opts = {}) => {
    const previousState = stateRef.current;
    const nextSource = nextState.diagramSource;

    if (streamTimerRef.current != null) {
      cancelAnimationFrame(streamTimerRef.current);
      streamTimerRef.current = null;
    }

    if (
      previousState.revisionId === nextState.revisionId ||
      previousState.diagramSource === nextSource
    ) {
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
    // Forms A2UI is a single JSON document — character-sliced typewriter
    // previews are invalid mid-stream and flash the error/"garbled" canvas.
    // Apply the next form atomically (same as reduced-motion).
    const skipTypewriter = reduceMotion || nextState.contentType === 'forms';

    if (skipTypewriter) {
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

  const appendInsightEntry = useCallback(
    (title, variant = 'general', options = {}) => {
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
          statusText: controls.loading.working,
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
    },
    [controls.loading.working]
  );

  const patchInsightEntry = useCallback((id, patcher) => {
    setInsightsEntries((prev) => prev.map((entry) => (entry.id === id ? patcher(entry) : entry)));
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
              ...(opts.contextNote ? { contextNote: opts.contextNote } : {}),
              ...(opts.modelName ? { modelName: opts.modelName } : {})
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
          formatPatchApplyDetail(coercePatchApplyDisplayStats(mergedStats, action.durationMs));
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
            idx === realIndex
              ? {
                  ...action,
                  status: 'done',
                  ...(Number.isFinite(action.startedAt)
                    ? { durationMs: Math.max(0, Date.now() - action.startedAt) }
                    : {})
                }
              : action
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
                ...(Number.isFinite(action.startedAt)
                  ? { durationMs: Math.max(0, Date.now() - action.startedAt) }
                  : {}),
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
          idx === realIndex ? { ...action, status: 'rejected', validationError: errorText } : action
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
      if (!isContentMode(nextMode)) return;
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      if (streamTimerRef.current != null) {
        cancelAnimationFrame(streamTimerRef.current);
        streamTimerRef.current = null;
      }
      const wasTypewriterPreview = streamingPreviewRef.current;
      setStreamingPreview(false);
      streamingPreviewRef.current = false;
      if (isConcreteContentMode(contentMode) && !wasTypewriterPreview) {
        leavingSlotSnapshotRef.current[contentMode] = { ...stateRef.current };
        sourceRevisionAtViewRef.current[contentMode] = stateRef.current.revisionId ?? 0;
      } else if (isConcreteContentMode(contentMode)) {
        sourceRevisionAtViewRef.current[contentMode] = stateRef.current.revisionId ?? 0;
      }
      stopStreamingAgentRequest();
      setLiveDraftSource('');
      setLiveDraftContentType(null);
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

  /** Auto-mode mid-stream: switch the picker without aborting the agent run. */
  const applyResolvedContentMode = useCallback(
    (nextMode) => {
      if (!isConcreteContentMode(nextMode) || nextMode === contentMode) return;
      skipHydrateOnceRef.current = true;
      suppressNextModeSwitchRerunRef.current = true;
      setLiveDraftContentType(nextMode);
      setContentMode(nextMode);
      setRendererRefreshKey((n) => n + 1);
    },
    [contentMode]
  );

  async function renderSelectionInMode(targetMode, descriptor) {
    if (!isConcreteContentMode(targetMode) || targetMode === contentMode) return;
    if (contentMode === 'auto') return;
    if (loadingRef.current || streamingPreviewRef.current) return;
    if (!stateRef.current.diagramSource.trim()) return;

    const sourceMode = contentMode;
    const promptText = buildRenderSelectionPrompt({
      descriptor,
      sourceMode,
      targetMode,
      options: contentModeOptions
    });
    hasInteractedRef.current = true;
    closeRadialMenu();

    try {
      const sourceState = await syncDiagramOrThrow();
      pendingRenderModeRequestRef.current = {
        targetMode,
        sourceMode,
        promptText,
        descriptor,
        peerContext: { contentType: sourceMode, diagramSource: sourceState.diagramSource }
      };
      handleSelectContentMode(targetMode);
    } catch (err) {
      pendingRenderModeRequestRef.current = null;
      setError(err.message);
    }
  }

  const { runStreamingAgent } = useRunStreamingAgent({
    activeSessionId,
    contentMode,
    modelProfile,
    controls,
    streamAgentAbortRef,
    lastTokenSoundAtRef,
    goMadTokenTickIndexRef,
    lastDraftTickAtRef,
    sessionTopicRef,
    crossModeSyncRef,
    pendingAutoDiagramHighlightRef,
    pendingAutoDiagramHighlightTimeoutRef,
    agentCostEstimatesRef,
    autoCloseActiveEntryIdRef,
    setInsightsOpen,
    setGoMadStreak,
    setLiveDraftSource,
    setLiveDraftContentType,
    appendInsightEntry,
    patchInsightEntry,
    appendToInsight,
    setInsightStatus,
    appendTechnicalAction,
    annotateTechnicalActionResult,
    finalizeTechnicalActionResult,
    enrichTechnicalActionDetail,
    appendStreamDebugLog,
    animateAcceptedSource,
    applyResolvedContentMode,
    triggerCompletionDelight,
    tryAgentSound
  });

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
      const profile = useQuality ? 'quality' : (desc.modelProfile ?? modelProfile);

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

  const reportAdvisorUsage = useCallback(
    ({ usage, model, inputTokens, outputTokens }) => {
      const resolvedUsage =
        usage && typeof usage === 'object'
          ? usage
          : {
              ...(Number.isFinite(inputTokens) ? { inputTokens } : {}),
              ...(Number.isFinite(outputTokens) ? { outputTokens } : {})
            };
      reportAdvisorLlmUsage({
        costTrackingEnabled,
        rates: agentCostEstimatesRef.current?.rates,
        usage: resolvedUsage,
        model,
        setGamification
      });
    },
    [costTrackingEnabled]
  );

  const handleExplainDumbDown = useCallback(
    async (entryId) => {
      const entry = insightsEntriesRef.current.find((e) => e.id === entryId);
      if (!entry || entry.variant !== 'explain' || (entry.status ?? 'running') !== 'done') return;
      if (explainDumbLoadingEntryId) return;

      const currentLevel = explainDumbLevelByEntryId[entryId] ?? 0;
      if (explainDumbSurrenderedEntryIds[entryId]) return;

      if (isLabelExplainGiveUpLevel(currentLevel)) {
        setExplainDumbSurrenderedEntryIds((prev) => ({ ...prev, [entryId]: true }));
        return;
      }

      const nextLevel =
        currentLevel >= MAX_LABEL_EXPLAIN_DUMB_LEVEL
          ? LABEL_EXPLAIN_GIBBERISH_LEVEL
          : currentLevel <= 0
            ? 1
            : currentLevel + 1;
      const isGibberish = nextLevel === LABEL_EXPLAIN_GIBBERISH_LEVEL;
      const previousExplain = explainEntryMarkdown(entry);
      if (!previousExplain) return;

      setExplainDumbLevelByEntryId((prev) => ({ ...prev, [entryId]: nextLevel }));
      setExplainDumbLoadingEntryId(entryId);

      try {
        const { markdown, explainSections, usage, model } = await fetchExplainDumbDown({
          previousExplain,
          contentType: entry.contentType ?? contentMode,
          sessionId: activeSessionId,
          style: isGibberish ? 'gibberish' : 'simple',
          simpleLevel: isGibberish ? undefined : nextLevel
        });
        reportAdvisorUsage({ usage, model });
        if (!markdown) {
          setExplainDumbLevelByEntryId((prev) => ({ ...prev, [entryId]: currentLevel }));
          return;
        }
        setInsightsEntries((prev) =>
          prev.map((e) =>
            e.id === entryId
              ? {
                  ...e,
                  content: markdown,
                  ...(explainSections?.sections?.length
                    ? { explainSections }
                    : { explainSections: undefined })
                }
              : e
          )
        );
      } catch (err) {
        setExplainDumbLevelByEntryId((prev) => ({ ...prev, [entryId]: currentLevel }));
        if (err?.name !== 'AbortError') {
          setError(err?.message || controls.loading.simplifyFailed);
        }
      } finally {
        setExplainDumbLoadingEntryId(null);
      }
    },
    [
      activeSessionId,
      contentMode,
      explainDumbLevelByEntryId,
      explainDumbLoadingEntryId,
      explainDumbSurrenderedEntryIds,
      reportAdvisorUsage
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
          contentType: contentMode,
          diagramSource: brokenSource,
          sessionId: activeSessionId
        });
        setState(syncedState);

        // Fast path: ask the cheap syntax-fixer model directly via the render-error endpoint.
        // One LLM call vs an entire agent turn. Fall back to the full intent pipeline only when
        // the fixer rejects (e.g., fixer model not configured, repair didn't validate, stale).
        // Mermaid render errors and Anything load-phase iframe errors both take this rung; the
        // Anything store-apply re-runs the full ladder (runtime check included), so no gate is
        // skipped by taking the cheaper path first.
        if (contentMode === 'mermaid' || contentMode === 'anything') {
          const fast = await submitDiagramRenderRepair({
            revisionId: syncedState.revisionId,
            source: syncedState.diagramSource,
            renderError: errorMessage,
            contentType: contentMode,
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
    clientValidationRef.current = nextError
      ? { source, error: nextError }
      : { source: null, error: null };
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

    // Auto is not a server slot — send placeholders; the server adopts the
    // classified slot's revision/source after LLM classification.
    if (contentMode === 'auto') {
      const empty = createInitialDiagramState('mermaid');
      stateRef.current = empty;
      setState(empty);
      return empty;
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

  const {
    submitIntentWithPrompt,
    runIntentChange,
    handleFormSubmit,
    handleSlopPromptSubmit,
    handleDeskPromptSubmit
  } = useSubmitIntent({
    applyLocaleFromText,
    closeRadialMenuRef,
    closeSlopPrompt,
    contentMode,
    controls,
    hasInteractedRef,
    loadingRef,
    modelProfile,
    prompt,
    radialMenuSession,
    runStreamingAgent,
    selectedNode,
    setActiveRequest,
    setDeskPrompt,
    setError,
    setGoMadStreak,
    setInsightsOpen,
    setLatestCritique,
    setLoading,
    setPrompt,
    setSelectedNode,
    slopPromptSource,
    streamingPreviewRef,
    syncDiagramOrThrow,
    tryAgentSound
  });
  submitIntentWithPromptRef.current = submitIntentWithPrompt;

  const { runTransform, runAnalyze } = useAnalyzeFlow({
    contentMode,
    controls,
    goMadStreak,
    hasInteractedRef,
    loadingRef,
    modelProfile,
    runStreamingAgent,
    selectedNode,
    setActiveRequest,
    setError,
    setGoMadStreak,
    setLatestCritique,
    setLoading,
    stateRef,
    streamingPreviewRef,
    syncDiagramOrThrow
  });

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
        scope === 'selected' ? actionableItems.filter((_, i) => selectedMask[i]) : actionableItems;

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
    [
      contentMode,
      critiqueActionableSelected,
      latestCritique,
      modelProfile,
      runStreamingAgent,
      syncDiagramOrThrow
    ]
  );

  function handleClearDiagram() {
    if (loadingRef.current || streamingPreviewRef.current) return;
    setClearConfirmOpen(true);
  }

  const diagramSurfaceRef = useRef(null);
  const { fullscreenSupported, isFullscreen, toggleFullscreen } =
    useDiagramFullscreen(diagramSurfaceRef);

  const officeDirectoryUi = useSyncExternalStore(
    subscribeOfficeDirectoryUi,
    getOfficeDirectoryUi,
    getOfficeDirectoryUi
  );

  const hasDiagramText = Boolean(state.diagramSource?.trim());
  // Peer content in another slot keeps chrome visible after a mode switch into an
  // empty target slot — do not dump the user back on the first-run intro.
  const hasCanvasContent = hasDiagramText || sessionHasPeerContent;

  const { officeBootPending, officeCanvasGrace, handleOfficeBootComplete } = useOfficeBoot({
    hasCanvasContent
  });

  const userName = useSyncExternalStore(subscribeUserName, resolveUserName, resolveUserName);

  const advisorPause =
    loading ||
    streamingPreview ||
    (Boolean(liveDraftSource) && liveDraftContentType === contentMode) ||
    insightsEntries.some((e) => (e.status ?? 'running') === 'running') ||
    voiceListening ||
    slopPromptExpanded ||
    clearConfirmOpen ||
    editorOpen ||
    (narrowLayout && insightsOpen) ||
    // Fullscreen hides the advisor bubble + cast chrome entirely, so pause the
    // proactive loop — otherwise stakeholders keep pulsing nodes (and chiming)
    // over the bare canvas with no visible way to mute them.
    isFullscreen ||
    // Meet the Office orientation/roster owns the stage — no competing popups.
    officeDirectoryUi.open;

  const officeDistractionsPaused = advisorPause || officeCanvasGrace;

  const { advisor, advisorBubbleProps, stakeholderIntroProps } = useAdvisorShell({
    selectedNode,
    hoverDescriptor,
    stateRef,
    contentMode,
    activeSessionId,
    advisorPause,
    controls,
    diagramRevisionId: state.revisionId,
    diagramSource: state.diagramSource,
    runTransform,
    runAnalyze,
    submitIntentWithPrompt,
    reportAdvisorUsage
  });

  const {
    showEntryDeskIntro,
    showEntryDeskPointers,
    showDeskChrome,
    entryTourStep,
    entryReveal,
    deskDrawerTourOpen,
    dismissEntryDeskPointers,
    advanceEntryTour,
    handleEntryModePick,
    modeRevealActive,
    dismissModeReveal,
    handleModeRevealPick
  } = useEntryDeskFlow({
    hasCanvasContent,
    hasDiagramText,
    insightsOpen,
    stakeholderIntroProps,
    editorOpen,
    hasInteractedRef,
    handleSelectContentMode
  });

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
    sourceRevisionAtViewRef.current = {};
    if (diagramAutoHighlightTimerRef.current != null) {
      window.clearTimeout(diagramAutoHighlightTimerRef.current);
      diagramAutoHighlightTimerRef.current = null;
    }
    clearPendingAutoDiagramHighlight();
    setDiagramChangeHighlightEntryId(null);
    setDiagramChangeHighlightAddedOnly(false);
    setError('');
    clearVoiceError();
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
        syncClientDiagramState({ contentType: 'forms', diagramSource: '', sessionId: nid }),
        syncClientDiagramState({ contentType: 'anything', diagramSource: '', sessionId: nid })
      ]);
      freshlyMintedSessionIdsRef.current.delete(nid);
      const fresh = createInitialDiagramState(
        isConcreteContentMode(contentMode) ? contentMode : 'mermaid'
      );
      stateRef.current = fresh;
      setState(fresh);
      setSessionHasPeerContent(false);
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
      if (!isConcreteContentType(contentType)) return;

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
      if (!isConcreteContentType(targetContentType)) return;

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
      if (isConcreteContentType(targetContentType) && targetContentType !== contentMode) {
        suppressNextModeSwitchRerunRef.current = true;
        setContentMode(targetContentType);
        setRendererRefreshKey((n) => n + 1);
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
        : (state.diagramSource ?? '');
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
      activeEntryStatus === 'done' && Boolean(activeAutoCloseEntry?.diagramRevisionApplied);
    const runProducedCanvasResult = revisionChanged || completedActiveMutation;
    if (
      phoneLayout &&
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
  }, [insightsEntries, phoneLayout, insightsOpen, state.revisionId, state.diagramSource]);

  const busy = loading || streamingPreview;

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
      resetRadialChrome();
      setDiagramChangeHighlightAddedOnly(false);
      setDiagramChangeHighlightEntryId(entryId);
      diagramAutoHighlightTimerRef.current = window.setTimeout(() => {
        diagramAutoHighlightTimerRef.current = null;
        setDiagramChangeHighlightEntryId((prev) => (prev === entryId ? null : prev));
      }, AUTO_DIAGRAM_CHANGE_HIGHLIGHT_MS);
    },
    [resetRadialChrome]
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

  // Mirror for appendActivePromptText (a []-dep callback) so voice dictation
  // routes to the persistent desk Work Order buffer whenever there's content.
  useEffect(() => {
    hasCanvasContentRef.current = hasCanvasContent;
  }, [hasCanvasContent]);

  const { critiqueActionableSplit, critiqueActionableUi } = useCritiqueActionableUi({
    activeRequest,
    handleFixFromCritique,
    insightsEntries,
    latestCritique,
    loading
  });

  const canFixFromCritique =
    Boolean(
      latestCritique?.text &&
      critiqueActionableSplit?.hasSection &&
      critiqueActionableSplit.items.length > 0
    ) && !busy;

  const { handleApplyStyleEdits } = useStyleEdits({
    activeSessionId,
    animateAcceptedSource,
    contentMode,
    loadingRef,
    modelProfile,
    setActiveRequest,
    setError,
    setInsightsOpen,
    setLoading,
    streamingPreviewRef,
    submitIntentWithPrompt,
    syncDiagramOrThrow,
    tryAgentSound
  });

  const status = useMemo(() => {
    const loadingCopy = controls.loading;
    if (loading && activeRequest === 'intent') return loadingCopy.applyingChange;
    if (loading && activeRequest?.startsWith?.('transform')) return loadingCopy.transforming;
    if (loading && activeRequest?.startsWith?.('analyze')) return loadingCopy.analyzing;
    if (loading && activeRequest === 'fix') return loadingCopy.applyingFixes;
    if (loading && activeRequest === 'style') return loadingCopy.applyingStyle;
    if (loading && activeRequest === 'clear') return loadingCopy.resetting;
    if (loading && activeRequest === 'autofix')
      return contentMode === 'anything' ? loadingCopy.fixingPage : loadingCopy.fixingMermaid;
    if (loading && activeRequest === 'hydrate') return loadingCopy.hydrating;
    if (streamingPreview) return loadingCopy.refreshing;
    if (error) return error;
    if (voiceError) return voiceError;
    if (validationError && autoFixAttempted)
      return contentMode === 'anything'
        ? `Page needs manual edit: ${validationError.error}`
        : `Mermaid syntax needs manual edit: ${validationError.error}`;
    return '';
  }, [
    activeRequest,
    autoFixAttempted,
    contentMode,
    error,
    loading,
    streamingPreview,
    validationError,
    voiceError,
    controls.loading
  ]);

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
    if (action.id === 'renderMode') {
      renderSelectionInMode(action.targetMode, descriptor);
      return;
    }
    closeRadialMenu();
    const runOpts = { focusTarget: descriptor };
    const variantForBoot =
      action.id === 'refine' ||
      action.id === 'innovate' ||
      action.id === 'goMad' ||
      action.id === 'critique' ||
      action.id === 'explain' ||
      action.id === 'exec'
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

  const radialActions = useMemo(
    () =>
      buildRadialActions({
        controls,
        slopitect,
        goMadStreak,
        contentMode,
        contentModeOptions,
        canFixFromCritique
      }),
    [canFixFromCritique, contentMode, contentModeOptions, controls, goMadStreak, slopitect]
  );

  const { mounted: insightsMounted, closing: insightsClosing } = useDelayedUnmount(
    insightsOpen,
    240
  );
  const liveStreamingEntry = insightsEntries.find((e) => (e.status ?? 'running') === 'running');
  const liveVariant = liveStreamingEntry?.variant ?? null;
  const ceremonyAnchor =
    insightsMounted && insightsOpen ? (phoneLayout ? 'insights' : 'canvas') : 'viewport';
  const ceremonyOverlays = (
    <CeremonyOverlaysSlot
      anchor={ceremonyAnchor}
      bootSeq={bootSeq}
      toasts={streakHudToasts}
      achievement={streakHudAchievement}
      levelUp={streakHudLevelUp}
      liveVariant={liveVariant}
      liveStreaming={Boolean(liveStreamingEntry)}
      showLiveRunHud={Boolean(liveStreamingEntry) && !insightsOpen}
      liveStreak={gamification?.streakByVariant?.[liveVariant] ?? 0}
      insightsOpen={insightsMounted && insightsOpen}
    />
  );
  const insightsSlot = (
    <InsightsSlot
      mounted={insightsMounted}
      closing={insightsClosing}
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
      onRetryInsightEntryWithQuality={(entryId) =>
        retryFailedInsight(entryId, { useQuality: true })
      }
      retryActionsDisabled={loading}
      onDismiss={() => setInsightsOpen(false)}
      onAcceptProposal={handleAcceptProposal}
      onRejectProposal={handleRejectProposal}
      agentReactions={agentReactions}
      onApplyStyleEdits={handleApplyStyleEdits}
      styleEditsApplyBusy={loading}
      liveDraftSource={liveDraftSource}
      liveDraftContentType={liveDraftContentType}
      activeContentType={contentMode}
      explainDumbLevelByEntryId={explainDumbLevelByEntryId}
      explainDumbLoadingEntryId={explainDumbLoadingEntryId}
      explainDumbSurrenderedEntryIds={explainDumbSurrenderedEntryIds}
      onExplainDumbDown={handleExplainDumbDown}
      modelProfile={modelProfile}
      onSelectModelProfile={setModelProfile}
      editorOpen={editorOpen}
      onToggleEditor={() => setEditorOpen((current) => !current)}
      canToggleEditor={hasCanvasContent || editorOpen}
    />
  );

  return (
    <main
      className={`app-shell${editorOpen ? ' is-editor-open' : ''}${insightsOpen ? ' is-insights-open' : ''}${narrowLayout ? ' is-narrow-layout' : ''}${phoneLayout ? ' is-phone-layout' : ''}${wideMobileLayout ? ' is-wide-mobile' : ''}${foldableDualScreen ? ' is-foldable-dual' : ''}${hasCanvasContent || editorOpen ? ' has-edit-control' : ''}${showDeskChrome ? ' has-bottom-brand' : ''}${officeBootPending ? ' is-office-boot' : ''}`}
      aria-label="ArchiSlop"
      data-live-variant={liveStreamingEntry ? liveVariant : undefined}
      data-streaming={liveStreamingEntry ? 'true' : undefined}
      data-advisor-active={
        advisor.thinkingPersona || advisor.suggestion || advisor.activePersona ? 'true' : undefined
      }
    >
      {!officeBootPending ? (
        <>
          <DiagramCanvas
            revisionId={state.revisionId}
            diagramSource={
              liveDraftSource && liveDraftContentType === contentMode
                ? liveDraftSource
                : state.diagramSource
            }
            contentType={contentMode === 'auto' ? 'mermaid' : contentMode}
            rendererRefreshKey={rendererRefreshKey}
            onManualEdit={handleManualEdit}
            onValidationChange={handleValidationChange}
            streamingPreview={
              streamingPreview || (Boolean(liveDraftSource) && liveDraftContentType === contentMode)
            }
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
              streaming: Boolean(liveStreamingEntry) && (!insightsOpen || liveVariant === 'goMad'),
              intensity:
                (gamification?.streakByVariant?.[liveVariant] ?? 0) >= 2 || goMadStreak >= 2
                  ? 'high'
                  : 'normal'
            }}
            diagramSurfaceRef={diagramSurfaceRef}
            isFullscreen={isFullscreen}
            onFormSubmit={handleFormSubmit}
          />

          <ModeRevealSlot
            active={modeRevealActive}
            copy={controls.modeReveal}
            modes={contentModeOptions.filter((m) => m.id !== 'auto')}
            currentMode={contentMode}
            onPickMode={handleModeRevealPick}
            onDismiss={dismissModeReveal}
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
              contentType={contentMode === 'auto' ? 'mermaid' : contentMode}
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
                    copy={controls.prompt}
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
              onAdvisorUsage={reportAdvisorUsage}
            />
          </DiagramFullscreenOverlay>

          {ceremonyOverlays}
          <ErrorToast />
          <OfficeLayer
            pause={officeDistractionsPaused}
            suppressDistractions={officeCanvasGrace}
            advisorBusy={Boolean(advisor.activePersona || advisor.thinkingPersona)}
            getDiagramSource={() => stateRef.current?.diagramSource ?? ''}
            getContentType={() => contentMode}
            getSessionId={() => activeSessionId}
            getSvgRoot={() => (typeof document !== 'undefined' ? document : null)}
            getUserTitle={() => gamification.levelTitle}
            getUserName={() => resolveUserName()}
            onUsage={reportAdvisorUsage}
            onAdoptPrompt={(text) => {
              void submitIntentWithPrompt(buildAdvisorIntentPrompt(text), {});
            }}
            onMeetingMinutes={(entry) => setInsightsEntries((prev) => [...prev, entry])}
            onOfficeEvent={handleOfficeEvent}
            onCheckHrProgression={() => setXpInfoPanelOpen((open) => !open)}
            onOpenOutbox={() => setOutboxOpenSignal((n) => n + 1)}
            onToggleEditor={() => setEditorOpen((current) => !current)}
            onInviteAgent={() => setInviteDialogOpen(true)}
            canToggleEditor={hasCanvasContent || editorOpen}
            editorOpen={editorOpen}
            onToggleThinking={() => setInsightsOpen((v) => !v)}
            modelProfile={modelProfile}
            onSelectModelProfile={setModelProfile}
            callMeetingSignal={callMeetingSignal}
            canOpenOutbox={Boolean((state.diagramSource ?? '').trim())}
            canToggleThinking
            thinkingOpen={insightsOpen}
            playChime={tryAgentSound}
            runSignal={officeRunSignal}
            deskActionsAnchorReady={entryReveal.desk && (hasCanvasContent || showEntryDeskIntro)}
            deskMenuInitialOpen={false}
            deskActionsLayoutKey={narrowLayout ? 'mobile' : 'desktop'}
          />
          <HotkeyOverlay
            open={hotkeyOverlayOpen}
            onClose={() => setHotkeyOverlayOpen(false)}
            copy={controls.hotkeys}
          />

          <BrandChromeSlot
            narrowLayout={narrowLayout}
            compactBrand={compactBrand}
            xpBarMobileOpen={xpBarMobileOpen}
            onToggleXpBarMobile={() => setXpBarMobileOpen((current) => !current)}
            slopitectTip={slopitectTip}
            slopitectTipRef={slopitectTipRef}
            onDismissSlopitectTip={dismissSlopitectTip}
            xpInfoPanelOpen={xpInfoPanelOpen}
            onToggleXpInfoPanel={() => setXpInfoPanelOpen((open) => !open)}
            onCloseXpInfoPanel={() => setXpInfoPanelOpen(false)}
            gamification={gamification}
            xpBarFlashKey={xpBarFlashKey}
            liveVariant={liveVariant}
            controls={controls}
            onBrandClick={handleBrandClick}
            costTrackingEnabled={costTrackingEnabled}
            fullscreenSupported={fullscreenSupported}
            hasCanvasContent={hasCanvasContent}
            editorOpen={editorOpen}
            isFullscreen={isFullscreen}
            streamingPreview={streamingPreview}
            onToggleFullscreen={toggleFullscreen}
          />

          <SessionCollaborationSlot
            activeSessionId={activeSessionId}
            pendingHandshake={pendingHandshake}
            onApproveHandshake={handleApproveHandshake}
            onDenyHandshake={handleDenyHandshake}
            inviteDialogOpen={inviteDialogOpen}
            onInviteDialogClose={() => setInviteDialogOpen(false)}
          />

          <ClearConfirmDialog
            key={clearConfirmOpen ? 'clear-confirm-open' : 'clear-confirm-closed'}
            open={clearConfirmOpen}
            copy={controls.clearDialog}
            onConfirm={() => {
              void performClearDiagram();
            }}
            onCancel={() => setClearConfirmOpen(false)}
          />

          <BottomRow
            narrowLayout={narrowLayout}
            statusRow={
              status ? (
                <div className="overlay-status-row">
                  <p
                    id="app-status"
                    className={`overlay-status ${error ? 'is-error' : ''}`}
                    role="status"
                  >
                    {status}
                  </p>
                  {streamingAgentStoppable && !insightsOpen ? (
                    <button
                      type="button"
                      className="overlay-button compact-button overlay-status-stop"
                      onClick={stopStreamingAgentRequest}
                    >
                      {controls.insights.stopRequest}
                    </button>
                  ) : null}
                </div>
              ) : null
            }
            actions={
              <DeskBottomActionsSlot
                hasCanvasContent={hasCanvasContent}
                insightsOpen={insightsOpen}
                showEntryDeskIntro={showEntryDeskIntro}
                showEntryDeskPointers={showEntryDeskPointers}
                entryTourStep={entryTourStep}
                entryReveal={entryReveal}
                deskDrawerTourOpen={deskDrawerTourOpen}
                narrowLayout={narrowLayout}
                busy={busy}
                loading={loading}
                streamingPreview={streamingPreview}
                controls={controls}
                userName={userName}
                contentMode={contentMode}
                contentModeOptions={contentModeOptions}
                deskSlotRef={deskSlotRef}
                deskPrompt={deskPrompt}
                setDeskPrompt={setDeskPrompt}
                voiceSupported={voiceSupported}
                voiceListening={voiceListening}
                speechRecognitionCtor={SpeechRecognitionCtor}
                PromptIcon={PromptIcon}
                MicIcon={MicIcon}
                MicActiveIcon={MicActiveIcon}
                ButtonIcon={ButtonIcon}
                handleDeskPromptSubmit={handleDeskPromptSubmit}
                handleMicToggleClick={handleMicToggleClick}
                handleMicPointerDown={handleMicPointerDown}
                handleMicPointerUp={handleMicPointerUp}
                stopVoiceInput={stopVoiceInput}
                dismissEntryDeskPointers={dismissEntryDeskPointers}
                advanceEntryTour={advanceEntryTour}
                handleEntryModePick={handleEntryModePick}
                runTransform={runTransform}
                runAnalyze={runAnalyze}
                advisor={advisor}
                advisorBubbleProps={advisorBubbleProps}
                stakeholderIntroProps={stakeholderIntroProps}
                advisorPause={advisorPause}
                goMadStreak={goMadStreak}
                diagramSource={state.diagramSource}
                onCallMeeting={() => setCallMeetingSignal((n) => n + 1)}
                handleSelectContentMode={handleSelectContentMode}
                latestCritique={latestCritique}
                canFixFromCritique={canFixFromCritique}
                handleFixFromCritique={handleFixFromCritique}
                handleClearDiagram={handleClearDiagram}
                onToggleThinking={() => setInsightsOpen((v) => !v)}
                canToggleThinking
              />
            }
            aiControls={
              // Empty intro: Settings only clutter the first screen. Keep the
              // headless Outbox/Settings panels once a diagram exists, or whenever
              // a handshake needs the panel. Peer content also keeps chrome after
              // a mode switch into an empty slot.
              hasCanvasContent || pendingHandshake ? (
                <AiCornerControlsInner
                  controls={controls.settings}
                  pendingHandshake={pendingHandshake}
                  externalAgentPresence={externalAgentPresence}
                  onInviteAgent={() => setInviteDialogOpen(true)}
                  popoverMode={!narrowLayout}
                  contentType={
                    isConcreteContentMode(contentMode) ? contentMode : (state.contentType ?? null)
                  }
                  diagramSource={state.diagramSource}
                  showEditorToggle={hasCanvasContent || editorOpen}
                  editorOpen={editorOpen}
                  onToggleEditor={() => setEditorOpen((current) => !current)}
                  editorControls={controls.editor}
                  settingsOpenSignal={settingsOpenSignal}
                  outboxOpenSignal={outboxOpenSignal}
                />
              ) : null
            }
          />
        </>
      ) : null}
      <div className="office-directory-root-mount">
        <OfficeDirectory
          placement={officeBootPending ? 'boot' : hasCanvasContent ? 'overlay' : 'entry'}
          isBoot={officeBootPending}
          showChip={false}
          onSkipToBuild={focusTopicInput}
          onBootComplete={handleOfficeBootComplete}
          getSessionId={() => activeSessionId}
          userRole={controls.prompt.entryIntro?.role ?? controls.prompt.exampleRole ?? 'Architect'}
        />
      </div>
    </main>
  );
}

export default ArchiSlop;
