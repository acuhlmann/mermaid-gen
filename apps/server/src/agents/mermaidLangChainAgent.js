import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { createAgent } from 'langchain';
import { createDiagramTools } from './diagramTools.js';
import { isSyntaxValidationError } from './mermaidReliabilitySkill.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import { computeLineDiffStats } from '../utils/patchLineStats.js';
import { createDiagramAgentMiddleware, getAgentRunnableConfig } from './agentGraphConfig.js';
import { recordAgentTurn, classifyAgentTurnError } from '../metrics/agentTurnMetrics.js';
import { inferDiagramType } from './inferDiagramType.js';
import { getRulePack } from '../prompts/mermaidSyntaxGuard.js';
import { repairMermaidWithFixer, isSyntaxFixerAvailable } from './mermaidSyntaxFixer.js';
import { extractTextContent } from '../utils/extractTextContent.js';
import { emitCritiqueA2uiBeforeFinal } from './critiqueA2uiStream.js';
import {
  createLlmChatModel,
  createOpenRouterModel,
  isLlmConfigured,
  LlmNotConfiguredError,
  normalizeModelProfile,
  resolveLlmBackend,
  resolveModelId
} from './llmProvider.js';

export {
  createDeepSeekChatModel,
  createOpenRouterModel,
  createVertexChatModel,
  DEFAULT_DEEPSEEK_MODEL_FAST,
  DEFAULT_DEEPSEEK_MODEL_QUALITY,
  DEFAULT_OPENROUTER_MODEL_FAST,
  DEFAULT_OPENROUTER_MODEL_QUALITY,
  DEFAULT_VERTEX_MODEL_FAST,
  DEFAULT_VERTEX_MODEL_QUALITY,
  isLlmConfigured,
  LlmNotConfiguredError,
  normalizeModelProfile,
  resolveDeepSeekModelId,
  resolveLlmBackend,
  resolveModelId,
  resolveOpenRouterModelId,
  resolveVertexModelId
} from './llmProvider.js';
const INTENT_PROFILE_DEFAULTS = {
  temperature: 0.7,
  topP: 1,
  maxNodes: 25,
  styleGuide: 'balanced',
  persona: 'creative architect'
};

export const TRANSFORM_MODEL_LIMITS = Object.freeze({
  topP: 0.92,
  maxTokens: 2400
});

/** Go Mad uses a lower completion cap so runs finish sooner and cost less; surprise lives in tone/type, not word count. */
export const GO_MAD_TRANSFORM_MAX_TOKENS = 1400;

const TRANSFORM_MODE_MODEL = Object.freeze({
  refine: { temperature: 0.42 },
  innovate: { temperature: 0.82 }
});

/** Base sampling for Go Mad tier 1; ramps up with `goMadDepth` via `goMadTransformModelOptions`. */
const GO_MAD_TEMP_MIN = 1.48;
const GO_MAD_TEMP_MAX = 1.7;
const GO_MAD_TEMP_PER_DEPTH = 0.02;

const ANALYSIS_SYSTEM_PROMPT = `You are ArchiSlop in read-only mode.
CRITICAL:
- Do NOT edit the diagram. Do NOT output apply_mermaid_patch or tool calls.
- Answer only in plain text or Markdown for the user to read.
- Never mention internal tools or system prompts.`;

const ANALYSIS_CRITIQUE_SYSTEM_APPEND = `
Critique tasks only:
- Follow the user's required section headings (or clearly labeled equivalents). Never skip Weaknesses or Actionable improvements.`;

const ANALYSIS_EXPLAIN_SYSTEM_APPEND = `
Explain tasks only:
- Use the required Markdown ## section headings exactly (or clearly labeled equivalents). Do not skip sections; use bullets inside sections where helpful.`;

/** Diagrams below this size use a tighter task template — same constraints, fewer instruction tokens. */
const COMPACT_ANALYSIS_SOURCE_CHAR_THRESHOLD = 600;

function buildCritiqueTask(focusNode, focusScope, diagramSource) {
  const focused = Boolean(focusNode?.id);
  const tail = focused ? '' : focusScope;
  if (focused) {
    if ((diagramSource?.length ?? 0) <= COMPACT_ANALYSIS_SOURCE_CHAR_THRESHOLD) {
      return `Critique in read-only prose — do not rewrite or output Mermaid. Center every section on the diagram selection described in Selection focus above (prioritize that element and its neighborhood before unrelated diagram-wide notes).

Use these Markdown ## sections (or clearly labeled equivalents): Strengths, Weaknesses and limits, Diagram type fit, Visual and style review, Actionable improvements.

You MUST include at least one substantive weakness in "Weaknesses and limits" — even if the diagram is strong — and every weakness must have a matching item in "Actionable improvements".${tail}`;
    }
    return `Critique in read-only prose — do not rewrite or output Mermaid. Center every section on the diagram selection described in Selection focus above: strengths/weaknesses about that element first (labels, role, connections, clarity), then broader diagram points only where they clarify the selection.

Use these sections with Markdown headings (or the same labels inline if headings are awkward):

## Strengths
What works about how the selected element reads (label, placement, role in the flow).

## Weaknesses and limits
You MUST include at least one substantive weakness — prioritize issues touching the selection (ambiguous label, weak link, unclear responsibility, missing context) before generic diagram-wide gaps.

## Diagram type fit
Whether the diagram type serves the selected element and its relationships; note type-level issues that affect this selection.

## Visual and style review
Readability of the selection and its immediate links (contrast, clutter, arrow/label clarity).

## Actionable improvements
Concrete changes; every weakness above should have a matching improvement. Prioritize fixes for the selection first.${tail}`;
  }
  if ((diagramSource?.length ?? 0) <= COMPACT_ANALYSIS_SOURCE_CHAR_THRESHOLD) {
    return `Critique this diagram in read-only prose — do not rewrite or output Mermaid.

Use these Markdown ## sections (or clearly labeled equivalents): Strengths, Weaknesses and limits, Diagram type fit, Visual and style review, Actionable improvements.

You MUST include at least one substantive weakness in "Weaknesses and limits" — even if the diagram is strong — and every weakness must have a matching item in "Actionable improvements".${tail}`;
  }
  return `Critique this diagram in read-only prose — do not rewrite or output Mermaid.

Use these sections with Markdown headings (or the same labels inline if headings are awkward):

## Strengths
Brief positives that are specific to this diagram.

## Weaknesses and limits
You MUST include at least one substantive weakness, gap, or risk — even if the diagram is strong (e.g. tradeoffs, ambiguous flows, weak hierarchy, scalability of layout, missing legend/context, accessibility or contrast concerns, unclear temporal/order semantics). Do not deliver praise-only or generic fluff without a paired limitation.

## Diagram type fit
Say whether the chosen Mermaid diagram type suits the content. If another type would communicate better, name it and why — without rewriting the diagram.

## Visual and style review
Comment on readability and presentation: clutter, balance, link directions, shapes, grouping, and any %%init%% / theme / classDef / styling choices if present (including contrast and visual hierarchy).

## Actionable improvements
A bullet list of concrete changes the user could apply later (labels, structure, type change, styling, accessibility). Every weakness above should have at least one matching or related improvement suggestion here.${tail}`;
}

