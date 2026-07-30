import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import './App.css';
import './components/RunTimeline.css';
import './components/OfficeFloor.css';
import { useThinkingPaneSlot } from './features/insights/useThinkingPaneSlot.jsx';
import { useCritiqueActionableSelection } from './features/insights/useCritiqueActionableSelection.js';
import { useSlopitectTips } from './features/prompt/useSlopitectTips.js';
import { useRunCeremony } from './features/ceremony/useRunCeremony.js';
import { useGamificationPersistence } from './features/ceremony/useGamificationPersistence.js';
import { useCeremonyOverlays } from './features/ceremony/useCeremonyOverlays.jsx';
import { useAgentRunPipeline } from './features/streaming/useAgentRunPipeline.js';
import { useLiveRunContext } from './features/streaming/useLiveRunContext.js';
import { useCritiqueActionableUi } from './features/insights/useCritiqueActionableUi.js';
import { useDiagramManualSync } from './features/canvas/useDiagramManualSync.js';
import { useRadialActionHandler } from './features/prompt/useRadialActionHandler.js';
import { useClearDiagram } from './features/session/useClearDiagram.js';
import { useInsightsAutoClose } from './features/insights/useInsightsAutoClose.js';
import { useAppStatus } from './features/shell/useAppStatus.js';
import { AppWorkspaceSlot } from './features/shell/AppWorkspaceSlot.jsx';
import { buildAppShellClassName } from './features/shell/buildAppShellClassName.js';
import { useShellAdvisorContext } from './features/shell/useShellAdvisorContext.js';
import { useShellRefSync } from './features/shell/useShellRefSync.js';
import { useArchiSlopSessionState } from './features/session/useArchiSlopSessionState.js';
import { useDiagramSessionRuntime } from './features/session/useDiagramSessionRuntime.js';
import { useCanvasInteractionRuntime } from './features/session/useCanvasInteractionRuntime.js';
import { usePromptBufferSync } from './features/session/usePromptBufferSync.js';
import OfficeDirectory from './components/OfficeDirectory.jsx';
import FloorArrival from './components/officeFloor/FloorArrival.jsx';
import { useUiCopy } from './i18n/useUiLocale.js';
import { readStreamDebugEnabled } from './utils/appStreamDebug.js';
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
import { buildContentModeOptions } from './utils/renderModeAction.js';
import { useOfficeAmbientAudio } from './hooks/useOfficeAmbientAudio.js';
import { useOfficeViewHotkey } from './hooks/useOfficeViewHotkey.js';
import { primeOfficeAudio } from './utils/officeAudioPrime.js';
import {
  getOfficeViewMode,
  subscribe as subscribeOfficeViewMode
} from './state/officeViewModeStore.js';

