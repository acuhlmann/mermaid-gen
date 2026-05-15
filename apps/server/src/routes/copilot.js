import express from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import {
  AgentStreamPayloadSchema,
  ContentTypeSchema,
  DiagramAnalyzeSchema,
  DiagramIntentSchema,
  DiagramStyleSchema,
  DiagramTransformIntentSchema,
  StyleIntentSchema
} from '@archislop/shared';
import { LlmNotConfiguredError } from '../agents/mermaidLangChainAgent.js';
import { SESSION_HEADER, resolveSessionIdFromRequest } from '../state/sessionServices.js';
import { redactSecrets } from '../utils/redactSecrets.js';
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
import { normalizePairingCode } from '../state/pairingCodeStore.js';
import {
  createAgentStreamEmitter,
  newRunIds,
  runStarted,
  runError,
  stepStarted
} from '../agents/agUiEvents.js';
import {
  apiLlmRateLimitIfNeeded,
  createApiRateLimitMiddleware
} from '../middleware/apiRateLimit.js';

function safeErrorMessage(error) {
  return redactSecrets(error instanceof Error ? error.message : String(error));
}

export async function handleDiagramIntent({ body, stateStore, agentService }) {
  const parsedIntent = DiagramIntentSchema.safeParse(body);
  if (!parsedIntent.success) {
    return {
      status: 400,
      body: {
        error: 'Invalid intent payload',
        details: parsedIntent.error.flatten()
      }
    };
  }

  const intent = parsedIntent.data;
  const state = stateStore.getSlot(intent.contentType);
  if (intent.revisionId !== state.revisionId) {
    return {
      status: 409,
      body: {
        error: 'State revision is stale. Refresh state and retry.',
        state
      }
    };
  }

  try {
    const agentResult = await agentService.applyIntent({
      contentType: intent.contentType,
      prompt: intent.prompt,
      settings: intent.settings,
      focusNode: intent.focusNode,
      modelProfile: intent.modelProfile,
      peerContext: intent.peerContext
    });
    const nextState = stateStore.getSlot(intent.contentType);
    const patch = nextState.history.at(-1);

    if (nextState.revisionId === state.revisionId || !patch) {
      return {
        status: 422,
        body: {
          error: 'Agent did not apply a diagram patch.',
          message: agentResult.message,
          state: nextState
        }
      };
    }

    const stateWithPrompt = stateStore.setLastUserPrompt({
      contentType: intent.contentType,
      prompt: intent.prompt
    });
    stateStore.mirrorLastUserPromptToSibling({
      contentType: intent.contentType,
      prompt: intent.prompt
    });

    return {
      status: 200,
      body: {
        message: agentResult.message || 'Patch accepted',
        patch,
        state: stateWithPrompt ?? nextState,
        metadata: {
          llm: true,
          agent: 'intent',
          contentType: intent.contentType
        }
      }
    };
  } catch (error) {
    if (error instanceof LlmNotConfiguredError) {
      return {
        status: error.statusCode,
        body: { error: safeErrorMessage(error) }
      };
    }

    return {
      status: 500,
      body: {
        error: 'Agent request failed',
        details: safeErrorMessage(error)
      }
    };
  }
}

export async function handleDiagramTransformIntent({ body, stateStore, agentService }) {
  const parsedIntent = DiagramTransformIntentSchema.safeParse(body);
  if (!parsedIntent.success) {
    return {
      status: 400,
      body: {
        error: 'Invalid transform payload',
        details: parsedIntent.error.flatten()
      }
    };
  }

  const intent = parsedIntent.data;
  const state = stateStore.getSlot(intent.contentType);
  if (intent.revisionId !== state.revisionId) {
    return {
      status: 409,
      body: {
        error: 'State revision is stale. Refresh state and retry.',
        state
      }
    };
  }

  try {
    const agentResult = await agentService.applyTransformIntent({
      contentType: intent.contentType,
      mode: intent.mode,
      focusNode: intent.focusNode,
      modelProfile: intent.modelProfile,
      goMadDepth: intent.goMadDepth
    });
    const nextState = stateStore.getSlot(intent.contentType);
    const patch = nextState.history.at(-1);

    if (nextState.revisionId === state.revisionId || !patch) {
      return {
        status: 422,
        body: {
          error: 'Transform did not apply a diagram patch.',
          message: 'The transform returned text instead of a valid diagram update. Please try again or simplify the diagram.',
          state: nextState
        }
      };
    }

    return {
      status: 200,
      body: {
        message: agentResult.message || 'Transform patch accepted',
        patch,
        state: nextState,
        metadata: {
          llm: true,
          agent: `transform:${intent.mode}`,
          contentType: intent.contentType
        }
      }
    };
  } catch (error) {
    if (error instanceof LlmNotConfiguredError) {
      return {
        status: error.statusCode,
        body: { error: safeErrorMessage(error) }
      };
    }

    return {
      status: 500,
      body: {
        error: 'Transform request failed',
        details: safeErrorMessage(error)
      }
    };
  }
}

