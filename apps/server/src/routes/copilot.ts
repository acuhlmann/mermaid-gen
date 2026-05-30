import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import type {
  AgentResult,
  AgentStreamEmit,
  AgentStreamOperation,
  ApplyAnalyzeIntentInput,
  ApplyIntentInput,
  ApplyStyleIntentInput,
  ApplyTransformIntentInput,
  ContentType,
  DiagramAgentStreamPayload,
  LegacyStreamEvent
} from '@archislop/shared';
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
import {
  SESSION_HEADER,
  resolveSessionIdFromRequest,
  type SessionServices
} from '../state/sessionServices.js';
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
import { normalizePairingCode, type PairingCodeStore } from '../state/pairingCodeStore.js';
import {
  createAgentStreamEmitter,
  newRunIds,
  runStarted,
  runError,
  stepStarted
} from '@archislop/shared';
import {
  apiLlmRateLimitIfNeeded,
  createApiRateLimitMiddleware
} from '../middleware/apiRateLimit.js';
import type { DiagramStateStore } from '../state/diagramStateStore.js';
import type { SessionEventEnvelope } from '../state/sessionEventBus.js';
import type {
  DiagramAnalyzeBody,
  DiagramIntentBody,
  DiagramTransformIntentBody,
  StyleIntentBody
} from './copilotRouteTypes.js';

/** Dispatcher routes by contentType before delegating to per-slot agent services. */
export type CopilotAgentService = {
  applyIntent(input: ApplyIntentInput & { contentType: ContentType }): Promise<AgentResult>;
  applyTransformIntent(
    input: ApplyTransformIntentInput & { contentType: ContentType }
  ): Promise<AgentResult>;
  applyAnalyzeIntent(
    input: ApplyAnalyzeIntentInput & { contentType: ContentType }
  ): Promise<AgentResult>;
  applyStyleIntent(input: ApplyStyleIntentInput): Promise<AgentResult>;
  runAgentStream(
    operation: AgentStreamOperation,
    payload: DiagramAgentStreamPayload,
    emit: AgentStreamEmit
  ): Promise<AgentResult>;
};

type SyncStoreResult =
  | { accepted: true; state: import('@archislop/shared').DiagramState }
  | { accepted: false; error?: string; styleConfig?: unknown };

type ApplyStoreResult =
  | { accepted: true; state: import('@archislop/shared').DiagramState; patch: unknown }
  | { accepted: false; error?: string };

type JsonRouteResult = {
  status: number;
  body: Record<string, unknown>;
};

type IntentHandlerDeps = {
  body: DiagramIntentBody;
  stateStore: DiagramStateStore;
  agentService: CopilotAgentService;
};

type TransformHandlerDeps = {
  body: DiagramTransformIntentBody;
  stateStore: DiagramStateStore;
  agentService: CopilotAgentService;
};

type AnalyzeHandlerDeps = {
  body: DiagramAnalyzeBody;
  stateStore: DiagramStateStore;
  agentService: CopilotAgentService;
};

type StyleHandlerDeps = {
  body: StyleIntentBody;
  stateStore: DiagramStateStore;
  agentService: CopilotAgentService;
};

type SyncHandlerDeps = {
  body: unknown;
  stateStore: DiagramStateStore;
};

type CopilotSessionServices = Pick<
  SessionServices,
  'sessionId' | 'stateStore' | 'proposalStore' | 'handshakeStore' | 'presenceStore' | 'eventBus'
> & {
  agentService: CopilotAgentService;
};

export type CreateCopilotRouterOptions = {
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
};

function safeErrorMessage(error: unknown): string {
  return redactSecrets(error instanceof Error ? error.message : String(error));
}

