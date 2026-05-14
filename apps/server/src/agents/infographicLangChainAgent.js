import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { createAgent } from 'langchain';
import { createInfographicTools } from './diagramTools.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import {
  INFOGRAPHIC_SYSTEM_PROMPT,
  INFOGRAPHIC_ANALYSIS_SYSTEM_PROMPT,
  INFOGRAPHIC_CRITIQUE_TASK,
  INFOGRAPHIC_EXPLAIN_TASK,
  buildInfographicRepairInstruction,
  inferInfographicTemplate
} from '../prompts/infographicSyntaxGuard.js';
import {
  LlmNotConfiguredError,
  isLlmConfigured,
  createOpenRouterModel,
  createVertexChatModel,
  resolveLlmBackend,
  resolveVertexModelId
} from './llmProvider.js';
import { emitCritiqueA2uiBeforeFinal } from './critiqueA2uiStream.js';
import {
  buildFocusScopeInstructions as buildMermaidFocusScopeInstructions,
  buildAnalyzeFocusInstructions as buildMermaidAnalyzeFocusInstructions,
  captureMessagesFromStreamEvent,
  clampGoMadDepth,
  emitIntentTransformStreamResult,
  extractFinalMessage,
  goMadTransformModelOptions,
  normalizeAgentStreamEvent,
  normalizeModelProfile,
  resolveOpenRouterModelId,
  toLangChainMessages,
  transformModeModelOptions
} from './mermaidLangChainAgent.js';
import {
  buildInfographicFocusScopeInstructions,
  buildInfographicAnalyzeFocusInstructions
} from './infographicFocusInstructions.js';

/**
 * Route a focus payload to the right vocabulary. `infographic-item` selections come from the
 * AntV renderer with `indexes` + `elementType`; everything else falls back to the Mermaid
 * builder (which produces generic "node id …" language that's harmless for unselected paths).
 */
function buildFocusScopeInstructions(focusNode) {
  if (focusNode?.selectionKind === 'infographic-item') {
    return buildInfographicFocusScopeInstructions(focusNode);
  }
  return buildMermaidFocusScopeInstructions(focusNode);
}

function buildAnalyzeFocusInstructions(focusNode, kind) {
  if (focusNode?.selectionKind === 'infographic-item') {
    return buildInfographicAnalyzeFocusInstructions(focusNode, kind);
  }
  return buildMermaidAnalyzeFocusInstructions(focusNode, kind);
}
import { extractJsonStringPrefix } from './partialJsonString.js';
import { repairInfographicWithFixer, isInfographicSyntaxFixerAvailable } from './infographicSyntaxFixer.js';

const INFOGRAPHIC_PATCH_REQUIRED_INSTRUCTION = `Your previous response did not apply an infographic patch.
- You MUST call apply_infographic_patch now once with complete, valid AntV Infographic DSL, then briefly summarize in prose only.
- Do not return prose only.
- Do not mention tool names in your final user-facing summary.`;

const INFOGRAPHIC_TRANSFORM_INSTRUCTIONS = {
  refine: `Refine the existing infographic without changing its core message. Tighten labels, fix awkward phrasing, balance the visual.`,
  innovate: `Re-imagine the infographic with bolder visual choices. You may switch to a different template if it better fits the data.`,
  goMad: `Transform mode: GO MAD — surprise and meme energy; loosely anchored to the idea (reinterpret ruthlessly).
- Speed first: your FIRST assistant turn must call apply_infographic_patch — no preamble, no reasoning essays. Skip get_infographic_dsl unless you truly suspect stale context.
- Template roulette: do NOT keep the same template — switch to a different family entirely (list → sequence → compare → chart → hierarchy → relation). Prefer exotic supported templates: compare-swot, compare-quadrant-quarter-simple-card, sequence-snake-steps-simple, sequence-circular-simple, sequence-funnel-simple, list-pyramid-rounded-rect-node, list-sector-simple, hierarchy-mindmap-branch-gradient-compact-card, relation-network-simple-circle-node, chart-wordcloud, chart-pie-donut-plain-text.
- Loud labels: short, absurd, geek-coded riffs (RFC vibes, fake folklore, ironic acronyms) — still readable.
- Palette mayhem: set a bold \`palette\` line with 3–5 high-contrast hex colors (no quotes, no commas) on every Go Mad pass.
- Iconography: every semantic item gets an \`icon\` (keyword phrase like \`rocket launch\` or \`shield check\`) unless the template is chart-only.
- Compact spectacle: 3–7 items is plenty. Density via vivid wording and icons, not item count.
- Weird > safe. The user clicked Go Mad — make them laugh, not nod politely.`
};

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

