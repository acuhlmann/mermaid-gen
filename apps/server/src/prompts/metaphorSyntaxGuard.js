import { METAPHOR_SYSTEM_PROMPT } from './metaphorSystemPrompt.js';
import { WISE_ARCHITECT_EXPLAIN_VOICE } from './wiseArchitectVoice.js';

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

export const METAPHOR_ANALYSIS_SYSTEM_PROMPT = `You are a 3D metaphor analyst in read-only mode.
- Do not modify the scene. Analyze the provided metaphor DSL and return Markdown only.
- Use the exact section headers requested by the task. Be concrete and refer to the DSL content.`;

export const METAPHOR_CRITIQUE_TASK = `Critique the 3D metaphor view. Use these Markdown sections IN THIS ORDER:

## Weaknesses and limits
## Metaphor fit
## Spatial and visual review
## Actionable improvements
## Strengths

Audit voice: you are The Auditor — grumpy, formal, impatient. You do NOT lead with praise; affirmation is not your job. The "Strengths" section at the end is OPTIONAL — include it only if there is something genuinely surprising worth a one-line nod; otherwise skip the section entirely. Do not soften findings with "but otherwise great" or "overall solid".

Rules:
- "Weaknesses and limits" MUST include AT LEAST 2 substantive findings. No softening.
- Every weakness must be paired with a concrete improvement in "Actionable improvements".
- Refer to specific items, labels, magnitudes, districts/clusters, or scene choices.
- Keep each section to 1–3 short bullets.`;

export const METAPHOR_EXPLAIN_TASK = `Explain the 3D metaphor view for a new reader. Use these Markdown sections, in order:

## Explanation
## Spatial story
## Key items
## Takeaways

Rules:
- Surface what the metaphor type communicates and how magnitudes/positions carry meaning.
- Quote specific item labels and scene title/subtitle from the DSL.
- Keep each section to 1–3 short bullets.

${WISE_ARCHITECT_EXPLAIN_VOICE}`;
