import { DiagramPatchSchema, sanitizeMetaphorDsl } from '@archislop/shared';

function stripJsonCodeFence(raw) {
  const text = String(raw ?? '')
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .trim();
  const applied = [];
  const fenced = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  if (fenced) {
    applied.push('strip-code-fence');
    return { text: fenced[1].trim(), applied };
  }
  return { text, applied };
}

export async function validateAndPrepareMetaphorPatch({
  currentState,
  proposedDiagramSource,
  reason
}) {
  if (typeof proposedDiagramSource !== 'string') {
    return { accepted: false, error: 'Metaphor DSL must be a string of JSON.' };
  }

  const fence = stripJsonCodeFence(proposedDiagramSource);
  const sanitized = sanitizeMetaphorDsl(fence.text, { allowStructureRewrite: true });
  const sanitizerApplied = [...fence.applied, ...sanitized.applied];

  if (!sanitized.dsl) {
    // Relay the sanitizer's root-cause diagnostic verbatim (JSON.parse message or per-field
    // Zod issues) — the fixer and repair prompts need to see WHICH field failed.
    return {
      accepted: false,
      error: `${
        sanitized.error ?? 'Metaphor DSL did not parse.'
      } Emit a JSON object: {"metaphor":"city|layercake|galaxy|tree|terrain|orrery|river|garden|archipelago","scene":{...},"items":[...]}.`
    };
  }

  const diagramSource = sanitized.text;

  const patch = DiagramPatchSchema.parse({
    previousRevisionId: currentState.revisionId,
    nextRevisionId: currentState.revisionId + 1,
    diagramSource,
    styleConfig: null,
    contentType: 'metaphor3d',
    reason: reason || 'Agent update'
  });

  return {
    accepted: true,
    patch,
    metadata: {
      validator: 'metaphor-zod',
      metaphor: sanitized.dsl.metaphor,
      warnings: [],
      sanitizerApplied
    }
  };
}

export function validateMetaphorStrict(source) {
  if (typeof source !== 'string') {
    return { valid: false, error: 'Metaphor DSL must be a string.', validator: 'metaphor-type' };
  }
  const fence = stripJsonCodeFence(source);
  const sanitized = sanitizeMetaphorDsl(fence.text, { allowStructureRewrite: false });
  if (!sanitized.dsl) {
    return {
      valid: false,
      error: sanitized.error ?? 'Metaphor DSL did not parse as a valid Zod discriminated union.',
      validator: 'metaphor-zod'
    };
  }
  return {
    valid: true,
    diagramSource: sanitized.text,
    metaphor: sanitized.dsl.metaphor,
    validator: 'metaphor-zod'
  };
}
