import { METAPHOR_SYSTEM_PROMPT } from './metaphorSystemPrompt.js';

export const METAPHOR_RULE_PACK = METAPHOR_SYSTEM_PROMPT;

export const METAPHOR_SELF_CHECK = `Self-check before calling apply_metaphor_patch:
- Valid JSON object (no trailing commas, double-quoted keys/strings).
- "metaphor" is exactly "city", "layercake", "galaxy", "tree", or "terrain".
- Every item has unique "id" (kebab-case) and non-empty "label".
- City items: numeric height and footprint; meaningful district when >6 items. Optional lighting (lit/dim/dark), condition (new/aging/crumbling).
- Layercake items: thickness + components[]. Optional cracks (0-1) and tilt (0-15).
- Galaxy items: magnitude; meaningful cluster when >6 items. Optional binary (id of paired star). Scene may include nebula[].
- Tree items: optional parent (id of another item); items without parent are roots. weight (1-20) controls branch thickness.
- Terrain items: elevation (-10..20) and intensity (0.1..10). Optional scene.surface = { metric, baseline }.
- "links" is an array (may be empty). Each link has "from" and "to" ids that exist in items; optional "label"; optional "kind" (flow/dependency/ownership).
- Optional item "note": a short string (≤ 140 chars) shown on hover.
- Optional item "position": [x,y,z] with numbers in −30…30.
- scene.title and scene.subtitle are set; scene.legend.<axis> is set for every encoding axis used (these render as visible overlays — do not leave them empty).
- scene.theme is whiteboard|noir|arcade|blueprint; scene.camera is orbit|isometric|cinematic when present.`;

/**
 * Build repair instructions after a failed metaphor patch tool call.
 */
export function buildMetaphorRepairInstruction({ errorMessage, brokenSource, originalRequest }) {
  const previous =
    brokenSource && brokenSource.trim()
      ? `PREVIOUS ATTEMPT (failed)
\`\`\`json
${brokenSource}
\`\`\`

`
      : '';
  const intent =
    typeof originalRequest === 'string' && originalRequest.trim()
      ? `ORIGINAL USER REQUEST (for intent only — do not echo):
${originalRequest.trim()}

`
      : '';
  return `Your previous metaphor patch failed validation.

${intent}${previous}ERROR
${errorMessage}

RULES
${METAPHOR_RULE_PACK}

${METAPHOR_SELF_CHECK}

Rewrite the full metaphor DSL JSON via apply_metaphor_patch. Do not narrate outside the tool call.`;
}
