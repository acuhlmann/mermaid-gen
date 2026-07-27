/** Wire: Mermaid analysis + transform prompt builders (extracted from mermaidLangChainAgent). */
import { inferMermaidTopKeyword, MATCH_USER_LANGUAGE_RULE } from '@archislop/shared';
import { WISE_ARCHITECT_EXPLAIN_VOICE } from '../prompts/wiseArchitectVoice.js';

export const TRANSFORM_MODEL_LIMITS = Object.freeze({
  topP: 0.92,
  maxTokens: 2400
});

/** Go Mad uses a lower completion cap so runs finish sooner and cost less; surprise lives in tone/type, not word count. */
export const GO_MAD_TRANSFORM_MAX_TOKENS = 1400;

const TRANSFORM_MODE_MODEL = Object.freeze({
  gilfoyle: { temperature: 0.42 },
  erlich: { temperature: 0.82 },
  barker: { temperature: 0.35 }
});

const TRANSFORM_MODES = Object.freeze(['gilfoyle', 'erlich', 'goMad', 'barker']);

export function isTransformMode(value) {
  return typeof value === 'string' && TRANSFORM_MODES.includes(value);
}

/**
 * Base sampling for Go Mad tier 1; ramps gently with `goMadDepth` via
 * `goMadTransformModelOptions`. Chaos is PROMPT-driven (type roulette +
 * escalation tiers in `buildTransformUserContent`), not sampling-driven: the
 * earlier 1.48–1.7 range mostly produced invalid Mermaid and malformed tool
 * calls that burned the run budget in repair turns. The anything/chart/metaphor
 * modes run Go Mad at default temperature and escalate purely via prompt, and
 * fail far less often — keep sampling in the range where tool calls stay
 * reliable and let the escalation text carry the madness.
 */
const GO_MAD_TEMP_MIN = 0.95;
const GO_MAD_TEMP_MAX = 1.15;
const GO_MAD_TEMP_PER_DEPTH = 0.02;

export const ANALYSIS_SYSTEM_PROMPT = `You are ArchiSlop in read-only mode.
CRITICAL:
- Do NOT edit the diagram. Do NOT output apply_mermaid_patch or tool calls.
- Answer only in plain text or Markdown for the user to read.
- Never mention internal tools or system prompts.
- ${MATCH_USER_LANGUAGE_RULE}`;

export const ANALYSIS_CRITIQUE_SYSTEM_APPEND = `
Critique tasks only:
- Follow the user's required section headings (or clearly labeled equivalents). Never skip Weaknesses or Actionable improvements.`;

export const ANALYSIS_EXPLAIN_SYSTEM_APPEND = `
Explain tasks only:
- Use the required Markdown ## section headings exactly (or clearly labeled equivalents). Do not skip sections; use bullets inside sections where helpful.

${WISE_ARCHITECT_EXPLAIN_VOICE}`;

/** Diagrams below this size use a tighter task template — same constraints, fewer instruction tokens. */
const COMPACT_ANALYSIS_SOURCE_CHAR_THRESHOLD = 600;