function templateFamily(name) {
  return (name || '').split('-')[0] || '';
}

/** Tier-aware nudge appended to the goMad directive — heats up labels/templates with depth. */
function buildInfographicGoMadEscalation(depth, currentDsl) {
  if (depth < 2) return '';
  const currentTemplate = inferInfographicTemplate(currentDsl) || '';
  const currentFamily = templateFamily(currentTemplate);
  const forbidden = currentFamily ? ` (current family "${currentFamily}" is OFF-LIMITS this turn)` : '';
  const familyOptions = GO_MAD_TEMPLATE_FAMILIES.filter((f) => f !== currentFamily).join(', ');
  const exoticHint =
    depth >= 4
      ? `- Prefer truly exotic templates: ${GO_MAD_EXOTIC_TEMPLATES.slice(0, 8).join(', ')}.\n`
      : `- Lean exotic: ${GO_MAD_EXOTIC_TEMPLATES.slice(0, 5).join(', ')}.\n`;
  const tierHint =
    depth >= 5
      ? `- Tier ${depth}: peak chaos — one coherent geek joke binds the whole piece; still valid DSL.\n`
      : `- Tier ${depth}: noticeably wilder than tier ${depth - 1}; no rename-only laziness on existing items.\n`;
  const paletteHint =
    depth >= 3
      ? `- Palette MUST swing: pick a loud 4–5 color scheme (neon, retro, vapor) the previous version didn't use.\n`
      : `- Palette MUST swing to something different from before (3+ bold colors).\n`;
  return `
GO MAD escalation (tier ${depth}):
${tierHint}- Primary template MUST switch family this turn${forbidden}. Pick from: ${familyOptions}.
${exoticHint}${paletteHint}- Labels: short, absurd, geek-coded; no generic business jargon.
`;
}

const DEFAULT_INFOGRAPHIC_REPAIR_ATTEMPTS = 2;

function resolveInfographicRepairAttempts(env) {
  const raw = env?.INFOGRAPHIC_REPAIR_MAX_ATTEMPTS;
  if (raw == null || raw === '') return DEFAULT_INFOGRAPHIC_REPAIR_ATTEMPTS;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_INFOGRAPHIC_REPAIR_ATTEMPTS;
  // Bound at 6 so a misconfigured env doesn't burn the whole quota on a single bad prompt.
  return Math.min(6, n);
}

/** Best-effort extraction of the user's request text from the message bag that drives a turn. */
function extractOriginalRequest(userMessages) {
  if (!Array.isArray(userMessages)) return null;
  for (const m of userMessages) {
    if ((m?.role ?? m?.kwargs?.role) !== 'user') continue;
    const text = typeof m?.content === 'string' ? m.content : extractTextContent(m?.content ?? m?.kwargs?.content);
    if (text && text.trim()) return text.trim();
  }
  return null;
}

function defaultChatModelFactory(env, options) {
  const backend = resolveLlmBackend(env);
  if (backend === 'vertex') return createVertexChatModel(env, options);
  return createOpenRouterModel(env, options);
}

function extractTextContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => extractTextContent(part)).join('');
  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    if (typeof content.content === 'string') return content.content;
  }
  return '';
}

function buildIntentUserContent({ prompt, focusScope, currentDsl, peerMermaid }) {
  const peerBlock =
    typeof peerMermaid === 'string' && peerMermaid.trim()
      ? `Cross-format / mode switch: reproduce the same information as the peer Mermaid diagram below as Infographic DSL (entities, flow, labels). Prefer this source over improvising from the topic text alone.

Peer Mermaid:
\`\`\`mermaid
${peerMermaid.trim()}
\`\`\`

`
      : '';
  return `${peerBlock}Interpret and apply the user's requested infographic change strictly according to their wording.

Broad or short requests (for example a single topic name) still require a concrete infographic now: choose a sensible template and produce real content. Do not ask the user to clarify.

Current committed infographic DSL:
\`\`\`
${currentDsl || '(empty — produce a fresh infographic)'}
\`\`\`

User request:
${prompt}${focusScope}`;
}