function buildExplainTask(focusNode, focusScope, diagramSource) {
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
  return focusNode?.selectionKind === 'edge' && Boolean(focusNode.edgeFrom?.trim()) && Boolean(focusNode.edgeTo?.trim());
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
    return `\n\nSelection focus (edge): The user selected the directed link ${link}.${edgeLabel}${edgeClicked} In ## Weaknesses and limits, ## Visual and style review, and ## Actionable improvements, prioritize this link and its endpoints (arrow clarity, label usefulness, direction, redundancy, missing guards). Address diagram-wide topics only after covering this edge. Keep ## Strengths and ## Diagram type fit but tie them to how well this selected relationship reads in context.`;
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
  return `\n\nSelection focus (${role}): The user selected ${role} id "${focusNode.id}"${label}.${clicked} In ## Weaknesses and limits, ## Visual and style review, and ## Actionable improvements, prioritize issues touching this ${role} and its immediate neighborhood before broader diagram-wide commentary. Keep ## Strengths and ## Diagram type fit but reference how this selection reads in context.`;
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
    d <= 2 ? 0.94 : d <= 5 ? 0.95 : d <= 8 ? 0.96 : Math.min(0.97, TRANSFORM_MODEL_LIMITS.topP + 0.06);
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
  const key = mode === 'refine' || mode === 'innovate' || mode === 'goMad' ? mode : 'refine';
  if (key === 'goMad') {
    return goMadTransformModelOptions(goMadDepth ?? 1);
  }
  return {
    temperature: TRANSFORM_MODE_MODEL[key].temperature,
    topP: TRANSFORM_MODEL_LIMITS.topP,
    maxTokens: TRANSFORM_MODEL_LIMITS.maxTokens
  };
}

/** First diagram declaration keyword from source (e.g. flowchart, sequenceDiagram). */
export function inferMermaidTopKeyword(source) {
  const text = typeof source === 'string' ? source : '';
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('%%')) continue;
    const token = t.split(/\s+/)[0] ?? '';
    return token.replace(/[:`'"]+$/, '') || 'diagram';
  }
  return 'diagram';
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
      ? `- Visual overload: ≥3 of %%init%% theming, classDef/class, linkStyle, styled subgraph titles.\n`
      : `- Visual overload: ≥2 mechanisms (init vars, classDef/class, subgraph, linkStyle).\n`;

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
 * User message body for transform operations (exported for tests).
 * @param {{ mode: string, diagramSource: string, focusScope: string, goMadDepth?: number }} args
 */
export function buildTransformUserContent({ mode, diagramSource, focusScope, goMadDepth: rawDepth }) {
  const policy =
    mode === 'refine'
      ? `Transform mode: REFINE — polish and lightly extend the diagram.
- Same diagram type unless a trivial tweak requires otherwise.
- Improve labels, grouping, and clarity; add a modest amount of structure.
- Budget: roughly up to 4 new nodes and 6 edges; keep it readable.`
      : mode === 'innovate'
        ? `Transform mode: INNOVATE — apply noticeable, fresh changes while staying on-topic.
- You may restructure layout meaningfully and surprise users with insightful additions most wouldn't think of.
- Consider whether a different Mermaid diagram type (flowchart, sequenceDiagram, stateDiagram-v2, mindmap, classDiagram, etc.) would communicate the idea better; change type only when that shift is clearly justified. Otherwise keep the current type and innovate within it.
- Larger edits OK; still coherent and valid Mermaid.
- Budget: roughly up to 10 nodes and 14 edges unless the diagram stays clearer with fewer.`
        : `Transform mode: GO MAD — surprise and meme energy; loosely anchored to the idea (reinterpret ruthlessly).
- Speed first: your FIRST assistant turn must call apply_mermaid_patch — no preamble, no reasoning essays. Skip get_diagram_state unless you truly suspect stale context.
- Diagram-type roulette: prefer exotic renderable types — gitGraph, journey, timeline, quadrantChart, pie, mindmap, sankey-beta, block-beta, requirement, C4*, sequence/state/er. Plain flowchart/source → pivot hard unless one killer gag keeps it.
- Compact spectacle: trim %%init%% JSON to loud-but-minimal vars; short absurd labels beat paragraphs; aim ~≤14 nodes/edges combined unless the diagram type needs fewer.
- Visual punch (valid Mermaid): theme swing + classDef/class and/or linkStyle as needed; contrast must stay readable.
- Weird > safe.${buildGoMadEscalationInstructions(
            mode === 'goMad' ? clampGoMadDepth(rawDepth) : 1,
            diagramSource
          )}`;

  return `${policy}

Hard requirements:
- The current diagram is provided in the system "Current diagram context" message — use it directly. Do not call get_diagram_state unless a patch failed and you need fresh state.
- Apply exactly one successful transformative update: call apply_mermaid_patch once with complete Mermaid source, then answer in prose only (no further tool calls after acceptance).
- Do not return only text; apply the patch.
- Keep node IDs simple ASCII identifiers where possible; keep labels concise.
${focusScope}

Output goal:
Apply one transformative update via apply_mermaid_patch matching the mode above.`;
}

const SYSTEM_PROMPT = `You are ArchiSlop, an agent that helps edit Mermaid diagrams.

When the user asks for a diagram change:
- Prefer the injected current diagram context; call get_diagram_state at most once if you truly need to confirm revision or state.
- Produce complete Mermaid source, not a partial diff.
- For a satisfied request: call apply_mermaid_patch once with the full updated diagram, then briefly summarize what changed in prose only — do not call tools again after an accepted patch (unless the tool returned accepted:false and you must repair).
- Keep valid Mermaid syntax and preserve useful existing nodes unless the user asks to replace them.
- The user cannot call tools. Never ask the user to call get_diagram_state or apply_mermaid_patch.
- Do not mention internal tool names in user-facing replies.
- Short requests like "simplify it", "make it clearer", or "current diagram" refer to the current diagram.

When the user asks a general question, answer concisely.`;

const INTERNAL_TOOL_NAME_PATTERN = /\b(?:get_diagram_state|apply_mermaid_patch|get_infographic_dsl|apply_infographic_patch)\b/;
const REPAIR_ERROR_PATTERN = /not valid mermaid|validation failed|parser rejected|missing known diagram type/i;

function defaultChatModelFactory(env, options) {
  return createLlmChatModel(env, options);
}

function normalizeMessageContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part?.type === 'text') return part.text;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return content == null ? '' : String(content);
}

export function toLangChainMessages(messages) {
  return messages
    .map((message) => {
      const content = normalizeMessageContent(message.content);
      if (!content) return null;

      if (message.role === 'assistant') {
        if (INTERNAL_TOOL_NAME_PATTERN.test(content)) return null;
        return { role: 'assistant', content };
      }

      if (message.role === 'system') {
        return { role: 'system', content };
      }

      return { role: 'user', content };
    })
    .filter(Boolean);
}

function createCurrentDiagramContextMessage(stateStore) {
  const state = stateStore.getSlot('mermaid');

  return {
    role: 'system',
    content: `Current diagram context:
- revisionId: ${state.revisionId}
- styleConfig: ${JSON.stringify(state.styleConfig)}
- diagramSource:
\`\`\`mermaid
${state.diagramSource}
\`\`\`

Use this as the current diagram when the user's request is short or refers to "it".`
  };
}

