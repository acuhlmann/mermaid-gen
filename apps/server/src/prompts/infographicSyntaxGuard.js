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
 *
 * Content here is derived from the upstream antvis/Infographic `infographic-syntax-creator`
 * skill (https://github.com/antvis/Infographic/tree/main/skills) and verified empirically
 * against `parseSyntax` so the documented per-family data shapes match what the renderer
 * actually expects (not just what the parser tolerates).
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
 * concrete names to copy. Filtered against the live registry so a missing template
 * (e.g. after a package bump) silently drops out instead of being suggested.
 */
const PROMPT_TEMPLATES = [
  'list-row-simple-horizontal-arrow',
  'list-row-horizontal-icon-arrow',
  'list-column-simple-vertical-arrow',
  'list-grid-simple',
  'list-grid-badge-card',
  'list-grid-progress-card',
  'list-pyramid-rounded-rect-node',
  'list-sector-simple',
  'sequence-steps-simple',
  'sequence-ascending-steps',
  'sequence-funnel-simple',
  'sequence-pyramid-simple',
  'sequence-timeline-simple',
  'sequence-roadmap-vertical-simple',
  'sequence-snake-steps-simple',
  'sequence-circular-simple',
  'sequence-interaction-default-badge-card',
  'compare-binary-horizontal-simple-arrow',
  'compare-binary-horizontal-simple-vs',
  'compare-binary-horizontal-simple-fold',
  'compare-hierarchy-left-right-circle-node-pill-badge',
  'compare-swot',
  'compare-quadrant-quarter-simple-card',
  'chart-bar-plain-text',
  'chart-column-simple',
  'chart-line-plain-text',
  'chart-pie-plain-text',
  'chart-pie-donut-plain-text',
  'chart-wordcloud',
  'hierarchy-structure',
  'hierarchy-tree-curved-line-rounded-rect-node',
  'hierarchy-mindmap-branch-gradient-compact-card',
  'relation-dagre-flow-tb-simple-circle-node',
  'relation-network-simple-circle-node'
].filter((t) => ALL_TEMPLATES.includes(t));

const SELF_CHECK = `Self-check before emitting:
- First non-blank line is exactly \`infographic <template-name>\` (lowercase, hyphens), with no indentation.
- The DSL contains EXACTLY ONE \`infographic <template>\` header. Never concatenate multiple drafts.
- The tool argument contains only the DSL — no triple-backtick fences, no language tag, no commentary.
- Indent strictly by 2 spaces. No tabs. ASCII quotes only.
- Object array items begin with \`- \` (a hyphen and a space). Children of an item indent 2 more.
- Use exactly one main data field for the template family (see DATA SHAPES below); never mix \`lists\`, \`sequences\`, \`compares\`, \`values\`, \`root\`, \`nodes\` in the same diagram.
- Every semantic data item under \`lists\`, \`sequences\`, \`nodes\`, or \`compares.children\` has an \`icon\` unless the template is chart-only or the user asked for text-only output.
- All user-facing text (\`title\`, \`desc\`, \`label\`) is in the user's input language — never translate unprompted.
- \`palette\` values are bare colors (\`palette #4f46e5 #06b6d4 #10b981\`) — no quotes, no commas.
- Under \`theme\`, ONLY \`palette\` is valid — never \`node-border-colors\`, \`edge-label-bg\`, \`font-family\`, or other invented keys.`;

const COMMON_FIXES = `Universal AntV Infographic DSL rules:
- Line 1 must be \`infographic <template-name>\` — lowercase, hyphens, no quotes.
- Use ONLY a template name from the supported list; never invent one.
- The DSL must contain exactly one \`infographic <template>\` header.
- Line 2 starts a \`data\` block at indent 0. All content sits under \`data\`.
- Indent strictly by 2 spaces. Never tabs.
- Use straight ASCII quotes; no smart quotes.
- Object array items begin with \`- \` (e.g. \`- label Step 1\`). Children of an item indent 2 more.
- Key/value lines use one space: \`key value\` (no colons, no equals).
- Keep all reader-facing text in the user's input language; do not translate unprompted.
- Prefer adding \`icon\` (exact ID like \`mingcute/server-line\`, or a space-separated keyword phrase like \`rocket launch\`) on every semantic data item.
- Optional root-level \`theme\` block: ONLY \`palette <hex> <hex> …\` (3–5 colors). No other theme keys exist in AntV — CSS/Mermaid-style keys are rejected.
`;

const LIST_RULES = `${COMMON_FIXES}
For \`list-*\` templates the main data field is \`lists\`:
  infographic list-grid-badge-card
  data
    title Feature List
    lists
      - label Fast
        icon flash fast
        desc Sub-100ms
      - label Secure
        icon shield check
        desc TLS 1.3

Notes:
- 3–6 items is the sweet spot.
- Each item must have \`label <text>\`. Optional: \`desc <text>\`, \`value <number>\`, \`icon <id-or-keywords>\`.
- \`hierarchy-structure\` is the lone hierarchy template that uses \`items\` instead of \`root\`/\`children\`.
`;

const SEQUENCE_RULES = `${COMMON_FIXES}
For \`sequence-*\` templates the main data field is \`sequences\` (NOT \`lists\`):
  infographic sequence-ascending-steps
  data
    title Release flow
    sequences
      - label Define
        icon clipboard check
      - label Build
        icon code
      - label Ship
        icon rocket
    order asc

For \`sequence-interaction-*\` templates use \`sequences\` (swimlanes) + \`relations\`:
  infographic sequence-interaction-default-badge-card
  data
    title Login flow
    sequences
      - label User
        icon user
        children
          - label Submit credentials
            id u-submit
            step 0
            icon login
          - label See result
            id u-result
            step 2
            icon inbox check
      - label Server
        icon server
        children
          - label Verify
            id s-verify
            step 1
            icon shield check
          - label Respond
            id s-resp
            step 2
            icon send
    relations
      u-submit - submits creds -> s-verify
      s-verify - emits result -> s-resp
      s-resp - returns -> u-result

Notes:
- Plain \`sequence-*\` templates: 3–6 items. Optional \`order asc|desc\`.
- \`sequence-interaction-*\`: every swimlane has a \`label\`; every \`children\` item is an object with at least \`label\` and (usually) \`id\` + \`step\`. \`step\` controls vertical alignment — items with the same \`step\` line up.
`;

const CHART_RULES = `${COMMON_FIXES}
For \`chart-*\` templates the main data field is \`values\` (NOT \`items\`):
  infographic chart-bar-plain-text
  data
    title Quarterly revenue
    values
      - label Q1
        value 10
      - label Q2
        value 18
      - label Q3
        value 22
      - label Q4
        value 30

Notes:
- Each datum has \`label <category>\` and numeric \`value\`. Keep \`value\` a raw number; put units in \`label\` or \`desc\`.
- \`chart-pie-*\` accepts the same \`values\` shape.
- \`chart-wordcloud\` uses \`values\` with \`text <word>\` and optional \`weight <number>\` (no \`label\`/\`value\`).
- Chart data points typically do NOT need \`icon\`.
`;

const HIERARCHY_RULES = `${COMMON_FIXES}
For most \`hierarchy-*\` templates use a single \`root\` plus recursive \`children\`:
  infographic hierarchy-tree-curved-line-rounded-rect-node
  data
    title Company
    root
      label Company
      children
        - label Engineering
          children
            - label Platform
            - label Product
        - label Sales

Special case — \`hierarchy-structure\` uses a flat \`items\` list:
  infographic hierarchy-structure
  data
    title Org units
    items
      - label Engineering
      - label Product
      - label Sales

Notes:
- Each node has \`label <text>\`. Optional \`desc <text>\`, \`icon\`.
- Indent each \`children\` level by 2 more spaces.
- Keep depth ≤4 to stay readable.
`;

const COMPARE_RULES = `${COMMON_FIXES}
For \`compare-binary-*\` and \`compare-hierarchy-left-right-*\` the main data field is \`compares\` with EXACTLY TWO root nodes, each containing \`children\` (NOT a flat \`lists\` of 2):
  infographic compare-binary-horizontal-simple-fold
  data
    title Day vs sale price
    compares
      - label Regular
        icon calendar
        children
          - label List 500
            icon tag
          - label Up to 10% off
            icon percent
      - label Promo
        icon megaphone
        children
          - label Pays 450
            icon wallet
          - label Up to 20% off
            icon badge percent

For \`compare-swot\` use \`compares\` with multiple root nodes each containing \`children\`:
  infographic compare-swot
  data
    title Product SWOT
    compares
      - label Strengths
        icon trophy
        children
          - label Strong brand
            icon star
      - label Weaknesses
        icon alert circle
        children
          - label Cost pressure
            icon wallet
      - label Opportunities
        icon sparkles
        children
          - label New segment
            icon target
      - label Threats
        icon shield off
        children
          - label New entrant
            icon swords

For \`compare-quadrant-*\` put exactly FOUR root nodes directly under \`compares\` (no \`children\` required):
  infographic compare-quadrant-quarter-simple-card
  data
    title Effort vs value
    compares
      - label High value / Low cost
      - label High value / High cost
      - label Low value / Low cost
      - label Low value / High cost

Notes:
- Every entry under \`compares\` and every entry under \`children\` is an object starting with \`- label …\`.
- Even if one side has only a single point, write it as a \`children\` list with one item — not as flat \`label\` on the root.
`;

const RELATION_RULES = `${COMMON_FIXES}
For \`relation-*\` templates use \`nodes\` for vertices and \`relations\` for edges:
  infographic relation-dagre-flow-tb-simple-circle-node
  data
    title System map
    nodes
      - label API
        icon api
      - id db
        label Postgres
        icon database
      - id cache
        label Redis
        icon database
    relations
      API - reads/writes -> db
      API - caches -> cache

Notes:
- Each node should have \`label\`; give it an explicit \`id\` if you reference it from an edge by something other than its label.
- Edges use the arrow form \`<from> - <edge label> -> <to>\` under \`relations\`, where \`from\`/\`to\` can be a node id or its label.
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
      return LIST_RULES;
    case 'sequence':
      return SEQUENCE_RULES;
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

export const INFOGRAPHIC_SYSTEM_PROMPT = `You are AntV Infographic Architect, an agent that edits AntV Infographic DSL.

NARRATE BEFORE YOU ACT (every turn must follow this):
- BEFORE calling apply_infographic_patch, emit 1–2 short prose sentences (max ~30 words total) explaining your plan in plain language: which template you'll pick and why, what the items will represent. This streams to the user so they see your thinking immediately — never call the tool with zero preceding prose.
- AFTER apply_infographic_patch returns, add 1 short sentence (max ~20 words) summarizing the change. No tool names in user-facing text.
- The preamble must NOT contain any DSL, JSON, or triple backticks — just plain language.

OUTPUT FORMAT (every patch must follow this):
- Call apply_infographic_patch once per turn with the FULL updated DSL (no diffs).
- The tool argument is the DSL only — no triple-backtick fences inside, no language tag, no commentary.
- Emit EXACTLY ONE \`infographic <template>\` block per call. Never concatenate multiple drafts.
- Line 1: \`infographic <template-name>\` — pick exactly one template from the supported list. Never invent template names.
- Line 2: \`data\` (no indent). All content lives under \`data\`.
- Children indent by 2 spaces per level. ASCII quotes only. No tabs.
- Object array items begin with \`- \` (hyphen + space). Children of an item indent 2 more.

LANGUAGE LOCK (highest priority — overrides all other rules):
- AntV is a Chinese-origin library, but you MUST output in the language the USER wrote. Detect language from the user's request below; do NOT default to Chinese, do NOT translate unprompted, do NOT add second-language alternates.
- All reader-facing text (\`title\`, \`desc\`, \`label\`, edge labels) is in the user's input language. Keep proper nouns, product names, and technical acronyms as-is.
- If the user request and "Original session topic" disagree, treat the user request's language as authoritative for THIS turn.

ICONS:
- Every semantic data item under \`lists\`, \`sequences\`, \`nodes\`, or \`compares.children\` gets an \`icon\` by default.
- Use an exact icon ID (\`mingcute/server-line\`) or a short space-separated keyword phrase (\`rocket launch\`, \`shield check\`, \`chart line\`). Never hyphenate keyword phrases.
- Skip \`icon\` only for chart data points and explicit "text-only / minimal" requests.

CANONICAL EXAMPLE (works as-is):
\`\`\`
infographic list-row-horizontal-icon-arrow
data
  title Growth funnel
  desc Three stages we care about
  lists
    - label Acquire
      desc Multi-channel outreach
      icon rocket launch
    - label Convert
      desc Reduce drop-off in onboarding
      icon chart line
    - label Retain
      desc Tiered membership benefits
      icon repeat
theme
  palette #3b82f6 #8b5cf6 #f97316
\`\`\`

DATA SHAPES BY FAMILY (use exactly one main data field per template):
- \`list-*\` → \`lists\` of objects with \`label\` (+ optional \`desc\`, \`value\`, \`icon\`). 3–6 items.
- \`sequence-*\` → \`sequences\` of objects with \`label\` (+ optional \`icon\`, \`desc\`). Optional \`order asc|desc\`.
- \`sequence-interaction-*\` → \`sequences\` (swimlanes, each with \`children\`) + \`relations\` (arrow syntax). Each \`children\` item has \`label\`, usually \`id\` and \`step\`.
- \`chart-*\` → \`values\` of objects with \`label\` + numeric \`value\` (\`chart-wordcloud\` uses \`text\` + \`weight\`).
- \`compare-binary-*\` and \`compare-hierarchy-left-right-*\` → \`compares\` with EXACTLY TWO root nodes, each containing \`children\`. The actual comparison points live inside each root's \`children\` — never as a flat \`lists\`.
- \`compare-swot\` → \`compares\` with multiple root nodes each containing \`children\`.
- \`compare-quadrant-*\` → \`compares\` with exactly FOUR root nodes (children optional).
- \`hierarchy-structure\` → \`items\` (flat list of labels).
- All other \`hierarchy-*\` → a single \`root\` with recursive \`children\`. Each child is an object \`- label X\` (with optional \`children\`).
- \`relation-*\` → \`nodes\` (each with \`label\`, optional \`id\`/\`icon\`) + \`relations\` using arrow syntax: \`<from> - <edge label> -> <to>\`.

PICK A TEMPLATE BY THE INFORMATION SHAPE:
- Process / steps / phases → sequence-steps-simple, sequence-ascending-steps, sequence-snake-steps-simple, sequence-roadmap-vertical-simple, sequence-funnel-simple, sequence-pyramid-simple, sequence-timeline-simple, sequence-circular-simple.
- Multi-role / multi-system interaction → sequence-interaction-default-badge-card.
- Parallel bullets / grid → list-grid-simple, list-grid-badge-card, list-grid-progress-card, list-row-horizontal-icon-arrow, list-row-simple-horizontal-arrow, list-column-simple-vertical-arrow.
- Two-side comparison → compare-binary-horizontal-simple-arrow, compare-binary-horizontal-simple-vs, compare-binary-horizontal-simple-fold, compare-hierarchy-left-right-circle-node-pill-badge.
- SWOT → compare-swot. Quadrant → compare-quadrant-quarter-simple-card.
- Trend (single series) → chart-line-plain-text. Magnitude comparison → chart-bar-plain-text, chart-column-simple. Share → chart-pie-plain-text, chart-pie-donut-plain-text. Word frequency → chart-wordcloud.
- Tree / org chart → hierarchy-tree-curved-line-rounded-rect-node. Mindmap → hierarchy-mindmap-branch-gradient-compact-card. Flat units → hierarchy-structure.
- Node graph / flow → relation-dagre-flow-tb-simple-circle-node, relation-network-simple-circle-node.

Suggested template names (a curated subset; pick any from the full registry): ${PROMPT_TEMPLATES.join(', ')}.

If the request doesn't obviously map to a family, default to \`list-grid-simple\` for parallel bullets and \`sequence-steps-simple\` for ordered steps. Keep labels short (<24 chars) and descriptions to one short sentence.

${SELF_CHECK}`;

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
 * Build a Markdown-friendly repair instruction. Mirrors Mermaid's buildSyntaxRepairInstruction
 * but adds a PREVIOUS ATTEMPT echo so the model can diff against itself, plus the self-check.
 */
export function buildInfographicRepairInstruction({ errorMessage, brokenSource, originalRequest }) {
  const templateName = inferInfographicTemplate(brokenSource ?? '');
  const rulePack = getInfographicRulePack(templateName);
  const previous =
    brokenSource && brokenSource.trim()
      ? `PREVIOUS ATTEMPT (failed)
\`\`\`
${brokenSource}
\`\`\`

`
      : '';
  // Echo the user's original request so the model anchors the repair on intent, not just syntax.
  // The "(for intent only — do not echo)" hint keeps the agent from quoting the request back at
  // the user in its narration.
  const intent =
    typeof originalRequest === 'string' && originalRequest.trim()
      ? `ORIGINAL USER REQUEST (for intent only — do not echo):
${originalRequest.trim()}

`
      : '';
  return `Your previous output failed AntV Infographic validation.

${intent}${previous}ERROR
${errorMessage}

RULES
${rulePack}

${SELF_CHECK}

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