function buildTransformUserContent({ mode, focusScope, currentDsl, goMadDepth }) {
  const directive = INFOGRAPHIC_TRANSFORM_INSTRUCTIONS[mode] ?? INFOGRAPHIC_TRANSFORM_INSTRUCTIONS.refine;
  const depthValue = mode === 'goMad' ? clampGoMadDepth(goMadDepth ?? 1) : 0;
  const depthLine = mode === 'goMad' && goMadDepth ? `\nGo Mad depth: ${depthValue} of 12.` : '';
  const escalation = mode === 'goMad' ? buildInfographicGoMadEscalation(depthValue, currentDsl) : '';
  return `${directive}${depthLine}${escalation}

Current committed infographic DSL:
\`\`\`
${currentDsl}
\`\`\`
${focusScope}

Apply one transformative update via apply_infographic_patch. Output the FULL DSL.`;
}

function buildAnalysisUserContent({ task, focusScope, currentDsl }) {
  const prefix = focusScope ? `${focusScope.trim()}\n\n` : '';
  return `${prefix}${task}

\`\`\`
${currentDsl}
\`\`\``;
}

/** Strip a single outer ```…``` wrapper if the whole string is one fenced block. */
function stripOptionalOuterFencedBlock(text) {
  const t = text.trim();
  const m = t.match(/^```(?:infographic|dsl|text)?\s*\n([\s\S]*?)\n```$/i);
  if (m) return m[1].trim();
  return t;
}

/**
 * Some chat models emit valid AntV Infographic DSL in the assistant message instead of
 * calling apply_infographic_patch. When tool_calls are empty, recover by validating/applying
 * that prose block through the same pipeline as the tool.
 *
 * @param {{ messages?: unknown[] } | null | undefined} result
 * @returns {string | null}
 */
function extractInfographicDslFromAssistantResult(result) {
  const messages = result?.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    const type = m?.type ?? m?.role ?? m?.kwargs?.role ?? '';
    if (type !== 'ai' && type !== 'assistant') continue;
    const raw = extractTextContent(m?.content ?? m?.kwargs?.content ?? '');
    if (!raw?.trim()) continue;
    const cleaned = stripOptionalOuterFencedBlock(raw);
    const lines = cleaned.split('\n');
    let start = -1;
    for (let j = 0; j < lines.length; j += 1) {
      if (/^\s*infographic\s+[\w-]+\s*$/.test(lines[j])) {
        start = j;
        break;
      }
    }
    if (start === -1) continue;
    return lines.slice(start).join('\n').trim();
  }
  return null;
}

async function emitTokens(stream, emit) {
  let full = '';
  for await (const chunk of stream) {
    const piece =
      extractTextContent(chunk?.content) ||
      extractTextContent(chunk?.kwargs?.content) ||
      (typeof chunk?.text === 'string' ? chunk.text : '');
    if (piece) {
      full += piece;
      if (typeof emit === 'function') emit({ type: 'token', text: piece });
    }
  }
  return full;
}

