import { randomUUID } from 'node:crypto';

/**
 * Holds external-agent diagram proposals awaiting user accept/reject.
 * Each proposal carries a `baseRevisionId` snapshot. When the diagram slot
 * advances past that revision, the proposal is treated as stale.
 */
export function createAgentProposalStore() {
  const byId = new Map();
  const waitersById = new Map();

  function create({
    sessionId,
    origin,
    contentType,
    baseRevisionId,
    diagramSource,
    reason,
    metadata
  }) {
    const proposalId = randomUUID();
    const proposal = {
      proposalId,
      sessionId,
      origin,
      contentType,
      baseRevisionId,
      diagramSource,
      reason,
      metadata,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };
    byId.set(proposalId, proposal);
    return { ...proposal };
  }

  function get(proposalId) {
    const p = byId.get(proposalId);
    return p ? { ...p } : null;
  }

  function listByAgent(agentId, { includeResolved = true, limit = 20 } = {}) {
    if (!agentId) return [];
    const out = [];
    for (const p of byId.values()) {
      if (p.origin?.agentId !== agentId) continue;
      if (!includeResolved && p.status !== 'pending') continue;
      out.push({ ...p });
    }
    out.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    return out.slice(0, limit);
  }

  function listPending({ contentType, currentRevisionByContentType } = {}) {
    const out = [];
    for (const p of byId.values()) {
      if (p.status !== 'pending') continue;
      if (contentType && p.contentType !== contentType) continue;
      const currentRevision = currentRevisionByContentType?.[p.contentType];
      if (typeof currentRevision === 'number' && currentRevision > p.baseRevisionId) {
        p.status = 'stale';
        resolveWaiters(p.proposalId, { status: 'stale' });
        continue;
      }
      out.push({ ...p });
    }
    return out;
  }

  function markAccepted(proposalId) {
    const p = byId.get(proposalId);
    if (!p || p.status !== 'pending') return null;
    p.status = 'accepted';
    p.resolvedAt = new Date().toISOString();
    resolveWaiters(proposalId, { status: 'accepted' });
    return { ...p };
  }

  function markRejected(proposalId) {
    const p = byId.get(proposalId);
    if (!p || p.status !== 'pending') return null;
    p.status = 'rejected';
    p.resolvedAt = new Date().toISOString();
    resolveWaiters(proposalId, { status: 'rejected' });
    return { ...p };
  }

  function requestChanges(proposalId, { comment }) {
    const p = byId.get(proposalId);
    if (!p || p.status !== 'pending') return null;
    p.changesRequested = {
      comment: String(comment ?? '').trim(),
      requestedAt: new Date().toISOString()
    };
    resolveWaiters(proposalId, {
      status: 'changes_requested',
      comment: p.changesRequested.comment
    });
    return { ...p };
  }

  function markStale(proposalId) {
    const p = byId.get(proposalId);
    if (!p || p.status !== 'pending') return null;
    p.status = 'stale';
    p.resolvedAt = new Date().toISOString();
    resolveWaiters(proposalId, { status: 'stale' });
    return { ...p };
  }

  function waitForResolution(proposalId, { timeoutMs = 60000 } = {}) {
    return new Promise((resolve) => {
      const p = byId.get(proposalId);
      if (!p) return resolve({ status: 'unknown' });
      if (p.status !== 'pending') return resolve({ status: p.status });
      let timer;
      const onResolved = (result) => {
        if (timer) clearTimeout(timer);
        resolve(result);
      };
      if (!waitersById.has(proposalId)) waitersById.set(proposalId, new Set());
      waitersById.get(proposalId).add(onResolved);
      timer = setTimeout(() => {
        const set = waitersById.get(proposalId);
        if (set) set.delete(onResolved);
        resolve({ status: 'timeout' });
      }, timeoutMs);
    });
  }

  function resolveWaiters(proposalId, result) {
    const set = waitersById.get(proposalId);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(result);
      } catch (err) {
        console.warn('agentProposalStore: proposal listener threw:', err?.message ?? err);
      }
    }
    waitersById.delete(proposalId);
  }

  return {
    create,
    get,
    listByAgent,
    listPending,
    markAccepted,
    markRejected,
    markStale,
    requestChanges,
    waitForResolution
  };
}
