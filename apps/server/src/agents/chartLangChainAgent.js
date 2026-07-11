import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createAgent } from 'langchain';
import { createChartTools } from './diagramTools.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import { CHART_SYSTEM_PROMPT } from '../prompts/chartSystemPrompt.js';
import {
  buildChartRepairInstruction,
  CHART_ANALYSIS_SYSTEM_PROMPT,
  CHART_CRITIQUE_TASK,
  CHART_EXPLAIN_TASK
} from '../prompts/chartSyntaxGuard.js';
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
  extractOriginalRequest,
  extractTextContent,
  extractToolFailureError,
  forwardNormalizedAgentStreamEvent,
  normalizeAgentStreamEvent,
  toLangChainMessages
} from './_lib/diagramAgentHelpers.js';
import { createPatchToolStreamTracker } from './streamPatchToolTelemetry.js';
import { classifyAgentTurnError, recordAgentTurn } from '../metrics/agentTurnMetrics.js';
import { repairChartWithFixer, isChartSyntaxFixerAvailable } from './chartSyntaxFixer.js';
import { buildAdvisorSuggestionBlock } from './mermaidAnalysisPrompts.js';
import { emitPlanBeat, emitServerMutationPlanBeats } from './planBeatMessages.js';
import { emitSyntaxFixerResult, emitSyntaxFixerStart } from './syntaxFixerTelemetry.js';
import {
  appendLastValidationError,
  buildAgentRunBudgetExceededMessage,
  MIN_AGENT_REPAIR_TURN_BUDGET_MS,
  MIN_SYNTAX_FIXER_BUDGET_MS,
  resolveAgentRepairMaxAttempts,
  resolveAgentRunBudgetMs
} from '@archislop/shared';
import { createRunDeadlineSignal } from './_lib/agentRunDeadline.js';
import {
  buildChartAnalyzeFocusInstructions,
  buildChartFocusScopeInstructions
} from './chartFocusInstructions.js';

const CHART_PATCH_REQUIRED_INSTRUCTION = `Your previous response did not apply a chart patch.
- You MUST call apply_chart_patch now once with a complete, valid chart DSL JSON wrapper, then briefly summarize in prose only.
- Do not return prose only.
- Do not mention tool names in your final user-facing summary.`;

function defaultChatModelFactory(env, options) {
  return createLlmChatModel(env, options);
}

/**
 * Some models emit the chart DSL as a fenced JSON block in prose instead of calling
 * apply_chart_patch. Scan the last assistant message for such a block (or for a bare
 * JSON object containing the archislop wrapper marker) and return it so the caller
 * can route it through the same tool path.
 */
function extractChartDslFromAssistantResult(result) {
  const messages = result?.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    const type = m?.type ?? m?.role ?? m?.kwargs?.role ?? '';
    if (type !== 'ai' && type !== 'assistant') continue;
    const raw = extractTextContent(m?.content ?? m?.kwargs?.content ?? '');
    if (!raw?.trim()) continue;

    const fenced = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
    if (fenced && fenced[1].includes('"archislopVersion"')) {
      return fenced[1].trim();
    }
    const braceStart = raw.indexOf('{');
    const braceEnd = raw.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
      const candidate = raw.slice(braceStart, braceEnd + 1);
      if (candidate.includes('"archislopVersion"')) return candidate.trim();
    }
  }
  return null;
}

function buildIntentUserContent({ prompt, currentDsl, peerContext, focusScope }) {
  const parts = [];
  parts.push(`User request: ${prompt.trim()}`);
  if (currentDsl?.trim()) {
    parts.push(`Current chart DSL:\n\n\`\`\`json\n${currentDsl}\n\`\`\``);
  } else {
    parts.push('There is no current chart — emit a fresh DSL wrapper.');
  }
  if (peerContext?.contentType && peerContext?.diagramSource?.trim()) {
    parts.push(
      `The user is converting from ${peerContext.contentType}. Use this as the subject context (do NOT translate 1:1 — surface the *data story* implied by the source):\n\n\`\`\`\n${peerContext.diagramSource}\n\`\`\``
    );
  }
  if (focusScope?.trim()) parts.push(focusScope.trim());
  parts.push('Call apply_chart_patch with the full JSON wrapper.');
  return parts.join('\n\n');
}

