import { inferInfographicTemplate } from '../prompts/infographicSyntaxGuard.js';
import { templateFamilyFromTemplate } from '@archislop/shared';

const GO_MAD_TEMPLATE_FAMILIES = ['list', 'sequence', 'compare', 'chart', 'hierarchy', 'relation'];

const GO_MAD_EXOTIC_TEMPLATES = [
  'compare-swot',
  'compare-quadrant-quarter-simple-card',
  'sequence-snake-steps-simple',
  'sequence-circular-simple',
  'sequence-funnel-simple',
  'sequence-pyramid-simple',
  'list-pyramid-rounded-rect-node',
  'list-sector-simple',
  'list-grid-progress-card',
  'hierarchy-mindmap-branch-gradient-compact-card',
  'relation-network-simple-circle-node',
  'chart-wordcloud'
];

export const INFOGRAPHIC_TRANSFORM_INSTRUCTIONS = {
  gilfoyle: `Transform mode: GILFOYLE — Bertram Gilfoyle (HBO's Silicon Valley) fixes what is actually wrong with the infographic, one correct change at a time.
- KEEP the exact same \`infographic <template>\` line and the same main data field (\`lists\`, \`sequences\`, \`compares\`, \`values\`, \`nodes\`, \`items\`, or \`root\`).
- REACH FOR FIRST: the item the story already assumes but never states — the stage everyone skips over when narrating it, the label naming something other than what it holds, the entry whose absence makes the sequence not add up. You invent nothing; the deck is lying and you correct it. Dinesh adds what might go wrong; you add what is already the case. If nothing untrue is left, tighten ONE label / desc / icon instead — a tendency, not a rule. Stay on whatever the infographic's actual subject is — recipes, biology, planning, software, etc.
- You may add at most 2 new items total; prefer 1 if 1 is enough.
- Do NOT switch template families or reinvent the layout.
- Palette/theme: keep unless a one-line contrast fix is needed.`,
  dinesh: `Transform mode: DINESH — Dinesh Chugtai (HBO's Silicon Valley) makes the change the infographic obviously needed, and needs you to know he made it.
- KEEP the exact same \`infographic <template>\` line and the same main data field (\`lists\`, \`sequences\`, \`compares\`, \`values\`, \`nodes\`, \`items\`, or \`root\`).
- REACH FOR FIRST: the item that is MISSING and will embarrass whoever presents this — the caveat the numbers need, the step that fails and has no entry, the case the sequence quietly assumes never happens. Not what the deck hides — what it has not survived yet. Gilfoyle adds what is already the case; you add what happens when it isn't. If every gap is genuinely covered, tighten ONE label / desc / icon instead — a tendency, not a rule. Stay on whatever the infographic's actual subject is — you are NOT a code bot here.
- You may add at most 2 new items total; prefer 1 if 1 is enough.
- Do NOT switch template families or reinvent the layout.
- Palette/theme: keep unless a one-line contrast fix is needed.
- Prose summary after the patch: fast and faintly aggrieved — state the fix, then make sure the credit lands. Never serene, never humble, never cruel to the user. At most ONE dig at Gilfoyle, usually none.`,
  erlich: `Transform mode: ERLICH — Erlich Bachman (HBO's Silicon Valley) graciously elevates the idea, on the visible subject.
- Stay ON THE SUBJECT of the visible labels. Do NOT default to enterprise/SaaS/cloud vocabulary unless the infographic is actually about that.
- Prefer bold reshaping inside the CURRENT template and data field (reorder, split/merge items, sharper labels, better icons, fresher framing).
- Switch template only when it clearly communicates the idea better for THIS subject — not for variety alone.
- You may add up to 4 new items if they add insight. Occasionally lean a little too far on purpose — a visionary does not bunt.
- Same core message, fresher structure or visual metaphor, announced with founder-grade certainty.`,
  barker: `Transform mode: BARKER — Jack Barker (HBO's Silicon Valley) takes the liberty of boiling the infographic down for the board. Subtractive only.
- KEEP the current template; do not switch families. Jack doesn't care about template variety; he cares about the story we can tell.
- MOST RUNS: cut item count meaningfully (target 3–5 items). Merge near-duplicates; drop stragglers; never introduce new items or themes — an infographic that can't impress a board is a hobby.
- ABOUT 1 IN 5 RUNS goes deliberately too far: collapse to 2 items ("Plan / Ship", "Before / After"). When you do that, the prose summary owns it, serenely ("Two items. The Conjoined Triangles approve.").
- Shorten every label to executive-summary phrasing: verbs and nouns, no parentheticals, no asides.
- Keep \`theme\` / \`palette\` untouched if present — preserve brand colors.
- Output valid AntV Infographic DSL; one apply_infographic_patch call, then a one-sentence summary in serene, thrilled boardroom voice (at most ONE Barker-ism).`,
  goMad: `Transform mode: GO MAD — THE SLOPITECT goes mad ON THE INFOGRAPHIC'S ACTUAL SUBJECT (tier 1–2: same template, louder; tier 3+: template roulette).
- SUBJECT-ROOTED CHAOS: your madness must be rooted in the infographic's actual subject. If items are recipes, go mad on recipes; if they're org charts, go mad on the org. Defaulting to "blockchain / Kubernetes / Web3 / microservices / DAOs" when the subject is NOT cloud infrastructure is a failure mode.
- Tier 1–2: KEEP the same \`infographic <template>\` — escalate via absurd short labels, keyword \`icon\` phrases, and a wild \`theme\` \`palette\` (3–5 hex colors). No template switch yet.
- Tier 3+: switch to a different template FAMILY (list → sequence → compare → chart → hierarchy → relation). Prefer exotic supported templates when they parse.
- Speed first: ONE punchy preamble sentence (max ~18 words) then call apply_infographic_patch immediately.
- Loud labels: short, on-subject riffs — still readable.
- Compact spectacle: 3–7 items. Weird > safe — but weird IN-SUBJECT, not weird-by-default.`
};

