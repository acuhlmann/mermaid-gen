import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { createAgent } from 'langchain';
import { createInfographicTools } from './diagramTools.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import {
  INFOGRAPHIC_SYSTEM_PROMPT,
  INFOGRAPHIC_ANALYSIS_SYSTEM_PROMPT,
  INFOGRAPHIC_CRITIQUE_TASK,
  INFOGRAPHIC_EXPLAIN_TASK,
  buildInfographicRepairInstruction
} from '../prompts/infographicSyntaxGuard.js';
import {
  LlmNotConfiguredError,
  isLlmConfigured,
  createLlmChatModel,
  createOpenRouterModel,
  resolveLlmBackend,
  resolveModelId
} from './llmProvider.js';
import { emitAnalyzeStreamArtifactsBeforeFinal } from './agentStreamAnalyzeFinalize.js';
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
  toLangChainMessages,
  transformModeModelOptions
} from './mermaidLangChainAgent.js';
import {
  buildInfographicFocusScopeInstructions,
  buildInfographicAnalyzeFocusInstructions
} from './infographicFocusInstructions.js';
import {
  buildAgentRunBudgetExceededMessage,
  refineInfographicDsl,
  resolveAgentRepairMaxAttempts,
  resolveAgentRunBudgetMs
} from '@archislop/shared';
import {
  buildInfographicTransformUserContent,
  INFOGRAPHIC_INTENT_PERSONA_INSTRUCTIONS
} from './infographicTransformPrompts.js';

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
import { repairInfographicWithFixer, isInfographicSyntaxFixerAvailable } from './infographicSyntaxFixer.js';
import { emitPlanBeat, emitServerMutationPlanBeats } from './planBeatMessages.js';
import { createPatchToolStreamTracker } from './streamPatchToolTelemetry.js';

const INFOGRAPHIC_PATCH_REQUIRED_INSTRUCTION = `Your previous response did not apply an infographic patch.
- You MUST call apply_infographic_patch now once with complete, valid AntV Infographic DSL, then briefly summarize in prose only.
- Do not return prose only.
- Do not mention tool names in your final user-facing summary.`;

const INFOGRAPHIC_TRANSFORM_PERSONAS = new Set(['refine', 'innovate', 'goMad', 'exec']);

