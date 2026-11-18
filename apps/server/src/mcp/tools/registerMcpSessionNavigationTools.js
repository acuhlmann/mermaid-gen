import { z } from 'zod';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { ContentTypeSchema } from '@archislop/shared';
import { buildWebCanvasUrl } from '../diagramDiffSummary.js';
import { buildProposalReviewPayload } from '../mcpProposalReviewPayload.js';
import { getSessionCollaborationSnapshot } from '../mcpCollaborationActions.js';
import { buildSessionBootstrap } from '../mcpSessionBootstrap.js';
import { jsonResult, requireRegisteredAgent } from '../mcpHelpers.js';
import {
  MCP_APP_URI_COMPOSE_INSIGHT,
  MCP_APP_URI_FOCUS_PICKER,
  MCP_APP_URI_HANDSHAKE,
  MCP_APP_URI_PROPOSAL_REVIEW,
  MCP_APP_URI_SESSION_DASHBOARD,
  MCP_APP_URI_SESSION_EVENTS,
  MCP_APP_URI_WEB_COMPANION,
  MCP_APP_URI_WELCOME,
  UI_META
} from '../registerMcpApps.js';

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {{
 *   sessionRegistry: ReturnType<import('../../state/sessionServices.js').createSessionServicesRegistry>,
 *   pairingCodeStore: ReturnType<import('../../state/pairingCodeStore.js').createPairingCodeStore>,
 *   agentTokenStore: ReturnType<import('../../state/agentTokenStore.js').createAgentTokenStore> | undefined,
 *   publicBaseUrl: () => string,
 *   currentEntry: () => object | null,
 *   requireBoundSession: () => { error?: object } | { entry: object },
 *   requireSessionEntry: () =>
 *     | { error: object }
 *     | { entry: { appSessionId: string }, services: import('../../state/sessionServices.js').SessionServices }
 * }} ctx
 */
export function registerMcpSessionNavigationTools(server, ctx) {
  const {
    sessionRegistry,
    pairingCodeStore,
    agentTokenStore,
    publicBaseUrl,
    currentEntry,
    requireBoundSession,
    requireSessionEntry
  } = ctx;

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
        contentType: ContentTypeSchema.optional()
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
    'get_session_snapshot',
    {
      title: 'Session collaboration snapshot',
      description: 'Returns presence list and pending proposals for the session dashboard MCP App.',
      inputSchema: {}
    },
    async () => {
      const ctxResult = requireSessionEntry();
      if (ctxResult.error) return ctxResult.error;
      const { entry, services } = ctxResult;
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
      const ctxResult = requireSessionEntry();
      if (ctxResult.error) return ctxResult.error;
      const { entry, services } = ctxResult;
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
      const ctxResult = requireSessionEntry();
      if (ctxResult.error) return ctxResult.error;
      const { entry, services } = ctxResult;
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
      const ctxResult = requireSessionEntry();
      if (ctxResult.error) return ctxResult.error;
      const { entry, services } = ctxResult;
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
      const ctxResult = requireSessionEntry();
      if (ctxResult.error) return ctxResult.error;
      const { entry, services } = ctxResult;
      const payload = buildProposalReviewPayload(services, entry.appSessionId, proposalId);
      if (!payload) {
        return jsonResult({ status: 'error', message: 'Proposal not found.' });
      }
      return jsonResult(payload);
    }
  );
}
