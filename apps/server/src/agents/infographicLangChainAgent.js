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
  appendProseLanguageInstruction,
  appendLanguageInstruction,
  buildLanguageInstruction
} from '@archislop/shared';
import {
  captureMessagesFromStreamEvent,
  extractFinalMessage,
  extractLastAttemptedToolSource,
  extractOriginalRequest,
  extractTextContent,
  extractToolFailureError,
  forwardNormalizedAgentStreamEvent,
  normalizeAgentStreamEvent,
  toLangChainMessages
} from './_lib/diagramAgentHelpers.js';
import { createLlmChatModel, resolveLlmBackend, resolveModelId } from './llmProvider.js';
import { createDiagramAgentCache } from './_lib/diagramAgentCache.js';
import { createLazyAgentService } from './_lib/createLazyAgentService.js';
import {
  buildAnalyzeFocusInstructions as buildMermaidAnalyzeFocusInstructions,
  buildFocusScopeInstructions as buildMermaidFocusScopeInstructions,
  clampGoMadDepth
} from './mermaidAnalysisPrompts.js';
import { normalizeModelProfile } from './llmProvider.js';
import {
  buildInfographicFocusScopeInstructions,
  buildInfographicAnalyzeFocusInstructions
} from './infographicFocusInstructions.js';
import {
  appendLastValidationError,
  buildAgentRunBudgetExceededMessage,
  isMermaidTransformConstraintError,
  MIN_AGENT_REPAIR_TURN_BUDGET_MS,
  MIN_SYNTAX_FIXER_BUDGET_MS,
  refineInfographicDsl,
  resolveAgentRepairAttemptProfile,
  resolveAgentRepairMaxAttempts,
  resolveAgentRunBudgetMs
} from '@archislop/shared';
import { createRunDeadlineSignal } from './_lib/agentRunDeadline.js';
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
import { classifyAgentTurnError, recordAgentTurn } from '../metrics/agentTurnMetrics.js';
import {
  repairInfographicWithFixer,
  isInfographicSyntaxFixerAvailable
} from './infographicSyntaxFixer.js';
import { emitPlanBeat, emitServerMutationPlanBeats } from './planBeatMessages.js';
import { emitSyntaxFixerResult, emitSyntaxFixerStart } from './syntaxFixerTelemetry.js';
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

