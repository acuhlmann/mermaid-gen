import type { Request } from 'express';
import { createDiagramAgentDispatcher } from '../agents/diagramAgentDispatcher.js';
import { createDiagramStateStore, type DiagramStateStore } from './diagramStateStore.js';
import { createAgentHandshakeStore } from './agentHandshakeStore.js';
import { createAgentPresenceStore } from './agentPresenceStore.js';
import { createAgentProposalStore } from './agentProposalStore.js';
import { createInsightStore } from './insightStore.js';
import { createSessionEventBus, type SessionEventBus } from './sessionEventBus.js';

export const SESSION_HEADER = 'x-session-id';
const SESSION_QUERY_KEYS = ['sessionId', 'threadId'] as const;
export const DEFAULT_SESSION_ID = 'default';
const MAX_SESSION_ID_LENGTH = 128;
const SESSION_ID_ALLOWED_CHARS = /[^a-zA-Z0-9._-]/g;

export function sanitizeSessionId(value: unknown): string | null {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate) return null;
  const normalized = candidate
    .replace(SESSION_ID_ALLOWED_CHARS, '-')
    .slice(0, MAX_SESSION_ID_LENGTH);
  return normalized || null;
}

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
  get?: (name: string) => string | undefined;
};

export function resolveSessionIdFromRequest(requestLike: RequestLike | Request): string {
  const headerRaw =
    requestLike?.headers?.[SESSION_HEADER] ??
    (typeof requestLike?.get === 'function' ? requestLike.get(SESSION_HEADER) : undefined);
  const headerId = sanitizeSessionId(Array.isArray(headerRaw) ? headerRaw[0] : headerRaw);
  if (headerId) return headerId;

  for (const key of SESSION_QUERY_KEYS) {
    const queryId = sanitizeSessionId(requestLike?.query?.[key]);
    if (queryId) return queryId;
  }

  return DEFAULT_SESSION_ID;
}

export function resolveSessionIdFromCopilotInput(input: { threadId?: unknown } = {}): string {
  const threadId = sanitizeSessionId(input.threadId);
  if (threadId) return threadId;
  return DEFAULT_SESSION_ID;
}

export type SessionServices = {
  sessionId: string;
  stateStore: DiagramStateStore;
  agentService: ReturnType<typeof createDiagramAgentDispatcher>;
  handshakeStore: ReturnType<typeof createAgentHandshakeStore>;
  presenceStore: ReturnType<typeof createAgentPresenceStore>;
  proposalStore: ReturnType<typeof createAgentProposalStore>;
  insightStore: ReturnType<typeof createInsightStore>;
  eventBus: SessionEventBus;
};

export type SessionServicesRegistry = ReturnType<typeof createSessionServicesRegistry>;

export function createSessionServicesRegistry({
  env = process.env
}: { env?: NodeJS.ProcessEnv } = {}) {
  const sessions = new Map<string, SessionServices>();
  const eventBus = createSessionEventBus();

  function getSessionServices(sessionId: unknown): SessionServices {
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

    return sessions.get(resolvedSessionId)!;
  }

  function hasSession(sessionId: unknown): boolean {
    const resolvedSessionId = sanitizeSessionId(sessionId);
    if (!resolvedSessionId) return false;
    return sessions.has(resolvedSessionId);
  }

  return {
    getSessionServices,
    hasSession,
    eventBus,
    getSessionServicesForRequest(req: RequestLike | Request) {
      return getSessionServices(resolveSessionIdFromRequest(req));
    },
    getSessionServicesForCopilotInput(input: { threadId?: unknown }) {
      return getSessionServices(resolveSessionIdFromCopilotInput(input));
    }
  };
}
