import { randomUUID } from 'node:crypto';

const HANDSHAKE_TTL_MS = 5 * 60 * 1000;

const AGENT_COLOR_PALETTE = [
  '#f97316',
  '#ec4899',
  '#22c55e',
  '#06b6d4',
  '#a855f7',
  '#eab308',
  '#ef4444',
  '#0ea5e9'
];

function pickColor(takenColors) {
  for (const color of AGENT_COLOR_PALETTE) {
    if (!takenColors.has(color)) return color;
  }
  // Fall back to a deterministic pseudo-random hex if the palette is exhausted.
  const hue = Math.floor(Math.random() * 360);
  return `#${hslToHex(hue, 70, 55)}`;
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const color = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `${f(0)}${f(8)}${f(4)}`;
}

export function createAgentHandshakeStore() {
  const pendingByRequestId = new Map();
  const approvedAgentsById = new Map();

  function pruneExpired() {
    const now = Date.now();
    for (const [requestId, entry] of pendingByRequestId) {
      if (entry.status === 'pending' && now - entry.createdAtMs > HANDSHAKE_TTL_MS) {
        entry.status = 'expired';
        entry.resolvers.forEach((resolve) => resolve({ status: 'expired' }));
        entry.resolvers = [];
      }
    }
  }

  function listConnectedColors() {
    const colors = new Set();
    for (const agent of approvedAgentsById.values()) {
      colors.add(agent.color);
    }
    return colors;
  }

  function createRequest({ sessionId, proposedName, proposedColor, proposedEmoji, clientInfo }) {
    pruneExpired();
    const requestId = randomUUID();
    const entry = {
      requestId,
      sessionId,
      proposedName,
      proposedColor: proposedColor ?? pickColor(listConnectedColors()),
      proposedEmoji,
      clientInfo,
      createdAt: new Date().toISOString(),
      createdAtMs: Date.now(),
      status: 'pending',
      resolvers: []
    };
    pendingByRequestId.set(requestId, entry);
    return {
      requestId: entry.requestId,
      sessionId: entry.sessionId,
      proposedName: entry.proposedName,
      proposedColor: entry.proposedColor,
      proposedEmoji: entry.proposedEmoji,
      clientInfo: entry.clientInfo,
      createdAt: entry.createdAt,
      status: entry.status
    };
  }

  function getRequest(requestId) {
    const entry = pendingByRequestId.get(requestId);
    if (!entry) return null;
    return {
      requestId: entry.requestId,
      sessionId: entry.sessionId,
      proposedName: entry.proposedName,
      proposedColor: entry.proposedColor,
      proposedEmoji: entry.proposedEmoji,
      clientInfo: entry.clientInfo,
      createdAt: entry.createdAt,
      status: entry.status
    };
  }

  function listPendingRequests() {
    pruneExpired();
    const out = [];
    for (const entry of pendingByRequestId.values()) {
      if (entry.status === 'pending') {
        out.push({
          requestId: entry.requestId,
          sessionId: entry.sessionId,
          proposedName: entry.proposedName,
          proposedColor: entry.proposedColor,
          proposedEmoji: entry.proposedEmoji,
          clientInfo: entry.clientInfo,
          createdAt: entry.createdAt,
          status: entry.status
        });
      }
    }
    return out;
  }

  function approveRequest(requestId) {
    const entry = pendingByRequestId.get(requestId);
    if (!entry || entry.status !== 'pending') return null;
    const agentId = randomUUID();
    const agent = {
      agentId,
      agentName: entry.proposedName,
      color: entry.proposedColor,
      emoji: entry.proposedEmoji
    };
    approvedAgentsById.set(agentId, agent);
    entry.status = 'approved';
    entry.agentId = agentId;
    entry.resolvers.forEach((resolve) => resolve({ status: 'approved', agent }));
    entry.resolvers = [];
    return agent;
  }

  function denyRequest(requestId) {
    const entry = pendingByRequestId.get(requestId);
    if (!entry || entry.status !== 'pending') return false;
    entry.status = 'denied';
    entry.resolvers.forEach((resolve) => resolve({ status: 'denied' }));
    entry.resolvers = [];
    return true;
  }

  function waitForResolution(requestId, { timeoutMs = 60000 } = {}) {
    return new Promise((resolve) => {
      const entry = pendingByRequestId.get(requestId);
      if (!entry) return resolve({ status: 'expired' });
      if (entry.status === 'approved') {
        return resolve({ status: 'approved', agent: approvedAgentsById.get(entry.agentId) });
      }
      if (entry.status === 'denied') return resolve({ status: 'denied' });
      if (entry.status === 'expired') return resolve({ status: 'expired' });
      const timer = setTimeout(() => resolve({ status: 'pending' }), timeoutMs);
      entry.resolvers.push((result) => {
        clearTimeout(timer);
        resolve(result);
      });
    });
  }

  function getApprovedAgent(agentId) {
    return approvedAgentsById.get(agentId) ?? null;
  }

  function getApprovedAgentForRequest(requestId) {
    const entry = pendingByRequestId.get(requestId);
    if (!entry || entry.status !== 'approved' || !entry.agentId) return null;
    return approvedAgentsById.get(entry.agentId) ?? null;
  }

  function isApproved(agentId) {
    return approvedAgentsById.has(agentId);
  }

  return {
    createRequest,
    getRequest,
    listPendingRequests,
    approveRequest,
    denyRequest,
    waitForResolution,
    getApprovedAgent,
    getApprovedAgentForRequest,
    isApproved
  };
}

export { AGENT_COLOR_PALETTE };
