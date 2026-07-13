import { DiagramPatchSchema, parseFormsA2ui } from '@archislop/shared';

/**
 * Forms mode validation gate. The forms slot stores a **model-authored** A2UI
 * v0.9 document (JSON). Unlike the critique checklist — where the server builds
 * A2UI deterministically from Markdown — here the model writes the UI JSON, so
 * `parseFormsA2ui` (shared) is the whole trust boundary: it parses the JSON,
 * enforces the basic-catalog allowlist, the component/action allowlists, the
 * single-capability action rule, and the size/count caps, and normalizes every
 * surfaceId to the fixed forms surface id.
 *
 * There is deliberately no A2UI runtime here (that would pull `@a2ui/web_core`
 * into the server); the client's MessageProcessor is the render-time check, the
 * same way chart's shared parser precedes the vega-lite compile gate.
 */
export async function validateAndPrepareFormsPatch({
  currentState,
  proposedDiagramSource,
  reason
}) {
  if (typeof proposedDiagramSource !== 'string') {
    return { accepted: false, error: 'Forms document must be a string of JSON.' };
  }

  const parsed = parseFormsA2ui(proposedDiagramSource);
  if (!parsed.ok) {
    return { accepted: false, error: parsed.error };
  }

  const patch = DiagramPatchSchema.parse({
    previousRevisionId: currentState.revisionId,
    nextRevisionId: currentState.revisionId + 1,
    diagramSource: parsed.text,
    styleConfig: null,
    contentType: 'forms',
    reason: reason || 'Agent update'
  });

  return {
    accepted: true,
    patch,
    metadata: {
      validator: 'forms-a2ui-allowlist',
      formTitle: parsed.doc.formTitle,
      formCode: parsed.doc.formCode ?? null,
      ...parsed.meta,
      warnings: []
    }
  };
}

/** Strict boolean gate for benches/tests. */
export function validateFormsStrict(source) {
  if (typeof source !== 'string') {
    return { valid: false, error: 'Forms document must be a string.', validator: 'forms-type' };
  }
  const parsed = parseFormsA2ui(source);
  if (!parsed.ok) {
    return { valid: false, error: parsed.error, validator: 'forms-a2ui-allowlist' };
  }
  return {
    valid: true,
    diagramSource: parsed.text,
    formTitle: parsed.doc.formTitle,
    validator: 'forms-a2ui-allowlist'
  };
}
