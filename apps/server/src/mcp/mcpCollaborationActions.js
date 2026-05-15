import { buildWebCanvasUrl } from './diagramDiffSummary.js';
import { buildProposalReviewPayload } from './mcpProposalReviewPayload.js';

/**
 * Shared accept/reject/approve/deny logic for external-agent collaboration.
 * Used by REST routes and MCP tools (including MCP Apps iframe actions).
 */

export async function acceptProposal({ sessionId, proposalStore, stateStore, eventBus, proposalId }) {
  const proposal = proposalStore.get(proposalId);
  if (!proposal) return { ok: false, status: 404, body: { error: 'Proposal not found.' } };
  if (proposal.status !== 'pending') {
    return { ok: false, status: 409, body: { error: `Proposal already ${proposal.status}.` } };
  }
  const slot = stateStore.getSlot(proposal.contentType);
  if (proposal.baseRevisionId !== slot.revisionId) {
    proposalStore.markStale(proposal.proposalId);
    eventBus.publish(sessionId, {
      type: 'proposal_resolved',
      payload: { proposalId: proposal.proposalId, status: 'stale' }
    });
    return { ok: false, status: 409, body: { error: 'Proposal is stale (diagram has advanced).' } };
  }
  const applied = await stateStore.applyDiagramSource({
    contentType: proposal.contentType,
    diagramSource: proposal.diagramSource,
    reason: proposal.reason,
    origin: proposal.origin
  });
  if (!applied.accepted) {
    return { ok: false, status: 422, body: { error: applied.error } };
  }
  proposalStore.markAccepted(proposal.proposalId);
  eventBus.publish(sessionId, {
    type: 'proposal_resolved',
    payload: { proposalId: proposal.proposalId, status: 'accepted', state: applied.state }
  });
  eventBus.publish(sessionId, {
    type: 'state_changed',
    payload: { contentType: proposal.contentType, state: applied.state, patch: applied.patch }
  });
  return {
    ok: true,
    status: 200,
    body: { status: 'accepted', state: applied.state, patch: applied.patch }
  };
}

export function rejectProposal({ sessionId, proposalStore, eventBus, proposalId }) {
  const proposal = proposalStore.get(proposalId);
  if (!proposal) return { ok: false, status: 404, body: { error: 'Proposal not found.' } };
  if (proposal.status !== 'pending') {
    return { ok: false, status: 409, body: { error: `Proposal already ${proposal.status}.` } };
  }
  proposalStore.markRejected(proposal.proposalId);
  eventBus.publish(sessionId, {
    type: 'proposal_resolved',
    payload: { proposalId: proposal.proposalId, status: 'rejected' }
  });
  return { ok: true, status: 200, body: { status: 'rejected' } };
}

export function approveHandshake({
  sessionId,
  handshakeStore,
  presenceStore,
  eventBus,
  requestId,
  agentTokenStore,
  mcpSessionId
}) {
  const agent = handshakeStore.approveRequest(requestId);
  if (!agent) return { ok: false, status: 404, body: { error: 'Unknown or already resolved handshake.' } };
  presenceStore.upsert({
    agentId: agent.agentId,
    agentName: agent.agentName,
    color: agent.color,
    emoji: agent.emoji,
    focus: null
  });
  eventBus.publish(sessionId, {
    type: 'handshake_resolved',
    payload: { requestId, status: 'approved', agent }
  });
  eventBus.publish(sessionId, {
    type: 'presence_update',
    payload: presenceStore.list()
  });
  let agentToken = null;
  if (agentTokenStore) {
    agentToken = agentTokenStore.issue({
      sessionId,
      agentId: agent.agentId,
      mcpSessionId: mcpSessionId ?? null
    });
    if (mcpSessionId) {
      agentTokenStore.bindMcpSession(sessionId, agent.agentId, mcpSessionId);
    }
  }
  return {
    ok: true,
    status: 200,
    body: { status: 'approved', agent, agentToken }
  };
}

export function denyHandshake({ sessionId, handshakeStore, eventBus, requestId }) {
  const ok = handshakeStore.denyRequest(requestId);
  if (!ok) return { ok: false, status: 404, body: { error: 'Unknown or already resolved handshake.' } };
  eventBus.publish(sessionId, {
    type: 'handshake_resolved',
    payload: { requestId, status: 'denied' }
  });
  return { ok: true, status: 200, body: { status: 'denied' } };
}

export function getSessionCollaborationSnapshot(
  { stateStore, presenceStore, proposalStore },
  sessionId
) {
  const mermaidRevision = stateStore.getSlot('mermaid').revisionId;
  const infographicRevision = stateStore.getSlot('infographic').revisionId;
  const services = { stateStore, proposalStore };
  const pending = proposalStore.listPending({
    currentRevisionByContentType: {
      mermaid: mermaidRevision,
      infographic: infographicRevision
    }
  });
  const proposals = sessionId
    ? pending.map((p) => {
        const review = buildProposalReviewPayload(services, sessionId, p.proposalId);
        return {
          proposalId: p.proposalId,
          contentType: p.contentType,
          reason: p.reason,
          status: p.status,
          origin: p.origin,
          baseRevisionId: p.baseRevisionId,
          diffSummary: review?.diffSummary,
          webCanvasUrl: review?.webCanvasUrl
        };
      })
    : pending;
  return {
    activeContentType: stateStore.getSessionState().activeContentType,
    revisions: { mermaid: mermaidRevision, infographic: infographicRevision },
    presence: presenceStore.list(),
    proposals,
    webCanvasUrl: sessionId ? buildWebCanvasUrl(sessionId) : undefined
  };
}