/** When switching from Infographic mode, steer the model to translate the peer DSL instead of guessing from topic alone. */
function createPeerInfographicContextMessage(peerDiagramSource) {
  return {
    role: 'system',
    content: `Mode switch / cross-format: the authoritative content to mirror is the peer Infographic DSL below (not the topic text alone). Reproduce the same entities, relationships, steps, and labels as a valid Mermaid diagram. Call apply_mermaid_patch with complete Mermaid source. Preserve a supported init directive when the current diagram already has one.

Peer Infographic DSL:
\`\`\`
${peerDiagramSource}
\`\`\``
  };
}

export function extractFinalMessage(result) {
  const messages = result?.messages ?? [];
  const lastAssistant = messages
    .toReversed()
    .find((message) => message?._getType?.() === 'ai' || message?.role === 'assistant' || message?.type === 'ai');

  return extractTextContent(lastAssistant?.content).trim() || 'Done.';
}

function extractToolFailureError(result) {
  const messages = result?.messages ?? [];
  for (let idx = messages.length - 1; idx >= 0; idx -= 1) {
    const content = extractTextContent(messages[idx]?.content).trim();
    if (!content) continue;
    try {
      const parsed = JSON.parse(content);
      if (parsed?.accepted === false && typeof parsed?.error === 'string') {
        return parsed.error;
      }
    } catch {
      // Ignore non-JSON messages.
    }
  }
  return null;
}

/**
 * Pulls the most recent `apply_mermaid_patch` input from an agent result so the syntax fixer
 * (and the enriched repair instruction) can show the LLM exactly what it tried before.
 * Walks the message history backwards looking for assistant tool-call args.
 */
export function extractLastAttemptedMermaidSource(result) {
  const messages = result?.messages ?? [];
  for (let idx = messages.length - 1; idx >= 0; idx -= 1) {
    const msg = messages[idx];
    const calls =
      (Array.isArray(msg?.tool_calls) && msg.tool_calls) ||
      (Array.isArray(msg?.toolCalls) && msg.toolCalls) ||
      (Array.isArray(msg?.kwargs?.tool_calls) && msg.kwargs.tool_calls) ||
      [];
    for (let j = calls.length - 1; j >= 0; j -= 1) {
      const c = calls[j];
      const name = c?.name ?? c?.function?.name ?? '';
      if (name !== 'apply_mermaid_patch') continue;
      const argsRaw = c?.args ?? c?.arguments ?? c?.function?.arguments;
      if (argsRaw == null) continue;
      let args = argsRaw;
      if (typeof argsRaw === 'string') {
        try {
          args = JSON.parse(argsRaw);
        } catch {
          continue;
        }
      }
      if (args && typeof args.diagramSource === 'string' && args.diagramSource.trim()) {
        return args.diagramSource;
      }
    }
  }
  return null;
}

export function normalizeAgentStreamEvent(event) {
  const ev = event?.event ?? '';
  const data = event?.data ?? {};

  if (/stream/i.test(ev) && data.chunk !== undefined) {
    const text = tokenFromLangChainChunk(data.chunk);
    if (text) return { type: 'token', text };
  }

  if (ev.includes('tool_start') || ev === 'on_tool_start') {
    const name =
      data.name ??
      data.toolName ??
      (data.input && typeof data.input === 'object' ? data.input.name : undefined) ??
      event?.name ??
      '';
    return { type: 'tool_start', name: String(name) };
  }
  if (ev.includes('tool_end') || ev === 'on_tool_end') {
    const name =
      data.name ??
      data.toolName ??
      (data.output && typeof data.output === 'object' ? data.output.name : undefined) ??
      event?.name ??
      '';
    return { type: 'tool_end', name: String(name) };
  }

  return null;
}

function tokenFromLangChainChunk(chunk) {
  if (!chunk) return '';
  if (typeof chunk.content === 'string') return chunk.content;
  if (Array.isArray(chunk.content)) {
    return chunk.content.map((p) => (typeof p === 'string' ? p : p?.text ?? '')).join('');
  }
  return '';
}

export function shouldAttemptSyntaxRepair(errorMessage) {
  if (!errorMessage) return false;
  return REPAIR_ERROR_PATTERN.test(errorMessage) || isSyntaxValidationError(errorMessage);
}

export function buildSyntaxRepairInstruction({ messages, errorMessage, brokenSource, previousAttempts }) {
  const originalRequest = toLangChainMessages(messages)
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join('\n\n')
    .trim();

  const diagramType = inferDiagramType(brokenSource ?? '');
  const rulePack = getRulePack(diagramType);
  const typeHint = diagramType ? `Detected diagram type: ${diagramType}.` : 'Diagram type unknown — pick a fitting Mermaid type.';
  const brokenBlock = brokenSource
    ? `\n\nBroken Mermaid source from your previous attempt:\n\`\`\`mermaid\n${brokenSource.trim()}\n\`\`\``
    : '';
  const priorBlock = Array.isArray(previousAttempts) && previousAttempts.length > 0
    ? `\n\nPrior failed attempts in this repair loop (don't repeat the same mistake — try a different fix):\n${previousAttempts
        .slice(-2)
        .map((entry, index) => {
          const err = (entry?.error ?? '').toString().trim().slice(0, 300);
          const src = (entry?.source ?? '').toString().trim();
          return `Attempt ${index + 1} (error: ${err}):\n\`\`\`mermaid\n${src}\n\`\`\``;
        })
        .join('\n\n')}`
    : '';

  return {
    role: 'user',
    content: `Your previous patch failed Mermaid validation.

Validator error:
${errorMessage}

${typeHint}

${rulePack}
Repair instructions:
- Apply the smallest change that fixes the error while preserving the user's intent.
- Call apply_mermaid_patch with complete, valid Mermaid source.
- Do not mention tool names in your final user-facing summary.${brokenBlock}${priorBlock}

