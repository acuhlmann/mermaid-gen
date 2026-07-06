import { DiagramPatchSchema, lintAnythingPolicy, lintAnythingQuality, parseAnythingHtml } from '@archislop/shared';

/**
 * Validation for the `anything` slot (freeform HTML/CSS/JS).
 *
 * Deterministic checks: shape, security policy, structure/JS/CSS quality.
 * Safety at render time is enforced by the sandboxed iframe + CSP in
 * AnythingRenderer.jsx — the server does not strip scripts or styles.
 */
export async function validateAndPrepareAnythingPatch({
  currentState,
  proposedDiagramSource,
  reason
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
      warnings: quality.warnings,
      quality: quality.quality
    }
  };
}

export function validateAnythingStrict(source) {
  const parsed = parseAnythingHtml(source);
  if (!parsed.ok) {
    return { valid: false, error: parsed.error, validator: 'anything-html-shape' };
  }

  const policy = lintAnythingPolicy(parsed.text);
  if (!policy.ok) {
    return { valid: false, error: policy.error, validator: 'anything-html-policy', code: policy.code };
  }

  const quality = lintAnythingQuality(parsed.text);
  if (!quality.ok) {
    return { valid: false, error: quality.error, validator: 'anything-html-quality', code: quality.code };
  }

  return {
    valid: true,
    diagramSource: parsed.text,
    validator: 'anything-html',
    warnings: quality.warnings,
    quality: quality.quality
  };
}