export async function handleDiagramAnalyze({ body, stateStore, agentService }) {
  const parsed = DiagramAnalyzeSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        error: 'Invalid analyze payload',
        details: parsed.error.flatten()
      }
    };
  }

  const intent = parsed.data;
  const state = stateStore.getSlot(intent.contentType);
  if (intent.revisionId !== state.revisionId) {
    return {
      status: 409,
      body: {
        error: 'State revision is stale. Refresh state and retry.',
        state
      }
    };
  }

  try {
    const agentResult = await agentService.applyAnalyzeIntent({
      contentType: intent.contentType,
      kind: intent.kind,
      focusNode: intent.focusNode,
      modelProfile: intent.modelProfile
    });

    return {
      status: 200,
      body: {
        text: agentResult.message || '',
        metadata: {
          llm: true,
          agent: `analyze:${intent.kind}`,
          contentType: intent.contentType
        }
      }
    };
  } catch (error) {
    if (error instanceof LlmNotConfiguredError) {
      return {
        status: error.statusCode,
        body: { error: safeErrorMessage(error) }
      };
    }

    return {
      status: 500,
      body: {
        error: 'Analyze request failed',
        details: safeErrorMessage(error)
      }
    };
  }
}

export async function handleStyleIntent({ body, stateStore, agentService }) {
  const parsedIntent = StyleIntentSchema.safeParse(body);
  if (!parsedIntent.success) {
    return {
      status: 400,
      body: {
        error: 'Invalid style payload',
        details: parsedIntent.error.flatten()
      }
    };
  }

  const intent = parsedIntent.data;
  if (intent.contentType !== 'mermaid') {
    return {
      status: 400,
      body: {
        error: 'Style intent is only supported for Mermaid diagrams.'
      }
    };
  }

  const state = stateStore.getSlot('mermaid');
  if (intent.revisionId !== state.revisionId) {
    return {
      status: 409,
      body: {
        error: 'State revision is stale. Refresh state and retry.',
        state
      }
    };
  }

  try {
    const agentResult = await agentService.applyStyleIntent({
      prompt: intent.stylePrompt || intent.prompt,
      settings: intent.settings
    });
    const nextState = stateStore.getSlot('mermaid');
    const patch = nextState.history.at(-1);

    if (nextState.revisionId === state.revisionId || !patch) {
      return {
        status: 422,
        body: {
          error: 'Style agent did not apply a diagram patch.',
          message: agentResult.message,
          state: nextState
        }
      };
    }

    return {
      status: 200,
      body: {
        message: agentResult.message || 'Style patch accepted',
        patch,
        state: nextState,
        metadata: {
          llm: true,
          agent: 'style',
          contentType: 'mermaid'
        }
      }
    };
  } catch (error) {
    if (error instanceof LlmNotConfiguredError) {
      return {
        status: error.statusCode,
        body: { error: safeErrorMessage(error) }
      };
    }

    return {
      status: 500,
      body: {
        error: 'Style request failed',
        details: safeErrorMessage(error)
      }
    };
  }
}

const SyncClientStateSchema = z.object({
  contentType: ContentTypeSchema.default('mermaid'),
  diagramSource: z.string(),
  styleConfig: DiagramStyleSchema.optional()
});

export async function handleClientStateSync({ body, stateStore }) {
  const parsed = SyncClientStateSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        error: 'Invalid state sync payload',
        details: parsed.error.flatten()
      }
    };
  }

  const synced = await stateStore.syncClientDiagramSource({
    contentType: parsed.data.contentType,
    diagramSource: parsed.data.diagramSource,
    styleConfig: parsed.data.styleConfig
  });

  if (!synced.accepted) {
    return {
      status: 422,
      body: {
        error: synced.error
      }
    };
  }

  return {
    status: 200,
    body: synced.state
  };
}

