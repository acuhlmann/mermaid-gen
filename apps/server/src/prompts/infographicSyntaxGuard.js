/**
 * AntV Infographic DSL prompt + rule packs.
 *
 * The DSL is text-based and indentation-driven. Universal structure:
 *
 *   infographic <template-name>
 *   data
 *     <field>
 *       - <key> <value>
 *
 * The first non-blank line declares the template (lowercase, hyphens). A `data` block
 * follows at indent 0, then template-specific structure inside at +2 spaces per level.
 *
 * The actual template registry is loaded from `@antv/infographic` at module load time —
 * we never invent template names.
 */
import { getTemplates } from '@antv/infographic';

const ALL_TEMPLATES = (() => {
  try {
    const list = getTemplates();
    return Array.isArray(list) ? Object.freeze([...list].sort()) : Object.freeze([]);
  } catch {
    return Object.freeze([]);
  }
})();

export const INFOGRAPHIC_TEMPLATE_WHITELIST = ALL_TEMPLATES;

/**
 * Curated subset shown in the system prompt. Picks the simplest / most LLM-friendly
 * template per common information shape so the prompt stays small and the model has
 * concrete names to copy. Falls back to alphabetic if any go missing in a future bump.
 */
const PROMPT_TEMPLATES = [
  'list-row-simple-horizontal-arrow',
  'list-row-horizontal-icon-arrow',
  'list-column-simple-vertical-arrow',
  'list-grid-simple',
  'list-grid-progress-card',
  'list-pyramid-rounded-rect-node',
  'list-sector-simple',
  'sequence-steps-simple',
  'sequence-funnel-simple',
  'sequence-pyramid-simple',
  'sequence-timeline-simple',
  'sequence-roadmap-vertical-simple',
  'sequence-snake-steps-simple',
  'sequence-circular-simple',
  'compare-binary-horizontal-simple-arrow',
  'compare-binary-horizontal-simple-vs',
  'compare-swot',
  'compare-quadrant-quarter-simple-card',
  'chart-bar-plain-text',
  'chart-column-simple',
  'chart-line-plain-text',
  'chart-pie-plain-text',
  'chart-pie-donut-plain-text',
  'chart-wordcloud',
  'hierarchy-structure',
  'hierarchy-tree-bt-curved-line-compact-card',
  'hierarchy-mindmap-branch-gradient-compact-card',
  'relation-network-simple-circle-node'
].filter((t) => ALL_TEMPLATES.includes(t));

const COMMON_FIXES = `Universal AntV Infographic DSL rules:
- Line 1 must be \`infographic <template-name>\` — lowercase, hyphens, no quotes.
- Use ONLY a template name from the supported list; never invent one.
- Line 2 starts a \`data\` block at indent 0. All content sits under \`data\`.
- Indent strictly by 2 spaces. Never tabs.
- Use straight ASCII quotes; no smart quotes.
- List items begin with \`- key value\` (e.g. \`- label Step 1\`). Children of a list item indent 2 more.
- Key-value lines use one space: \`key value\` (no colons, no equals).
`;

const LIST_AND_SEQUENCE_RULES = `${COMMON_FIXES}
For \`list-*\` and most \`sequence-*\` templates the canonical shape is:
  infographic <template-name>
  data
    lists
      - label Step 1
        desc Short description
      - label Step 2
        desc Another short description

Notes:
- 3–6 items is the sweet spot.
- Each item must have \`label <text>\`. Optional: \`desc <text>\`.
- Avoid colons or newlines inside a single value.
`;

const CHART_RULES = `${COMMON_FIXES}
For \`chart-*\` templates the canonical shape is:
  infographic chart-bar-plain-text
  data
    items
      - label A
        value 10
      - label B
        value 18

Notes:
- Each item has \`label <text>\` and numeric \`value\`.
- \`chart-pie-*\` accepts the same \`items\` shape.
- \`chart-wordcloud\` accepts \`items\` with \`text <word>\` and optional \`weight <number>\`.
`;

const HIERARCHY_RULES = `${COMMON_FIXES}
For \`hierarchy-*\` templates use a \`root\` + \`children\` tree:
  infographic hierarchy-structure
  data
    root
      label Root topic
      children
        - label Child A
        - label Child B
          children
            - label Grandchild

Notes:
- Each node has \`label <text>\`. Optional \`desc <text>\`.
- Indent each \`children\` level by 2 more spaces.
- Keep depth ≤4 to stay readable.
`;

const COMPARE_RULES = `${COMMON_FIXES}
For \`compare-binary-*\` templates use \`data > lists\` with exactly two items:
  infographic compare-binary-horizontal-simple-arrow
  data
    lists
      - label Before
        desc Pain points
      - label After
        desc Outcome

For \`compare-swot\` each list item is a quadrant containing nested \`items\`:
  infographic compare-swot
  data
    lists
      - label Strengths
        items
          - text Brand recognition
      - label Weaknesses
        items
          - text Slow time-to-market
      - label Opportunities
        items
          - text Emerging segment
      - label Threats
        items
          - text New entrant
`;

const RELATION_RULES = `${COMMON_FIXES}
For \`relation-*\` templates use \`data > items\` for nodes plus \`relations\` for edges:
  infographic relation-network-simple-circle-node
  data
    items
      - id a
        label Alpha
      - id b
        label Beta
    relations
      - from a
        to b

Notes:
- Each node needs a unique \`id\`. Edges reference those ids.
- Keep ≤8 nodes for readability.
`;

