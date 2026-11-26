import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { sanitizeSessionId } from '../state/sessionServices.js';
import { resolvePublicBaseUrl } from '../utils/publicBaseUrl.js';
import { verifyInviteToken } from '../utils/inviteToken.js';
import { safeError } from './mcpHelpers.js';
import { registerGetMcpBinding } from './tools/registerGetMcpBinding.js';
import { registerGetSessionBootstrap } from './tools/registerGetSessionBootstrap.js';
import { registerOpenSessionPairing } from './tools/registerOpenSessionPairing.js';
import { registerHumanOnlyAppTools } from './tools/registerHumanOnlyAppTools.js';
import { registerAgentHandshakeTools } from './tools/registerAgentHandshakeTools.js';
import { registerDiagramSessionTools } from './tools/registerDiagramSessionTools.js';
import { registerMcpCollaborationInsightTools } from './tools/registerMcpCollaborationInsightTools.js';
import { registerMcpSessionNavigationTools } from './tools/registerMcpSessionNavigationTools.js';
import { registerMcpSessionResources } from './tools/registerMcpSessionResources.js';
import { registerJoinSession } from './tools/registerJoinSession.js';
import { registerMcpCollaborationGuidePrompt } from './tools/registerMcpCollaborationGuidePrompt.js';
import { registerMcpApps } from './registerMcpApps.js';

import { createMcpSessionRegistry } from './mcpSessionRegistry.js';

function buildMcpServer({
  mcpRegistry,
  sessionRegistry,
  pairingCodeStore,
  agentTokenStore,
  mcpRateLimiter,
  mcpSessionIdRef,
  getPublicBaseUrl
}) {
  const publicBaseUrl = () =>
    typeof getPublicBaseUrl === 'function' ? getPublicBaseUrl() : resolvePublicBaseUrl(null);

  function recordPairingFailure(entry) {
    if (!mcpRateLimiter || !entry?.clientIp) return;
    mcpRateLimiter.recordFailure({ headers: {}, socket: { remoteAddress: entry.clientIp } });
  }

  function finalizeApprovedAgent(entry, services, agent) {
    let agentToken = null;
    if (agentTokenStore) {
      agentToken = agentTokenStore.issue({
        sessionId: entry.appSessionId,
        agentId: agent.agentId,
        mcpSessionId: entry.mcpSessionId
      });
    }
    mcpRegistry.setAgent(entry.mcpSessionId, agent, { agentToken });
    services.presenceStore.upsert({
      agentId: agent.agentId,
      agentName: agent.agentName,
      color: agent.color,
      emoji: agent.emoji,
      focus: null
    });
    services.eventBus.publish(entry.appSessionId, {
      type: 'presence_update',
      payload: services.presenceStore.list()
    });
    return { ...agent, agentToken };
  }
  const server = new McpServer(
    { name: 'archislop-collab', version: '0.2.0' },
    { capabilities: { resources: {}, tools: {}, prompts: {} } }
  );

  registerMcpApps(server, { getPublicBaseUrl: publicBaseUrl });

  // -------------------- Tools --------------------

  function currentEntry() {
    const id = mcpSessionIdRef.current;
    return id ? mcpRegistry.get(id) : null;
  }

  function assertResourceSessionAccess(requestedSessionId) {
    const entry = currentEntry();
    const bound = entry?.appSessionId ? sanitizeSessionId(entry.appSessionId) : null;
    const requested = sanitizeSessionId(requestedSessionId);
    if (!bound || !requested || bound !== requested) {
      throw new Error(
        'Resource access denied. Join this room with a pairing code or invite token before reading session resources.'
      );
    }
  }

  function currentServices() {
    const entry = currentEntry();
    if (!entry?.appSessionId) return null;
    return sessionRegistry.getSessionServices(entry.appSessionId);
  }

  function requireBoundSession() {
    const entry = currentEntry();
    if (!entry) {
      return {
        error: safeError(
          'No MCP transport session. Reconnect to /mcp and call join_session or use ?pairing= / ?token=.'
        )
      };
    }
    if (!entry.appSessionId) {
      return {
        error: safeError(
          'No ArchiSlop room bound. Call open_session_pairing or join_session (MCP App UI), pass pairingCode from Invite agent, or reconnect with ?pairing=<code>.'
        )
      };
    }
    return { entry };
  }

  function requireSessionEntry() {
    const bound = requireBoundSession();
    if (bound.error) return bound;
    const { entry } = bound;
    return { entry, services: sessionRegistry.getSessionServices(entry.appSessionId) };
  }

  const resourceCtx = {
    sessionRegistry,
    pairingCodeStore,
    publicBaseUrl,
    currentEntry,
    assertResourceSessionAccess
  };
  registerMcpSessionResources(server, resourceCtx);

  const toolCtx = {
    mcpRegistry,
    sessionRegistry,
    pairingCodeStore,
    agentTokenStore,
    mcpRateLimiter,
    mcpSessionIdRef,
    publicBaseUrl,
    currentEntry,
    currentServices,
    assertResourceSessionAccess,
    recordPairingFailure,
    finalizeApprovedAgent,
    requireBoundSession,
    requireSessionEntry
  };
  registerGetMcpBinding(server, toolCtx);
  registerGetSessionBootstrap(server, toolCtx);

  registerJoinSession(server, toolCtx);
  registerOpenSessionPairing(server, toolCtx);
  registerAgentHandshakeTools(server, toolCtx);
  registerDiagramSessionTools(server, toolCtx);
  registerMcpSessionNavigationTools(server, toolCtx);

  registerHumanOnlyAppTools(server);

  registerMcpCollaborationInsightTools(server, toolCtx);

  registerMcpCollaborationGuidePrompt(server);

  return server;
}

