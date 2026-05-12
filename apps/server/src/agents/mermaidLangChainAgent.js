import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { createAgent } from 'langchain';
import { createDiagramTools } from './diagramTools.js';
import { isSyntaxValidationError } from './mermaidReliabilitySkill.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import { computeLineDiffStats } from '../utils/patchLineStats.js';
import { createDiagramAgentMiddleware, getAgentRunnableConfig } from './agentGraphConfig.js';
import {
  createOpenRouterModel,
  createVertexChatModel,
  isLlmConfigured,
  LlmNotConfiguredError,
  resolveLlmBackend,
  resolveVertexModelId
} from './llmProvider.js';

export {
  createOpenRouterModel,
  createVertexChatModel,
  DEFAULT_VERTEX_MODEL_FAST,
  DEFAULT_VERTEX_MODEL_QUALITY,
  isLlmConfigured,
  LlmNotConfiguredError,
  resolveLlmBackend,
  resolveVertexModelId
} from './llmProvider.js';

/** Default OpenRouter slugs when OPENROUTER_MODEL* are unset (Qwen — HK-friendly). Fast = smaller/latency; Quality = flagship MoE (slower, stronger). Override via OPENROUTER_MODEL / OPENROUTER_MODEL_FAST / OPENROUTER_MODEL_QUALITY. */
export const DEFAULT_OPENROUTER_MODEL_FAST = 'qwen/qwen3-8b';
export const DEFAULT_OPENROUTER_MODEL_QUALITY = 'qwen/qwen3-235b-a22b';

/** @param {unknown} profile */
export function normalizeModelProfile(profile) {
  return profile === 'quality' ? 'quality' : 'fast';
}

/**
 * Resolves OpenRouter model slug for UI profile (never trusts raw client model ids).
 */
export function resolveOpenRouterModelId(env = process.env, profile = 'fast') {
  const p = normalizeModelProfile(profile);
  const shared = typeof env.OPENROUTER_MODEL === 'string' ? env.OPENROUTER_MODEL.trim() : '';
  if (p === 'quality') {
    const quality = typeof env.OPENROUTER_MODEL_QUALITY === 'string' ? env.OPENROUTER_MODEL_QUALITY.trim() : '';
    if (quality) return quality;
    if (shared) return shared;
    return DEFAULT_OPENROUTER_MODEL_QUALITY;
  }
  const fast = typeof env.OPENROUTER_MODEL_FAST === 'string' ? env.OPENROUTER_MODEL_FAST.trim() : '';
  if (fast) return fast;
  if (shared) return shared;
  return DEFAULT_OPENROUTER_MODEL_FAST;
}
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

const ANALYSIS_SYSTEM_PROMPT = `You are Mermaid Architect in read-only mode.
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
    return `\n\nFocus scope: Prefer edits centered on the edge from "${focusNode.edgeFrom}" to "${focusNode.edgeTo}"${label} (edge id "${focusNode.id}"). Adjust endpoints, labels on this link, or local routing only as needed for valid Mermaid; minimize unrelated changes elsewhere.`;
  }
  const label = focusNode.label ? ` (visible label: "${focusNode.label}")` : '';
  const role = focusNode.selectionKind === 'cluster' ? 'subgraph/cluster' : 'node';
  return `\n\nFocus scope: Prefer changes centered on diagram ${role} id "${focusNode.id}"${label}. Minimize edits elsewhere except where required for valid Mermaid syntax or connectivity.`;
}

/**
 * Instructions appended to analyze (explain / critique) prompts — read-only, selection-first wording.
 */
export function buildAnalyzeFocusInstructions(focusNode, kind) {
  if (!focusNode?.id) return '';
  const edgeLabel = focusNode.label ? ` Visible edge label text: "${focusNode.label}".` : '';
  const link = `"${focusNode.edgeFrom}" → "${focusNode.edgeTo}"`;

  if (isEdgeFocus(focusNode)) {
    if (kind === 'explain') {
      return `\n\nSelection focus (edge): The user selected the directed link ${link}.${edgeLabel} Lead with this relationship in ## Explanation, ## Main flows, and ## Key entities — what it means, what moves or depends along it, and how the two endpoints relate. Use ## Takeaways for conclusions specific to this link. Mention the wider diagram only briefly as supporting context; avoid a generic whole-diagram essay that ignores this edge.`;
    }
    return `\n\nSelection focus (edge): The user selected the directed link ${link}.${edgeLabel} In ## Weaknesses and limits, ## Visual and style review, and ## Actionable improvements, prioritize this link and its endpoints (arrow clarity, label usefulness, direction, redundancy, missing guards). Address diagram-wide topics only after covering this edge. Keep ## Strengths and ## Diagram type fit but tie them to how well this selected relationship reads in context.`;
  }

  const label = focusNode.label ? ` (visible label: "${focusNode.label}")` : '';
  const role = focusNode.selectionKind === 'cluster' ? 'subgraph/cluster' : 'node';

  if (kind === 'explain') {
    return `\n\nSelection focus (${role}): The user selected ${role} id "${focusNode.id}"${label}. In ## Explanation, ## Main flows, and ## Key entities, foreground this ${role}: its role, connections, and how it fits the wider diagram. ## Takeaways should emphasize what matters about this selection. Mention other parts only as supporting context; do not center the whole response on unrelated nodes or edges.`;
  }
  return `\n\nSelection focus (${role}): The user selected ${role} id "${focusNode.id}"${label}. In ## Weaknesses and limits, ## Visual and style review, and ## Actionable improvements, prioritize issues touching this ${role} and its immediate neighborhood before broader diagram-wide commentary. Keep ## Strengths and ## Diagram type fit but reference how this selection reads in context.`;
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

