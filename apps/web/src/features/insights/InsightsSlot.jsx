import InsightsPane from '../../components/InsightsPane.jsx';

/**
 * Thinking pane slot wired from the app shell.
 *
 * @param {object} props
 */
export function InsightsSlot({
  mounted,
  closing,
  entries,
  streakByVariant,
  celebratingEntryId,
  streamDebugEnabled,
  critiqueActionableUi,
  diagramUndoDisabled,
  onRestoreToEntry,
  onRestoreDiagramSnapshot,
  onOpenProposalFullPreview,
  entryDiagramDiffById,
  diagramChangeHighlightEntryId,
  diagramChangeHighlightSummary,
  diagramChangeHighlightDisabled,
  onToggleDiagramChangeHighlight,
  onStopStreamingAgent,
  onRetryInsightEntry,
  onRetryInsightEntryWithQuality,
  retryActionsDisabled,
  onDismiss,
  onAcceptProposal,
  onRejectProposal,
  agentReactions,
  onApplyStyleEdits,
  styleEditsApplyBusy,
  liveDraftSource,
  liveDraftContentType,
  activeContentType,
  explainDumbLevelByEntryId,
  explainDumbLoadingEntryId,
  explainDumbSurrenderedEntryIds,
  onExplainDumbDown,
  modelProfile,
  onSelectModelProfile,
  editorOpen,
  onToggleEditor,
  canToggleEditor,
  deskSlotRef = null
}) {
  if (!mounted) return null;

  return (
    <InsightsPane
      ceremonySlot={null}
      entries={entries}
      streakByVariant={streakByVariant}
      celebratingEntryId={celebratingEntryId}
      streamDebugEnabled={streamDebugEnabled}
      critiqueActionableUi={critiqueActionableUi}
      diagramUndoDisabled={diagramUndoDisabled}
      onRestoreToEntry={onRestoreToEntry}
      onRestoreDiagramSnapshot={onRestoreDiagramSnapshot}
      onOpenProposalFullPreview={onOpenProposalFullPreview}
      entryDiagramDiffById={entryDiagramDiffById}
      diagramChangeHighlightEntryId={diagramChangeHighlightEntryId}
      diagramChangeHighlightSummary={diagramChangeHighlightSummary}
      diagramChangeHighlightDisabled={diagramChangeHighlightDisabled}
      onToggleDiagramChangeHighlight={onToggleDiagramChangeHighlight}
      onStopStreamingAgent={onStopStreamingAgent}
      onRetryInsightEntry={onRetryInsightEntry}
      onRetryInsightEntryWithQuality={onRetryInsightEntryWithQuality}
      retryActionsDisabled={retryActionsDisabled}
      onDismiss={onDismiss}
      onAcceptProposal={onAcceptProposal}
      onRejectProposal={onRejectProposal}
      agentReactions={agentReactions}
      onApplyStyleEdits={onApplyStyleEdits}
      styleEditsApplyBusy={styleEditsApplyBusy}
      closing={closing}
      liveDraftSource={liveDraftSource}
      liveDraftContentType={liveDraftContentType}
      activeContentType={activeContentType}
      explainDumbLevelByEntryId={explainDumbLevelByEntryId}
      explainDumbLoadingEntryId={explainDumbLoadingEntryId}
      explainDumbSurrenderedEntryIds={explainDumbSurrenderedEntryIds}
      onExplainDumbDown={onExplainDumbDown}
      modelProfile={modelProfile}
      onSelectModelProfile={onSelectModelProfile}
      editorOpen={editorOpen}
      onToggleEditor={onToggleEditor}
      canToggleEditor={canToggleEditor}
      deskSlotRef={deskSlotRef}
    />
  );
}