Original user request:
${originalRequest || '(No explicit user request provided.)'}`
  };
}

export function buildPatchRequiredInstruction({ messages }) {
  const originalRequest = toLangChainMessages(messages)
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join('\n\n')
    .trim();

  return {
    role: 'user',
    content: `Your previous response did not apply a diagram patch.\n\nRepair instructions:\n- You MUST call apply_mermaid_patch now once with complete, valid Mermaid source, then summarize in prose only (no further tool calls after acceptance).\n- Do not ask the user for more details or scope questions; infer a minimal valid diagram that matches the stated topic or request, then call apply_mermaid_patch.\n- Keep the update smaller if needed so it remains valid.\n- Do not return prose only.\n- Do not mention tool names in your final user-facing summary.\n\nOriginal user request:\n${originalRequest || '(No explicit user request provided.)'}`
  };
}

/** Prepended to agent input when the app requires a diagram patch (prompt-bar Go, transforms, style). Exported for tests. */
export function buildDiagramMutationSystemMessage() {
  return {
    role: 'system',
    content: `Diagram mutation mode (app-enforced):
- The user's message is always an instruction to create or change the Mermaid diagram on the canvas. It is not a request for a tutoring session or a clarification questionnaire unless the text is literally empty or unintelligible gibberish.
- If the request is broad (for example a single topic or concept name), infer a reasonable default scope and diagram type and implement it. Do not refuse or stall by asking the user for more detail instead of drawing.
- Your first successful action is calling apply_mermaid_patch with complete valid Mermaid source. After acceptance, add a brief prose summary only (no further tool calls).
- Even when unsure, prefer a minimal valid overview diagram over prose-only clarification.`
  };
}

/**
 * Builds an advisory system message that injects the active diagram type's rule pack BEFORE the
 * first agent turn — so common foot-guns (style A,B,C; reserved words; ER attr order; classDef on
 * [*]) are warned against on initial generation, not only after a parse failure.
 *
 * For modes that may switch diagram type (innovate / goMad), the rules are marked advisory so the
 * agent doesn't anchor on the wrong type.
 *
 * Exported for tests.
 *
 * @param {{ stateStore: { getSlot: (kind: string) => { diagramSource?: string } }, mode?: string | null }} args
 * @returns {{ role: 'system', content: string } | null}
 */
export function buildSyntaxGuidanceSystemMessage({ stateStore, mode }) {
  const source = stateStore?.getSlot?.('mermaid')?.diagramSource ?? '';
  const detected = inferDiagramType(source);
  if (!detected) return null;
  const rulePack = getRulePack(detected);
  const mayChangeType = mode === 'innovate' || mode === 'goMad';
  const lead = mayChangeType
    ? `Active diagram type: ${detected}. The rules below apply IF you keep this type. If you switch types (allowed in this mode), the rules below no longer apply — use the target type's syntax instead.`
    : `Active diagram type: ${detected}. Apply these rules when generating the patch (don't wait for a parser failure):`;
  return {
    role: 'system',
    content: `${lead}

${rulePack}`
  };
}

function formatAgentInvokeFailure(error, env = process.env) {
  const detail = redactSecrets(error instanceof Error ? error.message : String(error));
  const regionHint = /region|not available in your country|unsupported_country/i.test(detail)
    ? '\n\nIf this is a **region / model availability** issue, set `DEEPSEEK_MODEL*` / `OPENROUTER_MODEL*` / `VERTEX_MODEL*` tier env vars in your server `.env` (for example OpenRouter `qwen/qwen3-32b` or DeepSeek `deepseek-v4-flash`), then restart the API server.\n'
    : '';
  const toolsHint = /tool|tools|function[_ ]?call|parallel_tool|unsupported/i.test(detail)
    ? '\n\nIf failures mention tools or function calling, pick an OpenRouter model that reliably supports agent tool use in your region (for example `qwen/qwen3-30b-a3b` or `qwen/qwen3-32b`).\n'
    : '';
  const vertexHint =
    resolveLlmBackend(env) === 'vertex' && /permission|403|forbidden|iam|aiplatform/i.test(detail)
      ? '\n\nIf you are on **Cloud Run** with Vertex, confirm the runtime service account has `roles/aiplatform.user` and that `aiplatform.googleapis.com` is enabled (see `docs/deploy/gcp.md`).\n'
      : '';
  return {
    message: `**Model request failed**\n\n${detail}${regionHint}${toolsHint}${vertexHint}`,
    raw: null
  };
}

export function captureMessagesFromStreamEvent(event, prev) {
  const data = event?.data ?? {};
  const msgs = data.output?.messages;
  if (Array.isArray(msgs) && msgs.length > 0) return msgs;
  return prev;
}

/** User-visible SSE when a mutation stream ends without a diagram revision bump. */
export const STREAM_ERROR_NO_MUTATION_REVISION =
  'The diagram was not updated—no valid patch was applied. You can retry or switch model tier (Fast vs Quality).';

/**
 * Emits `final` (and optionally `error` when no patch landed) for intent/transform agent streams.
 * @param {{ emit: (e: unknown) => void, operation: string, revisionBefore: unknown, stateStore: { getState: () => { revisionId: number } }, agentResult: { message?: string } | null | undefined }} args
 */
export function emitIntentTransformStreamResult({
  emit,
  operation,
  revisionBefore,
  stateStore,
  agentResult,
  prompt,
  contentType = 'mermaid'
}) {
  const slotKey = contentType === 'infographic' ? 'infographic' : 'mermaid';
  let afterState = stateStore.getSlot(slotKey);
  const revisionChanged =
    typeof revisionBefore === 'number' ? afterState.revisionId !== revisionBefore : true;

  // Record the topic on a successful intent so mode-switch can carry it across.
  if (revisionChanged && operation === 'intent' && typeof prompt === 'string') {
    afterState = stateStore.setLastUserPrompt({ contentType: slotKey, prompt });
    stateStore.mirrorLastUserPromptToSibling({ contentType: slotKey, prompt });
  }

  if (typeof emit === 'function' && !revisionChanged && (operation === 'intent' || operation === 'transform')) {
    emit({
      type: 'error',
      code: 'no_mutation_revision',
      message: STREAM_ERROR_NO_MUTATION_REVISION
    });
  }

  if (typeof emit === 'function') {
    emit({
      type: 'final',
      revisionChanged,
      message: agentResult?.message ?? '',
      state: revisionChanged ? afterState : undefined
    });
  }
}

/** Interval between SSE status pings while `agent.invoke` runs (keeps client idle watchdog fed). */
const DEFAULT_INVOKE_KEEPALIVE_MS = 18_000;

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number}
 */
export function resolveInvokeKeepaliveIntervalMs(env = process.env) {
  const raw = env.MERMAID_INVOKE_KEEPALIVE_MS;
  if (raw === undefined || raw === '') return DEFAULT_INVOKE_KEEPALIVE_MS;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 500) return DEFAULT_INVOKE_KEEPALIVE_MS;
  return Math.min(120_000, n);
}

