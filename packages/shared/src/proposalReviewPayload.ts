import { buildDiagramDiffSummary } from './diagramDiffSummary.js';
import { normalizeContentType } from './diagramSchema.js';

export type ProposalReviewInput = {
  proposal: Record<string, unknown>;
  currentDiagramSource: string;
  sessionId: string;
  webCanvasUrl?: string;
};

/**
 * Enrich a pending proposal with diff + canvas context (web Insights + MCP proposal-review App).
 */
export function enrichProposalForReview({
  proposal,
  currentDiagramSource,
  sessionId,
  webCanvasUrl
}: ProposalReviewInput): Record<string, unknown> {
  const contentType = normalizeContentType(proposal.contentType);
  const proposedSource =
    typeof proposal.diagramSource === 'string' ? proposal.diagramSource : '';
  const current = currentDiagramSource ?? '';
  const diffSummary = buildDiagramDiffSummary(current, proposedSource, { contentType });
  const meta = proposal.metadata as Record<string, unknown> | undefined;

  return {
    ...proposal,
    sessionId,
    currentDiagramSource: current,
    diffSummary,
    graphDiff: diffSummary.graphDiff ?? meta?.graphDiff,
    ...(webCanvasUrl ? { webCanvasUrl } : {})
  };
}