export function buildChartTransformUserContent({
  mode,
  currentDsl,
  goMadDepth,
  advisorPrompt,
  focusScope
}) {
  const modeInstructions = {
    refine:
      'Refine the current chart — improve mark choice, encoding clarity, color accessibility, and data ordering. Keep the same data and chart family unless a small swap clearly serves the story.',
    innovate:
      'Innovate on the current chart — try a different mark/encoding combination or reshape the data presentation. You may switch chart families.',
    goMad: `Go mad on this chart — push the data viz further (depth ${goMadDepth ?? 1}). Layered marks, faceted views, exaggerated encodings.`,
    exec: 'Execute the requested change tightly. No additions beyond the implied scope.'
  };
  return [
    modeInstructions[mode] ?? modeInstructions.refine,
    focusScope,
    `Current chart DSL:\n\n\`\`\`json\n${currentDsl}\n\`\`\``,
    buildAdvisorSuggestionBlock(advisorPrompt),
    'Call apply_chart_patch with the full JSON wrapper.'
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildChartAnalyzeUserContent({ kind, currentDsl, focusScope, advisorPrompt }) {
  const task = kind === 'critique' ? CHART_CRITIQUE_TASK : CHART_EXPLAIN_TASK;
  return [
    task,
    focusScope,
    buildAdvisorSuggestionBlock(advisorPrompt),
    `Current chart DSL:\n\n\`\`\`json\n${currentDsl}\n\`\`\``
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Style intent for chart — bounded vocabulary (theme swap, color scheme, axis gridlines,
 *  legend position). The agent must keep data and encodings intact. */
function buildStyleUserContent({ prompt, currentDsl }) {
  return [
    'Apply a visual styling update to the current chart.',
    '',
    'Bounded scope — change only these things:',
    '- "theme" (whiteboard | noir | arcade | blueprint) on the wrapper',
    '- spec.config.range.category (color scheme array)',
    '- spec.config.axis (gridlines, label/title color, tick density)',
    '- spec.config.legend (position, label/title color)',
    '- spec.config.title (font size, weight, color)',
    '- spec.config.background',
    '- spec.config.font',
    '',
    'Hard requirements:',
    '- Preserve spec.data, spec.mark, spec.encoding, spec.transform exactly as-is unless the user explicitly asks to change them.',
    '- Keep "$schema" pointing at vega-lite/v5.',
    '- Output the FULL wrapper JSON via apply_chart_patch — partial updates are not supported.',
    '',
    `Current chart DSL:\n\n\`\`\`json\n${currentDsl}\n\`\`\``,
    '',
    `User style request:\n${prompt}`,
    '',
    'Call apply_chart_patch with the full JSON wrapper.'
  ].join('\n');
}

export function createChartLangChainAgent({
  stateStore,
  env = process.env,
  createChatModel = defaultChatModelFactory,
  createAgentImpl = createAgent
}) {
  const tools = createChartTools({ stateStore });

  function buildAgent(profile) {
    const backend = resolveLlmBackend(env);
    const modelId = resolveModelId(env, profile, backend);
    const llm = createChatModel(env, { model: modelId });
    return createAgentImpl({ model: llm, tools, systemPrompt: CHART_SYSTEM_PROMPT });
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
          patchToolName: 'apply_chart_patch',
          contentType: 'chart',
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
      peerContext = null,
      // When the caller has a clean short prompt (intent), pass it so the repair
      // instruction doesn't re-embed the whole current-DSL block that the first
      // user message carries. Falls back to extracting the first user message.
      originalRequest: originalRequestOverride = null
    } = opts ?? {};
    const runProfile = normalizeModelProfile(profile);
    const maxRepairAttempts = resolveAgentRepairMaxAttempts(runProfile, env, 'chart');
    const runBudgetMs = resolveAgentRunBudgetMs(runProfile, env, mode);
    const turnStarted = Date.now();
    // Every model turn shares this deadline-capped signal so an in-flight call cannot
    // overrun the run budget; `abortSignal` stays untouched for user-stop detection.
    const runSignal = createRunDeadlineSignal({
      abortSignal,
      budgetMs: runBudgetMs,
      startedAt: turnStarted
    });
    const beforeRevision = stateStore.getSlot('chart').revisionId;
    const originalRequest = originalRequestOverride ?? extractOriginalRequest(userMessages);

    // Repair turns rebuild from this immutable base (mermaid pattern) instead of
    // appending to a growing transcript — otherwise each attempt re-embeds every prior
    // broken source + repair instruction, blowing up token cost superlinearly (audit F1).
    const initialMessages = toLangChainMessages(userMessages);
    let messages = initialMessages;
    let lastResult = null;
    let lastError = null;
    let lastBrokenSource = null;
    let syntaxFixerTried = false;
    let invokeErrored = false;
    const agent = buildAgent(runProfile);

    const backend = resolveLlmBackend(env);
    const modelLabel = backend ? `${backend}:${resolveModelId(env, runProfile, backend)}` : null;
    let repairAttempts = 0;
    /** @param {{accepted: boolean, validator?: string | null, errorClass?: string | null}} sample */
    const finishTurn = (sample) => {
      recordAgentTurn(
        {
          contentType: 'chart',
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
        metadata: { agent: 'chart', error: lastError ?? null, code: reason.code }
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
        contentType: 'chart'
      });
    }

    for (let attempt = 0; attempt <= maxRepairAttempts; attempt += 1) {
      if (attempt > 0) repairAttempts += 1;
      const stop = stopReason(attempt > 0 ? MIN_AGENT_REPAIR_TURN_BUDGET_MS : 0);
      if (stop) return finishStoppedRun(stop);
      if (typeof emit === 'function') {
        if (attempt > 0) {
          emitPlanBeat(
            emit,
            `Previous chart patch did not validate — retrying while keeping your intent (attempt ${attempt} of ${maxRepairAttempts}).`,
            'server'
          );
        }
        emit({
          type: 'phase',
          id: attempt === 0 ? 'chart_invoke' : `chart_repair_${attempt}`,
          label:
            attempt === 0
              ? 'Composing chart…'
              : `Repairing chart (attempt ${attempt} of ${maxRepairAttempts})…`
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
        invokeErrored = true;
        if (typeof emit === 'function') emit({ type: 'error', message: lastError });
        break;
      }

      lastResult = result;
      const currentRevision = stateStore.getSlot('chart').revisionId;
      if (currentRevision !== beforeRevision) {
        finishTurn({
          accepted: true,
          validator: attempt === 0 ? 'first-try' : `repair-attempt-${attempt}`
        });
        return {
          message: extractFinalMessage(result) || 'Chart updated.',
          raw: result,
          metadata: { agent: 'chart' }
        };
      }

      if (!requirePatch) {
        // Non-mutation runs (no caller today) aren't accept/reject samples — don't record.
        return {
          message: extractFinalMessage(result) || 'Done.',
          raw: result,
          metadata: { agent: 'chart' }
        };
      }

      let failureError = extractToolFailureError(result);

      if (!failureError && !result) {
        failureError = 'Agent stream ended without a model response or tool result.';
        lastError = failureError;
      }

      if (!failureError) {
        const proseDsl = extractChartDslFromAssistantResult(result);
        if (proseDsl) {
          const applied = await stateStore.applyDiagramSource({
            contentType: 'chart',
            diagramSource: proseDsl,
            reason: 'prose-dsl recovery'
          });
          if (applied.accepted) {
            finishTurn({ accepted: true, validator: 'prose-dsl-recovery' });
            return {
              message: extractFinalMessage(result) || 'Chart updated.',
              raw: result,
              metadata: { agent: 'chart', validator: 'prose-dsl-recovery' }
            };
          }
          failureError = applied.error ?? 'Chart validation failed';
          lastBrokenSource = proseDsl;
          lastError = failureError;
        }
      }

      if (failureError) {
        lastError = failureError;
        lastBrokenSource =
          extractLastAttemptedToolSource(result, 'apply_chart_patch') || lastBrokenSource;

        if (!syntaxFixerTried && lastBrokenSource && isChartSyntaxFixerAvailable(env)) {
          const fixerStop = stopReason(MIN_SYNTAX_FIXER_BUDGET_MS);
          if (fixerStop) return finishStoppedRun(fixerStop);
          syntaxFixerTried = true;
          repairAttempts += 1;
          emitSyntaxFixerStart(emit, { contentType: 'chart', triggerError: failureError });
          const fixerOutcome = await repairChartWithFixer({
            brokenSource: lastBrokenSource,
            parseError: failureError,
            originalRequest,
            env,
            abortSignal: runSignal
          });
          if (fixerOutcome.accepted && fixerOutcome.diagramSource) {
            const applied = await stateStore.applyDiagramSource({
              contentType: 'chart',
              diagramSource: fixerOutcome.diagramSource,
              reason: 'syntax-fixer repair'
            });
            if (applied.accepted) {
              emitSyntaxFixerResult(emit, {
                contentType: 'chart',
                outcome: 'repaired',
                detail: 'Repaired invalid chart DSL and applied the patch.'
              });
              finishTurn({ accepted: true, validator: 'syntax-fixer' });
              return {
                message: 'Chart updated (repaired by syntax fixer).',
                raw: result,
                metadata: { agent: 'chart', validator: 'syntax-fixer' }
              };
            }
            lastError = `${failureError}\n(fixer attempt also rejected: ${applied.error})`;
            emitSyntaxFixerResult(emit, {
              contentType: 'chart',
              outcome: 'store_rejected',
              error: applied.error ?? 'Chart validation failed after syntax fixer.'
            });
          } else {
            lastError = `${failureError}\n(syntax fixer: ${fixerOutcome.error})`;
            emitSyntaxFixerResult(emit, {
              contentType: 'chart',
              outcome: 'fixer_failed',
              error: fixerOutcome.error ?? 'Syntax fixer could not repair the chart DSL.'
            });
          }
        }

        messages = [
          ...initialMessages,
          new SystemMessage(
            buildChartRepairInstruction({
              errorMessage: failureError,
              brokenSource: lastBrokenSource,
              originalRequest
            })
          )
        ];
      } else {
        messages = [...initialMessages, new SystemMessage(CHART_PATCH_REQUIRED_INSTRUCTION)];
      }
    }

    finishTurn({
      accepted: false,
      errorClass: invokeErrored
        ? 'invoke-error'
        : (classifyAgentTurnError(lastError) ?? 'no-patch')
    });
    return {
      message: lastError ? `Chart update failed: ${lastError}` : 'Chart update did not apply.',
      raw: lastResult,
      metadata: { agent: 'chart', error: lastError ?? null }
    };
  }

  return {
    async applyIntent({ prompt, focusNode, modelProfile, emit, peerContext, abortSignal }) {
      const slot = stateStore.getSlot('chart');
      const profile = normalizeModelProfile(modelProfile);
      const focusScope = buildChartFocusScopeInstructions(focusNode);
      const userMessages = [
        {
          role: 'user',
          content: buildIntentUserContent({
            prompt,
            currentDsl: slot.diagramSource,
            peerContext,
            focusScope
          })
        }
      ];

      return invokeWithRepair(userMessages, {
        requirePatch: true,
        emit,
        profile,
        abortSignal,
        // 'go' matches the mermaid/infographic label for prompt-bar intent so
        // agent_turn dashboards aggregate one vocabulary across slots.
        mode: 'go',
        focusNode,
        peerContext,
        originalRequest: prompt
      });
    },

    async applyTransformIntent({
      mode,
      focusNode,
      modelProfile,
      emit,
      goMadDepth,
      abortSignal,
      advisorPrompt
    }) {
      const slot = stateStore.getSlot('chart');
      if (!slot.diagramSource?.trim()) {
        return { message: 'Nothing to transform — generate a chart first.', raw: null };
      }
      const profile = normalizeModelProfile(modelProfile);
      const focusScope = buildChartFocusScopeInstructions(focusNode);
      const userMessages = [
        {
          role: 'user',
          content: buildChartTransformUserContent({
            mode,
            currentDsl: slot.diagramSource,
            goMadDepth,
            advisorPrompt,
            focusScope
          })
        }
      ];

      if (typeof emit === 'function') {
        emit({ type: 'phase', id: 'chart_transform', label: 'Transforming chart…' });
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

    async applyStyleIntent({ prompt, modelProfile, emit, abortSignal }) {
      const slot = stateStore.getSlot('chart');
      if (!slot.diagramSource?.trim()) {
        return { message: 'Nothing to style — generate a chart first.', raw: null };
      }
      const profile = normalizeModelProfile(modelProfile);
      const userMessages = [
        {
          role: 'user',
          content: buildStyleUserContent({ prompt, currentDsl: slot.diagramSource })
        }
      ];

      if (typeof emit === 'function') {
        emit({ type: 'phase', id: 'chart_style', label: 'Restyling chart…' });
      }

      return invokeWithRepair(userMessages, {
        requirePatch: true,
        emit,
        profile,
        abortSignal,
        mode: 'style'
      });
    },

    async applyAnalyzeIntent({ kind, focusNode, modelProfile, emit, advisorPrompt }) {
      const slot = stateStore.getSlot('chart');
      if (!slot.diagramSource?.trim()) {
        return { message: 'Nothing to analyze — generate a chart first.', raw: null };
      }
      const profile = normalizeModelProfile(modelProfile);
      const model = buildAnalysisModel(profile);
      const focusScope = buildChartAnalyzeFocusInstructions(focusNode, kind);
      const messages = [
        new SystemMessage(CHART_ANALYSIS_SYSTEM_PROMPT),
        new HumanMessage(
          buildChartAnalyzeUserContent({
            kind,
            currentDsl: slot.diagramSource,
            focusScope,
            advisorPrompt
          })
        )
      ];

      if (typeof emit === 'function') {
        emit({ type: 'phase', id: 'chart_analyze', label: `Analyzing chart (${kind})…` });
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
export function createLazyChartAgentService({ stateStore, env = process.env }) {
  return createLazyAgentService({
    contentType: 'chart',
    stateStore,
    env,
    buildService: () => createChartLangChainAgent({ stateStore, env }),
    streamLabels: {
      analyze: 'Analyzing chart…',
      intent: 'Composing chart…',
      transform: 'Transforming chart…'
    },
    supportsStyleIntent: true,
    transformExtraFields: ['advisorPrompt'],
    analyzeExtraFields: ['advisorPrompt']
  });
}