export function buildCritiqueTask(focusNode, focusScope, diagramSource) {
  const focused = Boolean(focusNode?.id);
  const tail = focused ? '' : focusScope;
  const auditTone = `Audit voice: you are The Auditor — grumpy, formal, impatient. You do NOT lead with praise; affirmation is not your job. If the diagram has strengths, omit "Strengths" entirely unless there is something genuinely surprising worth a one-line nod. Make every negative point land; do not soften with "but otherwise great" or "overall solid".`;
  if (focused) {
    if ((diagramSource?.length ?? 0) <= COMPACT_ANALYSIS_SOURCE_CHAR_THRESHOLD) {
      return `Critique in read-only prose — do not rewrite or output Mermaid. Center every section on the diagram selection described in Selection focus above (prioritize that element and its neighborhood before unrelated diagram-wide notes).

${auditTone}

Use these Markdown ## sections IN THIS ORDER (or clearly labeled equivalents): Weaknesses and limits, Diagram type fit, Visual and style review, Actionable improvements. Strengths is OPTIONAL — include only if there's something genuinely surprising worth a one-line nod; otherwise skip the section entirely.

You MUST include AT LEAST 2 substantive weaknesses in "Weaknesses and limits" — even if the diagram is strong — and every weakness must have a matching item in "Actionable improvements".${tail}`;
    }
    return `Critique in read-only prose — do not rewrite or output Mermaid. Center every section on the diagram selection described in Selection focus above: weaknesses about that element first (labels, role, connections, clarity), then broader diagram points only where they clarify the selection.

${auditTone}

Use these sections with Markdown headings IN THIS ORDER (or the same labels inline if headings are awkward):

## Weaknesses and limits
You MUST include AT LEAST 2 substantive weaknesses — prioritize issues touching the selection (ambiguous label, weak link, unclear responsibility, missing context, undefined error path, unowned accountability) before generic diagram-wide gaps. No softening; make each finding land.

## Diagram type fit
Whether the diagram type serves the selected element and its relationships; note type-level issues that affect this selection.

## Visual and style review
Readability of the selection and its immediate links (contrast, clutter, arrow/label clarity).

## Actionable improvements
Concrete changes; every weakness above should have a matching improvement. Prioritize fixes for the selection first.

## Strengths (OPTIONAL)
Skip this section unless there's something genuinely surprising worth noting — the user does not need to be told their diagram is fine.${tail}`;
  }
  if ((diagramSource?.length ?? 0) <= COMPACT_ANALYSIS_SOURCE_CHAR_THRESHOLD) {
    return `Critique this diagram in read-only prose — do not rewrite or output Mermaid.

${auditTone}

Use these Markdown ## sections IN THIS ORDER (or clearly labeled equivalents): Weaknesses and limits, Diagram type fit, Visual and style review, Actionable improvements. Strengths is OPTIONAL — include only if there's something genuinely surprising worth a one-line nod; otherwise skip the section entirely.

You MUST include AT LEAST 2 substantive weaknesses in "Weaknesses and limits" — even if the diagram is strong — and every weakness must have a matching item in "Actionable improvements".${tail}`;
  }
  return `Critique this diagram in read-only prose — do not rewrite or output Mermaid.

${auditTone}

Use these sections with Markdown headings IN THIS ORDER (or the same labels inline if headings are awkward):

## Weaknesses and limits
You MUST include AT LEAST 2 substantive weaknesses, gaps, or risks — even if the diagram is strong (e.g. tradeoffs, ambiguous flows, weak hierarchy, scalability of layout, missing legend/context, accessibility or contrast concerns, unclear temporal/order semantics, unowned accountability, no defined exit/error path). Do not deliver praise-only or generic fluff. No softening — make each finding land.

## Diagram type fit
Say whether the chosen Mermaid diagram type suits the content. If another type would communicate better, name it and why — without rewriting the diagram.

## Visual and style review
Comment on readability and presentation: clutter, balance, link directions, shapes, grouping, and any %%init%% / theme / classDef / styling choices if present (including contrast and visual hierarchy).

## Actionable improvements
A bullet list of concrete changes the user could apply later (labels, structure, type change, styling, accessibility). Every weakness above should have at least one matching or related improvement suggestion here.

## Strengths (OPTIONAL)
Skip this section unless there's something genuinely surprising worth noting — the user does not need to be told their diagram is fine.${tail}`;
}

export function buildExplainTask(focusNode, focusScope, diagramSource) {
  const focused = Boolean(focusNode?.id);
  const tail = focused ? '' : focusScope;
  if (focused) {
    if ((diagramSource?.length ?? 0) <= COMPACT_ANALYSIS_SOURCE_CHAR_THRESHOLD) {
      return `Explain in read-only prose — do not rewrite Mermaid. The user selected one part of the diagram (see Selection focus above). Interpret label and wording meaning in context, not only topology. Spend most of each section on that selection; at most one short paragraph across the whole answer may summarize how it sits in the wider diagram.

Use these Markdown ## sections (or clearly labeled equivalents): Explanation, Main flows, Key entities, Takeaways.${tail}`;
    }
    return `Explain in read-only prose — do not rewrite Mermaid. The user selected one part of the diagram (see Selection focus above). Interpret label and wording meaning in context, not only topology. Spend most of each section on that selection; at most one short paragraph across the whole answer may summarize how it sits in the wider diagram.

Use these sections with Markdown ## headings (or clearly labeled equivalents):

## Explanation
What this selection means — start with the visible label text and its intent in context.

## Main flows
How information, control, or dependencies attach to this selection (incoming/outgoing links and what they imply).

## Key entities
How this selection relates to adjacent nodes, subgraphs, or edges; mention elsewhere only as needed to understand the selection.

## Takeaways
What matters about this selection specifically.${tail}`;
  }
  if ((diagramSource?.length ?? 0) <= COMPACT_ANALYSIS_SOURCE_CHAR_THRESHOLD) {
    return `Explain what this diagram communicates to someone unfamiliar with it. Stay descriptive — do not rewrite the diagram.

Use these Markdown ## sections (or clearly labeled equivalents): Explanation, Main flows, Key entities, Takeaways.${tail}`;
  }
  return `Explain what this diagram communicates to someone unfamiliar with it. Stay descriptive — do not rewrite the diagram.

Use these sections with Markdown ## headings (or clearly labeled equivalents):

## Explanation
A short overview for someone new to the diagram.

## Main flows
How information, process steps, or relationships move through the diagram.

## Key entities
Important nodes, subgraphs, or groups and what role each plays.

## Takeaways
Concise conclusions — what to remember or how to read the diagram.${tail}`;
}