async function invokeWithRepair(agent, userMessages, opts, stateStore, env) {
  const { requirePatch = false, emit, stableAgent = null } = opts ?? {};
  const maxRepairAttempts = resolveInfographicRepairAttempts(env);
  const beforeRevision = stateStore.getSlot('infographic').revisionId;
  const originalRequest = extractOriginalRequest(userMessages);

  let messages = toLangChainMessages(userMessages);
  let lastResult = null;
  let lastError = null;
  let lastBrokenSource = null;
  let currentAgent = agent;
  // Reliability hooks fire at most once each across the entire repair sequence.
  let syntaxFixerTried = false;
  let stableAgentTried = false;

  for (let attempt = 0; attempt <= maxRepairAttempts; attempt += 1) {
    if (typeof emit === 'function') {
      emit({ type: 'phase', id: attempt === 0 ? 'invoke' : `repair_${attempt}`, label: attempt === 0 ? 'Generating infographic…' : 'Repairing infographic…' });
    }

    let result;
    try {
      if (typeof currentAgent.streamEvents === 'function' && typeof emit === 'function') {
        const stream = await currentAgent.streamEvents({ messages }, { version: 'v2' });
        // Per tool_call_id buffers so we can lazily decode the partial
        // diagramSource argument as the model streams it. The patch tool's
        // schema is a single string field, so a streaming prefix is a valid
        // draft for the InfographicRenderer to render incrementally.
        const toolCallBuffers = new Map();
        let latestMessages = [];
        for await (const ev of stream) {
          latestMessages = captureMessagesFromStreamEvent(ev, latestMessages);
          const normalized = normalizeAgentStreamEvent(ev);
          if (normalized) emit(normalized);

          if (ev?.event === 'on_chat_model_stream') {
            const chunks = ev.data?.chunk?.tool_call_chunks;
            if (Array.isArray(chunks) && chunks.length > 0) {
              for (const tcc of chunks) {
                const bufferKey = tcc.id || `idx_${tcc.index ?? 0}`;
                let entry = toolCallBuffers.get(bufferKey);
                if (!entry) {
                  entry = { name: '', argsBuffer: '', lastEmitted: 0 };
                  toolCallBuffers.set(bufferKey, entry);
                }
                if (tcc.name) entry.name = tcc.name;
                if (typeof tcc.args === 'string' && tcc.args) {
                  entry.argsBuffer += tcc.args;
                }
                if (entry.name === 'apply_infographic_patch' && entry.argsBuffer) {
                  const accumulated = extractJsonStringPrefix(entry.argsBuffer, 'diagramSource');
                  if (accumulated.length > entry.lastEmitted) {
                    const delta = accumulated.slice(entry.lastEmitted);
                    entry.lastEmitted = accumulated.length;
                    emit({
                      type: 'draftPreview',
                      contentType: 'infographic',
                      delta,
                      accumulated
                    });
                  }
                }
              }
            }
          }
        }
        // streamEvents doesn't return a single envelope object; reconstruct
        // the legacy shape so the post-loop revision/repair logic still works.
        result = latestMessages.length > 0 ? { messages: latestMessages } : null;
      } else {
        result = await currentAgent.invoke({ messages });
      }
    } catch (error) {
      lastError = redactSecrets(error instanceof Error ? error.message : String(error));
      if (typeof emit === 'function') emit({ type: 'error', message: lastError });
      break;
    }

    lastResult = result;

    const currentRevision = stateStore.getSlot('infographic').revisionId;
    if (currentRevision !== beforeRevision) {
      // Patch landed — success.
      return {
        message: extractFinalMessage(result) || 'Infographic updated.',
        raw: result,
        metadata: { agent: 'infographic' }
      };
    }

    if (!requirePatch) {
      // No patch needed (e.g. analyze) — return whatever the agent produced.
      return {
        message: extractFinalMessage(result) || 'Done.',
        raw: result,
        metadata: { agent: 'infographic' }
      };
    }

    // Patch was required but not produced. Build a repair turn.
    let failureError = extractToolFailureMessage(result);

    // Prose-in-body recovery: models sometimes stream DSL as plain assistant text (zero tool
    // calls). Try the same apply path the tool uses; on failure, fall through so the syntax
    // fixer + repair instructions see a real error and broken source.
    if (!failureError) {
      const proseDsl = extractInfographicDslFromAssistantResult(result);
      if (proseDsl) {
        const applied = await stateStore.applyDiagramSource({
          contentType: 'infographic',
          diagramSource: proseDsl,
          reason: 'prose-dsl recovery'
        });
        if (applied.accepted) {
          return {
            message: extractFinalMessage(result) || 'Infographic updated.',
            raw: result,
            metadata: { agent: 'infographic', validator: 'prose-dsl-recovery' }
          };
        }
        failureError = applied.error ?? 'Infographic validation failed';
        lastBrokenSource = proseDsl;
        lastError = failureError;
      }
    }

    if (failureError) {
      lastError = failureError;
      lastBrokenSource = extractLastAttemptedDsl(result) || lastBrokenSource;

      // (a) Tool-less single-shot syntax fixer: runs ONCE before the next full agent retry.
      // Mirrors the Mermaid pattern (mermaidLangChainAgent.js around line 949). The fixer is
      // a cheap fast model and skips tool plumbing entirely — when it works, we apply the
      // patch directly and short-circuit the rest of the loop.
      if (!syntaxFixerTried && lastBrokenSource && isInfographicSyntaxFixerAvailable(env)) {
        syntaxFixerTried = true;
        if (typeof emit === 'function') {
          emit({ type: 'phase', id: 'syntax_fixer', label: 'Infographic syntax fixer…' });
        }
        const fixerOutcome = await repairInfographicWithFixer({
          brokenSource: lastBrokenSource,
          parseError: failureError,
          originalRequest,
          env
        });
        if (fixerOutcome.accepted && fixerOutcome.diagramSource) {
          const applied = await stateStore.applyDiagramSource({
            contentType: 'infographic',
            diagramSource: fixerOutcome.diagramSource,
            reason: 'syntax-fixer repair'
          });
          if (applied.accepted) {
            return {
              message: 'Infographic updated (repaired by syntax fixer).',
              raw: result,
              metadata: { agent: 'infographic', validator: 'syntax-fixer' }
            };
          }
          // If the fixer's candidate failed `applyDiagramSource` (re-validates), fall through
          // to the agent retry — pass the resulting error along so the next attempt sees it.
          lastError = `${failureError}\n(fixer attempt also rejected: ${applied.error})`;
        } else {
          lastError = `${failureError}\n(syntax fixer: ${fixerOutcome.error})`;
        }
      }

      messages = [
        ...messages,
        new SystemMessage(
          buildInfographicRepairInstruction({
            errorMessage: failureError,
            brokenSource: lastBrokenSource,
            originalRequest
          })
        )
      ];
    } else {
      // (b) No tool call at all — the model produced prose only. The hot/transform agent
      // sometimes settles into a refusal loop here; swap to the stable (fast, low-temp,
      // non-transform) agent for the next attempt. Mirrors mermaidLangChainAgent.js line ~885.
      if (!stableAgentTried && stableAgent && stableAgent !== currentAgent) {
        stableAgentTried = true;
        currentAgent = stableAgent;
        if (typeof emit === 'function') {
          emit({ type: 'status', text: 'Retrying with stable model: diagram patch required…' });
        }
      }
      messages = [...messages, new SystemMessage(INFOGRAPHIC_PATCH_REQUIRED_INSTRUCTION)];
    }
  }

  if (requirePatch) {
    const slot = stateStore.getSlot('infographic');
    const summary = summarizeAttempts(lastResult);
    console.warn('[infographic-agent] patch did not apply after repair attempts', {
      beforeRevision,
      afterRevision: slot.revisionId,
      lastError: lastError ?? null,
      // When lastError is null but patchToolCalls > 0, the tool ran but its rejection was
      // not surfaced — read the lastAssistantSnippet to learn what the model produced.
      // When patchToolCalls === 0, the model never invoked the tool (prose-only response).
      attempts: maxRepairAttempts + 1,
      syntaxFixerTried,
      stableAgentTried,
      ...summary
    });
  }

  return {
    message: lastError ? `Infographic update failed: ${lastError}` : 'Infographic update did not apply.',
    raw: lastResult,
    metadata: { agent: 'infographic', error: lastError ?? null }
  };
}

