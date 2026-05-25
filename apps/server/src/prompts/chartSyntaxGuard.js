import { CHART_SYSTEM_PROMPT } from './chartSystemPrompt.js';

export const CHART_RULE_PACK = CHART_SYSTEM_PROMPT;

export const CHART_SELF_CHECK = `Self-check before calling apply_chart_patch:
- Valid JSON object (no trailing commas, double-quoted keys/strings).
- Top-level keys: "archislopVersion": 1, "theme", "spec".
- "theme" is exactly "whiteboard", "noir", "arcade", or "blueprint".
- "spec" is a non-empty object containing at minimum "$schema" and either ("mark" and "encoding") or one of ("layer", "hconcat", "vconcat", "facet", "repeat").
- spec.data.values is an array of plain objects when present (inline data).
- Every encoding channel ("x", "y", "color", "size", "shape", etc.) has both "field" and "type".
- "type" is one of "quantitative", "ordinal", "nominal", "temporal".
- All fields referenced in encodings exist in every row of spec.data.values (or come from a transform).
- No lower-level Vega constructs ("signals", "scales"/"axes" at the top level, "marks": [...]).
- spec.title (if present) is a string or { "text": string }, not bare HTML.`;

/**
 * Build repair instructions after a failed chart patch tool call.
 */
export function buildChartRepairInstruction({ errorMessage, brokenSource, originalRequest }) {
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
  return `Your previous chart patch failed validation.

${intent}${previous}ERROR
${errorMessage}

RULES
${CHART_RULE_PACK}

${CHART_SELF_CHECK}

Rewrite the full chart DSL JSON wrapper via apply_chart_patch. Do not narrate outside the tool call.`;
}
