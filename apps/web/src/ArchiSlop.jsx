import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fallbackState, readDiagramCache } from './state/diagramStore.js';
import { getCachedAgentCostEstimates } from './state/agentCostEstimates';
import './App.css';
import './components/RunTimeline.css';
import { CeremonyOverlaysSlot } from './features/ceremony/CeremonyOverlaysSlot.jsx';
import { useThinkingPaneSlot } from './features/insights/useThinkingPaneSlot.jsx';
import { useCritiqueActionableSelection } from './features/insights/useCritiqueActionableSelection.js';
import { useSessionCollaboration } from './features/session/useSessionCollaboration.js';
import { useSessionHydrate } from './features/session/useSessionHydrate.js';
import { useContentModeSwitch } from './features/session/useContentModeSwitch.js';
import { useSlopitectTips } from './features/prompt/useSlopitectTips.js';
import { useRadialMenu } from './features/prompt/useRadialMenu.js';
import { useRunCeremony } from './features/ceremony/useRunCeremony.js';
import { useGamificationPersistence } from './features/ceremony/useGamificationPersistence.js';
import { useAgentRunPipeline } from './features/streaming/useAgentRunPipeline.js';
import { useAnimateAcceptedSource } from './features/streaming/useAnimateAcceptedSource.js';
import { useLiveRunContext } from './features/streaming/useLiveRunContext.js';
import { useCritiqueActionableUi } from './features/insights/useCritiqueActionableUi.js';
import { useDiagramChangeHighlight } from './features/insights/useDiagramChangeHighlight.js';
import { useInsightsLedger } from './features/insights/useInsightsLedger.js';
import { useDiagramAutoFix } from './features/canvas/useDiagramAutoFix.js';
import { useDiagramManualSync } from './features/canvas/useDiagramManualSync.js';
import { useRadialActionHandler } from './features/prompt/useRadialActionHandler.js';
import { useClearDiagram } from './features/session/useClearDiagram.js';
import { useSessionCacheLifecycle } from './features/session/useSessionCacheLifecycle.js';
import { useInsightsAutoClose } from './features/insights/useInsightsAutoClose.js';
import { useAppStatus } from './features/shell/useAppStatus.js';
import { AppWorkspaceSlot } from './features/shell/AppWorkspaceSlot.jsx';
import { buildAppShellClassName } from './features/shell/buildAppShellClassName.js';
import { useShellAdvisorContext } from './features/shell/useShellAdvisorContext.js';
import { useShellRefSync } from './features/shell/useShellRefSync.js';
import {
  createInitialState as createInitialGamificationState,
  readFromStorage as readGamificationFromStorage
} from './state/runGamificationStore.js';
import OfficeDirectory from './components/OfficeDirectory.jsx';
import { useUiCopy } from './i18n/useUiLocale.js';
import { readStreamDebugEnabled } from './utils/appStreamDebug.js';
import { ensureUrlBackedSession, readStoredModelProfile } from './utils/appSessionLocation.js';
import {
  useCompactBrandLayout,
  useFoldableDualScreen,
  useNarrowLayout,
  usePhoneLayout,
  useWideMobileLayout
} from './hooks/useAppLayoutMedia.js';
import { useDelayedUnmount } from './utils/useDelayedUnmount.js';
import { useSyncVisualViewportHeight } from './hooks/useSyncVisualViewportHeight.js';
import { useStyleEdits } from './hooks/useStyleEdits.js';
import { useVoiceInput } from './hooks/useVoiceInput.js';
import { useDeskSlotRef } from './hooks/useDeskSlotRef.js';
import { SpeechRecognitionCtor } from './utils/appConstants.js';
import { buildContentModeOptions } from './utils/renderModeAction.js';

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

  const { costTrackingEnabled } = useGamificationPersistence({
    agentCostEstimatesRef,
    gamification,
    insightsEntries,
    setGamification
  });

  useCritiqueActionableSelection({ latestCritique, setCritiqueActionableSelected });

  const closeSlopPrompt = useCallback(() => {
    setSlopPromptExpanded(false);
    setSlopPromptSource(null);
    setSlopNextPrompt('');
  }, []);

  useShellRefSync({
    autoFixTimerRef,
    celebrationTimerRef,
    cleanupVoiceInput,
    diagramAutoHighlightTimerRef,
    loading,
    loadingRef,
    pendingAutoDiagramHighlightRef,
    pendingAutoDiagramHighlightTimeoutRef,
    state,
    stateRef,
    streamingPreview,
    streamingPreviewRef,
    syncTimerRef,
    streamTimerRef
  });

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

  const {
    stopStreamingAgentRequest,
    retryFailedInsight,
    explainDumbLevelByEntryId,
    explainDumbLoadingEntryId,
    explainDumbSurrenderedEntryIds,
    handleExplainDumbDown,
    reportAdvisorUsage,
    submitIntentWithPrompt,
    handleFormSubmit,
    handleSlopPromptSubmit,
    handleDeskPromptSubmit,
    runTransform,
    runAnalyze,
    handleFixFromCritique
  } = useAgentRunPipeline({
    activeSessionId,
    agentCostEstimatesRef,
    animateAcceptedSource,
    appendInsightEntry,
    appendStreamDebugLog,
    appendTechnicalAction,
    appendToInsight,
    applyLocaleFromText,
    applyResolvedContentMode,
    autoCloseActiveEntryIdRef,
    closeRadialMenuRef,
    closeSlopPrompt,
    contentMode,
    controls,
    costTrackingEnabled,
    critiqueActionableSelected,
    crossModeSyncRef,
    goMadStreak,
    goMadTokenTickIndexRef,
    hasInteractedRef,
    insightsEntriesRef,
    lastDraftTickAtRef,
    lastTokenSoundAtRef,
    latestCritique,
    loadingRef,
    modelProfile,
    pendingAutoDiagramHighlightRef,
    pendingAutoDiagramHighlightTimeoutRef,
    prompt,
    radialMenuSession,
    selectedNode,
    sessionTopicRef,
    setActiveRequest,
    setDeskPrompt,
    setError,
    setGamification,
    setGoMadStreak,
    setInsightsEntries,
    setInsightsOpen,
    setLatestCritique,
    setLiveDraftContentType,
    setLiveDraftSource,
    setLoading,
    setPrompt,
    setSelectedNode,
    slopPromptSource,
    stateRef,
    streamAgentAbortRef,
    streamingPreviewRef,
    submitIntentWithPromptRef,
    syncDiagramOrThrow,
    triggerCompletionDelight,
    tryAgentSound,
    patchInsightEntry,
    setInsightStatus,
    annotateTechnicalActionResult,
    finalizeTechnicalActionResult,
    enrichTechnicalActionDetail
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

  const {
    diagramSurfaceRef,
    fullscreenSupported,
    isFullscreen,
    toggleFullscreen,
    hasCanvasContent,
    officeBootPending,
    officeCanvasGrace,
    handleOfficeBootComplete,
    userName,
    advisorPause,
    officeDistractionsPaused,
    advisor,
    advisorBubbleProps,
    stakeholderIntroProps,
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
    dismissEntryDeskTour,
    showEmptyCanvas,
    entryTourCopy
  } = useShellAdvisorContext({
    activeSessionId,
    clearConfirmOpen,
    contentMode,
    controls,
    editorOpen,
    handleSelectContentMode,
    hoverDescriptor,
    insightsEntries,
    insightsOpen,
    liveDraftContentType,
    liveDraftSource,
    loading,
    narrowLayout,
    reportAdvisorUsage,
    runAnalyze,
    runTransform,
    selectedNode,
    sessionHasPeerContent,
    slopPromptExpanded,
    state,
    stateRef,
    streamingPreview,
    submitIntentWithPrompt,
    voiceListening
  });

  useInsightsAutoClose({
    autoCloseActiveEntryIdRef,
    insightsEntries,
    insightsOpen,
    phoneLayout,
    setInsightsOpen,
    state
  });

  const busy = loading || streamingPreview;

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
  const { liveStreamingEntry, liveVariant, ceremonyAnchor, agentThinkingChrome, runFx } =
    useLiveRunContext({
      gamification,
      goMadStreak,
      insightsEntries,
      insightsMounted,
      insightsOpen,
      loading,
      phoneLayout
    });
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
  const insightsSlot = useThinkingPaneSlot({
    insightsMounted,
    insightsClosing,
    insightsEntries,
    streakByVariant: gamification?.streakByVariant,
    celebratingEntryId,
    streamDebugEnabled,
    critiqueActionableUi,
    loading,
    handleRestoreToEntry,
    handleRestoreDiagramSnapshot,
    handleOpenProposalFullPreview,
    entryDiagramDiffById,
    diagramChangeHighlightEntryId,
    diagramChangeHighlightSummary,
    handleToggleDiagramChangeHighlight,
    streamingAgentStoppable,
    stopStreamingAgentRequest,
    retryFailedInsight,
    setInsightsOpen,
    handleAcceptProposal,
    handleRejectProposal,
    submitIntentWithPrompt,
    agentReactions,
    handleApplyStyleEdits,
    liveDraftSource,
    liveDraftContentType,
    contentMode,
    explainDumbLevelByEntryId,
    explainDumbLoadingEntryId,
    explainDumbSurrenderedEntryIds,
    handleExplainDumbDown,
    modelProfile,
    setModelProfile,
    editorOpen,
    setEditorOpen,
    hasCanvasContent
  });

  return (
    <main
      className={buildAppShellClassName({
        editorOpen,
        insightsOpen,
        narrowLayout,
        phoneLayout,
        wideMobileLayout,
        foldableDualScreen,
        hasCanvasContent,
        showDeskChrome,
        officeBootPending
      })}
      aria-label="ArchiSlop"
      data-live-variant={liveStreamingEntry ? liveVariant : undefined}
      data-streaming={liveStreamingEntry ? 'true' : undefined}
      data-advisor-active={
        advisor.thinkingPersona || advisor.suggestion || advisor.activePersona ? 'true' : undefined
      }
    >
      {!officeBootPending ? (
        <AppWorkspaceSlot
          state={state}
          contentMode={contentMode}
          contentModeOptions={contentModeOptions}
          rendererRefreshKey={rendererRefreshKey}
          liveDraftSource={liveDraftSource}
          liveDraftContentType={liveDraftContentType}
          streamingPreview={streamingPreview}
          agentThinkingChrome={agentThinkingChrome && !streamingPreview}
          editorOpen={editorOpen}
          setEditorOpen={setEditorOpen}
          insightsMounted={insightsMounted}
          insightsSlot={insightsSlot}
          selectedNode={selectedNode}
          hoverDescriptor={hoverDescriptor}
          onSelectedNodeChange={handleSelectedNodeChange}
          onHoverTargetChange={handleHoverTargetChange}
          dismissRadialMenu={dismissRadialMenu}
          setToolbarAnchor={setToolbarAnchor}
          changeHighlightForCanvas={changeHighlightForCanvas}
          changeHighlightContentType={changeHighlightContentType}
          onDiagramSvgRendered={handleDiagramSvgRendered}
          runFx={runFx}
          diagramSurfaceRef={diagramSurfaceRef}
          isFullscreen={isFullscreen}
          onFormSubmit={handleFormSubmit}
          onManualEdit={handleManualEdit}
          onValidationChange={handleValidationChange}
          modeRevealActive={modeRevealActive}
          modeRevealCopy={controls.modeReveal}
          onModeRevealPick={handleModeRevealPick}
          onDismissModeReveal={dismissModeReveal}
          showEmptyCanvas={showEmptyCanvas}
          loading={loading}
          promptCopy={controls.prompt}
          userName={userName}
          showEntryDeskIntro={showEntryDeskIntro}
          entryIntroCopy={controls.prompt.entryIntro}
          entryRole={controls.prompt.entryIntro?.role ?? controls.prompt.exampleRole ?? 'Architect'}
          entryTourCopy={entryTourCopy}
          onAdvanceEntryTour={advanceEntryTour}
          onDismissEntryTour={dismissEntryDeskTour}
          toggleFullscreen={toggleFullscreen}
          radialMenuSession={radialMenuSession}
          radialActions={radialActions}
          busy={busy}
          activeSessionId={activeSessionId}
          slopPromptExpanded={slopPromptExpanded}
          slopPromptSource={slopPromptSource}
          slopNextPrompt={slopNextPrompt}
          voiceSupported={voiceSupported}
          voiceListening={voiceListening}
          narrowLayout={narrowLayout}
          onSlopPromptClose={closeSlopPrompt}
          onSlopNextPromptChange={setSlopNextPrompt}
          onSlopPromptSubmit={handleSlopPromptSubmit}
          onMicToggleClick={handleMicToggleClick}
          onMicPointerDown={handleMicPointerDown}
          onMicPointerUp={handleMicPointerUp}
          stopVoiceInput={stopVoiceInput}
          onRadialActionPick={handleRadialAction}
          setSelectedNode={setSelectedNode}
          closeRadialMenu={closeRadialMenu}
          setBootSeq={setBootSeq}
          tryAgentSound={tryAgentSound}
          runAnalyze={runAnalyze}
          cancelMenuClose={cancelMenuClose}
          scheduleMenuClose={scheduleMenuClose}
          onAdvisorUsage={reportAdvisorUsage}
          ceremonyOverlays={ceremonyOverlays}
          officeDistractionsPaused={officeDistractionsPaused}
          officeCanvasGrace={officeCanvasGrace}
          advisor={advisor}
          stateRef={stateRef}
          gamification={gamification}
          submitIntentWithPrompt={submitIntentWithPrompt}
          setInsightsEntries={setInsightsEntries}
          onOfficeEvent={handleOfficeEvent}
          setXpInfoPanelOpen={setXpInfoPanelOpen}
          setOutboxOpenSignal={setOutboxOpenSignal}
          setInviteDialogOpen={setInviteDialogOpen}
          hasCanvasContent={hasCanvasContent}
          setInsightsOpen={setInsightsOpen}
          modelProfile={modelProfile}
          setModelProfile={setModelProfile}
          callMeetingSignal={callMeetingSignal}
          insightsOpen={insightsOpen}
          officeRunSignal={officeRunSignal}
          entryReveal={entryReveal}
          hotkeyOverlayOpen={hotkeyOverlayOpen}
          onCloseHotkeyOverlay={() => setHotkeyOverlayOpen(false)}
          hotkeyCopy={controls.hotkeys}
          compactBrand={compactBrand}
          xpBarMobileOpen={xpBarMobileOpen}
          onToggleXpBarMobile={() => setXpBarMobileOpen((current) => !current)}
          slopitectTip={slopitectTip}
          slopitectTipRef={slopitectTipRef}
          onDismissSlopitectTip={dismissSlopitectTip}
          xpInfoPanelOpen={xpInfoPanelOpen}
          onToggleXpInfoPanel={() => setXpInfoPanelOpen((open) => !open)}
          onCloseXpInfoPanel={() => setXpInfoPanelOpen(false)}
          xpBarFlashKey={xpBarFlashKey}
          liveVariant={liveVariant}
          shellControls={controls}
          onBrandClick={handleBrandClick}
          costTrackingEnabled={costTrackingEnabled}
          fullscreenSupported={fullscreenSupported}
          onToggleFullscreen={toggleFullscreen}
          pendingHandshake={pendingHandshake}
          onApproveHandshake={handleApproveHandshake}
          onDenyHandshake={handleDenyHandshake}
          inviteDialogOpen={inviteDialogOpen}
          onInviteDialogClose={() => setInviteDialogOpen(false)}
          clearConfirmOpen={clearConfirmOpen}
          clearDialogCopy={controls.clearDialog}
          onConfirmClear={() => {
            void performClearDiagram();
          }}
          onCancelClear={() => setClearConfirmOpen(false)}
          status={status}
          error={error}
          streamingAgentStoppable={streamingAgentStoppable}
          stopStreamingAgentLabel={controls.insights.stopRequest}
          onStopStreamingAgent={stopStreamingAgentRequest}
          pendingHandshakeForAi={pendingHandshake}
          stateContentType={state.contentType}
          settingsOpenSignal={settingsOpenSignal}
          outboxOpenSignal={outboxOpenSignal}
          onInviteAgent={() => setInviteDialogOpen(true)}
          externalAgentPresence={externalAgentPresence}
          deskSlotRef={deskSlotRef}
          deskPrompt={deskPrompt}
          setDeskPrompt={setDeskPrompt}
          handleDeskPromptSubmit={handleDeskPromptSubmit}
          runTransform={runTransform}
          advisorBubbleProps={advisorBubbleProps}
          stakeholderIntroProps={stakeholderIntroProps}
          advisorPause={advisorPause}
          goMadStreak={goMadStreak}
          onCallMeeting={() => setCallMeetingSignal((n) => n + 1)}
          handleSelectContentMode={handleSelectContentMode}
          latestCritique={latestCritique}
          canFixFromCritique={canFixFromCritique}
          handleFixFromCritique={handleFixFromCritique}
          handleClearDiagram={handleClearDiagram}
          onToggleThinking={() => setInsightsOpen((v) => !v)}
          entryTourActive={entryTourActive}
          entryTourStep={entryTourStep}
          entryTourProgress={entryTourProgress}
          entryPointers={controls.prompt.entryPointers ?? []}
        />
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
