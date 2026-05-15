import { buildDiagramDiffSummary, buildWebCanvasUrl } from './diagramDiffSummary.js';

/**
 * Build proposal-review MCP App payload (same shape as propose_diagram_edit success).
 * @param {{ stateStore: import('../state/diagramStateStore.js').ReturnType<typeof import('../state/diagramStateStore.js').createDiagramStateStore>, proposalStore: import('../state/agentProposalStore.js').ReturnType<typeof import('../state/agentProposalStore.js').createAgentProposalStore> }} services
 * @param {string} sessionId
 * @param {string} proposalId
 */
export function buildProposalReviewPayload(services, sessionId, proposalId) {
  const proposal = services.proposalStore.get(proposalId);
  if (!proposal) return null;

  const slot = services.stateStore.getSlot(proposal.contentType);
  const currentDiagramSource = slot.diagramSource ?? '';
  const proposedSource = proposal.diagramSource ?? '';
  const diffSummary = buildDiagramDiffSummary(currentDiagramSource, proposedSource, {
    contentType: proposal.contentType
  });

  return {
    ...proposal,
    sessionId,
    currentDiagramSource,
    diffSummary,
    graphDiff: diffSummary.graphDiff ?? proposal.metadata?.graphDiff,
    webCanvasUrl: buildWebCanvasUrl(sessionId)
  };
}