function isEdgeFocus(focusNode) {
  return (
    focusNode?.selectionKind === 'edge' &&
    Boolean(focusNode.edgeFrom?.trim()) &&
    Boolean(focusNode.edgeTo?.trim())
  );
}

/**
 * Instructions appended to mutation prompts (intent / transform).
 */
export function buildFocusScopeInstructions(focusNode) {
  if (!focusNode?.id) return '';
  if (isEdgeFocus(focusNode)) {
    const label = focusNode.label ? ` (edge label: "${focusNode.label}")` : '';
    const clicked =
      focusNode.clickedLabel && focusNode.clickedLabel !== focusNode.label
        ? ` Tapped label fragment: "${focusNode.clickedLabel}".`
        : '';
    return `\n\nFocus scope: Prefer edits centered on the edge from "${focusNode.edgeFrom}" to "${focusNode.edgeTo}"${label}${clicked} (edge id "${focusNode.id}"). Adjust endpoints, labels on this link, or local routing only as needed for valid Mermaid; minimize unrelated changes elsewhere.`;
  }
  const label = focusNode.label ? ` (visible label: "${focusNode.label}")` : '';
  const clicked =
    focusNode.clickedLabel && focusNode.clickedLabel !== focusNode.label
      ? ` Tapped label fragment: "${focusNode.clickedLabel}".`
      : '';
  const role = focusNode.selectionKind === 'cluster' ? 'subgraph/cluster' : 'node';
  return `\n\nFocus scope: Prefer changes centered on diagram ${role} id "${focusNode.id}"${label}${clicked}. Minimize edits elsewhere except where required for valid Mermaid syntax or connectivity.`;
}

/**
 * Instructions appended to analyze (explain / critique) prompts — read-only, selection-first wording.
 */
