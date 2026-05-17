import express from 'express';
import { z } from 'zod';
import { repairMermaidWithFixer, isSyntaxFixerAvailable } from '../agents/mermaidSyntaxFixer.js';
import { SESSION_HEADER } from '../state/sessionServices.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import { createApiRateLimitMiddleware } from '../middleware/apiRateLimit.js';

const RepairSchema = z.object({
  revisionId: z.number().int().nonnegative(),
  source: z.string().min(1).max(20_000),
  renderError: z.string().min(1).max(2_000)
});

function safeErrorMessage(error) {
  return redactSecrets(error instanceof Error ? error.message : String(error));
}

/**
 * Render-error feedback loop: the browser-side Mermaid renderer can fail on sources that pass
 * the server's `mermaid.parse()` check (e.g. invalid theme names in `%%{init}%%`, bad linkStyle
 * indices, runtime layout errors). When the client surfaces such an error, this endpoint asks
 * the cheap syntax-fixer model to repair it and applies the patch through the same state-store
 * pipeline as the agent.
 *
 * Returns `{repaired: true, state}` on success, `{repaired: false, error?}` otherwise.
 *
 * Concurrency safety: only repairs when the posted `source` still matches what the state store
 * holds (i.e., neither the user nor a fresh agent run has moved the diagram on).
 */
export function createDiagramRepairRouter({
  resolveServices,
  env = process.env,
  /** Test seam: replace the syntax-fixer call entirely (tests inject a fake here). */
  repairImpl = repairMermaidWithFixer,
  /** Test seam: replace the availability check so tests don't need real LLM env vars. */
  isFixerAvailable = isSyntaxFixerAvailable
} = {}) {
  if (typeof resolveServices !== 'function') {
    throw new Error('createDiagramRepairRouter requires resolveServices');
  }

  const router = express.Router();
  router.use(createApiRateLimitMiddleware('llm'));

  router.post('/render-error', async (req, res) => {
    const { sessionId, stateStore } = resolveServices(req);
    res.setHeader(SESSION_HEADER, sessionId);

    const parsed = RepairSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        repaired: false,
        error: 'Invalid repair payload',
        details: parsed.error.flatten()
      });
    }

    const { revisionId, source, renderError } = parsed.data;

    if (!isFixerAvailable(env)) {
      return res.status(503).json({
        repaired: false,
        error: 'Syntax fixer model is not configured on this server.'
      });
    }

    const slot = stateStore.getSlot('mermaid');
    if (slot.revisionId !== revisionId || slot.diagramSource.trim() !== source.trim()) {
      // Diagram already moved on (user typed, or another agent run committed).
      // Don't touch state — just tell the client to drop its repair intent.
      return res.status(200).json({ repaired: false, reason: 'stale', state: slot });
    }

    let fixerOutcome;
    try {
      fixerOutcome = await repairImpl({
        brokenSource: source,
        parseError: `Browser render error: ${renderError}`,
        env
      });
    } catch (error) {
      return res.status(502).json({ repaired: false, error: safeErrorMessage(error) });
    }

    if (!fixerOutcome?.accepted || !fixerOutcome.diagramSource) {
      return res
        .status(200)
        .json({ repaired: false, error: fixerOutcome?.error || 'Fixer could not repair the diagram.' });
    }

    // Re-check the slot right before applying, in case state moved during the LLM call.
    const slotAfter = stateStore.getSlot('mermaid');
    if (slotAfter.revisionId !== revisionId) {
      return res.status(200).json({ repaired: false, reason: 'stale', state: slotAfter });
    }

    let applied;
    try {
      applied = await stateStore.applyDiagramSource({
        contentType: 'mermaid',
        diagramSource: fixerOutcome.diagramSource,
        reason: 'render-error repair'
      });
    } catch (error) {
      return res.status(500).json({ repaired: false, error: safeErrorMessage(error) });
    }

    if (!applied?.accepted) {
      return res
        .status(200)
        .json({ repaired: false, error: applied?.error || 'State store rejected the repair candidate.' });
    }

    return res.status(200).json({ repaired: true, state: applied.state ?? stateStore.getSlot('mermaid') });
  });

  return router;
}