async function withInfographicTransformContext(stateStore, context, fn) {
  stateStore.setTransformContext(context);
  try {
    return await fn();
  } finally {
    stateStore.clearTransformContext();
  }
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
  return createLlmChatModel(env, options);
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

function detectPromptLanguageHint(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  // Count CJK characters; if substantial, the user likely wants CJK output. Otherwise Latin.
  const cjkMatches = text.match(/[㐀-鿿豈-﫿]/g) ?? [];
  const totalLetters = text.match(/[\p{L}]/gu)?.length ?? 0;
  if (totalLetters === 0) return null;
  const cjkRatio = cjkMatches.length / totalLetters;
  if (cjkRatio >= 0.25) return 'Chinese (zh)';
  return 'English (en)';
}

function buildLanguageInstruction(prompt, currentDsl) {
  const hint = detectPromptLanguageHint(prompt) ?? detectPromptLanguageHint(currentDsl);
  if (!hint) return '';
  return `\n\nLANGUAGE LOCK: Output ALL reader-facing text (title, desc, label, edge labels) in ${hint}. Do NOT translate, do NOT add second-language alternates. This is NON-NEGOTIABLE for this turn.`;
}

function buildIntentUserContent({ prompt, focusScope, currentDsl, peerMermaid, transformPersona }) {
  const peerBlock =
    typeof peerMermaid === 'string' && peerMermaid.trim()
      ? `Cross-format / mode switch: reproduce the same information as the peer Mermaid diagram below as Infographic DSL (entities, flow, labels). Prefer this source over improvising from the topic text alone.

Peer Mermaid:
\`\`\`mermaid
${peerMermaid.trim()}
\`\`\`

`
      : '';
  const languageInstruction = buildLanguageInstruction(prompt, currentDsl);
  const personaBlock =
    transformPersona && INFOGRAPHIC_INTENT_PERSONA_INSTRUCTIONS[transformPersona]
      ? `\n\n${INFOGRAPHIC_INTENT_PERSONA_INSTRUCTIONS[transformPersona]}`
      : '';
  const preserveBlock =
    currentDsl?.trim() && !peerMermaid
      ? '\n\nWhen the current DSL is non-empty, keep the same `infographic <template>` and main data field unless the user explicitly asks for a different layout.'
      : '';
  return `${peerBlock}Interpret and apply the user's requested infographic change strictly according to their wording.${personaBlock}${preserveBlock}

Broad or short requests (for example a single topic name) still require a concrete infographic now: choose a sensible template and produce real content. Do not ask the user to clarify.

Current committed infographic DSL:
\`\`\`
${currentDsl || '(empty — produce a fresh infographic)'}
\`\`\`

User request:
${prompt}${focusScope}${languageInstruction}`;
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
  const {
    requirePatch = false,
    emit,
    stableAgent = null,
    profile,
    abortSignal,
    mode = null,
    focusNode = null,
    peerContext = null
  } = opts ?? {};
  const runProfile = normalizeModelProfile(profile);
  const maxRepairAttempts = resolveAgentRepairMaxAttempts(runProfile, env, 'infographic');
  const runBudgetMs = resolveAgentRunBudgetMs(runProfile, env);
  const turnStarted = Date.now();
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

  const stopReason = () => {
    if (abortSignal?.aborted) {
      return { code: 'run_aborted', message: 'Agent run was stopped before completion.' };
    }
    if (Date.now() - turnStarted >= runBudgetMs) {
      return {
        code: 'run_budget_exceeded',
        message: buildAgentRunBudgetExceededMessage(runProfile, runBudgetMs)
      };
    }
    return null;
  };

  const finishStoppedRun = (reason) => {
    lastError = reason.message;
    if (typeof emit === 'function' && reason.code === 'run_budget_exceeded') {
      emit({ type: 'error', code: reason.code, message: reason.message });
    }
    return {
      message: lastError,
      raw: lastResult,
      metadata: { agent: 'infographic', error: lastError, code: reason.code }
    };
  };

  if (typeof emit === 'function' && requirePatch) {
    emitServerMutationPlanBeats({
      emit,
      stateStore,
      mode,
      messages: userMessages,
      focusNode,
      peerContext,
      contentType: 'infographic'
    });
  }

  for (let attempt = 0; attempt <= maxRepairAttempts; attempt += 1) {
    const stop = stopReason();
    if (stop) return finishStoppedRun(stop);
    if (typeof emit === 'function') {
      if (attempt > 0) {
        emitPlanBeat(
          emit,
          `Previous infographic patch did not validate — retrying while keeping your intent (attempt ${attempt} of ${maxRepairAttempts}).`,
          'server'
        );
      }
      emit({
        type: 'phase',
        id: attempt === 0 ? 'invoke' : `repair_${attempt}`,
        label: attempt === 0 ? 'Generating infographic…' : `Repairing infographic (attempt ${attempt} of ${maxRepairAttempts})…`
      });
    }

    let result;
    try {
      if (typeof currentAgent.streamEvents === 'function' && typeof emit === 'function') {
        const stream = await currentAgent.streamEvents(
          { messages },
          { version: 'v2', ...(abortSignal ? { signal: abortSignal } : {}) }
        );
        const patchTelemetry = createPatchToolStreamTracker({
          emit,
          patchToolName: 'apply_infographic_patch',
          contentType: 'infographic',
          emitDraftPreview: true
        });
        let latestMessages = [];
        for await (const ev of stream) {
          latestMessages = captureMessagesFromStreamEvent(ev, latestMessages);
          const normalized = normalizeAgentStreamEvent(ev);
          if (normalized) emit(normalized);

          if (ev?.event === 'on_chat_model_stream') {
            const chunks = ev.data?.chunk?.tool_call_chunks;
            patchTelemetry.processToolCallChunks(chunks);
          }
        }
        // streamEvents doesn't return a single envelope object; reconstruct
        // the legacy shape so the post-loop revision/repair logic still works.
        result = latestMessages.length > 0 ? { messages: latestMessages } : null;
      } else {
        result = await currentAgent.invoke(
          { messages },
          abortSignal ? { signal: abortSignal } : undefined
        );
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
        const fixerStop = stopReason();
        if (fixerStop) return finishStoppedRun(fixerStop);
        syntaxFixerTried = true;
        if (typeof emit === 'function') {
          emitPlanBeat(
            emit,
            'Infographic DSL failed validation — running a quick syntax pass before retrying.',
            'server'
          );
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
          emitPlanBeat(
            emit,
            'No infographic patch landed — retrying with a steadier model to apply your change.',
            'server'
          );
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
    const modelId = resolveModelId(env, profile, backend);
    return chatModelFactory(env, { model: modelId, ...extraOptions });
  }

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
    const modelId = resolveModelId(env, p, backend);
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
    const m =
      mode === 'refine' || mode === 'innovate' || mode === 'goMad' || mode === 'exec' ? mode : 'refine';
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
    async applyIntent({ prompt, focusNode, modelProfile, emit, peerContext, transformPersona, abortSignal }) {
      const slot = stateStore.getSlot('infographic');
      const focusScope = buildFocusScopeInstructions(focusNode);
      const agent = getDefaultAgent(modelProfile);
      const peerMermaid =
        peerContext?.contentType === 'mermaid' && typeof peerContext.diagramSource === 'string'
          ? peerContext.diagramSource
          : '';
      const stableAgent = getStableIntentAgent('fast');
      const personaMode =
        typeof transformPersona === 'string' && INFOGRAPHIC_TRANSFORM_PERSONAS.has(transformPersona)
          ? transformPersona
          : null;
      const run = () =>
        invokeWithRepair(
          agent,
          [
            {
              role: 'user',
              content: buildIntentUserContent({
                prompt,
                focusScope,
                currentDsl: stateStore.getSlot('infographic').diagramSource,
                peerMermaid,
                transformPersona: personaMode ?? transformPersona
              })
            }
          ],
          {
            requirePatch: true,
            emit,
            stableAgent,
            profile: normalizeModelProfile(modelProfile),
            abortSignal,
            mode: personaMode ?? 'go',
            focusNode,
            peerContext:
              peerMermaid.length > 0
                ? { contentType: 'mermaid', diagramSource: peerMermaid }
                : peerContext ?? null
          },
          stateStore,
          env
        );
      if (personaMode) {
        return withInfographicTransformContext(
          stateStore,
          { mode: personaMode, goMadDepth: 1 },
          run
        );
      }
      return run();
    },

    async applyTransformIntent({
      mode,
      focusNode,
      modelProfile,
      emit,
      goMadDepth,
      advisorPrompt,
      abortSignal
    }) {
      const depth = mode === 'goMad' ? clampGoMadDepth(goMadDepth ?? 1) : null;
      return withInfographicTransformContext(
        stateStore,
        { mode, goMadDepth: depth },
        async () => {
          let slot = stateStore.getSlot('infographic');
          if (mode === 'refine' && slot.diagramSource?.trim()) {
            const prepass = refineInfographicDsl(slot.diagramSource);
            if (prepass.applied.length > 0 && prepass.dsl !== slot.diagramSource) {
              const prepApplied = await stateStore.applyDiagramSource({
                contentType: 'infographic',
                diagramSource: prepass.dsl,
                reason: 'refine-prepass'
              });
              if (prepApplied.accepted) slot = prepApplied.state;
            }
          }

          const focusScope = buildFocusScopeInstructions(focusNode);
          const agent = getTransformAgent(mode, modelProfile, goMadDepth);
          const stableAgent = getStableIntentAgent('fast');
          const originalRequest = typeof slot?.lastUserPrompt === 'string' ? slot.lastUserPrompt : '';
          const languageInstruction = buildLanguageInstruction(originalRequest, slot.diagramSource);
          const body = `${buildInfographicTransformUserContent({
            mode,
            focusScope,
            currentDsl: slot.diagramSource,
            goMadDepth,
            advisorPrompt
          })}${languageInstruction}`;

          return invokeWithRepair(
            agent,
            [{ role: 'user', content: body }],
            {
              requirePatch: true,
              emit,
              stableAgent,
              profile: normalizeModelProfile(modelProfile),
              abortSignal,
              mode,
              focusNode
            },
            stateStore,
            env
          );
        }
      );
    },

    async applyAnalyzeIntent({ kind, focusNode, modelProfile, emit }) {
      const slot = stateStore.getSlot('infographic');
      const focusScope = buildAnalyzeFocusInstructions(focusNode, kind);
      const task = kind === 'critique' ? INFOGRAPHIC_CRITIQUE_TASK : INFOGRAPHIC_EXPLAIN_TASK;

      const profile = normalizeModelProfile(modelProfile);
      const backend = resolveLlmBackend(env);
      const modelId = resolveModelId(env, profile, backend);
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
        emitAnalyzeStreamArtifactsBeforeFinal(emit, {
          kind: payload.kind,
          analyzeText: result.message,
          contentType: payload.contentType
        });
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
          peerContext: payload.peerContext,
          transformPersona: payload.transformPersona,
          abortSignal: payload.abortSignal
        });
      } else {
        agentResult = await agent.applyTransformIntent({
          mode: payload.mode,
          focusNode: payload.focusNode,
          modelProfile,
          emit,
          goMadDepth: payload.goMadDepth,
          advisorPrompt: payload.advisorPrompt,
          abortSignal: payload.abortSignal
        });
      }

      const before = payload._revisionBefore;
      emitIntentTransformStreamResult({
        emit,
        operation,
        revisionBefore: before,
        stateStore,
        agentResult,
        prompt: payload.prompt,
        contentType: 'infographic'
      });

      return agentResult;
    }
  };
}