function extractToolFailureMessage(result) {
  // Scan every message's content for a JSON-stringified `{accepted:false, error}` payload —
  // the apply_infographic_patch tool always serializes its result to JSON. We deliberately
  // don't gate on `tool_call_id` because LangChain v1 stream events sometimes deliver
  // tool messages without that field exposed where we'd look (it can land on the class
  // instance, on `kwargs`, on `lc_kwargs`, or be stripped during serialization). The
  // content-shape check is robust to all of those.
  const messages = result?.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const text = extractTextContent(messages[i]?.content ?? messages[i]?.kwargs?.content ?? '').trim();
    if (!text) continue;
    try {
      const parsed = JSON.parse(text);
      if (parsed && parsed.accepted === false && typeof parsed.error === 'string') {
        return parsed.error;
      }
    } catch {
      // Not JSON — keep walking back.
    }
  }
  return null;
}

function summarizeAttempts(result) {
  const messages = result?.messages ?? [];
  let toolCalls = 0;
  let patchToolCalls = 0;
  let toolResults = 0;
  let lastAssistantSnippet = '';
  for (const m of messages) {
    const calls = m?.tool_calls ?? m?.kwargs?.tool_calls ?? [];
    if (Array.isArray(calls) && calls.length > 0) {
      toolCalls += calls.length;
      for (const c of calls) {
        const name = c?.name ?? c?.function?.name ?? '';
        if (name === 'apply_infographic_patch') patchToolCalls += 1;
      }
    }
    const type = m?.type ?? m?.role ?? m?.kwargs?.role ?? '';
    if (type === 'tool' || m?.tool_call_id || m?.kwargs?.tool_call_id) toolResults += 1;
    if (type === 'ai' || type === 'assistant') {
      const text = extractTextContent(m?.content ?? m?.kwargs?.content ?? '');
      if (text) lastAssistantSnippet = text.slice(0, 200);
    }
  }
  return {
    messageCount: messages.length,
    toolCalls,
    patchToolCalls,
    toolResults,
    lastAssistantSnippet
  };
}