function buildGoMadEscalationInstructions(depth, mermaidSource) {
  if (depth < 2) return '';
  const currentKeyword = inferMermaidTopKeyword(mermaidSource);
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
 * @param {{ mode: string, mermaidSource: string, focusScope: string, goMadDepth?: number }} args
 */
export function buildTransformUserContent({ mode, mermaidSource, focusScope, goMadDepth: rawDepth }) {
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
            mermaidSource
          )}`;

  return `${policy}

Hard requirements:
- Call get_diagram_state at most once unless a patch failed and you need fresh state.
- Apply exactly one successful transformative update: call apply_mermaid_patch once with complete Mermaid source, then answer in prose only (no further tool calls after acceptance).
- Do not return only text; apply the patch.
- Keep node IDs simple ASCII identifiers where possible; keep labels concise.
${focusScope}

Current committed diagram:
\`\`\`mermaid
${mermaidSource}
\`\`\`

Output goal:
Apply one transformative update via apply_mermaid_patch matching the mode above.`;
}

const SYSTEM_PROMPT = `You are Mermaid Architect, an agent that helps edit Mermaid diagrams.

When the user asks for a diagram change:
- Prefer the injected current diagram context; call get_diagram_state at most once if you truly need to confirm revision or state.
- Produce complete Mermaid source, not a partial diff.
- For a satisfied request: call apply_mermaid_patch once with the full updated diagram, then briefly summarize what changed in prose only — do not call tools again after an accepted patch (unless the tool returned accepted:false and you must repair).
- Keep valid Mermaid syntax and preserve useful existing nodes unless the user asks to replace them.
- The user cannot call tools. Never ask the user to call get_diagram_state or apply_mermaid_patch.
- Do not mention internal tool names in user-facing replies.
- Short requests like "simplify it", "make it clearer", or "current diagram" refer to the current diagram.

When the user asks a general question, answer concisely.`;

const INTERNAL_TOOL_NAME_PATTERN = /\b(?:get_diagram_state|apply_mermaid_patch)\b/;
const REPAIR_ERROR_PATTERN = /not valid mermaid|validation failed|parser rejected|missing known diagram type|mcp/i;

function defaultChatModelFactory(env, options) {
  const backend = resolveLlmBackend(env);
  if (backend === 'vertex') {
    return createVertexChatModel(env, options);
  }
  return createOpenRouterModel(env, options);
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
  const state = stateStore.getState();

  return {
    role: 'system',
    content: `Current diagram context:
- revisionId: ${state.revisionId}
- styleConfig: ${JSON.stringify(state.styleConfig)}
- mermaidSource:
\`\`\`mermaid
${state.mermaidSource}
\`\`\`

Use this as the current diagram when the user's request is short or refers to "it".`
  };
}

function extractTextContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part?.type === 'text') return part.text;
        return '';
      })
      .filter(Boolean)
      .join('');
  }
  return content == null ? '' : String(content);
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

