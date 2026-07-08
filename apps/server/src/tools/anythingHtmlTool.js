import {
  DiagramPatchSchema,
  lintAnythingPolicy,
  lintAnythingQuality,
  parseAnythingHtml
} from '@archislop/shared';
import { isAnythingRuntimeCheckEnabled, runAnythingRuntimeCheck } from './anythingRuntimeCheck.js';

/**
 * Validation for the `anything` slot (freeform HTML/CSS/JS).
 *
 * Deterministic checks: shape, security policy, structure/JS/CSS quality —
 * then a runtime check that executes the page's scripts in an isolated jsdom
 * child process (anythingRuntimeCheck.js) and rejects uncaught errors, hangs,
 * and blank renders. Safety at render time is enforced by the sandboxed
 * iframe + CSP in AnythingRenderer.jsx — the server does not strip scripts or
 * styles.
 *
 * `runtimeCheck: false` skips the runtime layer. Used for client sync, where
 * the user is looking at the live document and rejecting their in-progress
 * edits (or the broken source an auto-fix is about to repair) would block the
 * flow. Agent patches always run it.
 */
export async function validateAndPrepareAnythingPatch({
  currentState,
  proposedDiagramSource,
  reason,
  runtimeCheck = true,
  env = process.env,
  runtimeCheckImpl = runAnythingRuntimeCheck
}) {
  const parsed = parseAnythingHtml(proposedDiagramSource);
  if (!parsed.ok) {
    return { accepted: false, error: parsed.error };
  }

  const policy = lintAnythingPolicy(parsed.text);
  if (!policy.ok) {
    return { accepted: false, error: policy.error, code: policy.code };
  }

  const quality = lintAnythingQuality(parsed.text);
  if (!quality.ok) {
    return { accepted: false, error: quality.error, code: quality.code };
  }

  let runtimeWarnings = [];
  let runtimeChecked = false;
  if (runtimeCheck && isAnythingRuntimeCheckEnabled(env)) {
    const runtime = await runtimeCheckImpl(parsed.text, { env });
    if (!runtime.ok) {
      return { accepted: false, error: runtime.error, code: runtime.code };
    }
    runtimeWarnings = runtime.warnings ?? [];
    runtimeChecked = !runtime.skipped;
  }

  const patch = DiagramPatchSchema.parse({
    previousRevisionId: currentState.revisionId,
    nextRevisionId: currentState.revisionId + 1,
    diagramSource: parsed.text,
    styleConfig: null,
    contentType: 'anything',
    reason: reason || 'Agent update'
  });

  return {
    accepted: true,
    patch,
    metadata: {
      validator: 'anything-html',
      warnings: [...quality.warnings, ...runtimeWarnings],
      quality: quality.quality,
      runtimeChecked
    }
  };
}

/**
 * Static-only validation (no runtime check) used by the single-shot syntax
 * fixer to vet its candidate cheaply; the store apply that follows re-runs
 * the full ladder including the runtime layer.
 */
export function validateAnythingStrict(source) {
  const parsed = parseAnythingHtml(source);
  if (!parsed.ok) {
    return { valid: false, error: parsed.error, validator: 'anything-html-shape' };
  }

  const policy = lintAnythingPolicy(parsed.text);
  if (!policy.ok) {
    return {
      valid: false,
      error: policy.error,
      validator: 'anything-html-policy',
      code: policy.code
    };
  }

  const quality = lintAnythingQuality(parsed.text);
  if (!quality.ok) {
    return {
      valid: false,
      error: quality.error,
      validator: 'anything-html-quality',
      code: quality.code
    };
  }

  return {
    valid: true,
    diagramSource: parsed.text,
    validator: 'anything-html',
    warnings: quality.warnings,
    quality: quality.quality
  };
}
