import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';

import { validateAndPreparePatch } from '../tools/mermaidDiffTool.js';
import { validateAndPrepareInfographicPatch } from '../tools/infographicDslTool.js';
import { validateAndPrepareMetaphorPatch } from '../tools/metaphorDslTool.js';
import { validateAndPrepareChartPatch } from '../tools/chartDslTool.js';
import { validateAndPrepareAnythingPatch } from '../tools/anythingHtmlTool.js';
import { getSessionCollaborationSnapshot } from './mcpCollaborationActions.js';
import { buildDiagramDiffSummary, buildWebCanvasUrl } from './diagramDiffSummary.js';
import { buildCanvasPreviewPayload } from './mcpCanvasPayload.js';
import { publishAttributedInsight } from './mcpInsightPublish.js';
import { buildProposalReviewPayload } from './mcpProposalReviewPayload.js';
import { sanitizeSessionId } from '../state/sessionServices.js';
import { resolvePublicBaseUrl } from '../utils/publicBaseUrl.js';
import { verifyInviteToken } from '../utils/inviteToken.js';
import { buildSessionBootstrap } from './mcpSessionBootstrap.js';
import {
  jsonResult,
  originFromMcpEntry,
  pairingFailureMessage,
  requireRegisteredAgent,
  safeError,
  textResult
} from './mcpHelpers.js';
import { buildMcpBindingSnapshot } from './mcpBindingSnapshot.js';
import { registerGetMcpBinding } from './tools/registerGetMcpBinding.js';
import { registerGetSessionBootstrap } from './tools/registerGetSessionBootstrap.js';
import { registerOpenSessionPairing } from './tools/registerOpenSessionPairing.js';
import { registerHumanOnlyAppTools } from './tools/registerHumanOnlyAppTools.js';
import {
  MCP_APP_URI_CANVAS_PREVIEW,
  MCP_APP_URI_COMPOSE_INSIGHT,
  MCP_APP_URI_CRITIQUE_MAP,
  MCP_APP_URI_FOCUS_PICKER,
  MCP_APP_URI_HANDSHAKE,
  MCP_APP_URI_INSIGHTS_FEED,
  MCP_APP_URI_PROPOSAL_INBOX,
  MCP_APP_URI_PROPOSAL_REVIEW,
  MCP_APP_URI_SESSION_DASHBOARD,
  MCP_APP_URI_SESSION_EVENTS,
  MCP_APP_URI_SESSION_PAIRING,
  MCP_APP_URI_WEB_COMPANION,
  MCP_APP_URI_WELCOME,
  registerMcpApps,
  UI_META
} from './registerMcpApps.js';

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

  // -------------------- Resources --------------------

  server.registerResource(
    'session',
    new ResourceTemplate('archislop://session/{sessionId}', { list: undefined }),
    { description: 'Full ArchiSlop session state (both mermaid and infographic slots).' },
    async (uri, { sessionId }) => {
      assertResourceSessionAccess(sessionId);
      const services = sessionRegistry.getSessionServices(sessionId);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(services.stateStore.getSessionState(), null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    'slot',
    new ResourceTemplate('archislop://session/{sessionId}/{contentType}', { list: undefined }),
    {
      description:
        'Diagram state for a specific slot (mermaid, infographic, metaphor3d, chart, or anything).'
    },
    async (uri, { sessionId, contentType }) => {
      assertResourceSessionAccess(sessionId);
      if (
        contentType !== 'mermaid' &&
        contentType !== 'infographic' &&
        contentType !== 'metaphor3d' &&
        contentType !== 'chart' &&
        contentType !== 'anything'
      ) {
        throw new Error(`Unknown contentType: ${contentType}`);
      }
      const services = sessionRegistry.getSessionServices(sessionId);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(services.stateStore.getSlot(contentType), null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    'presence',
    new ResourceTemplate('archislop://session/{sessionId}/presence', { list: undefined }),
    { description: 'External agents currently connected to the session.' },
    async (uri, { sessionId }) => {
      assertResourceSessionAccess(sessionId);
      const services = sessionRegistry.getSessionServices(sessionId);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(services.presenceStore.list(), null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    'bootstrap',
    new ResourceTemplate('archislop://session/{sessionId}/bootstrap', { list: undefined }),
    {
      description:
        'One-shot session bootstrap for external agents: binding, revisions, handshake status, checklist.'
    },
    async (uri, { sessionId }) => {
      assertResourceSessionAccess(sessionId);
      const services = sessionRegistry.getSessionServices(sessionId);
      const entry = currentEntry();
      const payload = buildSessionBootstrap({
        entry,
        services,
        pairingCodeStore,
        publicBaseUrl: publicBaseUrl()
      });
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2)
          }
        ]
      };
    }
  );

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

  async function executeJoinSession({ pairingCode }) {
    const entry = currentEntry();
    if (!entry) {
      return safeError('No MCP transport session. Connect to /mcp first, then call join_session.');
    }
    if (!pairingCode) {
      return jsonResult({
        status: 'needs_pairing_code',
        ...buildMcpBindingSnapshot(entry, pairingCodeStore),
        message:
          'Enter the pairing code in the session pairing MCP App, or pass pairingCode in tool arguments.'
      });
    }

    let appSessionId = null;
    const resolved = await Promise.resolve(
      pairingCodeStore.resolveDetailed(pairingCode, { consumeUse: false })
    );
    if (!resolved.ok) {
      recordPairingFailure(entry);
      return safeError(pairingFailureMessage(resolved, pairingCode));
    }
    appSessionId = resolved.sessionId;

    mcpRegistry.setAppSession(entry.mcpSessionId, appSessionId);
    const code = pairingCodeStore.getOrCreateCode(appSessionId);
    return jsonResult({
      status: 'joined',
      bound: true,
      sessionId: appSessionId,
      pairingCode: code,
      webCanvasUrl: buildWebCanvasUrl(appSessionId),
      agentRegistered: false,
      message: 'Room bound. Call register_agent next to request access.'
    });
  }

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
    requireSessionEntry,
    executeJoinSession
  };
  registerGetMcpBinding(server, toolCtx);
  registerGetSessionBootstrap(server, toolCtx);

  registerAppTool(
    server,
    'join_session',
    {
      title: 'Join ArchiSlop room',
      description:
        'Bind this MCP connection to an ArchiSlop session using the pairing code from Invite agent (stable /mcp URL). Opens the pairing MCP App when pairingCode is omitted. Pass pairingCode to join headlessly.',
      inputSchema: {
        pairingCode: z.string().min(4).max(16).optional()
      },
      ...UI_META(MCP_APP_URI_SESSION_PAIRING)
    },
    executeJoinSession
  );

  registerOpenSessionPairing(server, toolCtx);

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
    async ({ name, emoji, color, wait, agentSessionToken }) => {
      const bound = requireBoundSession();
      if (bound.error) return bound.error;
      const { entry } = bound;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);

      if (agentSessionToken && agentTokenStore) {
        const resumed = agentTokenStore.verify(agentSessionToken);
        if (resumed && resumed.sessionId === entry.appSessionId) {
          const agent = services.handshakeStore.getApprovedAgent(resumed.agentId);
          if (agent) {
            const finalized = finalizeApprovedAgent(entry, services, agent);
            return jsonResult({ status: 'approved', resumed: true, ...finalized });
          }
        }
      }

      if (entry.agentId) {
        return jsonResult({
          status: 'already_registered',
          agentId: entry.agentId,
          agentName: entry.agentName,
          color: entry.color,
          emoji: entry.emoji,
          agentToken: entry.agentToken ?? null
        });
      }

      let requestId = entry.pendingHandshakeRequestId;
      if (!requestId) {
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
      }

      if (!wait) {
        const pending = services.handshakeStore.getRequest(requestId);
        return jsonResult({
          status: 'pending',
          requestId,
          proposedName: pending?.proposedName ?? name,
          proposedEmoji: pending?.proposedEmoji ?? emoji,
          proposedColor: pending?.proposedColor ?? color,
          clientInfo: pending?.clientInfo ?? entry.clientInfo,
          message:
            'Awaiting human approval. Poll get_handshake_status or subscribe to session events.'
        });
      }

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
        proposedName: pending?.proposedName ?? name,
        proposedEmoji: pending?.proposedEmoji ?? emoji,
        proposedColor: pending?.proposedColor ?? color,
        clientInfo: pending?.clientInfo ?? entry.clientInfo
      });
    }
  );

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
  );

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
      const base = publicBaseUrl();
      let agentToken = entry.agentToken;
      if (!agentToken && agentTokenStore) {
        agentToken = agentTokenStore.issue({
          sessionId: entry.appSessionId,
          agentId: entry.agentId,
          mcpSessionId: entry.mcpSessionId
        });
        entry.agentToken = agentToken;
      }
      const sessionEventsUrl = `${base}/api/copilotkit/session-events?sessionId=${encodeURIComponent(entry.appSessionId)}&agentId=${encodeURIComponent(entry.agentId)}`;
      return jsonResult({
        status: 'ok',
        sessionEventsUrl,
        agentToken,
        headers: {
          'x-agent-token': agentToken,
          'Last-Event-ID': 'Replay: send Last-Event-ID header or sinceSeq query on reconnect'
        },
        hint: 'Open an SSE client against sessionEventsUrl with header x-agent-token. Use wait_for_session_event if your host cannot run SSE.'
      });
    }
  );

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

  registerAppTool(
    server,
    'open_session_events',
    {
      title: 'Open session events feed',
      description:
        'Opens the session-events MCP App: live SSE feed (with long-poll fallback) for proposals, presence, insights, and pairing rotation.',
      inputSchema: {},
      ...UI_META(MCP_APP_URI_SESSION_EVENTS)
    },
    async () => {
      const bound = requireBoundSession();
      if (bound.error) return bound.error;
      const { entry } = bound;
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const base = publicBaseUrl();
      let agentToken = entry.agentToken;
      if (!agentToken && agentTokenStore) {
        agentToken = agentTokenStore.issue({
          sessionId: entry.appSessionId,
          agentId: entry.agentId,
          mcpSessionId: entry.mcpSessionId
        });
        entry.agentToken = agentToken;
      }
      const sessionEventsUrl = `${base}/api/copilotkit/session-events?sessionId=${encodeURIComponent(entry.appSessionId)}&agentId=${encodeURIComponent(entry.agentId)}`;
      return jsonResult({
        status: 'ok',
        sessionEventsUrl,
        agentToken,
        webCanvasUrl: buildWebCanvasUrl(entry.appSessionId)
      });
    }
  );

  registerAppTool(
    server,
    'open_welcome',
    {
      title: 'Open welcome / onboarding',
      description:
        'Opens the welcome MCP App with join checklist, revision ids, and shortcuts to canvas, events, and collaboration tools.',
      inputSchema: {},
      ...UI_META(MCP_APP_URI_WELCOME)
    },
    async () => {
      const bound = requireBoundSession();
      if (bound.error) return bound.error;
      const { entry } = bound;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      return jsonResult(
        buildSessionBootstrap({
          entry,
          services,
          pairingCodeStore,
          publicBaseUrl: publicBaseUrl()
        })
      );
    }
  );

  registerAppTool(
    server,
    'open_compose_insight',
    {
      title: 'Compose an insight',
      description:
        'Opens the compose-insight MCP App to post a note, suggestion, or critique to the Thinking pane.',
      inputSchema: {},
      ...UI_META(MCP_APP_URI_COMPOSE_INSIGHT)
    },
    async () => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      return jsonResult({ webCanvasUrl: buildWebCanvasUrl(entry.appSessionId) });
    }
  );

  registerAppTool(
    server,
    'open_focus_picker',
    {
      title: 'Open focus picker',
      description:
        'Opens the focus-picker MCP App: pick a diagram node to highlight on the shared canvas for humans and other agents.',
      inputSchema: {
        contentType: z
          .enum(['mermaid', 'infographic', 'metaphor3d', 'chart', 'anything'])
          .optional()
      },
      ...UI_META(MCP_APP_URI_FOCUS_PICKER)
    },
    async ({ contentType }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      const slot = contentType ?? services.stateStore.getSessionState().activeContentType;
      return jsonResult({
        contentType: slot,
        ...services.stateStore.getSlot(slot),
        webCanvasUrl: buildWebCanvasUrl(entry.appSessionId)
      });
    }
  );

  server.registerTool(
    'get_session_state',
    {
      title: 'Read current diagram state',
      description:
        'Returns the current state of a slot (mermaid, infographic, metaphor3d, or chart). Use this before proposing edits so you can pass the right baseRevisionId.',
      inputSchema: {
        contentType: z
          .enum(['mermaid', 'infographic', 'metaphor3d', 'chart', 'anything'])
          .optional()
      }
    },
    async ({ contentType }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      const sessionId = entry.appSessionId;
      const webCanvasUrl = buildWebCanvasUrl(sessionId);
      if (contentType) {
        return jsonResult({
          ...services.stateStore.getSlot(contentType),
          contentType,
          sessionId,
          webCanvasUrl
        });
      }
      return jsonResult({
        ...services.stateStore.getSessionState(),
        ...buildCanvasPreviewPayload(services, sessionId),
        sessionId,
        webCanvasUrl
      });
    }
  );

  registerAppTool(
    server,
    'open_diagram_canvas',
    {
      title: 'Preview session diagram',
      description:
        'Opens the canvas-preview MCP App: live Mermaid render (or infographic DSL) for the current session, plus a link to open the full editor in ArchiSlop web.',
      inputSchema: {
        contentType: z
          .enum(['mermaid', 'infographic', 'metaphor3d', 'chart', 'anything'])
          .optional()
      },
      ...UI_META(MCP_APP_URI_CANVAS_PREVIEW)
    },
    async ({ contentType }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      return jsonResult(buildCanvasPreviewPayload(services, entry.appSessionId, contentType));
    }
  );

  registerAppTool(
    server,
    'propose_diagram_edit',
    {
      title: 'Propose a diagram edit',
      description:
        'Submit a complete replacement of the diagram source as a proposal. Opens the web-companion MCP App (read-only in Cursor; approve in ArchiSlop web). Also appears in InsightsPane. Returns proposalId; poll with `wait_for_resolution`.',
      inputSchema: {
        contentType: z.enum(['mermaid', 'infographic', 'metaphor3d', 'chart', 'anything']),
        diagramSource: z.string().min(1).max(200000),
        reason: z.string().min(1).max(2000),
        baseRevisionId: z.number().int().nonnegative()
      },
      ...UI_META(MCP_APP_URI_WEB_COMPANION)
    },
    async ({ contentType, diagramSource, reason, baseRevisionId }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      const slot = services.stateStore.getSlot(contentType);
      if (baseRevisionId !== slot.revisionId) {
        return jsonResult({
          status: 'stale_revision',
          serverRevisionId: slot.revisionId,
          message: 'baseRevisionId is stale. Call get_session_state and retry.'
        });
      }
      // Validate the proposed source up front so the user only ever sees viable proposals.
      const prepared = await (() => {
        if (contentType === 'mermaid') {
          return validateAndPreparePatch({
            currentState: slot,
            proposedMermaidSource: diagramSource,
            reason
          });
        }
        if (contentType === 'metaphor3d') {
          return validateAndPrepareMetaphorPatch({
            currentState: slot,
            proposedDiagramSource: diagramSource,
            reason
          });
        }
        if (contentType === 'chart') {
          return validateAndPrepareChartPatch({
            currentState: slot,
            proposedDiagramSource: diagramSource,
            reason
          });
        }
        if (contentType === 'anything') {
          return validateAndPrepareAnythingPatch({
            currentState: slot,
            proposedDiagramSource: diagramSource,
            reason
          });
        }
        return validateAndPrepareInfographicPatch({
          currentState: slot,
          proposedDiagramSource: diagramSource,
          reason
        });
      })();
      if (!prepared.accepted) {
        return jsonResult({ status: 'invalid', error: prepared.error });
      }
      const origin = originFromMcpEntry(entry);
      const proposal = services.proposalStore.create({
        sessionId: entry.appSessionId,
        origin,
        contentType,
        baseRevisionId,
        diagramSource: prepared.patch.diagramSource,
        reason,
        metadata: prepared.metadata
      });
      services.eventBus.publish(entry.appSessionId, {
        type: 'proposal_received',
        payload: proposal
      });
      services.presenceStore.touch(entry.agentId);
      const currentDiagramSource = slot.diagramSource ?? '';
      const proposedSource = proposal.diagramSource ?? '';
      const diffSummary = buildDiagramDiffSummary(currentDiagramSource, proposedSource, {
        contentType
      });
      return jsonResult({
        status: 'pending',
        ...proposal,
        origin: proposal.origin,
        sessionId: entry.appSessionId,
        currentDiagramSource,
        diffSummary,
        graphDiff: diffSummary.graphDiff ?? prepared.metadata?.graphDiff,
        webCanvasUrl: buildWebCanvasUrl(entry.appSessionId)
      });
    }
  );

  registerHumanOnlyAppTools(server);

  server.registerTool(
    'get_session_snapshot',
    {
      title: 'Session collaboration snapshot',
      description: 'Returns presence list and pending proposals for the session dashboard MCP App.',
      inputSchema: {}
    },
    async () => {
      const ctx = requireSessionEntry();
      if (ctx.error) return ctx.error;
      const { entry, services } = ctx;
      return jsonResult(getSessionCollaborationSnapshot(services, entry.appSessionId));
    }
  );

  registerAppTool(
    server,
    'open_web_companion',
    {
      title: 'Open web companion',
      description:
        'Read-only MCP App for humans using ArchiSlop in the browser while an external agent runs in Cursor: live queue, activity feed, canvas preview, links to approve in web. Use this instead of handshake/proposal-review when controlling from the web UI.',
      inputSchema: {},
      ...UI_META(MCP_APP_URI_WEB_COMPANION)
    },
    async () => {
      const ctx = requireSessionEntry();
      if (ctx.error) return ctx.error;
      const { entry, services } = ctx;
      return jsonResult({
        ...getSessionCollaborationSnapshot(services, entry.appSessionId),
        ...buildSessionBootstrap({
          entry,
          services,
          pairingCodeStore,
          publicBaseUrl: publicBaseUrl()
        })
      });
    }
  );

  registerAppTool(
    server,
    'open_handshake_review',
    {
      title: 'Open handshake review (MCP-only)',
      description:
        'Opens the legacy handshake MCP App with Approve/Deny buttons for hosts without the web UI. When ArchiSlop is open in the browser, prefer open_web_companion.',
      inputSchema: {
        requestId: z.string().min(1).optional()
      },
      ...UI_META(MCP_APP_URI_HANDSHAKE)
    },
    async ({ requestId }) => {
      const ctx = requireSessionEntry();
      if (ctx.error) return ctx.error;
      const { entry, services } = ctx;
      const pending = services.handshakeStore
        .listPendingRequests()
        .filter((h) => h.sessionId === entry.appSessionId);
      const match = requestId ? pending.find((h) => h.requestId === requestId) : pending[0];
      if (!match) {
        return jsonResult({ status: 'none', message: 'No pending handshake.' });
      }
      return jsonResult({
        ...match,
        webCanvasUrl: buildWebCanvasUrl(entry.appSessionId)
      });
    }
  );

  registerAppTool(
    server,
    'open_session_dashboard',
    {
      title: 'Open session war room',
      description:
        'Shows the session dashboard MCP App: connected agents, pending proposals, and revision ids.',
      inputSchema: {},
      ...UI_META(MCP_APP_URI_SESSION_DASHBOARD)
    },
    async () => {
      const ctx = requireSessionEntry();
      if (ctx.error) return ctx.error;
      const { entry, services } = ctx;
      return jsonResult(getSessionCollaborationSnapshot(services, entry.appSessionId));
    }
  );

  registerAppTool(
    server,
    'open_proposal_review',
    {
      title: 'Open proposal review',
      description:
        'Opens the proposal-review MCP App for a pending or resolved proposal by id (human reviewer or dashboard).',
      inputSchema: {
        proposalId: z.string().min(1)
      },
      ...UI_META(MCP_APP_URI_PROPOSAL_REVIEW)
    },
    async ({ proposalId }) => {
      const ctx = requireSessionEntry();
      if (ctx.error) return ctx.error;
      const { entry, services } = ctx;
      const payload = buildProposalReviewPayload(services, entry.appSessionId, proposalId);
      if (!payload) {
        return jsonResult({ status: 'error', message: 'Proposal not found.' });
      }
      return jsonResult(payload);
    }
  );

  server.registerTool(
    'get_insights',
    {
      title: 'List session insights',
      description:
        'Returns attributed insights (notes, critiques, suggestions) stored for this session. Use before revising proposals or to catch up after joining late.',
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional(),
        variant: z.enum(['note', 'critique', 'suggestion']).optional()
      }
    },
    async ({ limit, variant }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      return jsonResult({
        insights: services.insightStore.list({ limit: limit ?? 50, variant }),
        webCanvasUrl: buildWebCanvasUrl(entry.appSessionId)
      });
    }
  );

  registerAppTool(
    server,
    'open_insights_feed',
    {
      title: 'Open insights feed',
      description: 'Shows the insights-feed MCP App: Thinking-pane parity for external agents.',
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional()
      },
      ...UI_META(MCP_APP_URI_INSIGHTS_FEED)
    },
    async ({ limit }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      return jsonResult({
        insights: services.insightStore.list({ limit: limit ?? 50 }),
        webCanvasUrl: buildWebCanvasUrl(entry.appSessionId)
      });
    }
  );

  server.registerTool(
    'get_my_proposals',
    {
      title: 'List my diagram proposals',
      description:
        'Returns proposals submitted by this MCP agent (pending and resolved). Pair with open_my_proposals for the inbox MCP App.',
      inputSchema: {
        includeResolved: z.boolean().optional(),
        limit: z.number().int().min(1).max(50).optional()
      }
    },
    async ({ includeResolved, limit }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      return jsonResult({
        proposals: services.proposalStore.listByAgent(entry.agentId, {
          includeResolved: includeResolved ?? true,
          limit: limit ?? 20
        }),
        webCanvasUrl: buildWebCanvasUrl(entry.appSessionId)
      });
    }
  );

  registerAppTool(
    server,
    'open_my_proposals',
    {
      title: 'Open my proposal inbox',
      description:
        'Shows the proposal-inbox MCP App: track your pending and resolved diagram edit proposals.',
      inputSchema: {
        includeResolved: z.boolean().optional(),
        limit: z.number().int().min(1).max(50).optional()
      },
      ...UI_META(MCP_APP_URI_PROPOSAL_INBOX)
    },
    async ({ includeResolved, limit }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      return jsonResult({
        proposals: services.proposalStore.listByAgent(entry.agentId, {
          includeResolved: includeResolved ?? true,
          limit: limit ?? 20
        }),
        webCanvasUrl: buildWebCanvasUrl(entry.appSessionId)
      });
    }
  );

  server.registerTool(
    'wait_for_resolution',
    {
      title: 'Wait for proposal resolution',
      description:
        'Long-poll for the user to accept, reject, or let a proposal go stale. Times out after `timeoutMs` (default 50s) and returns the current status.',
      inputSchema: {
        proposalId: z.string().min(1),
        timeoutMs: z.number().int().min(1000).max(55000).optional()
      }
    },
    async ({ proposalId, timeoutMs }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      const result = await services.proposalStore.waitForResolution(proposalId, {
        timeoutMs: timeoutMs ?? 50000
      });
      services.presenceStore.touch(entry.agentId);
      return jsonResult(result);
    }
  );

  server.registerTool(
    'drop_insight',
    {
      title: 'Post an attributed insight',
      description:
        'Add a comment, critique, or suggestion to the InsightsPane. Shows up with your agent badge so the human user knows it came from you. Use this for second opinions, observations, or follow-up nudges.',
      inputSchema: {
        text: z.string().min(1).max(8000),
        variant: z.enum(['note', 'critique', 'suggestion']).default('note')
      }
    },
    async ({ text, variant }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      const insight = {
        insightId: randomUUID(),
        origin: originFromMcpEntry(entry),
        variant,
        text,
        createdAt: new Date().toISOString()
      };
      publishAttributedInsight({
        insightStore: services.insightStore,
        eventBus: services.eventBus,
        sessionId: entry.appSessionId,
        insight
      });
      services.presenceStore.touch(entry.agentId);
      const posted = {
        status: 'posted',
        insightId: insight.insightId,
        variant,
        text,
        origin: insight.origin
      };
      if (variant === 'critique') {
        return jsonResult({
          ...posted,
          hint: 'Call open_critique_review with the same text to show the critique-map MCP App.'
        });
      }
      return jsonResult(posted);
    }
  );

  registerAppTool(
    server,
    'open_critique_review',
    {
      title: 'Review critique with interactive map',
      description:
        'Opens the critique-map MCP App for a critique insight. Pass the critique markdown and metadata from drop_insight.',
      inputSchema: {
        text: z.string().min(1).max(8000),
        variant: z.enum(['note', 'critique', 'suggestion']).default('critique'),
        insightId: z.string().optional(),
        contentType: z
          .enum(['mermaid', 'infographic', 'metaphor3d', 'chart', 'anything'])
          .optional()
      },
      ...UI_META(MCP_APP_URI_CRITIQUE_MAP)
    },
    async ({ text, variant, insightId, contentType }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      return jsonResult({
        text,
        variant,
        insightId: insightId ?? randomUUID(),
        contentType: contentType ?? 'mermaid',
        origin: originFromMcpEntry(entry)
      });
    }
  );

  server.registerTool(
    'set_focus',
    {
      title: 'Announce what node you are looking at',
      description:
        'Tell the human user which node or region of the diagram has your attention. Renders as a colored focus indicator on the canvas. Pass `nodeId: null` to clear focus. Use open_focus_picker for a visual node list.',
      inputSchema: {
        contentType: z.enum(['mermaid', 'infographic', 'metaphor3d', 'chart', 'anything']),
        nodeId: z.string().max(120).optional(),
        label: z.string().max(240).optional()
      }
    },
    async ({ contentType, nodeId, label }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      services.presenceStore.upsert({
        agentId: entry.agentId,
        agentName: entry.agentName,
        color: entry.color,
        emoji: entry.emoji,
        focus: nodeId ? { contentType, nodeId, label } : null
      });
      services.eventBus.publish(entry.appSessionId, {
        type: 'presence_update',
        payload: services.presenceStore.list()
      });
      return jsonResult({ status: 'ok' });
    }
  );

  server.registerTool(
    'react',
    {
      title: 'React with an emoji',
      description:
        'Drop a short-lived emoji reaction on a revision, an insight, or a node. Cheap, fun, low-stakes — celebrate wins or signal disagreement.',
      inputSchema: {
        target: z.discriminatedUnion('kind', [
          z.object({
            kind: z.literal('revision'),
            contentType: z.enum(['mermaid', 'infographic', 'metaphor3d', 'chart', 'anything']),
            revisionId: z.number().int().nonnegative()
          }),
          z.object({
            kind: z.literal('insight'),
            insightId: z.string().min(1)
          }),
          z.object({
            kind: z.literal('node'),
            contentType: z.enum(['mermaid', 'infographic', 'metaphor3d', 'chart', 'anything']),
            nodeId: z.string().min(1)
          })
        ]),
        emoji: z.string().min(1).max(8)
      }
    },
    async ({ target, emoji }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      const reaction = {
        reactionId: randomUUID(),
        origin: originFromMcpEntry(entry),
        target,
        emoji,
        createdAt: new Date().toISOString()
      };
      services.eventBus.publish(entry.appSessionId, {
        type: 'reaction',
        payload: reaction
      });
      services.presenceStore.touch(entry.agentId);
      return jsonResult({ status: 'ok', reactionId: reaction.reactionId });
    }
  );

  // -------------------- Prompts --------------------

  server.registerPrompt(
    'archislop_collaboration_guide',
    {
      title: 'How to collaborate in an ArchiSlop session',
      description:
        'A short system-prompt-style brief teaching the model how to be a useful guest in a live ArchiSlop diagram session.'
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'You are connected to a live ArchiSlop diagram session as an external agent.',
              '',
              'MCP Apps (SEP-1865): several tools render interactive UIs in MCP hosts (Cursor, Claude Desktop, VS Code):',
              '- `open_welcome` / `get_session_bootstrap` → onboarding checklist and revision ids',
              '- `open_session_pairing` / `join_session` → paste pairing code from Invite agent (stable /mcp URL)',
              '- `register_agent` → handshake approval card',
              '- `open_session_events` → live collaboration feed (SSE + long-poll fallback)',
              '- `open_diagram_canvas` / `open_focus_picker` → canvas preview + node focus',
              '- `propose_diagram_edit` / `open_proposal_review` → side-by-side proposal review (accept/reject in the host)',
              '- `open_session_dashboard` → war room (presence + handshakes + pending proposals)',
              '- `open_my_proposals` → your proposal inbox (wait for resolution)',
              '- `open_insights_feed` / `open_compose_insight` / `get_insights` → Thinking-pane comments',
              '- `open_critique_review` / `drop_insight` (critique) → actionable checklist with fix request',
              '',
              'Conventions:',
              '- On a stable /mcp URL, call `open_session_pairing` or `join_session({ pairingCode })` before anything else.',
              '- Call `get_session_bootstrap` after binding for a one-shot checklist and revision ids.',
              '- Call `register_agent` once the room is bound (default: non-blocking). Poll `get_handshake_status` or use `subscribe_session_events`.',
              '- After approval, call `open_diagram_canvas` once to align visually, then `get_session_state` before proposing.',
              '- Use `open_session_events` or `subscribe_session_events` instead of polling proposals when possible.',
              '- Edits go through `propose_diagram_edit` — NEVER auto-applied.',
              '- Always include a one-sentence `reason` so the human understands WHY.',
              '- Use `set_focus` before proposing changes to a specific node.',
              '- Use `drop_insight` (variant critique) then `open_critique_review` for structured review.',
              '- Use `react` sparingly.',
              '- Be a good guest: small, well-motivated, frequent contributions beat one giant rewrite.'
            ].join('\n')
          }
        }
      ]
    })
  );

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
