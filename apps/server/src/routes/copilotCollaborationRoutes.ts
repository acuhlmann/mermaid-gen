/**
 * External-agent collaboration routes: proposals, handshakes, presence, invite, join-room, session-events SSE.
 * Split out of copilot.ts (ADR-0005 / balanced-coupling-priorities §5 "copilot.ts → route modules by concern").
 */
import type { Request, Response, Router } from 'express';
import QRCode from 'qrcode';
import { SESSION_HEADER, resolveSessionIdFromRequest } from '../state/sessionServices.js';
import { resolvePublicBaseUrl } from '../utils/publicBaseUrl.js';
import { signInviteToken } from '../utils/inviteToken.js';
import {
  MCP_SERVER_NAME,
  buildCursorInstallUrl,
  buildMcpConfigSnippet,
  buildVscodeInstallUrl
} from '../mcp/mcpInviteLinks.js';
import { approveHandshake, denyHandshake } from '../mcp/mcpCollaborationActions.js';
import { buildWebCanvasUrl } from '../mcp/diagramDiffSummary.js';
import { normalizePairingCode, type PairingCodeStore } from '../state/pairingCodeStore.js';
import type { ApplyStoreResult } from './copilotRouteTypes.js';

export function writeCopilotSseData(
  res: Response,
  payload: unknown,
  eventId?: string | number | null
) {
  if (eventId != null && eventId !== '') {
    res.write(`id: ${eventId}\n`);
  }
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function buildInvitePayload(req: Request, sessionId: string, pairingCodeStore: PairingCodeStore) {
  const base = resolvePublicBaseUrl(req);
  const stableMcpUrl = `${base}/mcp`;
  const pairingCode = pairingCodeStore.getOrCreateCode(sessionId);
  const inviteToken = signInviteToken({ sessionId });
  const mcpUrlWithPairing = `${base}/mcp?pairing=${encodeURIComponent(pairingCode)}`;
  const mcpUrlWithToken = `${base}/mcp?token=${encodeURIComponent(inviteToken)}`;
  const mcpUrl = mcpUrlWithToken;
  const stableConfig = { url: stableMcpUrl };
  const pairingConfig = { url: mcpUrlWithPairing };
  const tokenConfig = { url: mcpUrlWithToken };

  return {
    sessionId,
    pairingCode,
    inviteToken,
    stableMcpUrl,
    mcpUrl,
    mcpUrlWithPairing,
    mcpUrlWithToken,
    roomUrl: (() => {
      const canvas = buildWebCanvasUrl(sessionId);
      const origin = canvas.replace(/\/sessions\/.*$/, '');
      return `${origin}/?room=${encodeURIComponent(pairingCode)}`;
    })(),
    mcpConfigSnippet: buildMcpConfigSnippet(stableMcpUrl),
    mcpConfigSnippetWithSession: buildMcpConfigSnippet(mcpUrl),
    mcpConfigSnippetWithPairing: buildMcpConfigSnippet(mcpUrlWithPairing),
    mcpConfigSnippetWithToken: buildMcpConfigSnippet(mcpUrlWithToken),
    cursorInstallUrl: buildCursorInstallUrl(MCP_SERVER_NAME, stableConfig),
    cursorInstallUrlWithPairing: buildCursorInstallUrl(MCP_SERVER_NAME, pairingConfig),
    cursorInstallUrlWithToken: buildCursorInstallUrl(MCP_SERVER_NAME, tokenConfig),
    vscodeInstallUrl: buildVscodeInstallUrl({
      name: MCP_SERVER_NAME,
      type: 'http',
      ...stableConfig
    }),
    vscodeInstallUrlWithPairing: buildVscodeInstallUrl({
      name: MCP_SERVER_NAME,
      type: 'http',
      ...pairingConfig
    }),
    vscodeInstallUrlWithToken: buildVscodeInstallUrl({
      name: MCP_SERVER_NAME,
      type: 'http',
      ...tokenConfig
    }),
    claudeCodeCommand: `claude mcp add ${MCP_SERVER_NAME} --transport http "${stableMcpUrl}"`,
    claudeCodeCommandWithPairing: `claude mcp add ${MCP_SERVER_NAME} --transport http "${mcpUrlWithPairing}"`,
    claudeCodeCommandWithToken: `claude mcp add ${MCP_SERVER_NAME} --transport http "${mcpUrlWithToken}"`
  };
}

type CopilotSessionServices = {
  sessionId: string;
  stateStore: import('../state/diagramStateStore.js').DiagramStateStore;
  proposalStore: import('../state/sessionServices.js').SessionServices['proposalStore'];
  handshakeStore: import('../state/sessionServices.js').SessionServices['handshakeStore'];
  presenceStore: import('../state/sessionServices.js').SessionServices['presenceStore'];
  eventBus: import('../state/sessionEventBus.js').SessionEventBus;
};

export type RegisterCopilotCollaborationRoutesOptions = {
  resolveServices: (req: Request) => CopilotSessionServices;
  sessionExists?: (sessionId: string) => boolean;
  pairingCodeStore: PairingCodeStore;
  agentTokenStore?: {
    verify(token: string): { sessionId: string; agentId?: string } | null;
    issue?(opts: {
      sessionId: string;
      agentId: string;
      mcpSessionId: string | null;
    }): string | null;
    bindMcpSession?(sessionId: string, agentId: string, mcpSessionId: string): void;
  };
  sessionRegistry: {
    getSessionServices(sessionId: string): unknown;
  };
  joinRateLimit: import('express').RequestHandler;
};

export function registerCopilotCollaborationRoutes(
  router: Router,
  {
    resolveServices,
    sessionExists,
    pairingCodeStore,
    agentTokenStore,
    sessionRegistry,
    joinRateLimit
  }: RegisterCopilotCollaborationRoutesOptions
) {
  router.get('/proposals', (req, res) => {
    const { sessionId, stateStore, proposalStore } = resolveServices(req);
    const mermaidRevision = stateStore.getSlot('mermaid').revisionId;
    const infographicRevision = stateStore.getSlot('infographic').revisionId;
    const metaphor3dRevision = stateStore.getSlot('metaphor3d').revisionId;
    const chartRevision = stateStore.getSlot('chart').revisionId;
    const anythingRevision = stateStore.getSlot('anything').revisionId;
    const formsRevision = stateStore.getSlot('forms').revisionId;
    const pending = proposalStore.listPending({
      currentRevisionByContentType: {
        mermaid: mermaidRevision,
        infographic: infographicRevision,
        metaphor3d: metaphor3dRevision,
        chart: chartRevision,
        anything: anythingRevision,
        forms: formsRevision
      }
    });
    res.setHeader(SESSION_HEADER, sessionId);
    res.json({ proposals: pending });
  });

  router.post('/proposals/:proposalId/accept', async (req, res) => {
    const { sessionId, stateStore, proposalStore, eventBus } = resolveServices(req);
    res.setHeader(SESSION_HEADER, sessionId);
    const proposal = proposalStore.get(req.params.proposalId);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found.' });
    if (proposal.status !== 'pending') {
      return res.status(409).json({ error: `Proposal already ${proposal.status}.` });
    }
    const slot = stateStore.getSlot(proposal.contentType);
    if (proposal.baseRevisionId !== slot.revisionId) {
      proposalStore.markStale(proposal.proposalId);
      eventBus.publish(sessionId, {
        type: 'proposal_resolved',
        payload: { proposalId: proposal.proposalId, status: 'stale' }
      });
      return res.status(409).json({ error: 'Proposal is stale (diagram has advanced).' });
    }
    const applied = await stateStore.applyDiagramSource({
      contentType: proposal.contentType,
      diagramSource: proposal.diagramSource,
      reason: proposal.reason,
      origin: proposal.origin
    });
    if (!applied.accepted) {
      const rejected = applied as Extract<ApplyStoreResult, { accepted: false }>;
      return res.status(422).json({ error: rejected.error ?? 'Patch rejected' });
    }
    const ok = applied as Extract<ApplyStoreResult, { accepted: true }>;
    proposalStore.markAccepted(proposal.proposalId);
    eventBus.publish(sessionId, {
      type: 'proposal_resolved',
      payload: { proposalId: proposal.proposalId, status: 'accepted', state: ok.state }
    });
    eventBus.publish(sessionId, {
      type: 'state_changed',
      payload: { contentType: proposal.contentType, state: ok.state, patch: ok.patch }
    });
    res.json({ status: 'accepted', state: ok.state, patch: ok.patch });
  });

  router.post('/proposals/:proposalId/reject', (req, res) => {
    const { sessionId, proposalStore, eventBus } = resolveServices(req);
    res.setHeader(SESSION_HEADER, sessionId);
    const proposal = proposalStore.get(req.params.proposalId);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found.' });
    if (proposal.status !== 'pending') {
      return res.status(409).json({ error: `Proposal already ${proposal.status}.` });
    }
    proposalStore.markRejected(proposal.proposalId);
    eventBus.publish(sessionId, {
      type: 'proposal_resolved',
      payload: { proposalId: proposal.proposalId, status: 'rejected' }
    });
    res.json({ status: 'rejected' });
  });

  router.get('/handshakes', (req, res) => {
    const { sessionId, handshakeStore } = resolveServices(req);
    res.setHeader(SESSION_HEADER, sessionId);
    res.json({ requests: handshakeStore.listPendingRequests() });
  });

  router.post('/handshakes/:requestId/approve', (req, res) => {
    const { sessionId, handshakeStore, presenceStore, eventBus } = resolveServices(req);
    res.setHeader(SESSION_HEADER, sessionId);
    const result = approveHandshake({
      sessionId,
      handshakeStore,
      presenceStore,
      eventBus,
      requestId: req.params.requestId,
      agentTokenStore,
      mcpSessionId: undefined
    });
    if (!result.ok) return res.status(result.status).json(result.body);
    res.json(result.body);
  });

  router.post('/handshakes/:requestId/deny', (req, res) => {
    const { sessionId, handshakeStore, eventBus } = resolveServices(req);
    res.setHeader(SESSION_HEADER, sessionId);
    const result = denyHandshake({
      sessionId,
      handshakeStore,
      eventBus,
      requestId: req.params.requestId
    });
    if (!result.ok) return res.status(result.status).json(result.body);
    res.json(result.body);
  });

  router.get('/presence', (req, res) => {
    const { sessionId, presenceStore } = resolveServices(req);
    res.setHeader(SESSION_HEADER, sessionId);
    res.json({ agents: presenceStore.list() });
  });

  router.get('/invite', async (req, res) => {
    const { sessionId } = resolveServices(req);
    res.setHeader(SESSION_HEADER, sessionId);
    if (typeof pairingCodeStore.refreshForInvite === 'function') {
      await Promise.resolve(pairingCodeStore.refreshForInvite(sessionId));
    }
    const invite = buildInvitePayload(req, sessionId, pairingCodeStore);
    let qrDataUrl = null;
    try {
      qrDataUrl = await QRCode.toDataURL(invite.mcpUrlWithPairing, { width: 256, margin: 1 });
    } catch {
      // QR is decorative; fall through with null if the renderer fails.
    }
    res.json({ ...invite, qrDataUrl });
  });

  router.post('/invite/rotate-pairing', async (req, res) => {
    const { sessionId, eventBus } = resolveServices(req);
    res.setHeader(SESSION_HEADER, sessionId);
    const pairingCode = await Promise.resolve(pairingCodeStore.regenerate(sessionId));
    eventBus.publish(sessionId, {
      type: 'pairing_rotated',
      payload: { pairingCode, sessionId, at: new Date().toISOString() }
    });
    res.json({ pairingCode, sessionId });
  });

  router.post('/join-room', joinRateLimit, async (req, res) => {
    const joinBody = req.body as { pairingCode?: unknown; room?: unknown } | undefined;
    const pairingCode = normalizePairingCode(joinBody?.pairingCode ?? joinBody?.room ?? '');
    if (!pairingCode) {
      return res.status(400).json({ error: 'pairingCode required (6 characters).' });
    }
    const resolved = pairingCodeStore.resolveDetailed(pairingCode);
    if (resolved.ok === false) {
      const status = resolved.reason === 'expired' ? 410 : 404;
      return res.status(status).json({ error: resolved.reason, pairingCode });
    }
    const sessionId = resolved.sessionId;
    sessionRegistry.getSessionServices(sessionId);
    res.setHeader(SESSION_HEADER, sessionId);
    res.json({ sessionId, pairingCode });
  });

  router.get('/session-events', (req, res) => {
    const requestedId = resolveSessionIdFromRequest(req);
    if (typeof sessionExists === 'function' && !sessionExists(requestedId)) {
      res.setHeader(SESSION_HEADER, requestedId);
      return res.status(404).json({ error: 'Session not found' });
    }
    const { sessionId, presenceStore, proposalStore, stateStore, eventBus } = resolveServices(req);
    res.setHeader(SESSION_HEADER, sessionId);

    if (agentTokenStore) {
      const rawHeader = req.headers['x-agent-token'];
      const rawQuery = req.query.agentToken;
      const agentToken = Array.isArray(rawHeader)
        ? rawHeader[0]
        : (rawHeader ?? (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery));
      if (agentToken && typeof agentToken === 'string') {
        const verified = agentTokenStore.verify(agentToken);
        if (!verified || verified.sessionId !== sessionId) {
          res.status(403).json({ error: 'Invalid or expired agent token for this session.' });
          return;
        }
      }
    }
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const mermaidRevision = stateStore.getSlot('mermaid').revisionId;
    const infographicRevision = stateStore.getSlot('infographic').revisionId;
    const metaphor3dRevision = stateStore.getSlot('metaphor3d').revisionId;
    const chartRevision = stateStore.getSlot('chart').revisionId;
    const anythingRevision = stateStore.getSlot('anything').revisionId;
    const formsRevision = stateStore.getSlot('forms').revisionId;
    const pending = proposalStore.listPending({
      currentRevisionByContentType: {
        mermaid: mermaidRevision,
        infographic: infographicRevision,
        metaphor3d: metaphor3dRevision,
        chart: chartRevision,
        anything: anythingRevision,
        forms: formsRevision
      }
    });
    const { latestSeq } = eventBus.getSessionMeta(sessionId);
    const sinceSeq = eventBus.parseSinceSeq(req.headers['last-event-id'] ?? req.query.sinceSeq);
    writeCopilotSseData(res, {
      type: 'snapshot',
      payload: {
        presence: presenceStore.list(),
        pendingProposals: pending
      },
      latestSeq,
      at: new Date().toISOString()
    });

    for (const envelope of eventBus.getHistory(sessionId, { sinceSeq })) {
      writeCopilotSseData(res, envelope, envelope.eventId);
    }

    const unsubscribe = eventBus.subscribe(sessionId, (envelope) => {
      writeCopilotSseData(res, envelope, envelope.eventId);
    });

    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 15000);
    heartbeat.unref?.();

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };
    req.on('close', cleanup);
    req.on('aborted', cleanup);
    res.on('close', cleanup);
  });
}
