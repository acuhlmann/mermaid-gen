import { createLazyMermaidAgentService } from '../agents/mermaidLangChainAgent.js';
import { createDiagramStateStore } from './diagramStateStore.js';

const SESSION_HEADER = 'x-session-id';
const SESSION_QUERY_KEYS = ['sessionId', 'threadId'];
const DEFAULT_SESSION_ID = 'default';
const MAX_SESSION_ID_LENGTH = 128;

function sanitizeSessionId(value) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate) return null;
  if (candidate.length > MAX_SESSION_ID_LENGTH) {
    return candidate.slice(0, MAX_SESSION_ID_LENGTH);
  }
  return candidate;
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

  function getSessionServices(sessionId) {
    const resolvedSessionId = sanitizeSessionId(sessionId) ?? DEFAULT_SESSION_ID;
    if (!sessions.has(resolvedSessionId)) {
      const stateStore = createDiagramStateStore();
      const agentService = createLazyMermaidAgentService({ stateStore, env });
      sessions.set(resolvedSessionId, {
        sessionId: resolvedSessionId,
        stateStore,
        agentService
      });
    }

    return sessions.get(resolvedSessionId);
  }

  return {
    getSessionServices,
    getSessionServicesForRequest(req) {
      return getSessionServices(resolveSessionIdFromRequest(req));
    },
    getSessionServicesForCopilotInput(input) {
      return getSessionServices(resolveSessionIdFromCopilotInput(input));
    }
  };
}

export { DEFAULT_SESSION_ID, SESSION_HEADER };
