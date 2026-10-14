import express from 'express';
import { z } from 'zod';
import { ANYTHING_HTML_MAX_LENGTH } from '@archislop/shared';
import { repairMermaidWithFixer, isSyntaxFixerAvailable } from '../agents/mermaidSyntaxFixer.js';
import {
  repairAnythingWithFixer,
  isAnythingSyntaxFixerAvailable
} from '../agents/anythingSyntaxFixer.js';
import { SESSION_HEADER } from '../state/sessionServices.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import { createApiRateLimitMiddleware } from '../middleware/apiRateLimit.js';
import { recordUxSignal } from '../metrics/uxSignalMetrics.js';

const MERMAID_SOURCE_MAX = 20_000;

// The Anything slot carries full HTML documents (up to ANYTHING_HTML_MAX_LENGTH),
// so the source cap is per content type. Parse against the larger ceiling, then
// enforce the tighter mermaid cap in the refine so a mermaid payload can't smuggle
// a 200 KB body past validation.
const RepairSchema = z
  .object({
    revisionId: z.number().int().nonnegative(),
    source: z.string().min(1).max(ANYTHING_HTML_MAX_LENGTH),
    renderError: z.string().min(1).max(2_000),
    contentType: z.enum(['mermaid', 'anything']).default('mermaid')
  })
  .superRefine((data, ctx) => {
    if (data.contentType === 'mermaid' && data.source.length > MERMAID_SOURCE_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: MERMAID_SOURCE_MAX,
        type: 'string',
        inclusive: true,
        path: ['source'],
        message: `Mermaid source too large (max ${MERMAID_SOURCE_MAX} chars).`
      });
    }
  });

function safeErrorMessage(error) {
  return redactSecrets(error instanceof Error ? error.message : String(error));
}

/**
 * Render-error feedback loop: the browser-side renderer can fail on sources that pass the
 * server's static validation — Mermaid render failures (invalid theme names in `%%{init}%%`,
 * bad linkStyle indices, runtime layout errors) and Anything load-phase iframe errors (an
 * uncaught exception the jsdom runtime check didn't reproduce). When the client surfaces such
 * an error, this endpoint asks the cheap syntax-fixer model to repair it and applies the patch
 * through the same state-store pipeline as the agent (the Anything apply re-runs the full
 * ladder, including the runtime check, so no gate is bypassed).
 *
 * Returns `{repaired: true, state}` on success, `{repaired: false, error?}` otherwise.
 *
 * Concurrency safety: only repairs when the posted `source` still matches what the state store
 * holds (i.e., neither the user nor a fresh agent run has moved the diagram on).
 */
export function createDiagramRepairRouter({
  resolveServices,
  env = process.env,
  /** Test seam: replace the mermaid syntax-fixer call entirely (tests inject a fake here). */
  repairImpl = repairMermaidWithFixer,
  /** Test seam: replace the mermaid availability check so tests don't need real LLM env vars. */
  isFixerAvailable = isSyntaxFixerAvailable,
  /** Test seam: replace the anything syntax-fixer call. */
  repairAnythingImpl = repairAnythingWithFixer,
  /** Test seam: replace the anything availability check. */
  isAnythingFixerAvailable = isAnythingSyntaxFixerAvailable,
  /** Test seam: where each outcome's content-free `render_repair` signal goes (ADR-0019). */
  recordSignal = recordUxSignal
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

    const { revisionId, source, renderError, contentType } = parsed.data;
    /** Every outcome past validation records one `render_repair` signal as it responds. */
    const reply = (outcome, status, body) => {
      recordSignal({ kind: 'render_repair', contentType, outcome });
      return res.status(status).json(body);
    };
    const fixer = contentType === 'anything' ? repairAnythingImpl : repairImpl;
    const fixerAvailable = contentType === 'anything' ? isAnythingFixerAvailable : isFixerAvailable;

    if (!fixerAvailable(env)) {
      return reply('unavailable', 503, {
        repaired: false,
        error: 'Syntax fixer model is not configured on this server.'
      });
    }

    const slot = stateStore.getSlot(contentType);
    if (slot.revisionId !== revisionId || slot.diagramSource.trim() !== source.trim()) {
      // Slot already moved on (user typed, or another agent run committed).
      // Don't touch state — just tell the client to drop its repair intent.
      return reply('stale', 200, { repaired: false, reason: 'stale', state: slot });
    }

    let fixerOutcome;
    try {
      fixerOutcome = await fixer({
        brokenSource: source,
        parseError: `Browser render error: ${renderError}`,
        env
      });
    } catch (error) {
      return reply('error', 502, { repaired: false, error: safeErrorMessage(error) });
    }

    if (!fixerOutcome?.accepted || !fixerOutcome.diagramSource) {
      return reply('failed', 200, {
        repaired: false,
        error: fixerOutcome?.error || 'Fixer could not repair the document.'
      });
    }

    // Re-check the slot right before applying, in case state moved during the LLM call.
    const slotAfter = stateStore.getSlot(contentType);
    if (slotAfter.revisionId !== revisionId) {
      return reply('stale', 200, { repaired: false, reason: 'stale', state: slotAfter });
    }

    let applied;
    try {
      applied = await stateStore.applyDiagramSource({
        contentType,
        diagramSource: fixerOutcome.diagramSource,
        reason: 'render-error repair'
      });
    } catch (error) {
      return reply('error', 500, { repaired: false, error: safeErrorMessage(error) });
    }

    if (!applied?.accepted) {
      return reply('rejected', 200, {
        repaired: false,
        error: applied?.error || 'State store rejected the repair candidate.'
      });
    }

    return reply('repaired', 200, {
      repaired: true,
      state: applied.state ?? stateStore.getSlot(contentType)
    });
  });

  return router;
}