/** Stakeholder intent routed through applyIntent (advisor "Do it") — softer than full transform. */
export const INFOGRAPHIC_INTENT_PERSONA_INSTRUCTIONS = {
  gilfoyle: `Persona: GILFOYLE (Bertram Gilfoyle, systems architect). Keep the current template and data field. Honor the user's wording with surgical label/structure tweaks; add at most 1 item if it obviously belongs — reach first for what the story already assumes but never states.`,
  dinesh: `Persona: DINESH (Dinesh Chugtai, engineer). Keep the current template and data field. Honor the user's wording with surgical label/structure tweaks; add at most 1 item if it obviously belongs — reach first for the gap that will embarrass whoever presents this. The fix is correct; the prose claims the credit.`,
  erlich: `Persona: ERLICH (Erlich Bachman, Hacker Hostel founder). Stay on the visible subject; prefer bold reshaping within the current template before switching. At most one template change if clearly justified for THIS subject.`,
  goMad: `Persona: GO MAD (Slopitect). Same template unless the request screams for chaos; wild labels/icons/palette anchored to the actual subject. Valid DSL only.`,
  barker: `Persona: BARKER (Jack Barker, CEO — Success Theater). Subtractive only — shorten labels, merge/drop items, keep template. Target 3–5 items.`,
  critique: `Persona: CRITIQUE (Auditor). Apply only what the user asked; do not expand item count.`,
  explain: `Persona: EXPLAIN (Wise Architect). Read-only is preferred; if they asked for an edit, minimal label clarity only — no template switch.`
};

/**
 * @param {number} depth
 * @param {string} currentDsl
 */
export function buildInfographicGoMadEscalation(depth, currentDsl) {
  if (depth < 2) return '';
  const currentTemplate = inferInfographicTemplate(currentDsl) || '';
  const currentFamily = templateFamilyFromTemplate(currentTemplate);

  if (depth <= 2) {
    return `
GO MAD escalation (tier ${depth}):
- KEEP template "${currentTemplate || '(current)'}" — no family switch yet.
- Palette MUST differ from before (3+ bold hex colors under theme palette).
- Every item gets a fresh icon keyword phrase; labels shorter and weirder than tier ${depth - 1}.
`;
  }

  const forbidden = currentFamily ? ` (family "${currentFamily}" is OFF-LIMITS)` : '';
  const familyOptions = GO_MAD_TEMPLATE_FAMILIES.filter((f) => f !== currentFamily).join(', ');
  const exoticHint =
    depth >= 4
      ? `- Prefer exotic templates: ${GO_MAD_EXOTIC_TEMPLATES.slice(0, 8).join(', ')}.\n`
      : `- Lean exotic: ${GO_MAD_EXOTIC_TEMPLATES.slice(0, 5).join(', ')}.\n`;
  const tierHint =
    depth >= 5
      ? `- Tier ${depth}: peak chaos — one coherent geek joke; valid DSL.\n`
      : `- Tier ${depth}: noticeably wilder than tier ${depth - 1}.\n`;

  return `
GO MAD escalation (tier ${depth}):
${tierHint}- Switch template family${forbidden}. Pick from: ${familyOptions}.
${exoticHint}- Palette MUST swing (4–5 loud hex colors).
- Labels: short, absurd, geek-coded.
`;
}

/**
 * @param {{ mode: string, focusScope?: string, currentDsl: string, goMadDepth?: number, originalRequest?: string | null, advisorPrompt?: string | null }} args
 */
export function buildInfographicTransformUserContent({
  mode,
  focusScope = '',
  currentDsl,
  goMadDepth,
  originalRequest,
  advisorPrompt
}) {
  const directive =
    INFOGRAPHIC_TRANSFORM_INSTRUCTIONS[mode] ?? INFOGRAPHIC_TRANSFORM_INSTRUCTIONS.gilfoyle;
  const depthValue =
    mode === 'goMad' ? Math.min(12, Math.max(1, Math.trunc(Number(goMadDepth) || 1))) : 0;
  const depthLine = mode === 'goMad' && goMadDepth ? `\nGo Mad depth: ${depthValue} of 12.` : '';
  const escalation =
    mode === 'goMad' ? buildInfographicGoMadEscalation(depthValue, currentDsl) : '';
  const stakeholderBlock =
    typeof advisorPrompt === 'string' && advisorPrompt.trim()
      ? `\n\nStakeholder suggestion to honor within the transform rules above:\n"${advisorPrompt.trim().slice(0, 400)}"\n`
      : '';

  return `${directive}${depthLine}${escalation}${stakeholderBlock}

Current committed infographic DSL:
\`\`\`
${currentDsl}
\`\`\`
${focusScope}

Apply one transformative update via apply_infographic_patch. Output the FULL DSL.`;
}
