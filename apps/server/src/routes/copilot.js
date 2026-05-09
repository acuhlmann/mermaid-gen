import express from 'express';
import { DiagramIntentSchema } from '@mermaid-architect/shared';
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
      temperature: intent.temperature
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
          llm: true
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

export function createCopilotRouter({ stateStore, agentService }) {
  const router = express.Router();

  router.get('/state', (_req, res) => {
    res.json(stateStore.getState());
  });

  router.post('/intent', async (req, res) => {
    const result = await handleDiagramIntent({
      body: req.body,
      stateStore,
      agentService
    });

    return res.status(result.status).json(result.body);
  });

  return router;
}
