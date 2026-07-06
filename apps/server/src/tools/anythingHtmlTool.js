import { DiagramPatchSchema, parseAnythingHtml } from '@archislop/shared';

/**
 * Validation for the `anything` slot (freeform HTML/CSS/JS).
 *
 * Deterministic checks only — there is no DSL to parse and browsers accept
 * almost any markup, so a strict parser here would reject documents that
 * render fine. Safety is enforced at render time: the web client renders this
 * slot exclusively inside a sandboxed iframe (see AnythingRenderer.jsx), so
 * the server intentionally does NOT try to sanitize scripts or styles out of
 * the document.
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
      validator: 'anything-html-shape',
      warnings: []
    }
  };
}

export function validateAnythingStrict(source) {
  const parsed = parseAnythingHtml(source);
  if (!parsed.ok) {
    return { valid: false, error: parsed.error, validator: 'anything-html-shape' };
  }
  return { valid: true, diagramSource: parsed.text, validator: 'anything-html-shape' };
}
