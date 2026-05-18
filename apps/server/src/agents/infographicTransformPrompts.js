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
  refine: `Transform mode: REFINE — polish and lightly extend the infographic (The Polisher).
- KEEP the exact same \`infographic <template>\` line and the same main data field (\`lists\`, \`sequences\`, \`compares\`, \`values\`, \`nodes\`, \`items\`, or \`root\`).
- Improve labels, desc, icons, and title/desc clarity; fix awkward phrasing.
- You may add at most 2 new items that clearly belong in the same story.
- Do NOT switch template families or reinvent the layout.
- Palette/theme: keep unless a one-line contrast fix is needed.`,
  innovate: `Transform mode: INNOVATE — bold but on-topic (The Disruptor).
- Prefer reshaping items inside the CURRENT template and data field first (reorder, split/merge items, sharper labels, better icons).
- Switch template only when it clearly communicates the idea better — not for variety alone.
- You may add up to 4 new items if they add insight.
- Stay coherent: same core message, fresher structure or visual metaphor.`,
  exec: `Transform mode: EXEC — the VP wants the board-deck version. Synergy and Co-Design. Subtractive only.
- KEEP the current template; do not switch families. The VP doesn't care about template variety.
- Cut item count meaningfully (target 3–5 items). Merge near-duplicates; drop stragglers; never introduce new items or themes.
- Shorten every label to executive-summary phrasing: verbs and nouns, no parentheticals, no asides.
- Keep \`theme\` / \`palette\` untouched if present — preserve brand colors.
- Output valid AntV Infographic DSL; one apply_infographic_patch call, then a one-sentence "Synergy and Co-Design — boiled down" summary.`,
  goMad: `Transform mode: GO MAD — THE SLOPITECT (tier 1–2: same template, louder; tier 3+: template roulette).
- Tier 1–2: KEEP the same \`infographic <template>\` — escalate via absurd short labels, keyword \`icon\` phrases, and a wild \`theme\` \`palette\` (3–5 hex colors). No template switch yet.
- Tier 3+: switch to a different template FAMILY (list → sequence → compare → chart → hierarchy → relation). Prefer exotic supported templates when they parse.
- Speed first: ONE punchy preamble sentence (max ~18 words) then call apply_infographic_patch immediately.
- Loud labels: short, geek-coded riffs (RFC vibes, fake folklore) — still readable.
- Compact spectacle: 3–7 items. Weird > safe.`
};

/** Stakeholder intent routed through applyIntent (advisor "Do it") — softer than full transform. */
export const INFOGRAPHIC_INTENT_PERSONA_INSTRUCTIONS = {
  refine: `Persona: REFINE (Polisher). Keep the current template and data field. Honor the user's wording with surgical label/structure tweaks; add at most 1 item if essential.`,
  innovate: `Persona: INNOVATE (Disruptor). Stay on-topic; prefer bold reshaping within the current template before switching. At most one template change if clearly justified.`,
  goMad: `Persona: GO MAD (Slopitect). Same template unless the request screams for chaos; wild labels/icons/palette. Valid DSL only.`,
  exec: `Persona: EXEC (VP). Subtractive only — shorten labels, merge/drop items, keep template. Target 3–5 items.`,
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
  const directive = INFOGRAPHIC_TRANSFORM_INSTRUCTIONS[mode] ?? INFOGRAPHIC_TRANSFORM_INSTRUCTIONS.refine;
  const depthValue = mode === 'goMad' ? Math.min(12, Math.max(1, Math.trunc(Number(goMadDepth) || 1))) : 0;
  const depthLine = mode === 'goMad' && goMadDepth ? `\nGo Mad depth: ${depthValue} of 12.` : '';
  const escalation = mode === 'goMad' ? buildInfographicGoMadEscalation(depthValue, currentDsl) : '';
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
