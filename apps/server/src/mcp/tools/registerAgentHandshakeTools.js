import { z } from 'zod';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { jsonResult, requireRegisteredAgent } from '../mcpHelpers.js';
import { MCP_APP_URI_WEB_COMPANION, UI_META } from '../registerMcpApps.js';

function ensureAgentToken(entry, agentTokenStore) {
  let agentToken = entry.agentToken;
  if (!agentToken && agentTokenStore) {
    agentToken = agentTokenStore.issue({
      sessionId: entry.appSessionId,
      agentId: entry.agentId,
      mcpSessionId: entry.mcpSessionId
    });
    entry.agentToken = agentToken;
  }
  return agentToken;
}

function buildSessionEventsPayload(entry, publicBaseUrl, agentTokenStore) {
  const base = publicBaseUrl();
  const agentToken = ensureAgentToken(entry, agentTokenStore);
  const sessionEventsUrl = `${base}/api/copilotkit/session-events?sessionId=${encodeURIComponent(entry.appSessionId)}&agentId=${encodeURIComponent(entry.agentId)}`;
  return {
    status: 'ok',
    sessionEventsUrl,
    agentToken,
    headers: {
      'x-agent-token': agentToken,
      'Last-Event-ID': 'Replay: send Last-Event-ID header or sinceSeq query on reconnect'
    },
    hint: 'Open an SSE client against sessionEventsUrl with header x-agent-token. Use wait_for_session_event if your host cannot run SSE.'
  };
}

async function resumeAgentIfToken(ctx, entry, services, agentSessionToken) {
  const { agentTokenStore, finalizeApprovedAgent } = ctx;
  if (!agentSessionToken || !agentTokenStore) return null;
  const resumed = agentTokenStore.verify(agentSessionToken);
  if (!resumed || resumed.sessionId !== entry.appSessionId) return null;
  const agent = services.handshakeStore.getApprovedAgent(resumed.agentId);
  if (!agent) return null;
  const finalized = finalizeApprovedAgent(entry, services, agent);
  return jsonResult({ status: 'approved', resumed: true, ...finalized });
}

function alreadyRegisteredPayload(entry) {
  return jsonResult({
    status: 'already_registered',
    agentId: entry.agentId,
    agentName: entry.agentName,
    color: entry.color,
    emoji: entry.emoji,
    agentToken: entry.agentToken ?? null
  });
}

function ensureHandshakeRequest(entry, services, { name, emoji, color }) {
  let requestId = entry.pendingHandshakeRequestId;
  if (requestId) return requestId;
  const created = services.handshakeStore.createRequest({
    sessionId: entry.appSessionId,
    proposedName: name,
    proposedColor: color,
    proposedEmoji: emoji,
    clientInfo: entry.clientInfo
  });
  requestId = created.requestId;
  entry.pendingHandshakeRequestId = requestId;
  services.eventBus.publish(entry.appSessionId, {
    type: 'handshake_request',
    payload: created
  });
  return requestId;
}

function pendingRegisterPayload(services, requestId, entry, { name, emoji, color }) {
  const pending = services.handshakeStore.getRequest(requestId);
  return jsonResult({
    status: 'pending',
    requestId,
    proposedName: pending?.proposedName ?? name,
    proposedEmoji: pending?.proposedEmoji ?? emoji,
    proposedColor: pending?.proposedColor ?? color,
    clientInfo: pending?.clientInfo ?? entry.clientInfo,
    message: 'Awaiting human approval. Poll get_handshake_status or subscribe to session events.'
  });
}

async function blockingRegisterPayload(ctx, entry, services, requestId, proposal) {
  const { finalizeApprovedAgent } = ctx;
  const resolution = await services.handshakeStore.waitForResolution(requestId, {
    timeoutMs: 50000
  });
  if (resolution.status === 'approved') {
    const finalized = finalizeApprovedAgent(entry, services, resolution.agent);
    return jsonResult({ status: 'approved', ...finalized });
  }
  if (resolution.status === 'denied') {
    entry.pendingHandshakeRequestId = null;
    return jsonResult({ status: 'denied' });
  }
  if (resolution.status === 'expired') {
    entry.pendingHandshakeRequestId = null;
    return jsonResult({ status: 'expired' });
  }
  const pending = services.handshakeStore.getRequest(requestId);
  return jsonResult({
    status: 'awaiting_user_approval',
    requestId,
    proposedName: pending?.proposedName ?? proposal.name,
    proposedEmoji: pending?.proposedEmoji ?? proposal.emoji,
    proposedColor: pending?.proposedColor ?? proposal.color,
    clientInfo: pending?.clientInfo ?? entry.clientInfo
  });
}

async function handleRegisterAgent(ctx, { name, emoji, color, wait, agentSessionToken }) {
  const { sessionRegistry, requireBoundSession } = ctx;
  const bound = requireBoundSession();
  if (bound.error) return bound.error;
  const { entry } = bound;
  const services = sessionRegistry.getSessionServices(entry.appSessionId);

  const resumed = await resumeAgentIfToken(ctx, entry, services, agentSessionToken);
  if (resumed) return resumed;
  if (entry.agentId) return alreadyRegisteredPayload(entry);

  const requestId = ensureHandshakeRequest(entry, services, { name, emoji, color });
  if (!wait) return pendingRegisterPayload(services, requestId, entry, { name, emoji, color });
  return blockingRegisterPayload(ctx, entry, services, requestId, { name, emoji, color });
}