function resolveStateContentType(req) {
  const candidate = req?.query?.contentType;
  const parsed = ContentTypeSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function writeSseData(res, payload, eventId) {
  if (eventId != null && eventId !== '') {
    res.write(`id: ${eventId}\n`);
  }
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function buildInvitePayload(req, sessionId, pairingCodeStore) {
  const base = resolvePublicBaseUrl(req);
  const stableMcpUrl = `${base}/mcp`;
  const pairingCode =
    typeof pairingCodeStore.refreshForInvite === 'function'
      ? pairingCodeStore.refreshForInvite(sessionId)
      : pairingCodeStore.getOrCreateCode(sessionId);
  const inviteToken = signInviteToken({ sessionId });
  const mcpUrlWithPairing = `${base}/mcp?pairing=${encodeURIComponent(pairingCode)}`;
  const mcpUrlWithToken = `${base}/mcp?token=${encodeURIComponent(inviteToken)}`;
  const mcpUrl = mcpUrlWithToken;
  const stableConfig = { url: stableMcpUrl };
  const sessionConfig = { url: mcpUrlWithToken };
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

export function createCopilotRouter({
  resolveServices,
  sessionExists,
  pairingCodeStore,
  agentTokenStore,
  sessionRegistry
}) {
  const router = express.Router();
  const joinRateLimit = createApiRateLimitMiddleware('join');
  router.use(apiLlmRateLimitIfNeeded);

  router.get('/state', (req, res) => {
    const { sessionId, stateStore } = resolveServices(req);
    res.setHeader(SESSION_HEADER, sessionId);
    const contentType = resolveStateContentType(req);
    if (contentType) {
      return res.json(stateStore.getSlot(contentType));
    }
    return res.json(stateStore.getActiveSlot());
  });

  router.get('/session-state', (req, res) => {
    // If the client passes a session id we don't know about (e.g. URL bookmarked from before
    // a server restart), 404 so the client wipes its caches and generates a fresh id instead
    // of silently rehydrating a phantom session that has no agent state.
    const requestedId = resolveSessionIdFromRequest(req);
    if (typeof sessionExists === 'function' && !sessionExists(requestedId)) {
      res.setHeader(SESSION_HEADER, requestedId);
      return res.status(404).json({ error: 'Session not found' });
    }
    const { sessionId, stateStore } = resolveServices(req);
    res.setHeader(SESSION_HEADER, sessionId);
    return res.json(stateStore.getSessionState());
  });

  router.post('/state', async (req, res) => {
    const { sessionId, stateStore } = resolveServices(req);
    const result = await handleClientStateSync({
      body: req.body,
      stateStore
    });

    res.setHeader(SESSION_HEADER, sessionId);
    return res.status(result.status).json(result.body);
  });

  router.post('/intent', async (req, res) => {
    const { sessionId, stateStore, agentService } = resolveServices(req);
    const result = await handleDiagramIntent({
      body: req.body,
      stateStore,
      agentService
    });

    res.setHeader(SESSION_HEADER, sessionId);
    return res.status(result.status).json(result.body);
  });

  router.post('/transform', async (req, res) => {
    const { sessionId, stateStore, agentService } = resolveServices(req);
    const result = await handleDiagramTransformIntent({
      body: req.body,
      stateStore,
      agentService
    });

    res.setHeader(SESSION_HEADER, sessionId);
    return res.status(result.status).json(result.body);
  });

  router.post('/analyze', async (req, res) => {
    const { sessionId, stateStore, agentService } = resolveServices(req);
    const result = await handleDiagramAnalyze({
      body: req.body,
      stateStore,
      agentService
    });

    res.setHeader(SESSION_HEADER, sessionId);
    return res.status(result.status).json(result.body);
  });

  router.post('/agent-stream', async (req, res) => {
    const { sessionId, stateStore, agentService } = resolveServices(req);
    res.setHeader(SESSION_HEADER, sessionId);

    const parsed = AgentStreamPayloadSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid stream payload',
        details: parsed.error.flatten()
      });
    }

    const payload = parsed.data;
    const state = stateStore.getSlot(payload.contentType);
    if (payload.revisionId !== state.revisionId) {
      return res.status(409).json({
        error: 'State revision is stale. Refresh state and retry.',
        state
      });
    }

    const revisionBefore = state.revisionId;

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const rawEmit = (evt) => writeSseData(res, evt);

    // AG-UI is the only wire shape for this route: first-paint RUN_STARTED +
    // STEP_STARTED, then createAgentStreamEmitter maps agent events into AG-UI.
    const ids = newRunIds();
    rawEmit(runStarted(ids));
    rawEmit(stepStarted({ stepName: 'planning' }));
    const emit = createAgentStreamEmitter({
      rawEmit,
      threadId: ids.threadId,
      runId: ids.runId,
      contentType: payload.contentType,
      initialStep: 'planning'
    });

    try {
      await agentService.runAgentStream(payload.operation, { ...payload, _revisionBefore: revisionBefore }, emit);
    } catch (error) {
      const message = safeErrorMessage(error);
      rawEmit(runError({ message }));
    }

    res.end();
    return undefined;
  });

  router.post('/style', async (req, res) => {
    const { sessionId, stateStore, agentService } = resolveServices(req);
    const result = await handleStyleIntent({
      body: req.body,
      stateStore,
      agentService
    });

    res.setHeader(SESSION_HEADER, sessionId);
    return res.status(result.status).json(result.body);
  });

  // -------------------- External-agent collaboration endpoints --------------------

  router.get('/proposals', (req, res) => {
    const { sessionId, stateStore, proposalStore } = resolveServices(req);
    const mermaidRevision = stateStore.getSlot('mermaid').revisionId;
    const infographicRevision = stateStore.getSlot('infographic').revisionId;
    const pending = proposalStore.listPending({
      currentRevisionByContentType: {
        mermaid: mermaidRevision,
        infographic: infographicRevision
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
      return res.status(422).json({ error: applied.error });
    }
    proposalStore.markAccepted(proposal.proposalId);
    eventBus.publish(sessionId, {
      type: 'proposal_resolved',
      payload: { proposalId: proposal.proposalId, status: 'accepted', state: applied.state }
    });
    eventBus.publish(sessionId, {
      type: 'state_changed',
      payload: { contentType: proposal.contentType, state: applied.state, patch: applied.patch }
    });
    res.json({ status: 'accepted', state: applied.state, patch: applied.patch });
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
      agentTokenStore
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
    const pairingCode = normalizePairingCode(req.body?.pairingCode ?? req.body?.room ?? '');
    if (!pairingCode) {
      return res.status(400).json({ error: 'pairingCode required (6 characters).' });
    }
    const resolved = await Promise.resolve(pairingCodeStore.resolveDetailed(pairingCode));
    if (!resolved.ok) {
      const status = resolved.reason === 'expired' ? 410 : 404;
      return res.status(status).json({ error: resolved.reason, pairingCode });
    }
    const sessionId = resolved.sessionId;
    sessionRegistry.getSessionServices(sessionId);
    res.setHeader(SESSION_HEADER, sessionId);
    res.json({ sessionId, pairingCode });
  });

  router.get('/session-events', (req, res) => {
    const { sessionId, presenceStore, proposalStore, stateStore, eventBus } = resolveServices(req);
    res.setHeader(SESSION_HEADER, sessionId);

    if (agentTokenStore) {
      const rawHeader = req.headers['x-agent-token'];
      const rawQuery = req.query.agentToken;
      const agentToken = Array.isArray(rawHeader)
        ? rawHeader[0]
        : rawHeader ?? (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery);
      if (agentToken) {
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

    // Initial snapshot so a freshly-mounted UI sees current presence + pending proposals
    // without an extra round-trip to /presence + /proposals.
    const mermaidRevision = stateStore.getSlot('mermaid').revisionId;
    const infographicRevision = stateStore.getSlot('infographic').revisionId;
    const pending = proposalStore.listPending({
      currentRevisionByContentType: {
        mermaid: mermaidRevision,
        infographic: infographicRevision
      }
    });
    const { latestSeq } = eventBus.getSessionMeta(sessionId);
    const sinceSeq = eventBus.parseSinceSeq(
      req.headers['last-event-id'] ?? req.query.sinceSeq
    );
    writeSseData(res, {
      type: 'snapshot',
      payload: {
        presence: presenceStore.list(),
        pendingProposals: pending
      },
      latestSeq,
      at: new Date().toISOString()
    });

    for (const envelope of eventBus.getHistory(sessionId, { sinceSeq })) {
      writeSseData(res, envelope, envelope.eventId);
    }

    const unsubscribe = eventBus.subscribe(sessionId, (envelope) => {
      writeSseData(res, envelope, envelope.eventId);
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

  return router;
}