function extractLastAttemptedDsl(result) {
  const messages = result?.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    const toolCalls = m?.tool_calls ?? m?.kwargs?.tool_calls ?? [];
    for (const call of toolCalls) {
      const name = call?.name ?? call?.function?.name;
      if (name !== 'apply_infographic_patch') continue;
      const args =
        call?.args ?? (typeof call?.function?.arguments === 'string'
          ? safeParseJson(call.function.arguments)
          : call?.function?.arguments) ?? {};
      if (typeof args.diagramSource === 'string' && args.diagramSource.trim()) {
        return args.diagramSource;
      }
    }
  }
  return null;
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function createInfographicLangChainAgent({
  stateStore,
  env = process.env,
  createAgentImpl = createAgent,
  chatModelFactory = defaultChatModelFactory
}) {
  const tools = createInfographicTools({ stateStore });
  const agentCache = new Map();
  const analysisModelCache = new Map();

  function chatModelFor(profile, extraOptions = {}) {
    const backend = resolveLlmBackend(env);
    const modelId =
      backend === 'vertex' ? resolveVertexModelId(env, profile) : resolveOpenRouterModelId(env, profile);
    return chatModelFactory(env, { model: modelId, ...extraOptions });
  }

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
          systemPrompt: INFOGRAPHIC_SYSTEM_PROMPT
        })
      );
    }
    return agentCache.get(key);
  }

  /** Same tools/prompt as the default intent agent, but low temperature for prose-only retries. */
  function getStableIntentAgent(profile = 'fast') {
    const p = normalizeModelProfile(profile);
    const backend = resolveLlmBackend(env);
    const modelId =
      backend === 'vertex' ? resolveVertexModelId(env, p) : resolveOpenRouterModelId(env, p);
    const key = `intent-stable:${backend}:${modelId}`;
    if (!agentCache.has(key)) {
      agentCache.set(
        key,
        createAgentImpl({
          model: chatModelFor(p, { temperature: 0.06 }),
          tools,
          systemPrompt: INFOGRAPHIC_SYSTEM_PROMPT
        })
      );
    }
    return agentCache.get(key);
  }

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
          systemPrompt: INFOGRAPHIC_SYSTEM_PROMPT
        })
      );
    }
    return agentCache.get(key);
  }

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

  return {
    async applyIntent({ prompt, focusNode, modelProfile, emit, peerContext }) {
      const slot = stateStore.getSlot('infographic');
      const focusScope = buildFocusScopeInstructions(focusNode);
      const agent = getDefaultAgent(modelProfile);
      const peerMermaid =
        peerContext?.contentType === 'mermaid' && typeof peerContext.diagramSource === 'string'
          ? peerContext.diagramSource
          : '';
      const stableAgent = getStableIntentAgent(modelProfile);
      return invokeWithRepair(
        agent,
        [
          {
            role: 'user',
            content: buildIntentUserContent({
              prompt,
              focusScope,
              currentDsl: slot.diagramSource,
              peerMermaid
            })
          }
        ],
        { requirePatch: true, emit, stableAgent },
        stateStore,
        env
      );
    },

    async applyTransformIntent({ mode, focusNode, modelProfile, emit, goMadDepth }) {
      const slot = stateStore.getSlot('infographic');
      const focusScope = buildFocusScopeInstructions(focusNode);
      const agent = getTransformAgent(mode, modelProfile, goMadDepth);
      // Stable fallback: the default fast (non-transform) agent at the SAME caller profile.
      // Transform agents — especially goMad — run hot enough to occasionally produce prose-only
      // turns; the stable agent is the same toolset at default temperature.
      const stableAgent = getDefaultAgent(modelProfile);
      return invokeWithRepair(
        agent,
        [
          {
            role: 'user',
            content: buildTransformUserContent({
              mode,
              focusScope,
              currentDsl: slot.diagramSource,
              goMadDepth
            })
          }
        ],
        { requirePatch: true, emit, stableAgent },
        stateStore,
        env
      );
    },

    async applyAnalyzeIntent({ kind, focusNode, modelProfile, emit }) {
      const slot = stateStore.getSlot('infographic');
      const focusScope = buildAnalyzeFocusInstructions(focusNode, kind);
      const task = kind === 'critique' ? INFOGRAPHIC_CRITIQUE_TASK : INFOGRAPHIC_EXPLAIN_TASK;

      const profile = normalizeModelProfile(modelProfile);
      const backend = resolveLlmBackend(env);
      const modelId =
        backend === 'vertex' ? resolveVertexModelId(env, profile) : resolveOpenRouterModelId(env, profile);
      const analysisModel = getAnalysisModel(backend, modelId, kind);

      const messages = [
        new SystemMessage(INFOGRAPHIC_ANALYSIS_SYSTEM_PROMPT),
        new HumanMessage(buildAnalysisUserContent({ task, focusScope, currentDsl: slot.diagramSource }))
      ];

      if (typeof emit === 'function') {
        emit({ type: 'phase', id: 'analyze_stream', label: 'Streaming analysis…' });
        try {
          const stream = await analysisModel.stream(messages);
          const full = await emitTokens(stream, emit);
          return { message: full.trim() || 'Done.', raw: null };
        } catch (error) {
          emit({
            type: 'error',
            message: redactSecrets(error instanceof Error ? error.message : String(error))
          });
          const fallback = await analysisModel.invoke(messages).catch(() => null);
          const text = fallback ? extractTextContent(fallback.content) : '';
          return { message: text || 'Analysis failed.', raw: null };
        }
      }

      const response = await analysisModel.invoke(messages);
      return {
        message: extractTextContent(response.content).trim() || 'Done.',
        raw: response
      };
    }
  };
}