function defaultChatModelFactory(env, options) {
  return createLlmChatModel(env, options);
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

function buildAnalysisUserContent({ task, focusScope, currentDsl, advisorPrompt }) {
  const prefix = focusScope ? `${focusScope.trim()}\n\n` : '';
  const trimmed = typeof advisorPrompt === 'string' ? advisorPrompt.trim().slice(0, 400) : '';
  const stakeholderBlock = trimmed
    ? `\n\nStakeholder suggestion to honor (scoped — foreground this in the analysis; do not treat it as a request to rewrite the whole diagram unless the suggestion explicitly requires it):\n"${trimmed}"\n`
    : '';
  return `${prefix}${task}${stakeholderBlock}

\`\`\`
${currentDsl}
\`\`\``;
}

function buildAnalysisUserContentWithLanguage({
  task,
  focusScope,
  currentDsl,
  advisorPrompt,
  lastUserPrompt
}) {
  return appendProseLanguageInstruction(
    buildAnalysisUserContent({ task, focusScope, currentDsl, advisorPrompt }),
    lastUserPrompt,
    currentDsl,
    advisorPrompt
  );
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
    resolveRepairAgent = null,
    profile,
    abortSignal,
    mode = null,
    focusNode = null,
    peerContext = null
  } = opts ?? {};
  const runProfile = normalizeModelProfile(profile);
  const maxRepairAttempts = resolveAgentRepairMaxAttempts(runProfile, env, 'infographic');
  const runBudgetMs = resolveAgentRunBudgetMs(runProfile, env, mode);
  const turnStarted = Date.now();
  // Every model turn shares this deadline-capped signal so an in-flight call cannot
  // overrun the run budget; `abortSignal` stays untouched for user-stop detection.
  const runSignal = createRunDeadlineSignal({
    abortSignal,
    budgetMs: runBudgetMs,
    startedAt: turnStarted
  });
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
  let invokeErrored = false;

  const backend = resolveLlmBackend(env, runProfile);
  const modelLabel = backend ? `${backend}:${resolveModelId(env, runProfile, backend)}` : null;
  let repairAttempts = 0;
  /** @param {{accepted: boolean, validator?: string | null, errorClass?: string | null}} sample */
  const finishTurn = (sample) => {
    recordAgentTurn(
      {
        contentType: 'infographic',
        mode: mode ?? 'unknown',
        model: modelLabel,
        profile: runProfile,
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

  /**
   * @param {number} [minRemainingMs] Stop early when less than this much budget remains —
   * starting work that cannot finish inside the budget only delays the failure.
   */
  const stopReason = (minRemainingMs = 0) => {
    if (abortSignal?.aborted) {
      return {
        code: 'run_aborted',
        message: 'Agent run was stopped before completion.',
        errorClass: 'run-aborted'
      };
    }
    if (Date.now() - turnStarted >= runBudgetMs - minRemainingMs) {
      return {
        code: 'run_budget_exceeded',
        message: buildAgentRunBudgetExceededMessage(runProfile, runBudgetMs),
        errorClass: 'budget-exceeded'
      };
    }
    return null;
  };

  const finishStoppedRun = (reason) => {
    // Keep the last validator diagnostic in the failure message so the UI shows WHY the
    // run ran out of time (what was invalid in the DSL), not just that it timed out.
    const message = appendLastValidationError(reason.message, lastError);
    if (typeof emit === 'function' && reason.code === 'run_budget_exceeded') {
      emit({ type: 'error', code: reason.code, message });
    }
    finishTurn({ accepted: false, errorClass: reason.errorClass });
    return {
      message,
      raw: lastResult,
      metadata: { agent: 'infographic', error: lastError ?? null, code: reason.code }
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
    if (attempt > 0) {
      repairAttempts += 1;
      const repairProfile = resolveAgentRepairAttemptProfile(runProfile, attempt);
      if (typeof resolveRepairAgent === 'function') {
        const escalated = resolveRepairAgent(repairProfile, attempt);
        if (escalated) currentAgent = escalated;
      }
    }
    const stop = stopReason(attempt > 0 ? MIN_AGENT_REPAIR_TURN_BUDGET_MS : 0);
    if (stop) return finishStoppedRun(stop);
    if (typeof emit === 'function') {
      if (attempt > 0) {
        const repairProfile = resolveAgentRepairAttemptProfile(runProfile, attempt);
        const tierNote = repairProfile === 'quality' ? ' (quality model)' : '';
        emitPlanBeat(
          emit,
          `Previous infographic patch did not validate — retrying while keeping your intent (attempt ${attempt} of ${maxRepairAttempts})${tierNote}.`,
          'server'
        );
      }
      emit({
        type: 'phase',
        id: attempt === 0 ? 'invoke' : `repair_${attempt}`,
        label:
          attempt === 0
            ? 'Generating infographic…'
            : `Repairing infographic (attempt ${attempt} of ${maxRepairAttempts})…`
      });
    }

    let result;
    try {
      if (typeof currentAgent.streamEvents === 'function' && typeof emit === 'function') {
        const stream = await currentAgent.streamEvents(
          { messages },
          { version: 'v2', signal: runSignal }
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
          if (normalized) forwardNormalizedAgentStreamEvent(emit, normalized);

          if (ev?.event === 'on_chat_model_stream') {
            const chunks = ev.data?.chunk?.tool_call_chunks;
            patchTelemetry.processToolCallChunks(chunks);
          }
        }
        // streamEvents doesn't return a single envelope object; reconstruct
        // the legacy shape so the post-loop revision/repair logic still works.
        result = latestMessages.length > 0 ? { messages: latestMessages } : null;
      } else {
        result = await currentAgent.invoke({ messages }, { signal: runSignal });
      }
    } catch (error) {
      // A deadline/user abort surfaces as a stream error — finish with the proper stop
      // reason (which carries the last validator diagnostic) instead of the bare
      // "aborted" message.
      const abortStop = stopReason();
      if (abortStop) return finishStoppedRun(abortStop);
      lastError = redactSecrets(error instanceof Error ? error.message : String(error));
      invokeErrored = true;
      if (typeof emit === 'function') emit({ type: 'error', message: lastError });
      break;
    }

    lastResult = result;

    const currentRevision = stateStore.getSlot('infographic').revisionId;
    if (currentRevision !== beforeRevision) {
      // Patch landed — success.
      finishTurn({
        accepted: true,
        validator: attempt === 0 ? 'first-try' : `repair-attempt-${attempt}`
      });
      return {
        message: extractFinalMessage(result) || 'Infographic updated.',
        raw: result,
        metadata: { agent: 'infographic' }
      };
    }

    if (!requirePatch) {
      // No patch needed (e.g. analyze) — not an accept/reject sample, don't record.
      return {
        message: extractFinalMessage(result) || 'Done.',
        raw: result,
        metadata: { agent: 'infographic' }
      };
    }

    // Patch was required but not produced. Build a repair turn.
    let failureError = extractToolFailureError(result);

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
          finishTurn({ accepted: true, validator: 'prose-dsl-recovery' });
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
      lastBrokenSource =
        extractLastAttemptedToolSource(result, 'apply_infographic_patch') || lastBrokenSource;

      // (a) Tool-less single-shot syntax fixer: runs ONCE before the next full agent retry.
      // Mirrors the Mermaid pattern (mermaidLangChainAgent.js around line 949). The fixer is
      // a cheap fast model and skips tool plumbing entirely — when it works, we apply the
      // patch directly and short-circuit the rest of the loop. Transform-policy rejections
      // (e.g. Go Mad tier ≥3 "switch template family") are semantic constraints the
      // low-temperature fixer cannot satisfy, so those go straight to the agent retry.
      if (
        !syntaxFixerTried &&
        lastBrokenSource &&
        isInfographicSyntaxFixerAvailable(env) &&
        !isMermaidTransformConstraintError(failureError)
      ) {
        const fixerStop = stopReason(MIN_SYNTAX_FIXER_BUDGET_MS);
        if (fixerStop) return finishStoppedRun(fixerStop);
        syntaxFixerTried = true;
        repairAttempts += 1;
        emitSyntaxFixerStart(emit, { contentType: 'infographic', triggerError: failureError });
        const fixerOutcome = await repairInfographicWithFixer({
          brokenSource: lastBrokenSource,
          parseError: failureError,
          originalRequest,
          env,
          abortSignal: runSignal
        });
        if (fixerOutcome.accepted && fixerOutcome.diagramSource) {
          const applied = await stateStore.applyDiagramSource({
            contentType: 'infographic',
            diagramSource: fixerOutcome.diagramSource,
            reason: 'syntax-fixer repair'
          });
          if (applied.accepted) {
            emitSyntaxFixerResult(emit, {
              contentType: 'infographic',
              outcome: 'repaired',
              detail: 'Repaired invalid infographic DSL and applied the patch.'
            });
            finishTurn({ accepted: true, validator: 'syntax-fixer' });
            return {
              message: 'Infographic updated (repaired by syntax fixer).',
              raw: result,
              metadata: { agent: 'infographic', validator: 'syntax-fixer' }
            };
          }
          // If the fixer's candidate failed `applyDiagramSource` (re-validates), fall through
          // to the agent retry — pass the resulting error along so the next attempt sees it.
          lastError = `${failureError}\n(fixer attempt also rejected: ${applied.error})`;
          emitSyntaxFixerResult(emit, {
            contentType: 'infographic',
            outcome: 'store_rejected',
            error: applied.error ?? 'Infographic validation failed after syntax fixer.'
          });
        } else {
          lastError = `${failureError}\n(syntax fixer: ${fixerOutcome.error})`;
          emitSyntaxFixerResult(emit, {
            contentType: 'infographic',
            outcome: 'fixer_failed',
            error: fixerOutcome.error ?? 'Syntax fixer could not repair the infographic DSL.'
          });
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

  finishTurn({
    accepted: false,
    errorClass: invokeErrored ? 'invoke-error' : (classifyAgentTurnError(lastError) ?? 'no-patch')
  });
  return {
    message: lastError
      ? `Infographic update failed: ${lastError}`
      : 'Infographic update did not apply.',
    raw: lastResult,
    metadata: { agent: 'infographic', error: lastError ?? null }
  };
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

export function createInfographicLangChainAgent({
  stateStore,
  env = process.env,
  createAgentImpl = createAgent,
  chatModelFactory = defaultChatModelFactory
}) {
  const tools = createInfographicTools({ stateStore });
  const cache = createDiagramAgentCache({
    env,
    systemPrompt: INFOGRAPHIC_SYSTEM_PROMPT,
    tools,
    chatModelFactory,
    createAgentImpl
  });

  const getDefaultAgent = cache.getDefaultAgent;

  /** Same tools/prompt as the default intent agent, but low temperature for prose-only retries. */
  function getStableIntentAgent(profile = 'fast') {
    return cache.getCustomAgent({
      keyPrefix: 'intent-stable',
      profile,
      modelOptions: { temperature: 0.06 }
    });
  }

  function getTransformAgent(mode, profile = 'fast', goMadDepth) {
    const safeMode =
      mode === 'refine' || mode === 'innovate' || mode === 'goMad' || mode === 'exec'
        ? mode
        : 'refine';
    return cache.getTransformAgent(safeMode, profile, goMadDepth);
  }

  const getAnalysisModel = cache.getAnalysisModel;

  return {
    async applyIntent({
      prompt,
      focusNode,
      modelProfile,
      emit,
      peerContext,
      transformPersona,
      abortSignal
    }) {
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
            resolveRepairAgent: (p) => getDefaultAgent(p),
            profile: normalizeModelProfile(modelProfile),
            abortSignal,
            mode: personaMode ?? 'go',
            focusNode,
            peerContext:
              peerMermaid.length > 0
                ? { contentType: 'mermaid', diagramSource: peerMermaid }
                : (peerContext ?? null)
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
      return withInfographicTransformContext(stateStore, { mode, goMadDepth: depth }, async () => {
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
        const body = appendLanguageInstruction(
          buildInfographicTransformUserContent({
            mode,
            focusScope,
            currentDsl: slot.diagramSource,
            goMadDepth,
            advisorPrompt
          }),
          originalRequest,
          slot.diagramSource
        );

        return invokeWithRepair(
          agent,
          [{ role: 'user', content: body }],
          {
            requirePatch: true,
            emit,
            stableAgent,
            resolveRepairAgent: (p) => getDefaultAgent(p),
            profile: normalizeModelProfile(modelProfile),
            abortSignal,
            mode,
            focusNode
          },
          stateStore,
          env
        );
      });
    },

    async applyAnalyzeIntent({ kind, focusNode, modelProfile, emit, advisorPrompt }) {
      const slot = stateStore.getSlot('infographic');
      const focusScope = buildAnalyzeFocusInstructions(focusNode, kind);
      const task = kind === 'critique' ? INFOGRAPHIC_CRITIQUE_TASK : INFOGRAPHIC_EXPLAIN_TASK;

      const profile = normalizeModelProfile(modelProfile);
      const backend = resolveLlmBackend(env, profile);
      const modelId = resolveModelId(env, profile, backend);
      const analysisModel = getAnalysisModel(backend, modelId, kind);

      const messages = [
        new SystemMessage(INFOGRAPHIC_ANALYSIS_SYSTEM_PROMPT),
        new HumanMessage(
          buildAnalysisUserContentWithLanguage({
            task,
            focusScope,
            currentDsl: slot.diagramSource,
            advisorPrompt,
            lastUserPrompt: slot.lastUserPrompt
          })
        )
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

/**
 * Lazy wrapper that defers agent construction until the first call.
 * Satisfies {@link import('@archislop/shared').DiagramAgentService}.
 * Does not implement `invoke` or `applyStyleIntent` — those are mermaid-only.
 */
export function createLazyInfographicAgentService({ stateStore, env = process.env }) {
  return createLazyAgentService({
    contentType: 'infographic',
    stateStore,
    env,
    buildService: () => createInfographicLangChainAgent({ stateStore, env }),
    streamLabels: {
      analyze: 'Analyzing infographic…',
      intent: 'Applying your request…',
      transform: 'Transforming infographic…'
    },
    intentExtraFields: ['transformPersona'],
    transformExtraFields: ['advisorPrompt'],
    analyzeExtraFields: ['advisorPrompt']
  });
}
