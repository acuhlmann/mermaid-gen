import express from 'express';
import { z } from 'zod';
import { CoAuthorIntentSchema, DiagramIntentSchema } from '@mermaid-architect/shared';
import { LlmNotConfiguredError } from '../agents/mermaidLangChainAgent.js';

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
          message: agentResult.message,
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

const SyncClientStateSchema = z.object({
  mermaidSource: z.string().min(1)
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

  const synced = stateStore.syncClientMermaidSource({
    mermaidSource: parsed.data.mermaidSource
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

export function createCopilotRouter({ stateStore, agentService }) {
  const router = express.Router();

  router.get('/state', (_req, res) => {
    res.json(stateStore.getState());
  });

  router.post('/state', async (req, res) => {
    const result = await handleClientStateSync({
      body: req.body,
      stateStore
    });

    return res.status(result.status).json(result.body);
  });

  router.post('/intent', async (req, res) => {
    const result = await handleDiagramIntent({
      body: req.body,
      stateStore,
      agentService
    });

    return res.status(result.status).json(result.body);
  });

  router.post('/coauthor', async (req, res) => {
    const result = await handleCoAuthorIntent({
      body: req.body,
      stateStore,
      agentService
    });

    return res.status(result.status).json(result.body);
  });

  return router;
}