export async function handleDiagramIntent({
  body,
  stateStore,
  agentService
}: IntentHandlerDeps): Promise<JsonRouteResult> {
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
      peerContext: intent.peerContext,
      transformPersona: intent.transformPersona
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

export async function handleDiagramTransformIntent({
  body,
  stateStore,
  agentService
}: TransformHandlerDeps): Promise<JsonRouteResult> {
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
      goMadDepth: intent.goMadDepth,
      advisorPrompt: intent.advisorPrompt
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

export async function handleDiagramAnalyze({
  body,
  stateStore,
  agentService
}: AnalyzeHandlerDeps): Promise<JsonRouteResult> {
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
      modelProfile: intent.modelProfile,
      advisorPrompt: intent.advisorPrompt
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

export async function handleStyleIntent({
  body,
  stateStore,
  agentService
}: StyleHandlerDeps): Promise<JsonRouteResult> {
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
  if (intent.contentType !== 'mermaid' && intent.contentType !== 'chart') {
    return {
      status: 400,
      body: {
        error: 'Style intent is only supported for Mermaid diagrams and Vega-Lite charts.'
      }
    };
  }

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
    const agentResult = await agentService.applyStyleIntent({
      prompt: intent.stylePrompt || intent.prompt,
      settings: intent.settings,
      contentType: intent.contentType
    });
    const nextState = stateStore.getSlot(intent.contentType);
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

export async function handleClientStateSync({
  body,
  stateStore
}: SyncHandlerDeps): Promise<JsonRouteResult> {
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
    const rejected = synced as Extract<SyncStoreResult, { accepted: false }>;
    return {
      status: 422,
      body: {
        error: rejected.error ?? 'State sync rejected'
      }
    };
  }

  const accepted = synced as Extract<SyncStoreResult, { accepted: true }>;
  return {
    status: 200,
    body: accepted.state as unknown as Record<string, unknown>
  };
}

function resolveStateContentType(req: Request): ContentType | null {
  const candidate = req?.query?.contentType;
  const parsed = ContentTypeSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function writeSseData(res: Response, payload: unknown, eventId?: string | number | null) {
  if (eventId != null && eventId !== '') {
    res.write(`id: ${eventId}\n`);
  }
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function buildInvitePayload(
  req: Request,
  sessionId: string,
  pairingCodeStore: CreateCopilotRouterOptions['pairingCodeStore']
) {
  const base = resolvePublicBaseUrl(req);
  const stableMcpUrl = `${base}/mcp`;
  const pairingCode = pairingCodeStore.getOrCreateCode(sessionId);
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
}: CreateCopilotRouterOptions) {
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

    const abortController = new AbortController();
    const cleanup = () => {
      abortController.abort();
    };
    req.on('aborted', cleanup);
    res.on('close', cleanup);

    const rawEmit = (evt: LegacyStreamEvent | Record<string, unknown>) => {
      if (!res.destroyed) writeSseData(res, evt);
    };

    // AG-UI is the only wire shape for this route: first-paint RUN_STARTED +
    // STEP_STARTED, then createAgentStreamEmitter maps agent events into AG-UI.
    const ids = newRunIds();
    rawEmit(runStarted({ ...ids, parentRunId: undefined }));
    rawEmit(stepStarted({ stepName: 'planning' }));
    const emit = createAgentStreamEmitter({
      rawEmit: rawEmit as (evt: unknown) => void,
      threadId: ids.threadId,
      runId: ids.runId,
      contentType: payload.contentType,
      initialStep: 'planning'
    });

    try {
      await agentService.runAgentStream(
        payload.operation,
        { ...payload, _revisionBefore: revisionBefore, abortSignal: abortController.signal },
        emit as AgentStreamEmit
      );
    } catch (error) {
      const message = safeErrorMessage(error);
      rawEmit(runError({ message, code: undefined }));
    } finally {
      req.off?.('aborted', cleanup);
      res.off?.('close', cleanup);
    }

    if (!res.destroyed) res.end();
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
    const metaphor3dRevision = stateStore.getSlot('metaphor3d').revisionId;
    const chartRevision = stateStore.getSlot('chart').revisionId;
    const pending = proposalStore.listPending({
      currentRevisionByContentType: {
        mermaid: mermaidRevision,
        infographic: infographicRevision,
        metaphor3d: metaphor3dRevision,
        chart: chartRevision
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
        : rawHeader ?? (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery);
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

    // Initial snapshot so a freshly-mounted UI sees current presence + pending proposals
    // without an extra round-trip to /presence + /proposals.
    const mermaidRevision = stateStore.getSlot('mermaid').revisionId;
    const infographicRevision = stateStore.getSlot('infographic').revisionId;
    const metaphor3dRevision = stateStore.getSlot('metaphor3d').revisionId;
    const chartRevision = stateStore.getSlot('chart').revisionId;
    const pending = proposalStore.listPending({
      currentRevisionByContentType: {
        mermaid: mermaidRevision,
        infographic: infographicRevision,
        metaphor3d: metaphor3dRevision,
        chart: chartRevision
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
