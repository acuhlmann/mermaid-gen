import { useMemo } from 'react';
import { ThinkingPaneSlot } from './ThinkingPaneSlot.jsx';

/**
 * Memoized Thinking pane slot element for the diagram canvas overlay.
 */
export function useThinkingPaneSlot({
  insightsMounted,
  insightsClosing,
  insightsEntries,
  streakByVariant,
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
}) {
  return useMemo(
    () => (
      <ThinkingPaneSlot
        mounted={insightsMounted}
        closing={insightsClosing}
        entries={insightsEntries}
        streakByVariant={streakByVariant}
        celebratingEntryId={celebratingEntryId}
        streamDebugEnabled={streamDebugEnabled}
        critiqueActionableUi={critiqueActionableUi}
        loading={loading}
        onRestoreToEntry={handleRestoreToEntry}
        onRestoreDiagramSnapshot={handleRestoreDiagramSnapshot}
        onOpenProposalFullPreview={handleOpenProposalFullPreview}
        entryDiagramDiffById={entryDiagramDiffById}
        diagramChangeHighlightEntryId={diagramChangeHighlightEntryId}
        diagramChangeHighlightSummary={diagramChangeHighlightSummary}
        onToggleDiagramChangeHighlight={handleToggleDiagramChangeHighlight}
        streamingAgentStoppable={streamingAgentStoppable}
        onStopStreamingAgent={stopStreamingAgentRequest}
        onRetryInsightEntry={retryFailedInsight}
        onDismiss={() => setInsightsOpen(false)}
        onAcceptProposal={handleAcceptProposal}
        onRejectProposal={handleRejectProposal}
        submitIntentWithPrompt={submitIntentWithPrompt}
        agentReactions={agentReactions}
        onApplyStyleEdits={handleApplyStyleEdits}
        liveDraftSource={liveDraftSource}
        liveDraftContentType={liveDraftContentType}
        contentMode={contentMode}
        explainDumbLevelByEntryId={explainDumbLevelByEntryId}
        explainDumbLoadingEntryId={explainDumbLoadingEntryId}
        explainDumbSurrenderedEntryIds={explainDumbSurrenderedEntryIds}
        onExplainDumbDown={handleExplainDumbDown}
        modelProfile={modelProfile}
        onSelectModelProfile={setModelProfile}
        editorOpen={editorOpen}
        onToggleEditor={() => setEditorOpen((current) => !current)}
        canToggleEditor={hasCanvasContent || editorOpen}
        onToggleThinking={() => setInsightsOpen((open) => !open)}
      />
    ),
    [
      agentReactions,
      celebratingEntryId,
      contentMode,
      critiqueActionableUi,
      diagramChangeHighlightEntryId,
      diagramChangeHighlightSummary,
      editorOpen,
      entryDiagramDiffById,
      explainDumbLevelByEntryId,
      explainDumbLoadingEntryId,
      explainDumbSurrenderedEntryIds,
      handleAcceptProposal,
      handleApplyStyleEdits,
      handleExplainDumbDown,
      handleOpenProposalFullPreview,
      handleRejectProposal,
      handleRestoreDiagramSnapshot,
      handleRestoreToEntry,
      handleToggleDiagramChangeHighlight,
      hasCanvasContent,
      insightsClosing,
      insightsEntries,
      insightsMounted,
      liveDraftContentType,
      liveDraftSource,
      loading,
      modelProfile,
      retryFailedInsight,
      setEditorOpen,
      setInsightsOpen,
      setModelProfile,
      stopStreamingAgentRequest,
      streamDebugEnabled,
      streakByVariant,
      streamingAgentStoppable,
      submitIntentWithPrompt
    ]
  );
}
