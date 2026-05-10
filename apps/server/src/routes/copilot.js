import express from 'express';
import { z } from 'zod';
import { CoAuthorIntentSchema, DiagramIntentSchema, DiagramStyleSchema, StyleIntentSchema } from '@mermaid-architect/shared';
import { LlmNotConfiguredError } from '../agents/mermaidLangChainAgent.js';
import { SESSION_HEADER } from '../state/sessionServices.js';

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
  const state = stateStore.getState();
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
      prompt: intent.prompt,
      settings: intent.settings
    });
    const nextState = stateStore.getState();
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
          agent: 'intent'
        }
      }
    };
  } catch (error) {
    if (error instanceof LlmNotConfiguredError) {
      return {
        status: error.statusCode,
        body: { error: error.message }
      };
    }

    return {
      status: 500,
      body: {
        error: 'Agent request failed',
        details: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

export async function handleCoAuthorIntent({ body, stateStore, agentService }) {
  const parsedIntent = CoAuthorIntentSchema.safeParse(body);
  if (!parsedIntent.success) {
    return {
      status: 400,
      body: {
        error: 'Invalid co-author payload',
        details: parsedIntent.error.flatten()
      }
    };
  }

  const intent = parsedIntent.data;
  const state = stateStore.getState();
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
    const agentResult = await agentService.applyCoAuthorIntent({
      prompt: intent.prompt,
      settings: intent.settings
    });
    const nextState = stateStore.getState();
    const patch = nextState.history.at(-1);

    if (nextState.revisionId === state.revisionId || !patch) {
      return {
        status: 422,
        body: {
          error: 'Co-author did not apply a diagram patch.',
          message: 'The co-author returned text instead of a valid diagram update. Please try again with a lower surprise level or a simpler diagram.',
          state: nextState
        }
      };
    }

    return {
      status: 200,
      body: {
        message: agentResult.message || 'Co-author patch accepted',
        patch,
        state: nextState,
        metadata: {
          llm: true,
          agent: 'coauthor'
        }
      }
    };
  } catch (error) {
    if (error instanceof LlmNotConfiguredError) {
      return {
        status: error.statusCode,
        body: { error: error.message }
      };
    }

    return {
      status: 500,
      body: {
        error: 'Co-author request failed',
        details: error instanceof Error ? error.message : String(error)
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
  const state = stateStore.getState();
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
    const nextState = stateStore.getState();
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
          agent: 'style'
        }
      }
    };
  } catch (error) {
    if (error instanceof LlmNotConfiguredError) {
      return {
        status: error.statusCode,
        body: { error: error.message }
      };
    }

    return {
      status: 500,
      body: {
        error: 'Style request failed',
        details: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

const SyncClientStateSchema = z.object({
  mermaidSource: z.string().min(1),
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

  const synced = await stateStore.syncClientMermaidSource({
    mermaidSource: parsed.data.mermaidSource,
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

export function createCopilotRouter({ resolveServices }) {
  const router = express.Router();

  router.get('/state', (req, res) => {
    const { sessionId, stateStore } = resolveServices(req);
    res.setHeader(SESSION_HEADER, sessionId);
    res.json(stateStore.getState());
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

  router.post('/coauthor', async (req, res) => {
    const { sessionId, stateStore, agentService } = resolveServices(req);
    const result = await handleCoAuthorIntent({
      body: req.body,
      stateStore,
      agentService
    });

    res.setHeader(SESSION_HEADER, sessionId);
    return res.status(result.status).json(result.body);
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
