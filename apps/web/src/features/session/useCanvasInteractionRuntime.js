import { useRadialMenu } from '../prompt/useRadialMenu.js';
import { useAnimateAcceptedSource } from '../streaming/useAnimateAcceptedSource.js';
import { useDiagramAutoFix } from '../canvas/useDiagramAutoFix.js';
import { useDiagramChangeHighlight } from '../insights/useDiagramChangeHighlight.js';
import { useSessionCacheLifecycle } from './useSessionCacheLifecycle.js';
import { useFlowchartGraphEdit } from '../canvas/useFlowchartGraphEdit.js';

/**
 * Radial menu, diagram validation/highlight, and per-session cache lifecycle.
 */
export function useCanvasInteractionRuntime({
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
  uiLocale,
  narrowLayout,
  promptRef,
  resetCollaborationState,
  resetRadialChrome,
  selectedNode,
  setActiveRequest,
  setActiveSessionId,
  setContentMode,
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
}) {
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
    resetRadialChrome: resetRadialChromeFromMenu
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

  const flowchartGraphEdit = useFlowchartGraphEdit({
    activeSessionId,
    busy: loading || streamingPreview,
    closeRadialMenu,
    contentMode,
    controls,
    selectedNode,
    setSelectedNode,
    setState,
    stateRef,
    toolbarAnchor
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
    uiLocale,
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
    resetRadialChrome: resetRadialChrome ?? resetRadialChromeFromMenu,
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

  return {
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
    entryDiagramDiffById,
    flowchartGraphEdit
  };
}
