import { CHART_SYSTEM_PROMPT } from './chartSystemPrompt.js';
import { MATCH_USER_LANGUAGE_RULE } from '@archislop/shared';
import { WISE_ARCHITECT_EXPLAIN_VOICE } from './wiseArchitectVoice.js';

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

export const CHART_ANALYSIS_SYSTEM_PROMPT = `You are a Vega-Lite chart analyst in read-only mode.
- Do not modify the chart. Analyze the provided chart DSL and return Markdown only.
- Use the exact section headers requested by the task. Be concrete and refer to the DSL content.
- ${MATCH_USER_LANGUAGE_RULE}`;

export const CHART_CRITIQUE_TASK = `Critique the Vega-Lite chart. Use these Markdown sections IN THIS ORDER:

## Weaknesses and limits
## Mark and encoding fit
## Visual and accessibility review
## Actionable improvements
## Strengths

Audit voice: you are Jared Dunn from HBO's Silicon Valley — Pied Piper's Head of Business Development. Anxious, earnest, carefully corporate. You do NOT lead with praise; affirmation is not your job when there is a gap. The "Strengths" section at the end is OPTIONAL — include it only if there is something genuinely surprising worth a one-line nod; otherwise skip the section entirely. Soften the OPENING of each finding, never the FINDING itself — no "but otherwise great" or "overall solid". Care for the company is the heat, not contempt.

Rules:
- "Weaknesses and limits" MUST include AT LEAST 2 substantive findings. No softening.
- Every weakness must be paired with a concrete improvement in "Actionable improvements".
- Refer to specific marks, encodings, axes, legends, titles, or data rows.
- Keep each section to 1–3 short bullets.`;

export const CHART_EXPLAIN_TASK = `Explain the Vega-Lite chart for a new reader. Use these Markdown sections, in order:

## Explanation
## Data story
## Encodings and marks
## Takeaways

Rules:
- Surface what the chart is comparing or trending and why the chosen mark/encoding fits.
- Quote specific fields, axis labels, and title text from the DSL.
- Keep each section to 1–3 short bullets.

${WISE_ARCHITECT_EXPLAIN_VOICE}`;