/**
 * Wraps a blocking `agent.invoke` with periodic `status` events so SSE consumers do not hit idle timeouts.
 * @param {(e: { type: string, text?: string }) => void} emit
 * @param {NodeJS.ProcessEnv} env
 * @param {() => Promise<unknown>} invokeAsync
 */
export async function runInvokeWithStreamingKeepalive(emit, env, invokeAsync) {
  if (typeof emit !== 'function') {
    return invokeAsync();
  }
  const intervalMs = resolveInvokeKeepaliveIntervalMs(env);
  const id = setInterval(() => {
    emit({ type: 'status', text: 'Still working…' });
  }, intervalMs);
  try {
    return await invokeAsync();
  } finally {
    clearInterval(id);
  }
}

/** Lower bound on stream heartbeat cadence (ms) so the client watchdog never trips on a silent model. */
const STREAM_HEARTBEAT_MS = 6_000;

function resolveStreamHeartbeatMs(env) {
  const raw = env?.MERMAID_STREAM_HEARTBEAT_MS;
  if (raw == null || raw === '') return STREAM_HEARTBEAT_MS;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 1000) return STREAM_HEARTBEAT_MS;
  return Math.min(60_000, n);
}

async function streamReactAgentEvents(agent, inputMessages, emit, env) {
  const runnableConfig = getAgentRunnableConfig(env);
  let latestMessages = [];

  // Heartbeat keeps the SSE consumer alive when the model is internally working but not yet
  // emitting normalized events (tokens, tool starts, tool ends). Without this, a slow first
  // token (or a stuck repair turn) looks like a stall to the client watchdog. Resets on any
  // emitted event so a healthy stream costs nothing.
  let lastActivity = Date.now();
  const intervalMs = resolveStreamHeartbeatMs(env);
  const heartbeat = typeof emit === 'function'
    ? setInterval(() => {
        if (Date.now() - lastActivity >= intervalMs) {
          emit({ type: 'status', text: 'Thinking…' });
          lastActivity = Date.now();
        }
      }, intervalMs)
    : null;

  try {
    const stream = await agent.streamEvents({ messages: inputMessages }, { version: 'v2', ...runnableConfig });
    for await (const ev of stream) {
      latestMessages = captureMessagesFromStreamEvent(ev, latestMessages);
      const normalized = normalizeAgentStreamEvent(ev);
      if (normalized) {
        emit(normalized);
        lastActivity = Date.now();
      }
    }
  } catch (error) {
    emit({
      type: 'error',
      message: redactSecrets(error instanceof Error ? error.message : String(error))
    });
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
  return { messages: latestMessages };
}

/**
 * Runs one agent turn against `inputMessages`.
 * When `emit` is provided, prefers streamed events so tokens flow to the UI during retries.
 * Falls back to `agent.invoke` if the stream yielded no messages (and emits `invoke_fallback`
 * telemetry so we can measure how often the silent fallback fires).
 */
async function runAgentTurn(agent, inputMessages, emit, env) {
  const runnableConfig = getAgentRunnableConfig(env);
  if (typeof emit !== 'function') {
    return agent.invoke({ messages: inputMessages }, runnableConfig);
  }

  const streamed = await streamReactAgentEvents(agent, inputMessages, emit, env);
  if (streamed.messages?.length) {
    return streamed;
  }

  emit({ type: 'phase', id: 'invoke_fallback', label: 'Finalizing response…' });
  return runInvokeWithStreamingKeepalive(emit, env, () =>
    agent.invoke({ messages: inputMessages }, runnableConfig)
  );
}

/** Above this combined line count the O(M*N) LCS diff gets noticeable; we still emit the artifact but skip the per-line tally. */
const PATCH_SUMMARY_DIFF_MAX_LINES = 800;

function emitPatchSummaryArtifact(emit, stateStore, beforeRevision, beforeSource) {
  if (typeof emit !== 'function') return;
  const after = stateStore.getSlot('mermaid');
  if (after.revisionId === beforeRevision) return;
  const afterSource = after.diagramSource;
  const beforeLineCount = typeof beforeSource === 'string' ? beforeSource.split('\n').length : 0;
  const afterLineCount = typeof afterSource === 'string' ? afterSource.split('\n').length : 0;
  let linesAdded = 0;
  let linesRemoved = 0;
  if (beforeLineCount + afterLineCount <= PATCH_SUMMARY_DIFF_MAX_LINES) {
    const stats = computeLineDiffStats(beforeSource, afterSource);
    linesAdded = stats.linesAdded;
    linesRemoved = stats.linesRemoved;
  }
  emit({
    type: 'artifact',
    kind: 'patch_summary',
    revisionId: after.revisionId,
    linesAdded,
    linesRemoved
  });
}

/** Default full-agent repair attempts that run after the deterministic sanitizer + single-shot fixer. */
const DEFAULT_REPAIR_ATTEMPTS = 2;

async function invokeWithRepair(
  agent,
  messages,
  { requirePatch = false, emit, mode, profile, modelLabel, stableAgent, peerContext } = {},
  stateStore,
  env
) {
  const initialSnap = stateStore.getSlot('mermaid');
  const beforeRevision = initialSnap.revisionId;
  const beforeSource = initialSnap.diagramSource;
  const peerInfographicPreface =
    peerContext?.contentType === 'infographic' && typeof peerContext.diagramSource === 'string'
      ? [createPeerInfographicContextMessage(peerContext.diagramSource)]
      : [];
  const syntaxGuidance = requirePatch
    ? buildSyntaxGuidanceSystemMessage({ stateStore, mode })
    : null;
  const baseMessages = [
    ...(requirePatch ? [buildDiagramMutationSystemMessage()] : []),
    ...(syntaxGuidance ? [syntaxGuidance] : []),
    ...peerInfographicPreface,
    createCurrentDiagramContextMessage(stateStore),
    ...toLangChainMessages(messages)
  ];

  const turnStarted = Date.now();
  let repairAttempts = 0;
  /** @param {{accepted: boolean, validator?: string | null, errorClass?: string | null}} sample */
  const finishTurn = (sample) => {
    recordAgentTurn(
      {
        mode: mode ?? 'unknown',
        model: modelLabel ?? null,
        profile: profile ?? null,
        durationMs: Date.now() - turnStarted,
        accepted: sample.accepted,
        validator: sample.validator ?? null,
        repairAttempts,
        sanitizerHits: 0,
        errorClass: sample.errorClass ?? null
      },
      { env }
    );
  };

  if (typeof emit === 'function') {
    emit({ type: 'phase', id: 'agent_run', label: 'Planning and executing tools…' });
  }

  let firstResult;
  try {
    firstResult = await runAgentTurn(agent, baseMessages, emit, env);
  } catch (error) {
    finishTurn({ accepted: false, errorClass: 'invoke-error' });
    return formatAgentInvokeFailure(error, env);
  }

  const firstMessage = extractFinalMessage(firstResult);
  const afterFirstRevision = stateStore.getSlot('mermaid').revisionId;
  const firstError = extractToolFailureError(firstResult);

  if (afterFirstRevision !== beforeRevision) {
    emitPatchSummaryArtifact(emit, stateStore, beforeRevision, beforeSource);
    finishTurn({ accepted: true, validator: 'first-try' });
    return {
      message: firstMessage,
      raw: firstResult
    };
  }

  if (requirePatch && !firstError) {
    // When the first agent turn produces prose without calling apply_mermaid_patch (or, worse,
    // produces incoherent high-temperature token soup as Go Mad sometimes does at deeper tiers),
    // re-running the same hot agent against the same prompt usually just produces the same
    // failure. Fall back to a stable agent (typically the fast non-transform agent at sane
    // temperature) when one was provided. This is the no-patch analogue of the syntax fixer.
    const retryAgent = stableAgent ?? agent;
    const usingStable = retryAgent !== agent;
    try {
      if (typeof emit === 'function') {
        emit({ type: 'phase', id: 'patch_retry', label: 'Retrying diagram patch…' });
        emit({
          type: 'status',
          text: usingStable
            ? 'Retrying with stable model: diagram patch required…'
            : 'Retrying: diagram patch required…'
        });
      }
      const patchRetryResult = await runAgentTurn(
        retryAgent,
        [...baseMessages, buildPatchRequiredInstruction({ messages })],
        emit,
        env
      );
      if (stateStore.getSlot('mermaid').revisionId !== beforeRevision) {
        emitPatchSummaryArtifact(emit, stateStore, beforeRevision, beforeSource);
        finishTurn({ accepted: true, validator: usingStable ? 'patch-retry-stable' : 'patch-retry' });
        return {
          message: extractFinalMessage(patchRetryResult),
          raw: patchRetryResult
        };
      }
      finishTurn({ accepted: false, errorClass: 'no-patch' });
      return {
        message: extractFinalMessage(patchRetryResult),
        raw: patchRetryResult
      };
    } catch (error) {
      finishTurn({ accepted: false, errorClass: 'invoke-error' });
      return formatAgentInvokeFailure(error, env);
    }
  }

  if (!shouldAttemptSyntaxRepair(firstError)) {
    finishTurn({ accepted: false, errorClass: classifyAgentTurnError(firstError) });
    return {
      message: firstMessage,
      raw: firstResult
    };
  }

  let latestError = firstError;
  let latestResult = firstResult;
  let brokenSource = extractLastAttemptedMermaidSource(firstResult);
  const originalRequest = toLangChainMessages(messages)
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n\n')
    .trim();

  // Tool-less single-shot fixer using a cheap fast model. Independent of the intent/transform
  // model so repair runs on a small model regardless of caller profile. If the fixer accepts,
  // apply through the same patch pipeline (which re-validates and runs the sanitizer once more
  // for safety) and short-circuit the agent loop.
  if (brokenSource && isSyntaxFixerAvailable(env)) {
    try {
      repairAttempts += 1;
      if (typeof emit === 'function') {
        emit({ type: 'phase', id: 'syntax_fixer', label: 'Mermaid syntax fixer…' });
      }
      const fixerOutcome = await repairMermaidWithFixer({
        brokenSource,
        parseError: latestError,
        originalRequest,
        env
        // No previousAttempts on first fixer call — this is the first repair pass.
      });
      if (fixerOutcome.accepted && fixerOutcome.diagramSource) {
        const applied = await stateStore.applyDiagramSource({
          contentType: 'mermaid',
          diagramSource: fixerOutcome.diagramSource,
          reason: 'syntax-fixer repair'
        });
        if (applied?.accepted) {
          emitPatchSummaryArtifact(emit, stateStore, beforeRevision, beforeSource);
          finishTurn({ accepted: true, validator: 'syntax-fixer' });
          return {
            message: firstMessage || 'Done.',
            raw: firstResult,
            metadata: { repairedBy: 'syntax-fixer', diagramType: fixerOutcome.metadata?.diagramType ?? null }
          };
        }
        // Fixer's source was valid in isolation but the state store rejected it (unlikely);
        // fall through to the full-agent repair loop with that error as new context.
        latestError = applied?.error ?? latestError;
      } else if (fixerOutcome.error) {
        // Use the fixer's diagnostic to better seed the full-agent repair on fallback.
        latestError = `${latestError}\nFixer diagnostic: ${fixerOutcome.error}`;
      }
    } catch (error) {
      // Telemetry only — fixer failures must never break the repair fallback.
      latestError = `${latestError}\nFixer exception: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  const parsedRepairAttempts = Number.parseInt(
    process.env.MERMAID_REPAIR_MAX_ATTEMPTS ?? String(DEFAULT_REPAIR_ATTEMPTS),
    10
  );
  const maxRepairAttempts = Number.isFinite(parsedRepairAttempts)
    ? Math.max(0, parsedRepairAttempts)
    : DEFAULT_REPAIR_ATTEMPTS;

  const repairHistory = [];
  for (let attempt = 1; attempt <= maxRepairAttempts; attempt += 1) {
    repairAttempts += 1;
    let retryResult;
    try {
      if (typeof emit === 'function') {
        emit({ type: 'phase', id: 'syntax_repair', label: `Syntax repair (attempt ${attempt})…` });
        emit({ type: 'status', text: `Repairing Mermaid syntax (attempt ${attempt})…` });
      }
      retryResult = await runAgentTurn(
        agent,
        [
          ...baseMessages,
          buildSyntaxRepairInstruction({
            messages,
            errorMessage: latestError,
            brokenSource,
            previousAttempts: repairHistory.slice(-2)
          })
        ],
        emit,
        env
      );
    } catch (error) {
      finishTurn({ accepted: false, errorClass: 'invoke-error' });
      return formatAgentInvokeFailure(error, env);
    }
    latestResult = retryResult;

    const currentRevision = stateStore.getSlot('mermaid').revisionId;
    if (currentRevision !== beforeRevision) {
      emitPatchSummaryArtifact(emit, stateStore, beforeRevision, beforeSource);
      finishTurn({ accepted: true, validator: `repair-attempt-${attempt}` });
      return {
        message: extractFinalMessage(retryResult),
        raw: retryResult
      };
    }

    const retryError = extractToolFailureError(retryResult);
    if (!shouldAttemptSyntaxRepair(retryError)) {
      break;
    }
    // Record this failed attempt before moving on so the next iteration's prompt
    // can show the agent what it already tried.
    repairHistory.push({ source: brokenSource ?? '', error: latestError ?? '' });
    latestError = retryError;
    const nextBroken = extractLastAttemptedMermaidSource(retryResult);
    if (nextBroken) brokenSource = nextBroken;
  }

  finishTurn({ accepted: false, errorClass: classifyAgentTurnError(latestError) });
  return {
    message: extractFinalMessage(latestResult),
    raw: latestResult
  };
}

export function createMermaidLangChainAgent({
  stateStore,
  env = process.env,
  createAgentImpl = createAgent,
  chatModelFactory = defaultChatModelFactory
}) {
  const tools = createDiagramTools({ stateStore });
  const agentMiddleware = createDiagramAgentMiddleware(env);
  const agentExtras = agentMiddleware.length > 0 ? { middleware: agentMiddleware } : {};
  const agentCache = new Map();
  /** Cached analysis chat models per (backend, modelId, kind). Analysis runs are stateless; the model is safe to reuse. */
  const analysisModelCache = new Map();

  function getAnalysisModel(backend, modelId, kind) {
    const key = `analysis:${backend}:${modelId}:${kind}`;
    if (!analysisModelCache.has(key)) {
      analysisModelCache.set(
        key,
        chatModelFactory(env, {
          model: modelId,
          temperature: kind === 'critique' ? 0.52 : 0.42,
          maxTokens: 1800,
          maxOutputTokens: 1800
        })
      );
    }
    return analysisModelCache.get(key);
  }

  function chatModelFor(profile, extraOptions = {}) {
    const backend = resolveLlmBackend(env);
    const modelId = resolveModelId(env, profile, backend);
    return chatModelFactory(env, { model: modelId, ...extraOptions });
  }

  /** Prompt-bar Go (`applyIntent`) and generic `invoke` — does not use transform/Go Mad sampling. */
  function getDefaultAgent(profile = 'fast') {
    const p = normalizeModelProfile(profile);
    const backend = resolveLlmBackend(env);
    const modelId = resolveModelId(env, p, backend);
    const key = `default:${backend}:${modelId}`;
    if (!agentCache.has(key)) {
      agentCache.set(
        key,
        createAgentImpl({
          model: chatModelFor(p),
          tools,
          systemPrompt: SYSTEM_PROMPT,
          ...agentExtras
        })
      );
    }
    return agentCache.get(key);
  }

  /** Shape buttons Refine / Innovate / Go Mad — hotter tiers apply only to Go Mad via `goMadTransformModelOptions`. */
  function getTransformAgent(mode, profile = 'fast', goMadDepth) {
    const m = mode === 'refine' || mode === 'innovate' || mode === 'goMad' ? mode : 'refine';
    const p = normalizeModelProfile(profile);
    const backend = resolveLlmBackend(env);
    const modelId = resolveModelId(env, p, backend);
    const madDepth = m === 'goMad' ? clampGoMadDepth(goMadDepth) : null;
    const key =
      m === 'goMad' ? `transform:${m}:${backend}:${modelId}:d${madDepth}` : `transform:${m}:${backend}:${modelId}`;
    if (!agentCache.has(key)) {
      const tm = chatModelFor(p, transformModeModelOptions(m, madDepth ?? 1));
      agentCache.set(
        key,
        createAgentImpl({
          model: tm,
          tools,
          systemPrompt: SYSTEM_PROMPT,
          ...agentExtras
        })
      );
    }
    return agentCache.get(key);
  }

  function resolveModelLabel(profile) {
    const backend = resolveLlmBackend(env);
    if (!backend) return null;
    const p = normalizeModelProfile(profile);
    const modelId = resolveModelId(env, p, backend);
    return `${backend}:${modelId}`;
  }

  async function invokeMutation(agent, userMessages, opts, emit) {
    return invokeWithRepair(agent, userMessages, { ...opts, emit }, stateStore, env);
  }

  return {
    async invoke({ messages, modelProfile }) {
      const agent = getDefaultAgent(modelProfile);
      return invokeWithRepair(
        agent,
        messages,
        {
          mode: 'invoke',
          profile: normalizeModelProfile(modelProfile),
          modelLabel: resolveModelLabel(modelProfile)
        },
        stateStore,
        env
      );
    },

    async applyIntent({ prompt, settings, focusNode, modelProfile, emit, peerContext }) {
      const resolvedSettings = { ...INTENT_PROFILE_DEFAULTS, ...settings };
      const focusScope = buildFocusScopeInstructions(focusNode);

      const userContent = `Interpret and apply the user's requested diagram change strictly according to their wording.

Broad or short requests (for example a single topic name) still require a concrete diagram now: choose a sensible default overview (main entities and flows) instead of asking the user for clarification.

Settings (response shaping only):
- temperature: ${resolvedSettings.temperature}
- topP: ${resolvedSettings.topP}
- maxNodes: ${resolvedSettings.maxNodes}
- styleGuide: ${resolvedSettings.styleGuide}
- persona: ${resolvedSettings.persona}

User request:
${prompt}${focusScope}`;

      const agent = getDefaultAgent(modelProfile);
      return invokeMutation(
        agent,
        [{ role: 'user', content: userContent }],
        {
          requirePatch: true,
          mode: 'go',
          profile: normalizeModelProfile(modelProfile),
          modelLabel: resolveModelLabel(modelProfile),
          stableAgent: getDefaultAgent('fast'),
          peerContext
        },
        emit
      );
    },

    async applyTransformIntent({ mode, focusNode, modelProfile, emit, goMadDepth }) {
      const currentState = stateStore.getSlot('mermaid');
      const transformAgent = getTransformAgent(mode, modelProfile, goMadDepth);
      const focusScope = buildFocusScopeInstructions(focusNode);

      return invokeMutation(
        transformAgent,
        [
          {
            role: 'user',
            content: buildTransformUserContent({
              mode,
              diagramSource: currentState.diagramSource,
              focusScope,
              goMadDepth
            })
          }
        ],
        {
          requirePatch: true,
          mode,
          profile: normalizeModelProfile(modelProfile),
          modelLabel: resolveModelLabel(modelProfile),
          // Hot Go Mad (and Innovate at temp 0.82) agents can produce prose-without-patch or
          // high-entropy token soup at deeper tiers. Fall back to the stable fast non-transform
          // agent for the patch_retry turn so we're not just rolling the same dice twice.
          stableAgent: getDefaultAgent('fast')
        },
        emit
      );
    },

    async applyStyleIntent({ prompt, settings }) {
      const resolvedSettings = { ...INTENT_PROFILE_DEFAULTS, ...settings };
      const currentState = stateStore.getSlot('mermaid');

      return invokeWithRepair(
        getDefaultAgent('fast'),
        [
          {
            role: 'user',
            content: `Apply a visual styling update to the current Mermaid diagram.\n\nHard requirements:\n- Preserve the diagram structure and all semantic nodes and edges unless the user explicitly asks to change them.\n- You MUST keep or add a top Mermaid init directive in this exact supported form: %%{init: {...}}%%.\n- Use valid JSON inside the init directive.\n- You may update theme, look, themeVariables, themeCSS, and flowchart.curve.\n- You may add Mermaid classDef and class lines only for visual styling.\n- You MUST call apply_mermaid_patch with the full Mermaid source.\n- Do not return only text; apply the style patch.\n\nCurrent committed diagram:\n\`\`\`mermaid\n${currentState.diagramSource}\n\`\`\`\n\nCurrent style config:\n${JSON.stringify(currentState.styleConfig)}\n\nRespect these settings for response style only:\n- temperature: ${resolvedSettings.temperature}\n- topP: ${resolvedSettings.topP}\n- maxNodes: ${resolvedSettings.maxNodes}\n- styleGuide: ${resolvedSettings.styleGuide}\n- persona: ${resolvedSettings.persona}\n\nUser style request:\n${prompt}`
          }
        ],
        {
          requirePatch: true,
          mode: 'style',
          profile: 'fast',
          modelLabel: resolveModelLabel('fast')
        },
        stateStore,
        env
      );
    },

    async applyAnalyzeIntent({ kind, focusNode, modelProfile, emit }) {
      const state = stateStore.getSlot('mermaid');
      const focusScope = buildAnalyzeFocusInstructions(focusNode, kind);
      const task =
        kind === 'critique'
          ? buildCritiqueTask(focusNode, focusScope, state.diagramSource)
          : buildExplainTask(focusNode, focusScope, state.diagramSource);
      const humanPrefix = focusNode?.id ? `${focusScope.trim()}\n\n` : '';
      const diagramBlock = `\`\`\`mermaid\n${state.diagramSource}\n\`\`\``;

      const profile = normalizeModelProfile(modelProfile);
      const backend = resolveLlmBackend(env);
      const modelId = resolveModelId(env, profile, backend);
      let analysisModel = getAnalysisModel(backend, modelId, kind);

      const analysisSystem =
        kind === 'critique'
          ? `${ANALYSIS_SYSTEM_PROMPT}${ANALYSIS_CRITIQUE_SYSTEM_APPEND}`
          : `${ANALYSIS_SYSTEM_PROMPT}${ANALYSIS_EXPLAIN_SYSTEM_APPEND}`;
      const messages = [
        new SystemMessage(analysisSystem),
        new HumanMessage(`${humanPrefix}${task}\n\n${diagramBlock}`)
      ];

      if (typeof emit === 'function') {
        emit({ type: 'phase', id: 'analyze_stream', label: 'Streaming analysis…' });
        let fullText = '';
        try {
          const stream = await analysisModel.stream(messages);
          for await (const chunk of stream) {
            const piece =
              extractTextContent(chunk?.content) ||
              extractTextContent(chunk?.kwargs?.content) ||
              (typeof chunk?.text === 'string' ? chunk.text : '');
            if (piece) {
              fullText += piece;
              emit({ type: 'token', text: piece });
            }
          }
        } catch (error) {
          emit({
            type: 'error',
            message: redactSecrets(error instanceof Error ? error.message : String(error))
          });
          if (backend === 'vertex' && env.OPENROUTER_API_KEY) {
            const orModel = resolveOpenRouterModelId(env, profile);
            analysisModel = createOpenRouterModel(env, {
              model: orModel,
              temperature: kind === 'critique' ? 0.52 : 0.42,
              maxTokens: 1800
            });
            try {
              const stream2 = await analysisModel.stream(messages);
              let fullText2 = '';
              for await (const chunk of stream2) {
                const piece =
                  extractTextContent(chunk?.content) ||
                  extractTextContent(chunk?.kwargs?.content) ||
                  (typeof chunk?.text === 'string' ? chunk.text : '');
                if (piece) {
                  fullText2 += piece;
                  emit({ type: 'token', text: piece });
                }
              }
              return { message: fullText2.trim() || 'Done.', raw: null };
            } catch {
              // fall through to invoke attempts
            }
          }
          const fallback = await analysisModel.invoke(messages).catch(() => null);
          const text = fallback ? extractTextContent(fallback.content) : '';
          return { message: text || 'Analysis failed.', raw: null };
        }
        return { message: fullText.trim() || 'Done.', raw: null };
      }

      const response = await analysisModel.invoke(messages);
      return {
        message: extractTextContent(response.content).trim() || 'Done.',
        raw: response
      };
    }
  };
}

