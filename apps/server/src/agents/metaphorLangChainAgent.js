import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createAgent } from 'langchain';
import { createMetaphorTools } from './diagramTools.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import { METAPHOR_SYSTEM_PROMPT } from '../prompts/metaphorSystemPrompt.js';
import {
  buildMetaphorRepairInstruction,
  METAPHOR_ANALYSIS_SYSTEM_PROMPT,
  METAPHOR_CRITIQUE_TASK,
  METAPHOR_EXPLAIN_TASK
} from '../prompts/metaphorSyntaxGuard.js';
import { buildMetaphorAnalyzeFocusInstructions } from './metaphorFocusInstructions.js';
import {
  createLlmChatModel,
  normalizeModelProfile,
  resolveLlmBackend,
  resolveModelId
} from './llmProvider.js';
import { createLazyAgentService } from './_lib/createLazyAgentService.js';
import {
  captureMessagesFromStreamEvent,
  extractFinalMessage,
  extractLastAttemptedToolSource,
  extractToolFailureError,
  forwardNormalizedAgentStreamEvent,
  normalizeAgentStreamEvent,
  toLangChainMessages
} from './_lib/diagramAgentHelpers.js';
import { createPatchToolStreamTracker } from './streamPatchToolTelemetry.js';
import { repairMetaphorWithFixer, isMetaphorSyntaxFixerAvailable } from './metaphorSyntaxFixer.js';
import { emitPlanBeat, emitServerMutationPlanBeats } from './planBeatMessages.js';
import {
  appendLastValidationError,
  buildAgentRunBudgetExceededMessage,
  MIN_AGENT_REPAIR_TURN_BUDGET_MS,
  MIN_SYNTAX_FIXER_BUDGET_MS,
  resolveAgentRepairMaxAttempts,
  resolveAgentRunBudgetMs
} from '@archislop/shared';
import { createRunDeadlineSignal } from './_lib/agentRunDeadline.js';

const METAPHOR_PATCH_REQUIRED_INSTRUCTION = `Your previous response did not apply a metaphor patch.
- You MUST call apply_metaphor_patch now once with complete, valid metaphor DSL JSON, then briefly summarize in prose only.
- Do not return prose only.
- Do not mention tool names in your final user-facing summary.`;

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

/**
 * Some models emit the metaphor DSL as a fenced JSON block in prose instead of calling
 * apply_metaphor_patch. Scan the last assistant message for such a block (or for a bare
 * JSON object containing a recognized metaphor key) and return it so the caller can
 * route it through the same tool path.
 */
function extractMetaphorDslFromAssistantResult(result) {
  const messages = result?.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    const type = m?.type ?? m?.role ?? m?.kwargs?.role ?? '';
    if (type !== 'ai' && type !== 'assistant') continue;
    const raw = extractTextContent(m?.content ?? m?.kwargs?.content ?? '');
    if (!raw?.trim()) continue;

    const fenced = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
    if (fenced && fenced[1].includes('"metaphor"')) {
      return fenced[1].trim();
    }
    const braceStart = raw.indexOf('{');
    const braceEnd = raw.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
      const candidate = raw.slice(braceStart, braceEnd + 1);
      if (candidate.includes('"metaphor"')) return candidate.trim();
    }
  }
  return null;
}

function extractOriginalRequest(userMessages) {
  if (!Array.isArray(userMessages)) return null;
  for (const m of userMessages) {
    if ((m?.role ?? m?.kwargs?.role) !== 'user') continue;
    const text =
      typeof m?.content === 'string'
        ? m.content
        : extractTextContent(m?.content ?? m?.kwargs?.content);
    if (text && text.trim()) return text.trim();
  }
  return null;
}

function buildIntentUserContent({ prompt, currentDsl, peerContext }) {
  const parts = [];
  parts.push(`User request: ${prompt.trim()}`);
  if (currentDsl?.trim()) {
    parts.push(`Current metaphor DSL:\n\n\`\`\`json\n${currentDsl}\n\`\`\``);
  } else {
    parts.push('There is no current metaphor DSL — emit a fresh one.');
  }
  if (peerContext?.contentType && peerContext?.diagramSource?.trim()) {
    parts.push(
      `The user is converting from ${peerContext.contentType}. Use this as the subject context (do NOT translate 1:1 — surface a different *insight* via the metaphor):\n\n\`\`\`\n${peerContext.diagramSource}\n\`\`\``
    );
  }
  parts.push('Call apply_metaphor_patch with the full JSON DSL.');
  return parts.join('\n\n');
}