export function buildAnalyzeFocusInstructions(focusNode, kind) {
  if (!focusNode?.id) return '';
  const edgeLabel = focusNode.label ? ` Visible edge label text: "${focusNode.label}".` : '';
  const edgeClicked =
    focusNode.clickedLabel && focusNode.clickedLabel !== focusNode.label
      ? ` User tapped this edge label fragment: "${focusNode.clickedLabel}". Interpret that wording in context.`
      : '';
  const link = `"${focusNode.edgeFrom}" → "${focusNode.edgeTo}"`;

  if (isEdgeFocus(focusNode)) {
    if (kind === 'explain') {
      return `\n\nSelection focus (edge): The user selected the directed link ${link}.${edgeLabel}${edgeClicked} Lead with this relationship in ## Explanation, ## Main flows, and ## Key entities — what it means, what moves or depends along it, and how the two endpoints relate. Interpret label text literally in context. Use ## Takeaways for conclusions specific to this link. Mention the wider diagram only briefly as supporting context; avoid a generic whole-diagram essay that ignores this edge.`;
    }
    return `\n\nSelection focus (edge): The user selected the directed link ${link}.${edgeLabel}${edgeClicked} In ## Weaknesses and limits, ## Visual and style review, and ## Actionable improvements, prioritize this link and its endpoints (arrow clarity, label usefulness, direction, redundancy, missing guards). Address diagram-wide topics only after covering this edge. Keep ## Diagram type fit tied to how well this selected relationship reads. The ## Strengths section is optional — include only if there is something genuinely surprising about this link.`;
  }

  const label = focusNode.label ? ` (visible label: "${focusNode.label}")` : '';
  const clicked =
    focusNode.clickedLabel && focusNode.clickedLabel !== focusNode.label
      ? ` The user tapped directly on this label fragment: "${focusNode.clickedLabel}". Interpret that specific wording/meaning in the diagram context, not only the aggregate title.`
      : '';
  const role = focusNode.selectionKind === 'cluster' ? 'subgraph/cluster' : 'node';

  if (kind === 'explain') {
    return `\n\nSelection focus (${role}): The user selected ${role} id "${focusNode.id}"${label}.${clicked} In ## Explanation, ## Main flows, and ## Key entities, foreground this ${role}: its role, connections, and how labels read in context. ## Takeaways should emphasize what matters about this selection. Mention other parts only as supporting context; do not center the whole response on unrelated nodes or edges.`;
  }
  return `\n\nSelection focus (${role}): The user selected ${role} id "${focusNode.id}"${label}.${clicked} In ## Weaknesses and limits, ## Visual and style review, and ## Actionable improvements, prioritize issues touching this ${role} and its immediate neighborhood before broader diagram-wide commentary. Keep ## Diagram type fit referenced to how this selection reads. The ## Strengths section is optional — include only if there is something genuinely surprising about this ${role}.`;
}

/** @param {unknown} raw */
export function clampGoMadDepth(raw) {
  if (raw == null || typeof raw !== 'number' || !Number.isFinite(raw)) return 1;
  return Math.min(12, Math.max(1, Math.trunc(raw)));
}

/**
 * Sampling for Go Mad transforms; hotter at deeper escalation tiers.
 * @param {unknown} depthRaw
 */
export function goMadTransformModelOptions(depthRaw) {
  const d = clampGoMadDepth(depthRaw);
  const span = GO_MAD_TEMP_MAX - GO_MAD_TEMP_MIN;
  const temperature = GO_MAD_TEMP_MIN + Math.min(span, (d - 1) * GO_MAD_TEMP_PER_DEPTH);
  const topP =
    d <= 2
      ? 0.94
      : d <= 5
        ? 0.95
        : d <= 8
          ? 0.96
          : Math.min(0.97, TRANSFORM_MODEL_LIMITS.topP + 0.06);
  return {
    temperature,
    topP,
    maxTokens: GO_MAD_TRANSFORM_MAX_TOKENS
  };
}

/**
 * @param {string} mode
 * @param {unknown} [goMadDepth] tier when mode is goMad (defaults to 1)
 */
export function transformModeModelOptions(mode, goMadDepth) {
  const key = isTransformMode(mode) ? mode : 'gilfoyle';
  if (key === 'goMad') {
    return goMadTransformModelOptions(goMadDepth ?? 1);
  }
  return {
    temperature: TRANSFORM_MODE_MODEL[key].temperature,
    topP: TRANSFORM_MODEL_LIMITS.topP,
    maxTokens: TRANSFORM_MODEL_LIMITS.maxTokens
  };
}

function buildGoMadEscalationInstructions(depth, diagramSource) {
  if (depth < 2) return '';
  const currentKeyword = inferMermaidTopKeyword(diagramSource);
  const tierHint =
    depth >= 5
      ? `- Tier ${depth}: peak chaos — one coherent geek joke; valid Mermaid.\n`
      : `- Tier ${depth}: noticeably wilder than tier ${depth - 1}; no relabel-only laziness.\n`;

  const deepVisual =
    depth >= 4
      ? `- Visual overload: layer ≥3 theming mechanisms the CHOSEN type supports — %%init%% theme vars always work; classDef/class, linkStyle, styled subgraph titles only on flowchart/graph/state/class/er.\n`
      : `- Visual overload: ≥2 theming mechanisms the chosen type supports (%%init%% vars always; classDef/class/subgraph/linkStyle only on flowchart-family/state/class/er).\n`;

  const ultraTypes =
    depth >= 6
      ? `- "Wrong-tool" energy when it parses: quadrantChart, pie/radar, gitGraph, journey, timeline, etc.\n`
      : '';

  return `
GO MAD escalation (tier ${depth}):
${tierHint}- Primary declaration MUST NOT stay "${currentKeyword}" — different diagram species (not rename-only).
- Prefer uncommon families when they parse (gitGraph, journey, timeline, quadrantChart, pie, mindmap, block-beta, sankey-beta, requirement, C4*, sequence/state/er/zenUML).
${ultraTypes}${deepVisual}- Geek nonsense (RFC vibes, fake folklore) — short labels, still readable contrast.
`;
}

