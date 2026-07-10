import type { ContentType } from '@archislop/shared';
import { buildWebCanvasUrl } from './diagramDiffSummary.js';
import { buildProposalReviewPayload } from './mcpProposalReviewPayload.js';
import type { DiagramStateStore } from '../state/diagramStateStore.js';
import type { SessionEventBus } from '../state/sessionEventBus.js';

type ActionResult = {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
};

type ProposalRecord = {
  proposalId: string;
  status: string;
  contentType: ContentType;
  baseRevisionId: number;
  diagramSource: string;
  reason: string;
  origin?: unknown;
};

type ProposalStore = {
  get(proposalId: string): ProposalRecord | null;
  markStale(proposalId: string): void;
  markAccepted(proposalId: string): void;
  markRejected(proposalId: string): void;
  listPending(opts: {
    currentRevisionByContentType: Partial<Record<ContentType, number>>;
  }): ProposalRecord[];
};

type HandshakeStore = {
  approveRequest(requestId: string): {
    agentId: string;
    agentName: string;
    color: string;
    emoji: string;
  } | null;
  denyRequest(requestId: string): boolean;
};

type PresenceStore = {
  upsert(agent: {
    agentId: string;
    agentName: string;
    color: string;
    emoji: string;
    focus: null;
  }): void;
  list(): unknown[];
};

type AgentTokenStore = {
  issue?(opts: { sessionId: string; agentId: string; mcpSessionId: string | null }): string | null;
  bindMcpSession?(sessionId: string, agentId: string, mcpSessionId: string): void;
};

/**
 * Shared accept/reject/approve/deny logic for external-agent collaboration.
 * Used by REST routes and MCP tools (including MCP Apps iframe actions).
 */
export async function acceptProposal({
  sessionId,
  proposalStore,
  stateStore,
  eventBus,
  proposalId
}: {
  sessionId: string;
  proposalStore: ProposalStore;
  stateStore: DiagramStateStore;
  eventBus: SessionEventBus;
  proposalId: string;
}): Promise<ActionResult> {
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
    origin: proposal.origin as Parameters<DiagramStateStore['applyDiagramSource']>[0]['origin']
  });
  if (!applied.accepted || !('state' in applied) || !('patch' in applied)) {
    const message =
      'error' in applied && applied.error != null ? String(applied.error) : 'Patch rejected.';
    return { ok: false, status: 422, body: { error: message } };
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

export function rejectProposal({
  sessionId,
  proposalStore,
  eventBus,
  proposalId
}: {
  sessionId: string;
  proposalStore: ProposalStore;
  eventBus: SessionEventBus;
  proposalId: string;
}): ActionResult {
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
}: {
  sessionId: string;
  handshakeStore: HandshakeStore;
  presenceStore: PresenceStore;
  eventBus: SessionEventBus;
  requestId: string;
  agentTokenStore?: AgentTokenStore;
  mcpSessionId?: string | null;
}): ActionResult {
  const agent = handshakeStore.approveRequest(requestId);
  if (!agent)
    return { ok: false, status: 404, body: { error: 'Unknown or already resolved handshake.' } };
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
  let agentToken: string | null = null;
  if (agentTokenStore?.issue) {
    agentToken = agentTokenStore.issue({
      sessionId,
      agentId: agent.agentId,
      mcpSessionId: mcpSessionId ?? null
    });
    if (mcpSessionId && agentTokenStore.bindMcpSession) {
      agentTokenStore.bindMcpSession(sessionId, agent.agentId, mcpSessionId);
    }
  }
  return {
    ok: true,
    status: 200,
    body: { status: 'approved', agent, agentToken }
  };
}

export function denyHandshake({
  sessionId,
  handshakeStore,
  eventBus,
  requestId
}: {
  sessionId: string;
  handshakeStore: HandshakeStore;
  eventBus: SessionEventBus;
  requestId: string;
}): ActionResult {
  const ok = handshakeStore.denyRequest(requestId);
  if (!ok)
    return { ok: false, status: 404, body: { error: 'Unknown or already resolved handshake.' } };
  eventBus.publish(sessionId, {
    type: 'handshake_resolved',
    payload: { requestId, status: 'denied' }
  });
  return { ok: true, status: 200, body: { status: 'denied' } };
}

export function getSessionCollaborationSnapshot(
  {
    stateStore,
    presenceStore,
    proposalStore
  }: {
    stateStore: DiagramStateStore;
    presenceStore: PresenceStore;
    proposalStore: ProposalStore;
  },
  sessionId: string | undefined
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
