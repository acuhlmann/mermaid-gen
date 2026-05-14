import express from 'express';
import { z } from 'zod';
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
import { SESSION_HEADER } from '../state/sessionServices.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import {
  createAgUiEmit,
  newRunIds,
  runStarted,
  runError,
  stepStarted
} from '../agents/agUiEvents.js';

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
      modelProfile: intent.modelProfile
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

    return {
      status: 200,
      body: {
        message: agentResult.message || 'Patch accepted',
        patch,
        state: nextState,
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

function writeSseData(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function createCopilotRouter({ resolveServices }) {
  const router = express.Router();

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
    const useAgUi = req.query?.protocol === 'agui';

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const rawEmit = (evt) => writeSseData(res, evt);

    // First-paint: emit RUN_STARTED + an initial STEP_STARTED immediately so
    // the client can show feedback before the (lazy) agent service warms up.
    let emit;
    let ids = null;
    if (useAgUi) {
      ids = newRunIds();
      rawEmit(runStarted(ids));
      rawEmit(stepStarted({ stepName: 'planning' }));
      emit = createAgUiEmit({
        rawEmit,
        threadId: ids.threadId,
        runId: ids.runId,
        contentType: payload.contentType
      });
    } else {
      emit = rawEmit;
    }

    try {
      await agentService.runAgentStream(payload.operation, { ...payload, _revisionBefore: revisionBefore }, emit);
      if (!useAgUi) {
        writeSseData(res, { type: 'done' });
      }
    } catch (error) {
      const message = safeErrorMessage(error);
      if (useAgUi && ids) {
        rawEmit(runError({ message }));
      } else {
        if (error instanceof LlmNotConfiguredError) {
          writeSseData(res, { type: 'error', message });
        } else {
          writeSseData(res, { type: 'error', message });
        }
        writeSseData(res, { type: 'done' });
      }
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

  return router;
}
