import express from 'express';
import { applyPatch, createInitialDiagramState, DiagramIntentSchema } from '@mermaid-architect/shared';
import { validateAndPreparePatch } from '../tools/mermaidDiffTool.js';

export function createCopilotRouter() {
  const router = express.Router();
  let state = createInitialDiagramState();

  router.get('/state', (_req, res) => {
    res.json(state);
  });

  router.post('/intent', async (req, res) => {
    const parsedIntent = DiagramIntentSchema.safeParse(req.body);
    if (!parsedIntent.success) {
      return res.status(400).json({
        error: 'Invalid intent payload',
        details: parsedIntent.error.flatten()
      });
    }

    const intent = parsedIntent.data;
    if (intent.revisionId !== state.revisionId) {
      return res.status(409).json({
        error: 'State revision is stale. Refresh state and retry.',
        state
      });
    }

    // Placeholder for CopilotKit model output; deterministic patch for bootstrap.
    const addition = `\n  Note_${state.revisionId + 1}[${intent.prompt.slice(0, 40)}]`;
    const nextSource = `${intent.mermaidSource}${addition}`;

    const prepared = await validateAndPreparePatch({
      currentState: state,
      proposedMermaidSource: nextSource,
      reason: `Prompted update (temperature=${intent.temperature})`
    });

    if (!prepared.accepted) {
      return res.status(422).json({
        error: prepared.error
      });
    }

    const applied = applyPatch(state, prepared.patch);
    if (!applied.accepted) {
      return res.status(409).json({ error: applied.error });
    }

    state = applied.state;

    return res.json({
      message: 'Patch accepted',
      patch: prepared.patch,
      state,
      metadata: prepared.metadata
    });
  });

  return router;
}