export function createLazyInfographicAgentService({ stateStore, env = process.env }) {
  let agentService;

  function getAgentService() {
    if (!isLlmConfigured(env)) {
      throw new LlmNotConfiguredError();
    }
    agentService ??= createInfographicLangChainAgent({ stateStore, env });
    return agentService;
  }

  return {
    async applyIntent(input) {
      return getAgentService().applyIntent(input);
    },
    async applyTransformIntent(input) {
      return getAgentService().applyTransformIntent(input);
    },
    async applyAnalyzeIntent(input) {
      return getAgentService().applyAnalyzeIntent(input);
    },
    async runAgentStream(operation, payload, emit) {
      const agent = getAgentService();
      const modelProfile = payload.modelProfile;

      if (typeof emit === 'function') {
        if (operation === 'analyze') {
          emit({ type: 'phase', id: 'analyze', label: 'Analyzing infographic…' });
        } else if (operation === 'intent') {
          emit({ type: 'phase', id: 'intent', label: 'Applying your request…' });
        } else {
          emit({ type: 'phase', id: 'transform', label: 'Transforming infographic…' });
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
      // Reuse Mermaid's emitter; it reads stateStore.getSlot('mermaid') for the patch summary,
      // so we emit a thin infographic equivalent here instead.
      let after = stateStore.getSlot('infographic');
      const revisionChanged = after.revisionId !== before;
      // Record the topic on a successful intent so mode-switch can carry it across.
      if (revisionChanged && operation === 'intent' && typeof payload.prompt === 'string') {
        after = stateStore.setLastUserPrompt({ contentType: 'infographic', prompt: payload.prompt });
      }
      if (typeof emit === 'function') {
        emit({
          type: 'final',
          revisionChanged,
          message: agentResult.message,
          state: after
        });
      }
      // Suppress unused-var warning for the imported helper.
      void emitIntentTransformStreamResult;

      return agentResult;
    }
  };
}