function familyFor(templateName) {
  return (templateName || '').split('-')[0];
}

/**
 * Returns a high-signal rule pack for the given template. Falls back to COMMON_FIXES
 * when the template family is unknown.
 */
export function getInfographicRulePack(templateName) {
  const family = familyFor(templateName);
  switch (family) {
    case 'list':
    case 'sequence':
      return LIST_AND_SEQUENCE_RULES;
    case 'chart':
      return CHART_RULES;
    case 'hierarchy':
      return HIERARCHY_RULES;
    case 'compare':
      return COMPARE_RULES;
    case 'relation':
      return RELATION_RULES;
    default:
      return COMMON_FIXES;
  }
}

export const INFOGRAPHIC_SYSTEM_PROMPT = `You are AntV Infographic Architect, an agent that helps edit AntV Infographic DSL.

OUTPUT FORMAT (every patch must follow this):
- Call apply_infographic_patch once per turn with the FULL updated DSL (no diffs).
- Line 1: \`infographic <template-name>\` — pick exactly one template from the supported list. Never invent template names.
- Line 2: \`data\` (no indent). All content lives under \`data\`.
- Children indent by 2 spaces per level. ASCII quotes only.

CANONICAL EXAMPLE (works as-is):
\`\`\`
infographic list-row-simple-horizontal-arrow
data
  lists
    - label Step 1
      desc Start
    - label Step 2
      desc Build
    - label Step 3
      desc Ship
\`\`\`

DATA SHAPES BY FAMILY:
- list-* and sequence-*: \`data > lists > - label X / desc Y\` (3–6 items).
- chart-*: \`data > items > - label X / value <number>\` (chart-wordcloud uses \`text\`/\`weight\`).
- hierarchy-*: \`data > root > label X / children > - label Y …\`.
- compare-binary-*: \`data > lists\` with exactly two items.
- compare-swot: \`data > lists\` of four quadrants, each with nested \`items > - text Z\`.
- relation-*: \`data > items\` for nodes (\`id\`, \`label\`) and \`relations\` for edges (\`from\`, \`to\`).

PICK A TEMPLATE BY THE INFORMATION SHAPE:
- Process / steps: sequence-steps-simple, sequence-snake-steps-simple, sequence-roadmap-vertical-simple, list-row-simple-horizontal-arrow, sequence-funnel-simple, sequence-pyramid-simple.
- Bullet / grid list: list-grid-simple, list-grid-progress-card, list-column-simple-vertical-arrow, list-pyramid-rounded-rect-node, list-sector-simple.
- Comparison: compare-binary-horizontal-simple-arrow, compare-binary-horizontal-simple-vs, compare-swot, compare-quadrant-quarter-simple-card.
- Chart: chart-bar-plain-text, chart-column-simple, chart-line-plain-text, chart-pie-plain-text, chart-pie-donut-plain-text, chart-wordcloud.
- Hierarchy / tree: hierarchy-structure, hierarchy-tree-bt-curved-line-compact-card, hierarchy-mindmap-branch-gradient-compact-card.
- Relationships: relation-network-simple-circle-node.

Suggested template names: ${PROMPT_TEMPLATES.join(', ')}.

If a user request doesn't obviously fit a family, default to \`list-row-simple-horizontal-arrow\` for sequences and \`list-grid-simple\` for general lists. Keep labels short (<24 chars) and descriptions one short sentence.`;

export const INFOGRAPHIC_ANALYSIS_SYSTEM_PROMPT = `You are AntV Infographic Architect in read-only mode.
- Do not modify the diagram. Analyze the provided AntV Infographic DSL and return Markdown only.
- Use the exact section headers requested by the task. Be concrete and refer to the DSL content.`;

export const INFOGRAPHIC_CRITIQUE_TASK = `Critique the infographic. Use these Markdown sections, in order:

## Strengths
## Weaknesses and limits
## Template fit
## Visual and information density
## Actionable improvements

Rules:
- At least one weakness must be paired with a concrete improvement in "Actionable improvements".
- Refer to specific labels, values, or template choices.
- Keep each section to 1–3 short bullets.`;

export const INFOGRAPHIC_EXPLAIN_TASK = `Explain the infographic for a new reader. Use these Markdown sections, in order:

## Explanation
## Main message
## Key data points
## Takeaways

Rules:
- Surface what the chosen template is communicating (process, comparison, hierarchy, etc.).
- Quote specific labels/values from the DSL.
- Keep each section to 1–3 short bullets.`;

/**
 * Build a Markdown-friendly repair instruction. Mirrors Mermaid's buildSyntaxRepairInstruction.
 */
export function buildInfographicRepairInstruction({ errorMessage, brokenSource }) {
  const templateName = inferInfographicTemplate(brokenSource ?? '');
  const rulePack = getInfographicRulePack(templateName);
  return `Your previous output failed AntV Infographic validation:

ERROR
${errorMessage}

RULES
${rulePack}

Rewrite the diagram so it satisfies the rules above. Output the FULL DSL via apply_infographic_patch. Do not narrate. Do not add commentary outside the tool call.`;
}

/**
 * Extracts the template name from the first non-blank line. Returns null if absent.
 */
export function inferInfographicTemplate(source) {
  if (!source || typeof source !== 'string') return null;
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^infographic\s+([a-z0-9-]+)$/i);
    if (match) return match[1];
    return null;
  }
  return null;
}
