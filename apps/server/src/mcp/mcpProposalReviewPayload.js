import { enrichProposalForReview } from '@archislop/shared';
import { buildWebCanvasUrl } from './diagramDiffSummary.js';

/**
 * Build proposal-review MCP App payload (same shape as enriched web proposal cards).
 * @param {{ stateStore: import('../state/diagramStateStore.js').ReturnType<typeof import('../state/diagramStateStore.js').createDiagramStateStore>, proposalStore: import('../state/agentProposalStore.js').ReturnType<typeof import('../state/agentProposalStore.js').createAgentProposalStore> }} services
 * @param {string} sessionId
 * @param {string} proposalId
 */
export function buildProposalReviewPayload(services, sessionId, proposalId) {
  const proposal = services.proposalStore.get(proposalId);
  if (!proposal) return null;

  const slot = services.stateStore.getSlot(proposal.contentType);
  const currentDiagramSource = slot.diagramSource ?? '';

  return enrichProposalForReview({
    proposal,
    currentDiagramSource,
    sessionId,
    webCanvasUrl: buildWebCanvasUrl(sessionId)
  });
}
