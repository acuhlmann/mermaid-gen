import { useCallback } from 'react';
import { useRunStreamingAgent } from './useRunStreamingAgent.js';
import { useRetryFailedInsight } from '../insights/useRetryFailedInsight.js';
import { useExplainDumbDown } from '../insights/useExplainDumbDown.js';
import { useSubmitIntent } from '../../hooks/useSubmitIntent.js';
import { useAnalyzeFlow } from '../../hooks/useAnalyzeFlow.js';
import { useFixFromCritique } from '../insights/useFixFromCritique.js';

/**
 * Agent execution pipeline: streaming runs, intent submission, transforms, critique fix.
 */
export function useAgentRunPipeline({
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
}) {
  const stopStreamingAgentRequest = useCallback(() => {
    streamAgentAbortRef.current?.abort();
  }, [streamAgentAbortRef]);

  const { runStreamingAgent } = useRunStreamingAgent({
    activeSessionId,
    contentMode,
    modelProfile,
    controls,
    streamAgentAbortRef,
    lastTokenSoundAtRef,
    russTokenTickIndexRef,
    lastDraftTickAtRef,
    sessionTopicRef,
    crossModeSyncRef,
    pendingAutoDiagramHighlightRef,
    pendingAutoDiagramHighlightTimeoutRef,
    agentCostEstimatesRef,
    autoCloseActiveEntryIdRef,
    setInsightsOpen,
    setRussStreak,
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
    setRussStreak,
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
    setRussStreak,
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

  if (submitIntentWithPromptRef) {
    submitIntentWithPromptRef.current = submitIntentWithPrompt;
  }

  const { runTransform, runAnalyze } = useAnalyzeFlow({
    contentMode,
    controls,
    russStreak,
    hasInteractedRef,
    loadingRef,
    modelProfile,
    runStreamingAgent,
    selectedNode,
    setActiveRequest,
    setError,
    setRussStreak,
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
    setRussStreak,
    setLatestCritique,
    setLoading,
    streamingPreviewRef,
    syncDiagramOrThrow
  });

  return {
    stopStreamingAgentRequest,
    runStreamingAgent,
    retryFailedInsight,
    explainDumbLevelByEntryId,
    explainDumbLoadingEntryId,
    explainDumbSurrenderedEntryIds,
    handleExplainDumbDown,
    reportAdvisorUsage,
    submitIntentWithPrompt,
    runIntentChange,
    handleFormSubmit,
    handleStarterPick,
    handleSlopPromptSubmit,
    handleDeskPromptSubmit,
    runTransform,
    runAnalyze,
    handleFixFromCritique
  };
}