function jsonForHandshakeRequest(ctx, entry, services, requestId, request) {
  const { finalizeApprovedAgent } = ctx;
  if (request.status === 'approved') {
    const agent =
      services.handshakeStore.getApprovedAgentForRequest(requestId) ??
      (entry.agentId ? services.handshakeStore.getApprovedAgent(entry.agentId) : null);
    if (agent && !entry.agentId) {
      const finalized = finalizeApprovedAgent(entry, services, agent);
      return jsonResult({ status: 'approved', requestId, ...finalized });
    }
    return jsonResult({
      status: 'approved',
      requestId,
      agentId: entry.agentId ?? agent?.agentId,
      agentToken: entry.agentToken ?? null
    });
  }
  if (request.status === 'denied') {
    entry.pendingHandshakeRequestId = null;
    return jsonResult({ status: 'denied', requestId });
  }
  if (request.status === 'expired') {
    entry.pendingHandshakeRequestId = null;
    return jsonResult({ status: 'expired', requestId });
  }
  return jsonResult({
    status: 'pending',
    requestId,
    proposedName: request.proposedName,
    proposedEmoji: request.proposedEmoji,
    proposedColor: request.proposedColor
  });
}

function registerRegisterAgentTool(server, ctx) {
  registerAppTool(
    server,
    'register_agent',
    {
      title: 'Register external agent',
      description:
        'Request to join the ArchiSlop session. The human approves via the MCP App UI or ArchiSlop web. By default returns immediately with status pending; pass wait:true to block up to ~50s for approval. Use get_handshake_status to poll.',
      inputSchema: {
        name: z.string().min(1).max(64),
        emoji: z.string().max(8).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        wait: z.boolean().optional(),
        agentSessionToken: z.string().min(1).optional()
      },
      ...UI_META(MCP_APP_URI_WEB_COMPANION)
    },
    (args) => handleRegisterAgent(ctx, args)
  );
}

function registerGetHandshakeStatusTool(server, ctx) {
  const { sessionRegistry, requireBoundSession } = ctx;
  server.registerTool(
    'get_handshake_status',
    {
      title: 'Handshake status',
      description:
        'Poll approval for a register_agent request. When approved, registers this MCP connection and returns agentToken for session-events.',
      inputSchema: {
        requestId: z.string().min(1)
      }
    },
    async ({ requestId }) => {
      const bound = requireBoundSession();
      if (bound.error) return bound.error;
      const { entry } = bound;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      const request = services.handshakeStore.getRequest(requestId);
      if (!request) {
        return jsonResult({ status: 'expired', requestId });
      }
      return jsonForHandshakeRequest(ctx, entry, services, requestId, request);
    }
  );
}

function registerSubscribeSessionEventsTool(server, ctx) {
  const { agentTokenStore, publicBaseUrl, requireBoundSession } = ctx;
  server.registerTool(
    'subscribe_session_events',
    {
      title: 'Subscribe to session events',
      description:
        'Returns an SSE URL and agentToken for real-time collaboration events (proposals, presence, insights). Requires an approved handshake.',
      inputSchema: {}
    },
    async () => {
      const bound = requireBoundSession();
      if (bound.error) return bound.error;
      const { entry } = bound;
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      return jsonResult(buildSessionEventsPayload(entry, publicBaseUrl, agentTokenStore));
    }
  );
}

function registerWaitForSessionEventTool(server, ctx) {
  const { sessionRegistry, agentTokenStore, requireBoundSession } = ctx;
  server.registerTool(
    'wait_for_session_event',
    {
      title: 'Wait for session event',
      description:
        'Long-poll for the next collaboration event after sinceSeq. Optional types filter (e.g. proposal_resolved, state_changed).',
      inputSchema: {
        sinceSeq: z.number().int().min(0).optional(),
        types: z.array(z.string().min(1)).optional(),
        timeoutMs: z.number().int().min(1000).max(120000).optional()
      }
    },
    async ({ sinceSeq = 0, types, timeoutMs = 50000 }) => {
      const bound = requireBoundSession();
      if (bound.error) return bound.error;
      const { entry } = bound;
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      const envelope = await services.eventBus.waitForEvent(entry.appSessionId, {
        sinceSeq,
        types,
        timeoutMs
      });
      if (!envelope) {
        return jsonResult({ status: 'timeout', sinceSeq });
      }
      return jsonResult({ status: 'ok', event: envelope });
    }
  );
}

/**
 * Agent registration, handshake polling, and session-event subscription tools.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {object} ctx
 */
export function registerAgentHandshakeTools(server, ctx) {
  registerRegisterAgentTool(server, ctx);
  registerGetHandshakeStatusTool(server, ctx);
  registerSubscribeSessionEventsTool(server, ctx);
  registerWaitForSessionEventTool(server, ctx);
}