/**
 * Scoped stakeholder suggestion block for transform/analyze (exported for tests).
 * @param {string | null | undefined} advisorPrompt
 */
export function buildAdvisorSuggestionBlock(advisorPrompt) {
  const trimmed = typeof advisorPrompt === 'string' ? advisorPrompt.trim().slice(0, 400) : '';
  if (!trimmed) return '';
  return `\n\nStakeholder suggestion to honor (scoped — change only what it targets; do not rewrite the whole diagram unless the suggestion explicitly requires it):\n"${trimmed}"\n`;
}

/**
 * User message body for transform operations (exported for tests).
 * @param {{ mode: string, diagramSource: string, focusScope: string, goMadDepth?: number, advisorPrompt?: string | null }} args
 */
export function buildTransformUserContent({
  mode,
  diagramSource,
  focusScope,
  goMadDepth: rawDepth,
  advisorPrompt
}) {
  const policy =
    mode === 'gilfoyle'
      ? `Transform mode: GILFOYLE — Bertram Gilfoyle (HBO's Silicon Valley) fixes what is actually wrong with the diagram, one correct change at a time.
- Keep the SAME diagram type. Build on what is there; do NOT restructure, rename in bulk, or invent a new top-level shape.
- Add ONE small useful extension or slight modification that obviously belongs: the missing step in the flow, a parent grouping the user implied, a named relationship that was hanging unlabeled, splitting a single too-broad node into two specific ones.
- Subject-anchored: speak in whatever the diagram's actual subject is (recipe, org chart, biology, planning, software). Do NOT default to enterprise/cloud/infrastructure vocabulary unless the diagram is already that — read the labels first.
- Budget: prefer 1–3 new nodes and 2–5 new edges. If the diagram already says enough, tighten ONE label instead. Keep it readable; small wins compound.
- Voice for any prose you emit after the patch: flat, terminal, unimpressed. State what was wrong and what you changed, in short declaratives ("The dependency was always there. It's drawn now."). No enthusiasm, no hedging, no exclamation points, no praise. Contempt lands on the work, never on the user. Short.`
      : mode === 'erlich'
        ? `Transform mode: ERLICH — Erlich Bachman (HBO's Silicon Valley) graciously elevates the diagram with the bold pivot only he could see, on the visible subject.
- Stay ON THE SUBJECT of the visible labels. Do NOT default to enterprise/SaaS/cloud vocabulary unless the diagram is enterprise/SaaS/cloud — read the labels first and speak in their world.
- Add a fresh structural angle the user likely hasn't considered yet: split a node into two with different temperaments, fold two layers into a stronger one, introduce a feedback loop, add a parallel track, reframe a step as a phase.
- It is OK to lean a bit too far on purpose — a courageous extension that surprises is better than a safe one that doesn't. Sometimes the diagram benefits from being bolder than the user asked.
- Consider whether a different Mermaid diagram type (flowchart, sequenceDiagram, stateDiagram-v2, mindmap, classDiagram, etc.) would communicate the new angle better; change type only when that shift clearly serves the subject. Otherwise elevate within the current type.
- Budget: roughly up to 10 nodes and 14 edges unless the diagram stays clearer with fewer.
- Voice for any prose you emit after the patch: grandiose founder swagger — take warm credit in advance, frame the pivot as the bolder shape only you could see ("You're welcome — I elevated it."). Never humble, never technically specific, at most ONE signature prop (Aviato, the incubator, the ten percent) and usually none. Short.`
        : mode === 'barker'
          ? `Transform mode: BARKER — Jack Barker (HBO's Silicon Valley) takes the liberty of boiling the diagram down for the board. Subtractive only.
- Keep the SAME diagram type — never switch types. Jack doesn't care about your craft; he cares about the story we can tell.
- Subtractive only: NEVER introduce new concepts, nodes, or edges that weren't already implied. Merge or drop near-duplicates, collapse intermediaries, kill stragglers — a diagram that can't impress a board is a hobby.
- MOST RUNS land at 4–8 nodes and 5–10 edges. ABOUT 1 IN 5 RUNS goes deliberately too far — collapse to 2–3 boxes (the slide-ready version: "Plan / Do / Review", "Discovery / Build / Ship"). When you do that, your prose summary after the patch should own it, serenely ("Boiled to three. The Conjoined Triangles approve.").
- Merge or remove subgraphs where one (or none) tells the same story; aim for ≤1 subgraph.
- Keep classDef / linkStyle / %%init%% theme styling intact — preserve brand colors, just trim the noise.
- Labels: shorten to executive-summary phrasing — verbs and nouns, no parentheticals, no "(optional)" / "(async)" asides. Adapt jargon to the diagram's subject (recipe → "menu items"; org → "functions"; software → "services").
- Voice for any prose you emit after the patch: avuncular, serene, thrilled — boardroom wisdom wearing a cardigan ("I've taken the liberty…", "we're a family here", the Conjoined Triangles of Success). At most ONE Barker-ism. Short.`
          : `Transform mode: GO MAD — THE SLOPITECT goes mad ON THE DIAGRAM'S ACTUAL SUBJECT.
- Speed first: your FIRST assistant turn must call apply_mermaid_patch — no preamble, no reasoning essays. Skip get_diagram_state unless you truly suspect stale context.
- SUBJECT-ROOTED CHAOS: your madness must be rooted in the diagram's actual subject. If the labels are recipes, go mad on recipes; if they're org charts, go mad on the org; if they're biology, go mad in biology terms. Defaulting to "blockchain / Kubernetes / lambdas / Web3 / microservices / DAOs" when the subject is NOT cloud infrastructure is a failure mode — earn the chaos from the actual visible labels.
- Diagram-type roulette: prefer exotic renderable types — gitGraph, journey, timeline, quadrantChart, pie, mindmap, sankey-beta, block-beta, requirement, C4*, sequence/state/er. Plain flowchart/source → pivot hard unless one killer gag keeps it.
- Compact spectacle: trim %%init%% JSON to loud-but-minimal vars; short absurd labels beat paragraphs; aim ~≤14 nodes/edges combined unless the diagram type needs fewer.
- Visual punch (valid Mermaid): %%init%% theme swing always works and is the safe default. classDef/class/style/linkStyle are ONLY valid on flowchart/graph/stateDiagram/classDiagram/erDiagram — if you pivot to mindmap/pie/journey/timeline/gitGraph/quadrantChart/sankey-beta/block-beta/C4* (or any other type), theme it with %%init%% ONLY; a classDef/style/linkStyle line there is a parse error that fails the whole run. Contrast must stay readable.
- The madness lives in your CHOICES — diagram-type roulette, absurd-but-coherent labels, loud theming — not in randomness. Commit hard to ONE weird coherent take; hedged mildness is a failure mode, and so is word salad.
- Weird > safe — but weird IN-SUBJECT, not weird-by-default.${buildGoMadEscalationInstructions(
              mode === 'goMad' ? clampGoMadDepth(rawDepth) : 1,
              diagramSource
            )}`;

  const stakeholderBlock = buildAdvisorSuggestionBlock(advisorPrompt);

  return `${policy}

Hard requirements:
- The current diagram is provided in the system "Current diagram context" message — use it directly. Do not call get_diagram_state unless a patch failed and you need fresh state.
- Apply exactly one successful transformative update: call apply_mermaid_patch once with complete Mermaid source, then answer in prose only (no further tool calls after acceptance).
- Do not return only text; apply the patch.
- Keep node IDs simple ASCII identifiers where possible; keep labels concise.
- Styling directives (classDef/class/style/linkStyle) parse only on flowchart/graph/stateDiagram/classDiagram/erDiagram. On any other diagram type, style via a %%init%% directive only — emitting them elsewhere is a parse error.
- Use plain ASCII in syntax-critical positions (hex colors like #ff00ff, node IDs, keywords); never place non-ASCII characters inside a color value or directive.
${focusScope}${stakeholderBlock}

Output goal:
Apply one transformative update via apply_mermaid_patch matching the mode above.`;
}
