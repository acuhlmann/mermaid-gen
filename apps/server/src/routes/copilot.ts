import express, { type Request, type Response } from 'express';
import type {
  AgentStreamEmit,
  DiagramAgentStreamPayload,
  LegacyStreamEvent
} from '@archislop/shared';
import {
  AgentStreamPayloadSchema,
  ContentTypeSchema,
  AGUI_CUSTOM_NAME_HEARTBEAT,
  createAgentStreamEmitter,
  customEvent,
  newRunIds,
  runStarted,
  runError,
  stepStarted
} from '@archislop/shared';
import { resolveAutoIntentContentType } from './resolveAutoContentType.js';
import {
  SESSION_HEADER,
  resolveSessionIdFromRequest,
  type SessionServices
} from '../state/sessionServices.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import { type PairingCodeStore } from '../state/pairingCodeStore.js';
import {
  apiLlmRateLimitIfNeeded,
  createApiRateLimitMiddleware
} from '../middleware/apiRateLimit.js';
import type { DiagramStateStore } from '../state/diagramStateStore.js';
import type { SessionEventEnvelope } from '../state/sessionEventBus.js';
import type { CopilotAgentService } from './copilotRouteTypes.js';
import {
  handleClientStateSync,
  handleDiagramAnalyze,
  handleDiagramIntent,
  handleDiagramTransformIntent,
  handleStyleIntent
} from './copilotDiagramHandlers.js';
import {
  registerCopilotCollaborationRoutes,
  writeCopilotSseData
} from './copilotCollaborationRoutes.js';
import { handleUserDiagramEdit, resolveStateContentType } from './copilotUserEdit.js';

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

/**
 * Wire an AbortController to the response lifecycle for a blocking REST agent run.
 * Express fires `close` on normal completion too, so only a close BEFORE the response
 * finished (`!res.writableEnded`) is treated as a client disconnect worth aborting —
 * otherwise an abandoned tab would keep the agent burning its full repair budget to the
 * deadline. `dispose()` detaches the listener once the handler has responded.
 */
