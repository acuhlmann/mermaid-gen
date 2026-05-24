import { METAPHOR_SYSTEM_PROMPT } from './metaphorSystemPrompt.js';

export const METAPHOR_RULE_PACK = METAPHOR_SYSTEM_PROMPT;

export const METAPHOR_SELF_CHECK = `Self-check before calling apply_metaphor_patch:
- Valid JSON object (no trailing commas, double-quoted keys/strings).
- "metaphor" is exactly "city", "layercake", or "galaxy".
- Every item has unique "id" (kebab-case) and non-empty "label".
- City items: numeric height and footprint; meaningful district when >6 items. Layercake: thickness + components[]. Galaxy: magnitude; meaningful cluster when >6 items.
- "links" is an array (may be empty). Each link has "from" and "to" ids that exist in items; optional "label".
- Optional item "position": [x,y,z] with numbers in −30…30.
- scene.theme is whiteboard|noir|arcade; scene.camera is orbit|isometric when present.`;

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
