import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import DiagramCanvas from './components/DiagramCanvas.jsx';
import ClearConfirmDialog from './components/ClearConfirmDialog.jsx';
import { useDiagramFullscreen } from './hooks/useDiagramFullscreen.js';
import { fallbackState, readDiagramCache } from './state/diagramStore.js';
import { getCachedAgentCostEstimates, loadAgentCostEstimates } from './state/agentCostEstimates';
import './App.css';
import './components/RunTimeline.css';
import { CeremonyOverlaysSlot } from './features/ceremony/CeremonyOverlaysSlot.jsx';
import { InsightsSlot } from './features/insights/InsightsSlot.jsx';
import { SessionCollaborationSlot } from './features/session/SessionCollaborationSlot.jsx';
import { useSessionCollaboration } from './features/session/useSessionCollaboration.js';
import { useSessionHydrate } from './features/session/useSessionHydrate.js';
import { useContentModeSwitch } from './features/session/useContentModeSwitch.js';
import { useSlopitectTips } from './features/prompt/useSlopitectTips.js';
import { useRadialMenu } from './features/prompt/useRadialMenu.js';
import { useAdvisorShell } from './features/advisor/useAdvisorShell.js';
import { useRunCeremony } from './features/ceremony/useRunCeremony.js';
import { DeskBottomActionsSlot } from './features/desk/DeskBottomActionsSlot.jsx';
import { ModeRevealSlot } from './features/desk/ModeRevealSlot.jsx';
import { EmptyCanvasSlot } from './features/desk/EmptyCanvasSlot.jsx';
import { useEntryDeskFlow } from './features/desk/useEntryDeskFlow.js';
import { useOfficeBoot } from './features/desk/useOfficeBoot.js';
import { BrandChromeSlot } from './features/shell/BrandChromeSlot.jsx';
import { useRunStreamingAgent } from './features/streaming/useRunStreamingAgent.js';
import { useAnimateAcceptedSource } from './features/streaming/useAnimateAcceptedSource.js';
import { useCritiqueActionableUi } from './features/insights/useCritiqueActionableUi.js';
import { useDiagramChangeHighlight } from './features/insights/useDiagramChangeHighlight.js';
import { useExplainDumbDown } from './features/insights/useExplainDumbDown.js';
import { useFixFromCritique } from './features/insights/useFixFromCritique.js';
import { useInsightsLedger } from './features/insights/useInsightsLedger.js';
import { useRetryFailedInsight } from './features/insights/useRetryFailedInsight.js';
import { useDiagramAutoFix } from './features/canvas/useDiagramAutoFix.js';
import { useDiagramManualSync } from './features/canvas/useDiagramManualSync.js';
import { useRadialActionHandler } from './features/prompt/useRadialActionHandler.js';
import { RadialMenuSlot } from './features/prompt/RadialMenuSlot.jsx';
import { useClearDiagram } from './features/session/useClearDiagram.js';
import { useSessionCacheLifecycle } from './features/session/useSessionCacheLifecycle.js';
import { useInsightsAutoClose } from './features/insights/useInsightsAutoClose.js';
import { useAppStatus } from './features/shell/useAppStatus.js';
import { OfficeLayerSlot } from './features/shell/OfficeLayerSlot.jsx';
import ErrorToast from './components/ErrorToast.jsx';
import HotkeyOverlay from './components/HotkeyOverlay.jsx';
import {
  createInitialState as createInitialGamificationState,
  readFromStorage as readGamificationFromStorage,
  writeToStorage as writeGamificationToStorage,
  reconcileLifetimeLlmCostUsd
} from './state/runGamificationStore.js';
import OfficeDirectory from './components/OfficeDirectory.jsx';
import { subscribe as subscribeUserName, resolveUserName } from './state/userIdentityStore.js';
import {
  getOfficeDirectoryUi,
  subscribeOfficeDirectoryUi
} from './state/officeDirectoryUiStore.js';
import { useUiCopy } from './i18n/useUiLocale.js';
import { readStreamDebugEnabled } from './utils/appStreamDebug.js';
import { ensureUrlBackedSession, readStoredModelProfile } from './utils/appSessionLocation.js';
import { splitCritiqueActionableSections, isConcreteContentType } from '@archislop/shared';
import { buildOfficeBatchIntentPrompt } from './utils/advisorActionContext.js';
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
import { SpeechRecognitionCtor } from './utils/appConstants.js';
import { buildContentModeOptions, isConcreteContentMode } from './utils/renderModeAction.js';

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
  const [editorOpen, setEditorOpen] = useState(Boolean(cacheRef.current?.editorOpen));
  const [insightsOpen, setInsightsOpen] = useState(Boolean(cacheRef.current?.insightsOpen));
  const {
    insightsEntries,
    setInsightsEntries,
    insightsEntriesRef,
    appendInsightEntry,
    patchInsightEntry,
    appendToInsight,
    setInsightStatus,
    appendTechnicalAction,
    enrichTechnicalActionDetail,
    finalizeTechnicalActionResult,
    annotateTechnicalActionResult,
    appendStreamDebugLog
  } = useInsightsLedger({
    initialEntries: Array.isArray(cacheRef.current?.insightsEntries)
      ? cacheRef.current.insightsEntries
      : [],
    workingStatusText: controls.loading.working
  });
  const [soundEnabled, setSoundEnabled] = useState(cacheRef.current?.soundEnabled ?? true);
  const [modelProfile, setModelProfile] = useState(() => readStoredModelProfile());
  // Bumped on every completed run so the office can ping the user about it.
  const [officeRunSignal, setOfficeRunSignal] = useState(null);
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
  const stateRef = useRef(state);
  const loadingRef = useRef(false);
  const submitIntentWithPromptRef = useRef(null);
  const closeRadialMenuRef = useRef(null);
  const streamingPreviewRef = useRef(false);
  const lastDraftTickAtRef = useRef(0);
  const hasInteractedRef = useRef(false);
  const audioContextRef = useRef(null);
  const celebrationTimerRef = useRef(null);
  const promptRef = useRef('');
  const hasCanvasContentRef = useRef(false);
  const slopPromptExpandedRef = useRef(false);
  const slopPromptSourceRef = useRef(null);
  const lastTokenSoundAtRef = useRef(0);
  const goMadTokenTickIndexRef = useRef(0);

  /** Single session topic; seeded from hydrate and updated on successful intent revisions. */
  const sessionTopicRef = useRef(null);

  /**
   * True when any sibling slot already has customized content. Used to keep the first-run
   * empty intro from reclaiming the chrome when switching into an empty sibling mode.
   */
  const [sessionHasPeerContent, setSessionHasPeerContent] = useState(false);

  const syncDiagramOrThrowRef = useRef(async () => {
    throw new Error('syncDiagramOrThrow not ready');
  });
  const tryAgentSoundRef = useRef(null);

  const {
    contentMode,
    setContentMode,
    rendererRefreshKey,
    hydrateRefs,
    crossModeSyncRef,
    handleSelectContentMode,
    applyResolvedContentMode,
    renderSelectionInMode,
    resetModeSwitchTracking,
    armSuppressHydrateRerun,
    disarmSuppressHydrateRerun,
    switchContentModeForRestore
  } = useContentModeSwitch({
    stateRef,
    syncTimerRef,
    streamTimerRef,
    streamingPreviewRef,
    streamAgentAbortRef,
    loadingRef,
    hasInteractedRef,
    syncDiagramOrThrowRef,
    closeRadialMenuRef,
    tryAgentSoundRef,
    contentModeOptions,
    setStreamingPreview,
    setLiveDraftSource,
    setLiveDraftContentType,
    setSelectedNode,
    setHoverDescriptor,
    setToolbarAnchor,
    setLatestCritique,
    setError
  });

  const { sessionHydrated } = useSessionHydrate({
    activeSessionId,
    contentMode,
    freshlyMintedSessionIdsRef,
    sessionIdFromUrlRef,
    sessionTopicRef,
    modeSwitch: hydrateRefs,
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

  const { animateAcceptedSource } = useAnimateAcceptedSource({
    stateRef,
    streamTimerRef,
    setState,
    setStreamingPreview,
    setLoading,
    setActiveRequest
  });

  const {
    validationError,
    autoFixAttempted,
    clientValidationRef,
    autoFixTimerRef,
    handleValidationChange,
    resetAutoFixState
  } = useDiagramAutoFix({
    activeSessionId,
    animateAcceptedSource,
    contentMode,
    loading,
    loadingRef,
    modelProfile,
    setActiveRequest,
    setError,
    setLoading,
    streamingPreview,
    streamingPreviewRef
  });

  const {
    diagramChangeHighlightEntryId,
    pendingAutoDiagramHighlightRef,
    pendingAutoDiagramHighlightTimeoutRef,
    diagramAutoHighlightTimerRef,
    clearDiagramHighlightTimers,
    handleDiagramSvgRendered,
    handleRestoreToEntry,
    handleRestoreDiagramSnapshot,
    handleOpenProposalFullPreview,
    handleToggleDiagramChangeHighlight,
    changeHighlightForCanvas,
    changeHighlightContentType,
    diagramChangeHighlightSummary,
    entryDiagramDiffById
  } = useDiagramChangeHighlight({
    activeSessionId,
    contentMode,
    insightsEntries,
    insightsOpen,
    loadingRef,
    narrowLayout,
    setContentMode,
    setError,
    setInsightsOpen,
    setState,
    setStreamingPreview,
    state,
    streamTimerRef,
    syncTimerRef,
    armSuppressHydrateRerun,
    disarmSuppressHydrateRerun,
    resetRadialChrome,
    switchContentModeForRestore
  });

  useSessionCacheLifecycle({
    activeSessionId,
    clearDiagramHighlightTimers,
    contentMode,
    controls,
    editorOpen,
    freshlyMintedSessionIdsRef,
    insightsEntries,
    insightsOpen,
    latestCritique,
    modelProfile,
    promptRef,
    resetCollaborationState,
    setActiveRequest,
    setActiveSessionId,
    setEditorOpen,
    setError,
    setHoverDescriptor,
    setInsightsEntries,
    setInsightsOpen,
    setLatestCritique,
    setLoading,
    setPrompt,
    setSelectedNode,
    setSoundEnabled,
    setStreamingPreview,
    setToolbarAnchor,
    soundEnabled,
    state,
    streamAgentAbortRef,
    streamTimerRef,
    syncTimerRef,
    cacheRef
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
  tryAgentSoundRef.current = tryAgentSound;

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

  const { handleManualEdit, syncDiagramOrThrow } = useDiagramManualSync({
    activeSessionId,
    clientValidationRef,
    contentMode,
    setState,
    stateRef,
    syncDiagramOrThrowRef,
    syncTimerRef
  });

  const stopStreamingAgentRequest = useCallback(() => {
    streamAgentAbortRef.current?.abort();
  }, []);

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

  const { retryFailedInsight } = useRetryFailedInsight({
    contentMode,
    insightsEntriesRef,
    loadingRef,
    modelProfile,
    runStreamingAgent,
    setActiveRequest,
    setError,
    setGoMadStreak,
    setLoading,
    streamingPreviewRef,
    syncDiagramOrThrow
  });

  const {
    explainDumbLevelByEntryId,
    explainDumbLoadingEntryId,
    explainDumbSurrenderedEntryIds,
    handleExplainDumbDown,
    reportAdvisorUsage
  } = useExplainDumbDown({
    activeSessionId,
    contentMode,
    controls,
    costTrackingEnabled,
    agentCostEstimatesRef,
    insightsEntriesRef,
    setError,
    setGamification,
    setInsightsEntries
  });

  const {
    submitIntentWithPrompt,
    runIntentChange,
    handleFormSubmit,
    handleStarterPick,
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

  const { handleFixFromCritique } = useFixFromCritique({
    contentMode,
    critiqueActionableSelected,
    hasInteractedRef,
    latestCritique,
    loadingRef,
    modelProfile,
    runStreamingAgent,
    setActiveRequest,
    setError,
    setGoMadStreak,
    setLatestCritique,
    setLoading,
    streamingPreviewRef,
    syncDiagramOrThrow
  });

  const { handleClearDiagram, performClearDiagram } = useClearDiagram({
    cacheRef,
    clearDiagramHighlightTimers,
    clearVoiceError,
    contentMode,
    freshlyMintedSessionIdsRef,
    loadingRef,
    promptRef,
    resetAutoFixState,
    resetModeSwitchTracking,
    sessionTopicRef,
    setActiveRequest,
    setActiveSessionId,
    setClearConfirmOpen,
    setCritiqueActionableSelected,
    setError,
    setGoMadStreak,
    setHoverDescriptor,
    setInsightsEntries,
    setLatestCritique,
    setLiveDraftContentType,
    setLiveDraftSource,
    setLoading,
    setPrompt,
    setSelectedNode,
    setSessionHasPeerContent,
    setState,
    setStreamingPreview,
    setToolbarAnchor,
    stateRef,
    stopVoiceInput,
    streamTimerRef,
    streamingPreviewRef,
    syncTimerRef
  });

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

  const {
    officeBootPending,
    officeCanvasGrace,
    deskTourPending,
    handleOfficeBootComplete,
    completeDeskTour
  } = useOfficeBoot({
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
    showDeskChrome,
    entryReveal,
    entryTourActive,
    entryTourStep,
    entryTourProgress,
    showEntryDeskIntro,
    modeRevealActive,
    dismissModeReveal,
    handleModeRevealPick,
    advanceEntryTour,
    dismissEntryDeskTour
  } = useEntryDeskFlow({
    hasDiagramText,
    insightsOpen,
    stakeholderIntroProps,
    editorOpen,
    handleSelectContentMode,
    deskTourPending,
    onDeskTourComplete: completeDeskTour,
    entryPointers: controls.prompt.entryPointers ?? []
  });

  const showEmptyCanvas =
    !hasCanvasContent &&
    !insightsOpen &&
    !editorOpen &&
    !officeBootPending &&
    !modeRevealActive &&
    !isFullscreen &&
    !loading;
  const entryTourCopy = {
    ...(controls.prompt.entryTour ?? {}),
    deskEyebrow: controls.prompt.entryIntro?.deskEyebrow ?? 'Your desk'
  };

  useInsightsAutoClose({
    autoCloseActiveEntryIdRef,
    insightsEntries,
    insightsOpen,
    phoneLayout,
    setInsightsOpen,
    state
  });

  const busy = loading || streamingPreview;

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

  const { status, streamingAgentStoppable } = useAppStatus({
    activeRequest,
    autoFixAttempted,
    contentMode,
    controls,
    error,
    loading,
    streamingPreview,
    validationError,
    voiceError
  });

  const streamDebugEnabled = readStreamDebugEnabled();

  const { handleRadialAction, radialActions } = useRadialActionHandler({
    busy,
    canFixFromCritique,
    closeRadialMenu,
    contentMode,
    contentModeOptions,
    controls,
    goMadStreak,
    handleFixFromCritique,
    openRadialSlopPrompt,
    radialMenuVisible,
    renderSelectionInMode,
    runAnalyze,
    runTransform,
    selectedNode,
    setBootSeq,
    setHotkeyOverlayOpen,
    setSelectedNode,
    slopitect,
    tryAgentSound
  });

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
      onApplyOfficeActionItems={(_scope, items) => {
        const prompt = buildOfficeBatchIntentPrompt(items);
        if (!prompt) return;
        void submitIntentWithPrompt(prompt, {});
      }}
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

          <EmptyCanvasSlot
            active={showEmptyCanvas}
            busy={loading || streamingPreview}
            copy={controls.prompt}
            userName={userName}
            showEntryDeskIntro={showEntryDeskIntro}
            entryIntroCopy={controls.prompt.entryIntro}
            entryRole={
              controls.prompt.entryIntro?.role ?? controls.prompt.exampleRole ?? 'Architect'
            }
            entryTourCopy={entryTourCopy}
            onAdvanceEntryTour={advanceEntryTour}
            onDismissEntryTour={dismissEntryDeskTour}
          />

          <RadialMenuSlot
            isFullscreen={isFullscreen}
            diagramSurfaceRef={diagramSurfaceRef}
            toggleFullscreen={toggleFullscreen}
            radialMenuSession={radialMenuSession}
            radialActions={radialActions}
            busy={busy}
            diagramSource={state.diagramSource}
            contentType={contentMode === 'auto' ? 'mermaid' : contentMode}
            sessionId={activeSessionId}
            slopPromptExpanded={slopPromptExpanded}
            slopPromptSource={slopPromptSource}
            slopNextPrompt={slopNextPrompt}
            voiceSupported={voiceSupported}
            voiceListening={voiceListening}
            narrowLayout={narrowLayout}
            speechRecognitionCtor={SpeechRecognitionCtor}
            PromptIcon={PromptIcon}
            MicIcon={MicIcon}
            MicActiveIcon={MicActiveIcon}
            ButtonIcon={ButtonIcon}
            promptCopy={controls.prompt}
            onSlopPromptClose={closeSlopPrompt}
            onPromptChange={setSlopNextPrompt}
            onSlopPromptSubmit={handleSlopPromptSubmit}
            onMicToggleClick={handleMicToggleClick}
            onMicPointerDown={handleMicPointerDown}
            onMicPointerUp={handleMicPointerUp}
            onMicLostPointerCapture={() => stopVoiceInput()}
            onActionPick={handleRadialAction}
            setSelectedNode={setSelectedNode}
            closeRadialMenu={closeRadialMenu}
            setBootSeq={setBootSeq}
            tryAgentSound={tryAgentSound}
            runAnalyze={runAnalyze}
            cancelMenuClose={cancelMenuClose}
            scheduleMenuClose={scheduleMenuClose}
            dismissRadialMenu={dismissRadialMenu}
            onAdvisorUsage={reportAdvisorUsage}
          />

          {ceremonyOverlays}
          <ErrorToast />
          <OfficeLayerSlot
            officeDistractionsPaused={officeDistractionsPaused}
            officeCanvasGrace={officeCanvasGrace}
            advisor={advisor}
            stateRef={stateRef}
            contentMode={contentMode}
            activeSessionId={activeSessionId}
            gamification={gamification}
            reportAdvisorUsage={reportAdvisorUsage}
            submitIntentWithPrompt={submitIntentWithPrompt}
            setInsightsEntries={setInsightsEntries}
            handleOfficeEvent={handleOfficeEvent}
            setXpInfoPanelOpen={setXpInfoPanelOpen}
            setOutboxOpenSignal={setOutboxOpenSignal}
            setEditorOpen={setEditorOpen}
            setInviteDialogOpen={setInviteDialogOpen}
            hasCanvasContent={hasCanvasContent}
            editorOpen={editorOpen}
            setInsightsOpen={setInsightsOpen}
            modelProfile={modelProfile}
            setModelProfile={setModelProfile}
            callMeetingSignal={callMeetingSignal}
            diagramSource={state.diagramSource}
            insightsOpen={insightsOpen}
            tryAgentSound={tryAgentSound}
            officeRunSignal={officeRunSignal}
            entryReveal={entryReveal}
            narrowLayout={narrowLayout}
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
                entryReveal={entryReveal}
                narrowLayout={narrowLayout}
                busy={busy}
                loading={loading}
                streamingPreview={streamingPreview}
                controls={controls}
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
                entryTourActive={entryTourActive}
                entryTourStep={entryTourStep}
                entryTourProgress={entryTourProgress}
                entryPointers={controls.prompt.entryPointers ?? []}
                entryTourCopy={entryTourCopy}
                onAdvanceEntryTour={advanceEntryTour}
                onDismissEntryTour={dismissEntryDeskTour}
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