function createRestAbortSignal(res: Response): { abortSignal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const onClose = () => {
    if (!res.writableEnded) controller.abort();
  };
  res.on('close', onClose);
  return {
    abortSignal: controller.signal,
    dispose: () => {
      res.off?.('close', onClose);
    }
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

  router.post('/user-edit', async (req, res) => {
    const { sessionId, stateStore } = resolveServices(req);
    const result = await handleUserDiagramEdit({
      body: req.body,
      stateStore
    });

    res.setHeader(SESSION_HEADER, sessionId);
    return res.status(result.status).json(result.body);
  });

  router.post('/intent', async (req, res) => {
    const { sessionId, stateStore, agentService } = resolveServices(req);
    const { abortSignal, dispose } = createRestAbortSignal(res);
    try {
      const result = await handleDiagramIntent({
        body: req.body,
        stateStore,
        agentService,
        abortSignal
      });

      res.setHeader(SESSION_HEADER, sessionId);
      return res.status(result.status).json(result.body);
    } finally {
      dispose();
    }
  });

  router.post('/transform', async (req, res) => {
    const { sessionId, stateStore, agentService } = resolveServices(req);
    const { abortSignal, dispose } = createRestAbortSignal(res);
    try {
      const result = await handleDiagramTransformIntent({
        body: req.body,
        stateStore,
        agentService,
        abortSignal
      });

      res.setHeader(SESSION_HEADER, sessionId);
      return res.status(result.status).json(result.body);
    } finally {
      dispose();
    }
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

  // Keep-alive cadence for /agent-stream. The web client aborts after 60s of
  // event silence (AGENT_STREAM_IDLE_TIMEOUT_MS in diagramStore.js) — 15s gives
  // a 4x margin.
  const AGENT_STREAM_HEARTBEAT_MS = 15_000;

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
    const requestedAuto = payload.operation === 'intent' && payload.contentType === 'auto';

    // Auto is intent-only on the wire; transform/analyze schemas reject it.
    if (requestedAuto && payload.operation === 'intent') {
      // Open the SSE stream before classification so the client gets the
      // content_type event and heartbeats during the classifier call.
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
        if (!res.destroyed) writeCopilotSseData(res, evt);
      };

      const PLANNING_STEP = 'planning\x1fPlanning the approach…';
      const ids = newRunIds();
      rawEmit(runStarted({ ...ids, parentRunId: undefined }));
      rawEmit(stepStarted({ stepName: PLANNING_STEP }));

      const heartbeat = setInterval(() => {
        rawEmit(customEvent({ name: AGUI_CUSTOM_NAME_HEARTBEAT, value: { ts: Date.now() } }));
      }, AGENT_STREAM_HEARTBEAT_MS);
      heartbeat.unref?.();

      try {
        const resolved = await resolveAutoIntentContentType({
          payload,
          getSlot: (contentType) => stateStore.getSlot(contentType),
          abortSignal: abortController.signal,
          onResolved: (evt) => rawEmit(evt)
        });

        const state = stateStore.getSlot(resolved.contentType);
        const revisionBefore = state.revisionId;
        const streamPayload = {
          ...resolved,
          revisionId: state.revisionId,
          diagramSource: state.diagramSource,
          _revisionBefore: revisionBefore,
          abortSignal: abortController.signal
        } as DiagramAgentStreamPayload;

        const emit = createAgentStreamEmitter({
          rawEmit: rawEmit as (evt: unknown) => void,
          threadId: ids.threadId,
          runId: ids.runId,
          contentType: resolved.contentType,
          initialStep: PLANNING_STEP
        });

        await agentService.runAgentStream('intent', streamPayload, emit as AgentStreamEmit);
      } catch (error) {
        const message = safeErrorMessage(error);
        rawEmit(runError({ message, code: undefined }));
      } finally {
        clearInterval(heartbeat);
        req.off?.('aborted', cleanup);
        res.off?.('close', cleanup);
      }

      if (!res.destroyed) res.end();
      return undefined;
    }

    const concreteContentType = ContentTypeSchema.parse(payload.contentType);
    const state = stateStore.getSlot(concreteContentType);
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
      if (!res.destroyed) writeCopilotSseData(res, evt);
    };

    // AG-UI is the only wire shape for this route: first-paint RUN_STARTED +
    // STEP_STARTED, then createAgentStreamEmitter maps agent events into AG-UI.
    // The step name uses the emitter's `id\x1flabel` encoding so the Thinking
    // timeline renders a readable label instead of the raw step id; the same
    // string must be passed as initialStep so STEP_FINISHED pairs verbatim.
    const PLANNING_STEP = 'planning\x1fPlanning the approach…';
    const ids = newRunIds();
    rawEmit(runStarted({ ...ids, parentRunId: undefined }));
    rawEmit(stepStarted({ stepName: PLANNING_STEP }));
    const emit = createAgentStreamEmitter({
      rawEmit: rawEmit as (evt: unknown) => void,
      threadId: ids.threadId,
      runId: ids.runId,
      contentType: concreteContentType,
      initialStep: PLANNING_STEP
    });

    // Route-level keep-alive: the agent-level heartbeats ("Thinking…" during
    // streaming turns, invoke keepalive during blocking turns) don't cover every
    // quiet window — syntax-fixer model calls and lazy-agent cold start emit
    // nothing. The client kills the stream after 60s of event silence, so cover
    // the whole run here. SSE comment lines won't do: the client's idle timer
    // resets per decoded AG-UI event, hence a real CUSTOM event.
    const heartbeat = setInterval(() => {
      rawEmit(customEvent({ name: AGUI_CUSTOM_NAME_HEARTBEAT, value: { ts: Date.now() } }));
    }, AGENT_STREAM_HEARTBEAT_MS);
    heartbeat.unref?.();

    try {
      await agentService.runAgentStream(
        payload.operation,
        {
          ...payload,
          contentType: concreteContentType,
          _revisionBefore: revisionBefore,
          abortSignal: abortController.signal
        } as DiagramAgentStreamPayload,
        emit as AgentStreamEmit
      );
    } catch (error) {
      const message = safeErrorMessage(error);
      rawEmit(runError({ message, code: undefined }));
    } finally {
      clearInterval(heartbeat);
      req.off?.('aborted', cleanup);
      res.off?.('close', cleanup);
    }

    if (!res.destroyed) res.end();
    return undefined;
  });

  router.post('/style', async (req, res) => {
    const { sessionId, stateStore, agentService } = resolveServices(req);
    const { abortSignal, dispose } = createRestAbortSignal(res);
    try {
      const result = await handleStyleIntent({
        body: req.body,
        stateStore,
        agentService,
        abortSignal
      });

      res.setHeader(SESSION_HEADER, sessionId);
      return res.status(result.status).json(result.body);
    } finally {
      dispose();
    }
  });

  registerCopilotCollaborationRoutes(router, {
    resolveServices,
    sessionExists,
    pairingCodeStore,
    agentTokenStore,
    sessionRegistry,
    joinRateLimit
  });

  return router;
}
