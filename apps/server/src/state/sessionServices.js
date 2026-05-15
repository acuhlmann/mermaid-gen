import { createDiagramAgentDispatcher } from '../agents/diagramAgentDispatcher.js';
import { createDiagramStateStore } from './diagramStateStore.js';
import { createAgentHandshakeStore } from './agentHandshakeStore.js';
import { createAgentPresenceStore } from './agentPresenceStore.js';
import { createAgentProposalStore } from './agentProposalStore.js';
import { createInsightStore } from './insightStore.js';
import { createSessionEventBus } from './sessionEventBus.js';

const SESSION_HEADER = 'x-session-id';
const SESSION_QUERY_KEYS = ['sessionId', 'threadId'];
const DEFAULT_SESSION_ID = 'default';
const MAX_SESSION_ID_LENGTH = 128;
const SESSION_ID_ALLOWED_CHARS = /[^a-zA-Z0-9._-]/g;

function sanitizeSessionId(value) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate) return null;
  const normalized = candidate.replace(SESSION_ID_ALLOWED_CHARS, '-').slice(0, MAX_SESSION_ID_LENGTH);
  return normalized || null;
}

export function resolveSessionIdFromRequest(requestLike) {
  const headerId = sanitizeSessionId(requestLike?.headers?.[SESSION_HEADER] ?? requestLike?.get?.(SESSION_HEADER));
  if (headerId) return headerId;

  for (const key of SESSION_QUERY_KEYS) {
    const queryId = sanitizeSessionId(requestLike?.query?.[key]);
    if (queryId) return queryId;
  }

  return DEFAULT_SESSION_ID;
}

export function resolveSessionIdFromCopilotInput(input = {}) {
  const threadId = sanitizeSessionId(input.threadId);
  if (threadId) return threadId;
  return DEFAULT_SESSION_ID;
}

export function createSessionServicesRegistry({ env = process.env } = {}) {
  const sessions = new Map();
  const eventBus = createSessionEventBus();

  function getSessionServices(sessionId) {
    const resolvedSessionId = sanitizeSessionId(sessionId) ?? DEFAULT_SESSION_ID;
    if (!sessions.has(resolvedSessionId)) {
      const stateStore = createDiagramStateStore();
      const agentService = createDiagramAgentDispatcher({ stateStore, env });
      const handshakeStore = createAgentHandshakeStore();
      const presenceStore = createAgentPresenceStore();
      const proposalStore = createAgentProposalStore();
      const insightStore = createInsightStore();
      sessions.set(resolvedSessionId, {
        sessionId: resolvedSessionId,
        stateStore,
        agentService,
        handshakeStore,
        presenceStore,
        proposalStore,
        insightStore,
        eventBus
      });
    }

    return sessions.get(resolvedSessionId);
  }

  function hasSession(sessionId) {
    const resolvedSessionId = sanitizeSessionId(sessionId);
    if (!resolvedSessionId) return false;
    return sessions.has(resolvedSessionId);
  }

  return {
    getSessionServices,
    hasSession,
    eventBus,
    getSessionServicesForRequest(req) {
      return getSessionServices(resolveSessionIdFromRequest(req));
    },
    getSessionServicesForCopilotInput(input) {
      return getSessionServices(resolveSessionIdFromCopilotInput(input));
    }
  };
}

export { DEFAULT_SESSION_ID, SESSION_HEADER, sanitizeSessionId };