/**
 * Express handler that terminates the MCP Streamable HTTP transport at /mcp.
 *
 * Maintains one McpServer + Transport per MCP transport-session. The ArchiSlop
 * application session id may be set on `initialize` via ?pairing= or ?token=, or later
 * via the join_session tool (stable /mcp URL without query params).
 */
export function createMcpHandler({
  sessionRegistry,
  pairingCodeStore,
  agentTokenStore,
  mcpRateLimiter
}) {
  const mcpRegistry = createMcpSessionRegistry();
  const transportsByMcpSessionId = new Map();
  const serversByMcpSessionId = new Map();
  const getPublicBaseUrl = () => resolvePublicBaseUrl(null);

  async function handle(req, res) {
    if (mcpRateLimiter?.isLimited(req)) {
      res.status(429).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Too many failed pairing attempts. Try again later.' },
        id: null
      });
      return;
    }

    const headerSessionId = req.headers['mcp-session-id'];
    const mcpSessionId = Array.isArray(headerSessionId) ? headerSessionId[0] : headerSessionId;

    // Initialize requests are POSTs without an mcp-session-id header.
    if (req.method === 'POST' && !mcpSessionId && isInitializeRequest(req.body)) {
      const queryAppSessionId = await resolveAppSessionIdForMcpInitialize(req, pairingCodeStore, {
        mcpRateLimiter
      });
      const clientInfo = readClientInfo(req);
      const clientIp = mcpRateLimiter?.clientKey(req) ?? null;

      // mutable ref so tool closures see the current mcpSessionId (it's not known yet here).
      const mcpSessionIdRef = { current: null };

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newMcpSessionId) => {
          mcpSessionIdRef.current = newMcpSessionId;
          transportsByMcpSessionId.set(newMcpSessionId, transport);
          mcpRegistry.bind(newMcpSessionId, {
            appSessionId: queryAppSessionId,
            clientInfo,
            clientIp
          });
          if (queryAppSessionId) mcpRateLimiter?.reset(req);
        }
      });

      transport.onclose = () => {
        const id = transport.sessionId;
        if (!id) return;
        // Clean up presence on disconnect so the UI stops showing a ghost agent.
        const entry = mcpRegistry.get(id);
        if (entry?.appSessionId && entry?.agentId) {
          const services = sessionRegistry.getSessionServices(entry.appSessionId);
          services.presenceStore.remove(entry.agentId);
          agentTokenStore?.clearBinding(entry.appSessionId, entry.agentId);
          services.eventBus.publish(entry.appSessionId, {
            type: 'presence_update',
            payload: services.presenceStore.list()
          });
        }
        transportsByMcpSessionId.delete(id);
        serversByMcpSessionId.delete(id);
        mcpRegistry.remove(id);
      };

      const server = buildMcpServer({
        mcpRegistry,
        sessionRegistry,
        pairingCodeStore,
        agentTokenStore,
        mcpRateLimiter,
        mcpSessionIdRef,
        getPublicBaseUrl
      });
      await server.connect(transport);
      serversByMcpSessionId.set(transport.sessionId ?? mcpSessionIdRef.current, server);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    if (!mcpSessionId || !transportsByMcpSessionId.has(mcpSessionId)) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'No active MCP session. Send initialize first.' },
        id: null
      });
      return;
    }
    const transport = transportsByMcpSessionId.get(mcpSessionId);
    await transport.handleRequest(req, res, req.body);
  }

  return (req, res, next) => {
    handle(req, res).catch(next);
  };
}

function readClientInfo(req) {
  const userAgent = req.headers['user-agent'];
  return typeof userAgent === 'string' ? userAgent.slice(0, 200) : undefined;
}

function isInitializeRequest(body) {
  if (!body) return false;
  if (Array.isArray(body)) return body.some((m) => m?.method === 'initialize');
  return body?.method === 'initialize';
}

/**
 * @param {import('express').Request} req
 * @param {ReturnType<import('../state/pairingCodeStore.js').createPairingCodeStore>} pairingCodeStore
 * @param {{ mcpRateLimiter?: ReturnType<import('./mcpRateLimit.js').createMcpRateLimiter> }} [options]
 * @returns {Promise<string | null>}
 */
async function resolveAppSessionIdForMcpInitialize(req, pairingCodeStore, { mcpRateLimiter } = {}) {
  const tokenQuery = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
  if (tokenQuery) {
    const verified = verifyInviteToken(tokenQuery);
    if (verified?.sessionId) {
      return sanitizeSessionId(verified.sessionId);
    }
    mcpRateLimiter?.recordFailure(req);
    return null;
  }

  const pairingQuery = typeof req.query?.pairing === 'string' ? req.query.pairing.trim() : '';
  if (pairingQuery) {
    const resolved = await Promise.resolve(
      pairingCodeStore.resolveDetailed(pairingQuery, { consumeUse: true })
    );
    if (resolved.ok) return resolved.sessionId;
    mcpRateLimiter?.recordFailure(req);
    return null;
  }
  return null;
}