export function normalizeAgentStreamEvent(event) {
  const ev = event?.event ?? '';
  const data = event?.data ?? {};

  if (/stream/i.test(ev) && data.chunk !== undefined) {
    const text = tokenFromLangChainChunk(data.chunk);
    if (text) return { type: 'token', text };
  }

  if (ev.includes('tool_start') || ev === 'on_tool_start') {
    return { type: 'tool_start', name: String(data.name ?? event?.name ?? '') };
  }
  if (ev.includes('tool_end') || ev === 'on_tool_end') {
    return { type: 'tool_end', name: String(data.name ?? event?.name ?? '') };
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

export function buildSyntaxRepairInstruction({ messages, errorMessage }) {
  const originalRequest = toLangChainMessages(messages)
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join('\n\n')
    .trim();

  return {
    role: 'user',
    content: `Your previous patch failed validation.\n\nValidator error:\n${errorMessage}\n\nRepair instructions:\n- Return valid Mermaid syntax.\n- Keep the user's requested intent.\n- Call apply_mermaid_patch with complete Mermaid source.\n- Do not mention tool names in your final user-facing summary.\n\nOriginal user request:\n${originalRequest || '(No explicit user request provided.)'}`
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
    content: `Your previous response did not apply a diagram patch.\n\nRepair instructions:\n- You MUST call apply_mermaid_patch now once with complete, valid Mermaid source, then summarize in prose only (no further tool calls after acceptance).\n- Keep the update smaller if needed so it remains valid.\n- Do not return prose only.\n- Do not mention tool names in your final user-facing summary.\n\nOriginal user request:\n${originalRequest || '(No explicit user request provided.)'}`
  };
}

function formatAgentInvokeFailure(error, env = process.env) {
  const detail = redactSecrets(error instanceof Error ? error.message : String(error));
  const regionHint = /region|not available in your country|unsupported_country/i.test(detail)
    ? '\n\nIf this is a **region / model availability** issue, set `OPENROUTER_MODEL` or `OPENROUTER_MODEL_FAST` / `OPENROUTER_MODEL_QUALITY` in your server `.env` to an OpenRouter slug that works where you are (for example `qwen/qwen3-8b`, `qwen/qwen3-32b`, or `deepseek/deepseek-chat-v3-0324`), then restart the API server.\n'
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

function captureMessagesFromStreamEvent(event, prev) {
  const data = event?.data ?? {};
  const msgs = data.output?.messages;
  if (Array.isArray(msgs) && msgs.length > 0) return msgs;
  return prev;
}

async function streamReactAgentEvents(agent, inputMessages, emit, env) {
  const runnableConfig = getAgentRunnableConfig(env);
  let latestMessages = [];
  try {
    const stream = await agent.streamEvents({ messages: inputMessages }, { version: 'v2', ...runnableConfig });
    for await (const ev of stream) {
      latestMessages = captureMessagesFromStreamEvent(ev, latestMessages);
      const normalized = normalizeAgentStreamEvent(ev);
      if (normalized) {
        emit(normalized);
      }
    }
  } catch (error) {
    emit({
      type: 'error',
      message: redactSecrets(error instanceof Error ? error.message : String(error))
    });
  }
  return { messages: latestMessages };
}

function emitPatchSummaryArtifact(emit, stateStore, beforeRevision, beforeSource) {
  if (typeof emit !== 'function') return;
  const after = stateStore.getState();
  if (after.revisionId === beforeRevision) return;
  const { linesAdded, linesRemoved } = computeLineDiffStats(beforeSource, after.mermaidSource);
  emit({
    type: 'artifact',
    kind: 'patch_summary',
    revisionId: after.revisionId,
    linesAdded,
    linesRemoved
  });
}

async function invokeWithRepair(
  agent,
  messages,
  { requirePatch = false, emit } = {},
  stateStore,
  env
) {
  const initialSnap = stateStore.getState();
  const beforeRevision = initialSnap.revisionId;
  const beforeSource = initialSnap.mermaidSource;
  const baseMessages = [createCurrentDiagramContextMessage(stateStore), ...toLangChainMessages(messages)];

  if (typeof emit === 'function') {
    emit({ type: 'phase', id: 'agent_run', label: 'Planning and executing tools…' });
  }

  const runnableConfig = getAgentRunnableConfig(env);
  let firstResult;
  try {
    if (typeof emit === 'function') {
      firstResult = await streamReactAgentEvents(agent, baseMessages, emit, env);
      if (!firstResult.messages?.length) {
        emit({ type: 'status', text: 'Running agent…' });
        firstResult = await agent.invoke({ messages: baseMessages }, runnableConfig);
      }
    } else {
      firstResult = await agent.invoke({ messages: baseMessages }, runnableConfig);
    }
  } catch (error) {
    return formatAgentInvokeFailure(error, env);
  }

  const firstMessage = extractFinalMessage(firstResult);
  const afterFirstRevision = stateStore.getState().revisionId;
  const firstError = extractToolFailureError(firstResult);

  if (afterFirstRevision !== beforeRevision) {
    emitPatchSummaryArtifact(emit, stateStore, beforeRevision, beforeSource);
    return {
      message: firstMessage,
      raw: firstResult
    };
  }

  if (requirePatch && !firstError) {
    try {
      if (typeof emit === 'function') {
        emit({ type: 'phase', id: 'patch_retry', label: 'Retrying diagram patch…' });
        emit({ type: 'status', text: 'Retrying: diagram patch required…' });
      }
      const patchRetryResult = await agent.invoke(
        {
          messages: [...baseMessages, buildPatchRequiredInstruction({ messages })]
        },
        runnableConfig
      );
      if (stateStore.getState().revisionId !== beforeRevision) {
        emitPatchSummaryArtifact(emit, stateStore, beforeRevision, beforeSource);
        return {
          message: extractFinalMessage(patchRetryResult),
          raw: patchRetryResult
        };
      }
      return {
        message: extractFinalMessage(patchRetryResult),
        raw: patchRetryResult
      };
    } catch (error) {
      return formatAgentInvokeFailure(error, env);
    }
  }

  if (!shouldAttemptSyntaxRepair(firstError)) {
    return {
      message: firstMessage,
      raw: firstResult
    };
  }

  const parsedRepairAttempts = Number.parseInt(process.env.MERMAID_REPAIR_MAX_ATTEMPTS ?? '1', 10);
  const maxRepairAttempts = Number.isFinite(parsedRepairAttempts) ? Math.max(0, parsedRepairAttempts) : 1;
  let latestError = firstError;
  let latestResult = firstResult;

  for (let attempt = 1; attempt <= maxRepairAttempts; attempt += 1) {
    let retryResult;
    try {
      if (typeof emit === 'function') {
        emit({ type: 'phase', id: 'syntax_repair', label: `Syntax repair (attempt ${attempt})…` });
        emit({ type: 'status', text: `Repairing Mermaid syntax (attempt ${attempt})…` });
      }
      retryResult = await agent.invoke(
        {
          messages: [...baseMessages, buildSyntaxRepairInstruction({ messages, errorMessage: latestError })]
        },
        runnableConfig
      );
    } catch (error) {
      return formatAgentInvokeFailure(error, env);
    }
    latestResult = retryResult;

    const currentRevision = stateStore.getState().revisionId;
    if (currentRevision !== beforeRevision) {
      emitPatchSummaryArtifact(emit, stateStore, beforeRevision, beforeSource);
      return {
        message: extractFinalMessage(retryResult),
        raw: retryResult
      };
    }

    const retryError = extractToolFailureError(retryResult);
    if (!shouldAttemptSyntaxRepair(retryError)) {
      break;
    }
    latestError = retryError;
  }

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

  function chatModelFor(profile, extraOptions = {}) {
    const backend = resolveLlmBackend(env);
    const modelId =
      backend === 'vertex' ? resolveVertexModelId(env, profile) : resolveOpenRouterModelId(env, profile);
    return chatModelFactory(env, { model: modelId, ...extraOptions });
  }

  /** Prompt-bar Go (`applyIntent`) and generic `invoke` — does not use transform/Go Mad sampling. */
  function getDefaultAgent(profile = 'fast') {
    const p = normalizeModelProfile(profile);
    const backend = resolveLlmBackend(env);
    const modelId =
      backend === 'vertex' ? resolveVertexModelId(env, p) : resolveOpenRouterModelId(env, p);
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
    const modelId =
      backend === 'vertex' ? resolveVertexModelId(env, p) : resolveOpenRouterModelId(env, p);
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

  async function invokeMutation(agent, userMessages, opts, emit) {
    return invokeWithRepair(agent, userMessages, { ...opts, emit }, stateStore, env);
  }

  return {
    async invoke({ messages, modelProfile }) {
      const agent = getDefaultAgent(modelProfile);
      return invokeWithRepair(agent, messages, {}, stateStore, env);
    },

    async applyIntent({ prompt, settings, focusNode, modelProfile, emit }) {
      const resolvedSettings = { ...INTENT_PROFILE_DEFAULTS, ...settings };
      const focusScope = buildFocusScopeInstructions(focusNode);

      const userContent = `Interpret and apply the user's requested diagram change strictly according to their wording.

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
        { requirePatch: true },
        emit
      );
    },

    async applyTransformIntent({ mode, focusNode, modelProfile, emit, goMadDepth }) {
      const currentState = stateStore.getState();
      const transformAgent = getTransformAgent(mode, modelProfile, goMadDepth);
      const focusScope = buildFocusScopeInstructions(focusNode);

      return invokeMutation(
        transformAgent,
        [
          {
            role: 'user',
            content: buildTransformUserContent({
              mode,
              mermaidSource: currentState.mermaidSource,
              focusScope,
              goMadDepth
            })
          }
        ],
        { requirePatch: true },
        emit
      );
    },

    async applyStyleIntent({ prompt, settings }) {
      const resolvedSettings = { ...INTENT_PROFILE_DEFAULTS, ...settings };
      const currentState = stateStore.getState();

      return invokeWithRepair(
        getDefaultAgent('fast'),
        [
          {
            role: 'user',
            content: `Apply a visual styling update to the current Mermaid diagram.\n\nHard requirements:\n- Preserve the diagram structure and all semantic nodes and edges unless the user explicitly asks to change them.\n- You MUST keep or add a top Mermaid init directive in this exact supported form: %%{init: {...}}%%.\n- Use valid JSON inside the init directive.\n- You may update theme, look, themeVariables, themeCSS, and flowchart.curve.\n- You may add Mermaid classDef and class lines only for visual styling.\n- You MUST call apply_mermaid_patch with the full Mermaid source.\n- Do not return only text; apply the style patch.\n\nCurrent committed diagram:\n\`\`\`mermaid\n${currentState.mermaidSource}\n\`\`\`\n\nCurrent style config:\n${JSON.stringify(currentState.styleConfig)}\n\nRespect these settings for response style only:\n- temperature: ${resolvedSettings.temperature}\n- topP: ${resolvedSettings.topP}\n- maxNodes: ${resolvedSettings.maxNodes}\n- styleGuide: ${resolvedSettings.styleGuide}\n- persona: ${resolvedSettings.persona}\n\nUser style request:\n${prompt}`
          }
        ],
        { requirePatch: true },
        stateStore,
        env
      );
    },

    async applyAnalyzeIntent({ kind, focusNode, modelProfile, emit }) {
      const state = stateStore.getState();
      const focusScope = buildAnalyzeFocusInstructions(focusNode, kind);
      const diagramBlock = `\`\`\`mermaid\n${state.mermaidSource}\n\`\`\``;

      const task =
        kind === 'critique'
          ? `Critique this diagram in read-only prose — do not rewrite or output Mermaid.

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
A bullet list of concrete changes the user could apply later (labels, structure, type change, styling, accessibility). Every weakness above should have at least one matching or related improvement suggestion here.${focusScope}`
          : `Explain what this diagram communicates to someone unfamiliar with it. Stay descriptive — do not rewrite the diagram.

Use these sections with Markdown ## headings (or clearly labeled equivalents):

## Explanation
A short overview for someone new to the diagram.

## Main flows
How information, process steps, or relationships move through the diagram.

## Key entities
Important nodes, subgraphs, or groups and what role each plays.

## Takeaways
Concise conclusions — what to remember or how to read the diagram.${focusScope}`;

      const profile = normalizeModelProfile(modelProfile);
      const backend = resolveLlmBackend(env);
      const modelId =
        backend === 'vertex' ? resolveVertexModelId(env, profile) : resolveOpenRouterModelId(env, profile);
      const analysisOpts = {
        model: modelId,
        temperature: kind === 'critique' ? 0.52 : 0.42,
        maxTokens: 1800,
        maxOutputTokens: 1800
      };
      let analysisModel = chatModelFactory(env, analysisOpts);

      const analysisSystem =
        kind === 'critique'
          ? `${ANALYSIS_SYSTEM_PROMPT}${ANALYSIS_CRITIQUE_SYSTEM_APPEND}`
          : `${ANALYSIS_SYSTEM_PROMPT}${ANALYSIS_EXPLAIN_SYSTEM_APPEND}`;
      const messages = [new SystemMessage(analysisSystem), new HumanMessage(`${task}\n\n${diagramBlock}`)];

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
          emit
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
      const afterState = stateStore.getState();
      const revisionChanged = typeof before === 'number' ? afterState.revisionId !== before : true;

      emit({
        type: 'final',
        revisionChanged,
        message: agentResult?.message ?? '',
        state: revisionChanged ? afterState : undefined
      });

      return agentResult;
    }
  };
}

export { INTENT_PROFILE_DEFAULTS };
