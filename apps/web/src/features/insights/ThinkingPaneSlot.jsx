import { InsightsSlot } from './InsightsSlot.jsx';
import { buildOfficeBatchIntentPrompt } from '../../utils/advisorActionContext.js';

/**
 * Thinking pane slot with shell-level callbacks wired in.
 */
export function ThinkingPaneSlot({
  mounted,
  closing,
  entries,
  streakByVariant,
  celebratingEntryId,
  streamDebugEnabled,
  critiqueActionableUi,
  loading,
  onRestoreToEntry,
  onRestoreDiagramSnapshot,
  onOpenProposalFullPreview,
  entryDiagramDiffById,
  diagramChangeHighlightEntryId,
  diagramChangeHighlightSummary,
  onToggleDiagramChangeHighlight,
  streamingAgentStoppable,
  onStopStreamingAgent,
  onRetryInsightEntry,
  onDismiss,
  onAcceptProposal,
  onRejectProposal,
  submitIntentWithPrompt,
  agentReactions,
  onApplyStyleEdits,
  liveDraftSource,
  liveDraftContentType,
  contentMode,
  explainDumbLevelByEntryId,
  explainDumbLoadingEntryId,
  explainDumbSurrenderedEntryIds,
  onExplainDumbDown,
  modelProfile,
  onSelectModelProfile,
  editorOpen,
  onToggleEditor,
  canToggleEditor,
  onToggleThinking
}) {
  return (
    <InsightsSlot
      mounted={mounted}
      closing={closing}
      entries={entries}
      streakByVariant={streakByVariant}
      celebratingEntryId={celebratingEntryId}
      streamDebugEnabled={streamDebugEnabled}
      critiqueActionableUi={critiqueActionableUi}
      diagramUndoDisabled={loading}
      onRestoreToEntry={onRestoreToEntry}
      onRestoreDiagramSnapshot={onRestoreDiagramSnapshot}
      onOpenProposalFullPreview={onOpenProposalFullPreview}
      entryDiagramDiffById={entryDiagramDiffById}
      diagramChangeHighlightEntryId={diagramChangeHighlightEntryId}
      diagramChangeHighlightSummary={diagramChangeHighlightSummary}
      diagramChangeHighlightDisabled={loading}
      onToggleDiagramChangeHighlight={onToggleDiagramChangeHighlight}
      onStopStreamingAgent={streamingAgentStoppable ? onStopStreamingAgent : undefined}
      onRetryInsightEntry={onRetryInsightEntry}
      onRetryInsightEntryWithQuality={(entryId) =>
        onRetryInsightEntry(entryId, { useQuality: true })
      }
      retryActionsDisabled={loading}
      onDismiss={onDismiss}
      onAcceptProposal={onAcceptProposal}
      onRejectProposal={onRejectProposal}
      onApplyOfficeActionItems={(_scope, items) => {
        const prompt = buildOfficeBatchIntentPrompt(items);
        if (!prompt) return;
        void submitIntentWithPrompt(prompt, {});
      }}
      agentReactions={agentReactions}
      onApplyStyleEdits={onApplyStyleEdits}
      styleEditsApplyBusy={loading}
      liveDraftSource={liveDraftSource}
      liveDraftContentType={liveDraftContentType}
      activeContentType={contentMode}
      explainDumbLevelByEntryId={explainDumbLevelByEntryId}
      explainDumbLoadingEntryId={explainDumbLoadingEntryId}
      explainDumbSurrenderedEntryIds={explainDumbSurrenderedEntryIds}
      onExplainDumbDown={onExplainDumbDown}
      modelProfile={modelProfile}
      onSelectModelProfile={onSelectModelProfile}
      editorOpen={editorOpen}
      onToggleEditor={onToggleEditor}
      canToggleEditor={canToggleEditor}
      onToggleThinking={onToggleThinking}
    />
  );
}