function buildTransformUserContent({ mode, currentDsl, goMadDepth }) {
  const modeInstructions = {
    refine:
      'Refine the current metaphor — improve labels, balance magnitudes, tighten the spatial story. Keep the same metaphor type.',
    innovate:
      'Innovate on the current metaphor — try a different metaphor type or a fresh angle on the subject. You may switch metaphors.',
    goMad: `Go mad on this metaphor — push the spatial story further (depth ${goMadDepth ?? 1}). Exaggerate, recombine, surprise.`,
    exec: 'Execute the requested change tightly. No additions beyond the implied scope.'
  };
  return [
    modeInstructions[mode] ?? modeInstructions.refine,
    `Current metaphor DSL:\n\n\`\`\`json\n${currentDsl}\n\`\`\``,
    'Call apply_metaphor_patch with the full JSON DSL.'
  ].join('\n\n');
}

function buildAnalyzeUserContent({ kind, currentDsl, focusScope }) {
  const task = kind === 'critique' ? METAPHOR_CRITIQUE_TASK : METAPHOR_EXPLAIN_TASK;
  return [task, focusScope, `Current metaphor DSL:\n\n\`\`\`json\n${currentDsl}\n\`\`\``]
    .filter(Boolean)
    .join('\n\n');
}

export function createMetaphorLangChainAgent({
  stateStore,
  env = process.env,
  createChatModel = defaultChatModelFactory,
  createAgentImpl = createAgent
}) {
  const tools = createMetaphorTools({ stateStore });

  function buildAgent(profile) {
    const backend = resolveLlmBackend(env);
    const modelId = resolveModelId(env, profile, backend);
    const llm = createChatModel(env, { model: modelId });
    return createAgentImpl({ model: llm, tools, systemPrompt: METAPHOR_SYSTEM_PROMPT });
  }

  function buildAnalysisModel(profile) {
    const backend = resolveLlmBackend(env);
    const modelId = resolveModelId(env, profile, backend);
    return createChatModel(env, { model: modelId });
  }

  async function invokeAgentStream({ agent, messages, abortSignal, emit }) {
    try {
      if (typeof agent.streamEvents === 'function' && typeof emit === 'function') {
        const stream = await agent.streamEvents(
          { messages },
          { version: 'v2', ...(abortSignal ? { signal: abortSignal } : {}) }
        );
        const patchTelemetry = createPatchToolStreamTracker({
          emit,
          patchToolName: 'apply_metaphor_patch',
          contentType: 'metaphor3d',
          emitDraftPreview: true
        });
        let latestMessages = [];
        for await (const ev of stream) {
          latestMessages = captureMessagesFromStreamEvent(ev, latestMessages);
          const normalized = normalizeAgentStreamEvent(ev);
          if (normalized) forwardNormalizedAgentStreamEvent(emit, normalized);
          if (ev?.event === 'on_chat_model_stream') {
            patchTelemetry.processToolCallChunks(ev.data?.chunk?.tool_call_chunks);
          }
        }
        return latestMessages.length > 0 ? { messages: latestMessages } : null;
      }
      return await agent.invoke({ messages }, { signal: abortSignal });
    } catch (error) {
      const message = redactSecrets(error instanceof Error ? error.message : String(error));
      return { error: message };
    }
  }

  async function invokeWithRepair(userMessages, opts) {
    const {
      requirePatch = false,
      emit,
      profile,
      abortSignal,
      mode = null,
      focusNode = null,
      peerContext = null
    } = opts ?? {};
    const runProfile = normalizeModelProfile(profile);
    const maxRepairAttempts = resolveAgentRepairMaxAttempts(runProfile, env, 'metaphor3d');
    const runBudgetMs = resolveAgentRunBudgetMs(runProfile, env, mode);
    const turnStarted = Date.now();
    // Every model turn shares this deadline-capped signal so an in-flight call cannot
    // overrun the run budget; `abortSignal` stays untouched for user-stop detection.
    const runSignal = createRunDeadlineSignal({
      abortSignal,
      budgetMs: runBudgetMs,
      startedAt: turnStarted
    });
    const beforeRevision = stateStore.getSlot('metaphor3d').revisionId;
    const originalRequest = extractOriginalRequest(userMessages);

    let messages = toLangChainMessages(userMessages);
    let lastResult = null;
    let lastError = null;
    let lastBrokenSource = null;
    let syntaxFixerTried = false;
    const agent = buildAgent(runProfile);

    /**
     * @param {number} [minRemainingMs] Stop early when less than this much budget remains —
     * starting work that cannot finish inside the budget only delays the failure.
     */
    const stopReason = (minRemainingMs = 0) => {
      if (abortSignal?.aborted) {
        return { code: 'run_aborted', message: 'Agent run was stopped before completion.' };
      }
      if (Date.now() - turnStarted >= runBudgetMs - minRemainingMs) {
        return {
          code: 'run_budget_exceeded',
          message: buildAgentRunBudgetExceededMessage(runProfile, runBudgetMs)
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
      return {
        message,
        raw: lastResult,
        metadata: { agent: 'metaphor3d', error: lastError ?? null, code: reason.code }
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
        contentType: 'metaphor3d'
      });
    }

    for (let attempt = 0; attempt <= maxRepairAttempts; attempt += 1) {
      const stop = stopReason(attempt > 0 ? MIN_AGENT_REPAIR_TURN_BUDGET_MS : 0);
      if (stop) return finishStoppedRun(stop);
      if (typeof emit === 'function') {
        if (attempt > 0) {
          emitPlanBeat(
            emit,
            `Previous metaphor patch did not validate — retrying while keeping your intent (attempt ${attempt} of ${maxRepairAttempts}).`,
            'server'
          );
        }
        emit({
          type: 'phase',
          id: attempt === 0 ? 'metaphor_invoke' : `metaphor_repair_${attempt}`,
          label:
            attempt === 0
              ? 'Composing metaphor…'
              : `Repairing metaphor (attempt ${attempt} of ${maxRepairAttempts})…`
        });
      }

      const result = await invokeAgentStream({ agent, messages, abortSignal: runSignal, emit });
      if (result?.error) {
        // A deadline/user abort surfaces as a stream error — finish with the proper
        // stop reason (which carries the last validator diagnostic) instead of the
        // bare "aborted" message.
        const abortStop = stopReason();
        if (abortStop) return finishStoppedRun(abortStop);
        lastError = result.error;
        if (typeof emit === 'function') emit({ type: 'error', message: lastError });
        break;
      }

      lastResult = result;
      const currentRevision = stateStore.getSlot('metaphor3d').revisionId;
      if (currentRevision !== beforeRevision) {
        return {
          message: extractFinalMessage(result) || 'Metaphor updated.',
          raw: result,
          metadata: { agent: 'metaphor3d' }
        };
      }

      if (!requirePatch) {
        return {
          message: extractFinalMessage(result) || 'Done.',
          raw: result,
          metadata: { agent: 'metaphor3d' }
        };
      }

      let failureError = extractToolFailureError(result);

      if (!failureError) {
        const proseDsl = extractMetaphorDslFromAssistantResult(result);
        if (proseDsl) {
          const applied = await stateStore.applyDiagramSource({
            contentType: 'metaphor3d',
            diagramSource: proseDsl,
            reason: 'prose-dsl recovery'
          });
          if (applied.accepted) {
            return {
              message: extractFinalMessage(result) || 'Metaphor updated.',
              raw: result,
              metadata: { agent: 'metaphor3d', validator: 'prose-dsl-recovery' }
            };
          }
          failureError = applied.error ?? 'Metaphor validation failed';
          lastBrokenSource = proseDsl;
          lastError = failureError;
        }
      }

      if (failureError) {
        lastError = failureError;
        lastBrokenSource =
          extractLastAttemptedToolSource(result, 'apply_metaphor_patch') || lastBrokenSource;

        if (!syntaxFixerTried && lastBrokenSource && isMetaphorSyntaxFixerAvailable(env)) {
          const fixerStop = stopReason(MIN_SYNTAX_FIXER_BUDGET_MS);
          if (fixerStop) return finishStoppedRun(fixerStop);
          syntaxFixerTried = true;
          if (typeof emit === 'function') {
            emitPlanBeat(
              emit,
              'Metaphor DSL failed validation — running a quick syntax pass before retrying.',
              'server'
            );
            emit({ type: 'phase', id: 'metaphor_syntax_fixer', label: 'Metaphor syntax fixer…' });
          }
          const fixerOutcome = await repairMetaphorWithFixer({
            brokenSource: lastBrokenSource,
            parseError: failureError,
            originalRequest,
            env,
            abortSignal: runSignal
          });
          if (fixerOutcome.accepted && fixerOutcome.diagramSource) {
            const applied = await stateStore.applyDiagramSource({
              contentType: 'metaphor3d',
              diagramSource: fixerOutcome.diagramSource,
              reason: 'syntax-fixer repair'
            });
            if (applied.accepted) {
              return {
                message: 'Metaphor updated (repaired by syntax fixer).',
                raw: result,
                metadata: { agent: 'metaphor3d', validator: 'syntax-fixer' }
              };
            }
            lastError = `${failureError}\n(fixer attempt also rejected: ${applied.error})`;
          } else {
            lastError = `${failureError}\n(syntax fixer: ${fixerOutcome.error})`;
          }
        }

        messages = [
          ...messages,
          new SystemMessage(
            buildMetaphorRepairInstruction({
              errorMessage: failureError,
              brokenSource: lastBrokenSource,
              originalRequest
            })
          )
        ];
      } else {
        messages = [...messages, new SystemMessage(METAPHOR_PATCH_REQUIRED_INSTRUCTION)];
      }
    }

    return {
      message: lastError
        ? `Metaphor update failed: ${lastError}`
        : 'Metaphor update did not apply.',
      raw: lastResult,
      metadata: { agent: 'metaphor3d', error: lastError ?? null }
    };
  }

  return {
    async applyIntent({ prompt, focusNode, modelProfile, emit, peerContext, abortSignal }) {
      const slot = stateStore.getSlot('metaphor3d');
      const profile = normalizeModelProfile(modelProfile);
      const userMessages = [
        {
          role: 'user',
          content: buildIntentUserContent({
            prompt,
            currentDsl: slot.diagramSource,
            peerContext
          })
        }
      ];

      return invokeWithRepair(userMessages, {
        requirePatch: true,
        emit,
        profile,
        abortSignal,
        mode: 'intent',
        focusNode,
        peerContext
      });
    },

    async applyTransformIntent({ mode, focusNode, modelProfile, emit, goMadDepth, abortSignal }) {
      const slot = stateStore.getSlot('metaphor3d');
      if (!slot.diagramSource?.trim()) {
        return { message: 'Nothing to transform — generate a metaphor first.', raw: null };
      }
      const profile = normalizeModelProfile(modelProfile);
      const userMessages = [
        {
          role: 'user',
          content: buildTransformUserContent({
            mode,
            currentDsl: slot.diagramSource,
            goMadDepth
          })
        }
      ];

      if (typeof emit === 'function') {
        emit({ type: 'phase', id: 'metaphor_transform', label: 'Transforming metaphor…' });
      }

      return invokeWithRepair(userMessages, {
        requirePatch: true,
        emit,
        profile,
        abortSignal,
        mode,
        focusNode
      });
    },

    async applyAnalyzeIntent({ kind, focusNode, modelProfile, emit }) {
      const slot = stateStore.getSlot('metaphor3d');
      if (!slot.diagramSource?.trim()) {
        return { message: 'Nothing to analyze — generate a metaphor first.', raw: null };
      }
      const profile = normalizeModelProfile(modelProfile);
      const model = buildAnalysisModel(profile);
      const focusScope = buildMetaphorAnalyzeFocusInstructions(focusNode, kind);
      const messages = [
        new SystemMessage(METAPHOR_ANALYSIS_SYSTEM_PROMPT),
        new HumanMessage(
          buildAnalyzeUserContent({ kind, currentDsl: slot.diagramSource, focusScope })
        )
      ];

      if (typeof emit === 'function') {
        emit({ type: 'phase', id: 'metaphor_analyze', label: `Analyzing metaphor (${kind})…` });
      }

      try {
        const response = await model.invoke(messages);
        const text = extractTextContent(response.content).trim() || 'Done.';
        return { message: text, raw: response };
      } catch (error) {
        return {
          message: redactSecrets(error instanceof Error ? error.message : String(error)),
          raw: null
        };
      }
    }
  };
}

/**
 * Lazy wrapper that defers agent construction until the first call.
 * Satisfies {@link import('@archislop/shared').DiagramAgentService}.
 */
export function createLazyMetaphorAgentService({ stateStore, env = process.env }) {
  return createLazyAgentService({
    contentType: 'metaphor3d',
    stateStore,
    env,
    buildService: () => createMetaphorLangChainAgent({ stateStore, env }),
    streamLabels: {
      analyze: 'Analyzing metaphor…',
      intent: 'Composing metaphor…',
      transform: 'Transforming metaphor…'
    }
  });
}