export function ArchiSlop() {
  const { controls, slopitect, applyLocaleFromText, locale: uiLocale } = useUiCopy();
  const deskSlotRef = useDeskSlotRef();
  const contentModeOptions = useMemo(() => buildContentModeOptions(controls), [controls]);
  const { slopitectTip, slopitectTipRef, handleBrandClick, dismissSlopitectTip, focusTopicInput } =
    useSlopitectTips({ idleTips: slopitect.IDLE_TIPS });

  const session = useArchiSlopSessionState({ controls });
  const {
    activeSessionId,
    setActiveSessionId,
    cacheRef,
    state,
    setState,
    prompt,
    setPrompt,
    slopNextPrompt,
    setSlopNextPrompt,
    deskPrompt,
    setDeskPrompt,
    deskPromptRef,
    slopNextPromptRef,
    loading,
    setLoading,
    activeRequest,
    setActiveRequest,
    error,
    setError,
    streamingPreview,
    setStreamingPreview,
    liveDraftSource,
    setLiveDraftSource,
    liveDraftContentType,
    setLiveDraftContentType,
    editorOpen,
    setEditorOpen,
    insightsOpen,
    setInsightsOpen,
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
    appendStreamDebugLog,
    soundEnabled,
    setSoundEnabled,
    modelProfile,
    setModelProfile,
    officeRunSignal,
    setOfficeRunSignal,
    latestCritique,
    setLatestCritique,
    critiqueActionableSelected,
    setCritiqueActionableSelected,
    russStreak,
    setRussStreak,
    gamification,
    setGamification,
    xpBarMobileOpen,
    setXpBarMobileOpen,
    xpInfoPanelOpen,
    setXpInfoPanelOpen,
    settingsOpenSignal,
    setSettingsOpenSignal,
    callMeetingSignal,
    huddleSignal,
    setCallMeetingSignal,
    setHuddleSignal,
    selectedNode,
    setSelectedNode,
    hotkeyOverlayOpen,
    setHotkeyOverlayOpen,
    hoverDescriptor,
    setHoverDescriptor,
    toolbarAnchor,
    setToolbarAnchor,
    voiceSupported,
    slopPromptExpanded,
    setSlopPromptExpanded,
    slopPromptSource,
    setSlopPromptSource,
    clearConfirmOpen,
    setClearConfirmOpen,
    syncTimerRef,
    streamTimerRef,
    streamAgentAbortRef,
    agentCostEstimatesRef,
    autoCloseActiveEntryIdRef,
    stateRef,
    loadingRef,
    submitIntentWithPromptRef,
    closeRadialMenuRef,
    streamingPreviewRef,
    lastDraftTickAtRef,
    hasInteractedRef,
    audioContextRef,
    celebrationTimerRef,
    promptRef,
    hasCanvasContentRef,
    slopPromptExpandedRef,
    slopPromptSourceRef,
    lastTokenSoundAtRef,
    russTokenTickIndexRef,
    sessionTopicRef,
    sessionHasPeerContent,
    setSessionHasPeerContent,
    syncDiagramOrThrowRef,
    tryAgentSoundRef,
    freshlyMintedSessionIdsRef,
    sessionIdFromUrlRef
  } = session;

  const runtime = useDiagramSessionRuntime({
    activeSessionId,
    contentModeOptions,
    controls,
    freshlyMintedSessionIdsRef,
    sessionIdFromUrlRef,
    sessionTopicRef,
    stateRef,
    promptRef,
    loadingRef,
    submitIntentWithPromptRef,
    cacheRef,
    syncTimerRef,
    streamTimerRef,
    streamingPreviewRef,
    streamAgentAbortRef,
    hasInteractedRef,
    syncDiagramOrThrowRef,
    closeRadialMenuRef,
    tryAgentSoundRef,
    setStreamingPreview,
    setLiveDraftSource,
    setLiveDraftContentType,
    setSelectedNode,
    setHoverDescriptor,
    setToolbarAnchor,
    setLatestCritique,
    setError,
    setActiveSessionId,
    setState,
    setSessionHasPeerContent,
    setLoading,
    setActiveRequest,
    setPrompt,
    setInsightsEntries,
    setCritiqueActionableSelected,
    setRussStreak,
    setModelProfile
  });

  const {
    contentMode,
    rendererRefreshKey,
    crossModeSyncRef,
    handleSelectContentMode,
    applyResolvedContentMode,
    renderSelectionInMode,
    resetModeSwitchTracking,
    armSuppressHydrateRerun,
    disarmSuppressHydrateRerun,
    switchContentModeForRestore,
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
  } = runtime;

  useSyncVisualViewportHeight();
  const narrowLayout = useNarrowLayout();
  const phoneLayout = usePhoneLayout();
  const wideMobileLayout = useWideMobileLayout();
  const foldableDualScreen = useFoldableDualScreen();
  const compactBrand = useCompactBrandLayout();

  usePromptBufferSync({
    prompt,
    promptRef,
    deskPrompt,
    deskPromptRef,
    slopNextPrompt,
    slopNextPromptRef,
    slopPromptExpanded,
    slopPromptExpandedRef,
    slopPromptSource,
    slopPromptSourceRef
  });

  const canvas = useCanvasInteractionRuntime({
    activeSessionId,
    armSuppressHydrateRerun,
    cacheRef,
    contentMode,
    controls,
    disarmSuppressHydrateRerun,
    editorOpen,
    freshlyMintedSessionIdsRef,
    insightsEntries,
    insightsOpen,
    latestCritique,
    loading,
    loadingRef,
    modelProfile,
    narrowLayout,
    promptRef,
    resetCollaborationState,
    selectedNode,
    setActiveRequest,
    setActiveSessionId,
    setContentMode: runtime.setContentMode,
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
    setState,
    setStreamingPreview,
    setToolbarAnchor,
    setSlopNextPrompt,
    setSlopPromptExpanded,
    setSlopPromptSource,
    slopPromptExpandedRef,
    slopPromptSourceRef,
    soundEnabled,
    state,
    stateRef,
    streamAgentAbortRef,
    streamTimerRef,
    streamingPreview,
    streamingPreviewRef,
    switchContentModeForRestore,
    syncTimerRef,
    toolbarAnchor,
    closeRadialMenuRef
  });

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
    animateAcceptedSource,
    validationError,
    autoFixAttempted,
    clientValidationRef,
    autoFixTimerRef,
    handleValidationChange,
    resetAutoFixState,
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
  } = canvas;

  const {
    voiceListening,
    voiceError,
    stopVoiceInput,
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
  }, [setSlopNextPrompt, setSlopPromptExpanded, setSlopPromptSource]);

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

  // Returns whether the gate let the call through. One-shot chimes ignore this;
  // the continuous room-tone bed needs it, since a gate that closes mid-session
  // has to stop a loop that is already playing (useOfficeRoomTone).
  const tryAgentSound = useCallback(
    (playFn) => {
      if (!soundEnabled) return false;
      primeOfficeAudio(audioContextRef, hasInteractedRef);
      if (!hasInteractedRef.current) return false;
      try {
        playFn(audioContextRef);
      } catch {
        // Ignore audio issues (autoplay restrictions, unsupported browser, etc).
      }
      return true;
    },
    [soundEnabled, audioContextRef, hasInteractedRef]
  );
  tryAgentSoundRef.current = tryAgentSound;

  // Office soundscape waits on the same gesture gate as agent chimes. Prime on
  // any deliberate UI interaction — stand up, check in, desk menu — not only on
  // diagram generation.
  useEffect(() => {
    if (!soundEnabled) return undefined;
    const prime = () => primeOfficeAudio(audioContextRef, hasInteractedRef);
    const opts = { capture: true, once: true, passive: true };
    document.addEventListener('pointerdown', prime, opts);
    document.addEventListener('keydown', prime, opts);
    return () => {
      document.removeEventListener('pointerdown', prime, opts);
      document.removeEventListener('keydown', prime, opts);
    };
  }, [soundEnabled, audioContextRef, hasInteractedRef]);

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
    russStreak,
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
    russStreak,
    russTokenTickIndexRef,
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
    setRussStreak,
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
    setRussStreak,
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

  const shell = useShellAdvisorContext({
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
    officeDistractionsPaused,
    advisor,
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
  } = shell;

  const officeViewMode = useSyncExternalStore(
    subscribeOfficeViewMode,
    getOfficeViewMode,
    getOfficeViewMode
  );
  // Mount ambient audio here — always in the tree — so the room-tone bed survives
  // the floor-arrival → desk transition (OfficeLayer is not mounted during boot).
  useOfficeAmbientAudio({
    playChime: tryAgentSound,
    audioContextRef,
    hasInteractedRef,
    soundEnabled,
    roomToneViewMode: officeBootPending || officeViewMode === 'floor' ? 'floor' : 'desk'
  });

  useOfficeViewHotkey({ enabled: !officeBootPending });

  useInsightsAutoClose({
    autoCloseActiveEntryIdRef,
    insightsEntries,
    insightsOpen,
    phoneLayout,
    setInsightsOpen,
    state
  });

  const busy = loading || streamingPreview;

  useEffect(() => {
    hasCanvasContentRef.current = hasCanvasContent;
  }, [hasCanvasContent, hasCanvasContentRef]);

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
    russStreak,
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
      russStreak,
      insightsEntries,
      insightsMounted,
      insightsOpen,
      loading,
      phoneLayout
    });

  const ceremonyOverlays = useCeremonyOverlays({
    ceremonyAnchor,
    bootSeq,
    streakHudToasts,
    streakHudAchievement,
    streakHudLevelUp,
    liveVariant,
    liveStreamingEntry,
    insightsOpen,
    insightsMounted,
    gamification
  });

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
          setInviteDialogOpen={setInviteDialogOpen}
          hasCanvasContent={hasCanvasContent}
          setInsightsOpen={setInsightsOpen}
          modelProfile={modelProfile}
          setModelProfile={setModelProfile}
          callMeetingSignal={callMeetingSignal}
          huddleSignal={huddleSignal}
          insightsOpen={insightsOpen}
          agentBusy={busy || insightsEntries.some((e) => (e.status ?? 'running') === 'running')}
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
          onInviteAgent={() => setInviteDialogOpen(true)}
          externalAgentPresence={externalAgentPresence}
          deskSlotRef={deskSlotRef}
          deskPrompt={deskPrompt}
          setDeskPrompt={setDeskPrompt}
          handleDeskPromptSubmit={handleDeskPromptSubmit}
          runTransform={runTransform}
          russStreak={russStreak}
          onHuddle={() => setHuddleSignal((n) => n + 1)}
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
      {/* First run arrives through the floor (ADR-0011 slice 3); the card tour
          stays mounted afterwards for replays from the level panel. */}
      {officeBootPending ? (
        <FloorArrival
          onComplete={handleOfficeBootComplete}
          onSkipToBuild={focusTopicInput}
          getSessionId={() => activeSessionId}
          playChime={tryAgentSound}
          audioContextRef={audioContextRef}
          hasInteractedRef={hasInteractedRef}
          soundEnabled={soundEnabled}
        />
      ) : (
        <div className="office-directory-root-mount">
          <OfficeDirectory
            placement={hasCanvasContent ? 'overlay' : 'entry'}
            showChip={false}
            onSkipToBuild={focusTopicInput}
            onBootComplete={handleOfficeBootComplete}
            getSessionId={() => activeSessionId}
            userRole={
              controls.prompt.entryIntro?.role ?? controls.prompt.exampleRole ?? 'Architect'
            }
          />
        </div>
      )}
    </main>
  );
}

export default ArchiSlop;