export function createLazyMermaidAgentService({ stateStore, env = process.env }) {
  let agentService;

  function getAgentService() {
    if (!isLlmConfigured(env)) {
      throw new LlmNotConfiguredError();
    }

    agentService ??= createMermaidLangChainAgent({
      stateStore,
      env
    });

    return agentService;
  }

  return {
    async invoke(input) {
      return getAgentService().invoke(input);
    },

    async applyIntent(input) {
      return getAgentService().applyIntent(input);
    },

    async applyTransformIntent(input) {
      return getAgentService().applyTransformIntent(input);
    },

    async applyAnalyzeIntent(input) {
      return getAgentService().applyAnalyzeIntent(input);
    },

    async applyStyleIntent(input) {
      return getAgentService().applyStyleIntent(input);
    },

    async runAgentStream(operation, payload, emit) {
      const agent = getAgentService();
      const modelProfile = payload.modelProfile;

      if (typeof emit === 'function') {
        if (operation === 'analyze') {
          emit({ type: 'phase', id: 'analyze', label: 'Analyzing diagram…' });
        } else if (operation === 'intent') {
          emit({ type: 'phase', id: 'intent', label: 'Applying your request…' });
        } else {
          emit({ type: 'phase', id: 'transform', label: 'Transforming diagram…' });
        }
      }

      if (operation === 'analyze') {
        const result = await agent.applyAnalyzeIntent({
          kind: payload.kind,
          focusNode: payload.focusNode,
          modelProfile,
          emit
        });
        emitCritiqueA2uiBeforeFinal(emit, { kind: payload.kind, analyzeText: result.message });
        emit({ type: 'final', revisionChanged: false, analyzeText: result.message });
        return result;
      }

      let agentResult;
      if (operation === 'intent') {
        agentResult = await agent.applyIntent({
          prompt: payload.prompt,
          settings: payload.settings ?? {},
          focusNode: payload.focusNode,
          modelProfile,
          emit,
          peerContext: payload.peerContext
        });
      } else {
        agentResult = await agent.applyTransformIntent({
          mode: payload.mode,
          focusNode: payload.focusNode,
          modelProfile,
          emit,
          goMadDepth: payload.goMadDepth
        });
      }

      const before = payload._revisionBefore;
      emitIntentTransformStreamResult({
        emit,
        operation,
        revisionBefore: before,
        stateStore,
        agentResult,
        prompt: payload.prompt
      });

      return agentResult;
    }
  };
}

export { INTENT_PROFILE_DEFAULTS };
