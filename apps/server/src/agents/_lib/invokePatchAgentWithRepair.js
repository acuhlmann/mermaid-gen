import { SystemMessage } from '@langchain/core/messages';
import {
  appendLastValidationError,
  buildAgentRunBudgetExceededMessage,
  MIN_AGENT_REPAIR_TURN_BUDGET_MS,
  MIN_SYNTAX_FIXER_BUDGET_MS,
  resolveAgentRepairAttemptProfile,
  resolveAgentRepairMaxAttempts,
  resolveAgentRunBudgetMs
} from '@archislop/shared';
import { classifyAgentTurnError, recordAgentTurn } from '../../metrics/agentTurnMetrics.js';
import { normalizeModelProfile, resolveLlmBackend, resolveModelId } from '../llmProvider.js';
import { emitPlanBeat, emitServerMutationPlanBeats } from '../planBeatMessages.js';
import { emitSyntaxFixerResult, emitSyntaxFixerStart } from '../syntaxFixerTelemetry.js';
import { createRunDeadlineSignal } from './agentRunDeadline.js';
import {
  extractFinalMessage,
  extractLastAttemptedToolSource,
  extractOriginalRequest,
  extractToolFailureError,
  toLangChainMessages
} from './diagramAgentHelpers.js';

/**
 * Shared repair ladder for slot agents that use the immutable-transcript pattern
 * (chart, metaphor3d, anything, forms — and future symmetric slots).
 *
 * Mermaid and Infographic keep bespoke loops (stable-agent fallback, cumulative
 * transcript, syntax-guidance prelude). When those converge, route them here too.
 *
 * @param {{
 *   contentType: string,
 *   patchToolName: string,
 *   agentName?: string,
 *   stateStore: { getSlot: Function, applyDiagramSource: Function },
 *   env: NodeJS.ProcessEnv,
 *   userMessages: unknown[],
 *   opts?: {
 *     requirePatch?: boolean,
 *     emit?: Function,
 *     profile?: string,
 *     abortSignal?: AbortSignal,
 *     mode?: string | null,
 *     focusNode?: unknown,
 *     peerContext?: unknown,
 *     originalRequest?: string | null
 *   },
 *   buildAgent: (profile: string) => unknown,
 *   invokeAgentStream: (args: {
 *     agent: unknown,
 *     messages: unknown[],
 *     abortSignal: AbortSignal,
 *     emit?: Function
 *   }) => Promise<{ error?: string, messages?: unknown[] } | null>,
 *   extractProseSource: (result: unknown) => string | null,
 *   buildRepairInstruction: (args: {
 *     errorMessage: string,
 *     brokenSource: string | null,
 *     originalRequest: string | null
 *   }) => string,
 *   patchRequiredInstruction: string,
 *   isSyntaxFixerAvailable: (env: NodeJS.ProcessEnv) => boolean,
 *   repairWithFixer: (args: {
 *     brokenSource: string,
 *     parseError: string,
 *     originalRequest: string | null,
 *     env: NodeJS.ProcessEnv,
 *     abortSignal: AbortSignal
 *   }) => Promise<{ accepted: boolean, diagramSource?: string, error?: string }>,
 *   labels: {
 *     phaseInvokeId: string,
 *     phaseRepairId: (attempt: number) => string,
 *     invokeLabel: string,
 *     repairLabel: (attempt: number, max: number) => string,
 *     retryPlanBeat: (attempt: number, max: number, tierNote: string) => string,
 *     successMessage: string,
 *     proseRecoveryReason: string,
 *     proseRecoveryValidator: string,
 *     validationFailedFallback: string,
 *     syntaxFixerSuccessMessage: string,
 *     syntaxFixerRepairedDetail: string,
 *     syntaxFixerStoreRejectedFallback: string,
 *     syntaxFixerFailedFallback: string,
 *     failurePrefix: string,
 *     noApplyMessage: string
 *   }
 * }} config
 */
export async function invokePatchAgentWithRepair(config) {
  const {
    contentType,
    patchToolName,
    agentName = contentType,
    stateStore,
    env,
    userMessages,
    opts = {},
    buildAgent,
    invokeAgentStream,
    extractProseSource,
    buildRepairInstruction,
    patchRequiredInstruction,
    isSyntaxFixerAvailable,
    repairWithFixer,
    labels
  } = config;

  const {
    requirePatch = false,
    emit,
    profile,
    abortSignal,
    mode = null,
    focusNode = null,
    peerContext = null,
    originalRequest: originalRequestOverride = null
  } = opts;

  const runProfile = normalizeModelProfile(profile);
  const maxRepairAttempts = resolveAgentRepairMaxAttempts(runProfile, env, contentType);
  const runBudgetMs = resolveAgentRunBudgetMs(runProfile, env, mode);
  const turnStarted = Date.now();
  const runSignal = createRunDeadlineSignal({
    abortSignal,
    budgetMs: runBudgetMs,
    startedAt: turnStarted
  });
  const beforeRevision = stateStore.getSlot(contentType).revisionId;
  const originalRequest = originalRequestOverride ?? extractOriginalRequest(userMessages);

  // Repair turns rebuild from this immutable base instead of appending to a growing
  // transcript — otherwise each attempt re-embeds every prior broken source + repair
  // instruction (audit F1).
  const initialMessages = toLangChainMessages(userMessages);
  let messages = initialMessages;
  let lastResult = null;
  let lastError = null;
  let lastBrokenSource = null;
  let syntaxFixerTried = false;
  let invokeErrored = false;
  let agent = buildAgent(runProfile);

  const backend = resolveLlmBackend(env, runProfile);
  const modelLabel = backend ? `${backend}:${resolveModelId(env, runProfile, backend)}` : null;
  let repairAttempts = 0;

  /** @param {{accepted: boolean, validator?: string | null, errorClass?: string | null}} sample */
  const finishTurn = (sample) => {
    recordAgentTurn(
      {
        contentType,
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
   * @param {number} [minRemainingMs]
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
    const message = appendLastValidationError(reason.message, lastError);
    if (typeof emit === 'function' && reason.code === 'run_budget_exceeded') {
      emit({ type: 'error', code: reason.code, message });
    }
    finishTurn({ accepted: false, errorClass: reason.errorClass });
    return {
      message,
      raw: lastResult,
      metadata: { agent: agentName, error: lastError ?? null, code: reason.code }
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
      contentType
    });
  }

  for (let attempt = 0; attempt <= maxRepairAttempts; attempt += 1) {
    if (attempt > 0) {
      repairAttempts += 1;
      const repairProfile = resolveAgentRepairAttemptProfile(runProfile, attempt);
      agent = buildAgent(repairProfile);
    }
    const stop = stopReason(attempt > 0 ? MIN_AGENT_REPAIR_TURN_BUDGET_MS : 0);
    if (stop) return finishStoppedRun(stop);
    if (typeof emit === 'function') {
      if (attempt > 0) {
        const repairProfile = resolveAgentRepairAttemptProfile(runProfile, attempt);
        const tierNote = repairProfile === 'quality' ? ' (quality model)' : '';
        emitPlanBeat(emit, labels.retryPlanBeat(attempt, maxRepairAttempts, tierNote), 'server');
      }
      emit({
        type: 'phase',
        id: attempt === 0 ? labels.phaseInvokeId : labels.phaseRepairId(attempt),
        label: attempt === 0 ? labels.invokeLabel : labels.repairLabel(attempt, maxRepairAttempts)
      });
    }

    const result = await invokeAgentStream({
      agent,
      messages,
      abortSignal: runSignal,
      emit
    });
    if (result?.error) {
      const abortStop = stopReason();
      if (abortStop) return finishStoppedRun(abortStop);
      lastError = result.error;
      invokeErrored = true;
      if (typeof emit === 'function') emit({ type: 'error', message: lastError });
      break;
    }

    lastResult = result;
    const currentRevision = stateStore.getSlot(contentType).revisionId;
    if (currentRevision !== beforeRevision) {
      finishTurn({
        accepted: true,
        validator: attempt === 0 ? 'first-try' : `repair-attempt-${attempt}`
      });
      return {
        message: extractFinalMessage(result) || labels.successMessage,
        raw: result,
        metadata: { agent: agentName }
      };
    }

    if (!requirePatch) {
      return {
        message: extractFinalMessage(result) || 'Done.',
        raw: result,
        metadata: { agent: agentName }
      };
    }

    let failureError = extractToolFailureError(result);

    if (!failureError && !result) {
      failureError = 'Agent stream ended without a model response or tool result.';
      lastError = failureError;
    }

    if (!failureError) {
      const proseSource = extractProseSource(result);
      if (proseSource) {
        const applied = await stateStore.applyDiagramSource({
          contentType,
          diagramSource: proseSource,
          reason: labels.proseRecoveryReason
        });
        if (applied.accepted) {
          finishTurn({ accepted: true, validator: labels.proseRecoveryValidator });
          return {
            message: extractFinalMessage(result) || labels.successMessage,
            raw: result,
            metadata: { agent: agentName, validator: labels.proseRecoveryValidator }
          };
        }
        failureError = applied.error ?? labels.validationFailedFallback;
        lastBrokenSource = proseSource;
        lastError = failureError;
      }
    }

    if (failureError) {
      lastError = failureError;
      lastBrokenSource = extractLastAttemptedToolSource(result, patchToolName) || lastBrokenSource;

      if (!syntaxFixerTried && lastBrokenSource && isSyntaxFixerAvailable(env)) {
        const fixerStop = stopReason(MIN_SYNTAX_FIXER_BUDGET_MS);
        if (fixerStop) return finishStoppedRun(fixerStop);
        syntaxFixerTried = true;
        repairAttempts += 1;
        emitSyntaxFixerStart(emit, { contentType, triggerError: failureError });
        const fixerOutcome = await repairWithFixer({
          brokenSource: lastBrokenSource,
          parseError: failureError,
          originalRequest,
          env,
          abortSignal: runSignal
        });
        if (fixerOutcome.accepted && fixerOutcome.diagramSource) {
          const applied = await stateStore.applyDiagramSource({
            contentType,
            diagramSource: fixerOutcome.diagramSource,
            reason: 'syntax-fixer repair'
          });
          if (applied.accepted) {
            emitSyntaxFixerResult(emit, {
              contentType,
              outcome: 'repaired',
              detail: labels.syntaxFixerRepairedDetail
            });
            finishTurn({ accepted: true, validator: 'syntax-fixer' });
            return {
              message: labels.syntaxFixerSuccessMessage,
              raw: result,
              metadata: { agent: agentName, validator: 'syntax-fixer' }
            };
          }
          lastError = `${failureError}\n(fixer attempt also rejected: ${applied.error})`;
          emitSyntaxFixerResult(emit, {
            contentType,
            outcome: 'store_rejected',
            error: applied.error ?? labels.syntaxFixerStoreRejectedFallback
          });
        } else {
          lastError = `${failureError}\n(syntax fixer: ${fixerOutcome.error})`;
          emitSyntaxFixerResult(emit, {
            contentType,
            outcome: 'fixer_failed',
            error: fixerOutcome.error ?? labels.syntaxFixerFailedFallback
          });
        }
      }

      messages = [
        ...initialMessages,
        new SystemMessage(
          buildRepairInstruction({
            errorMessage: failureError,
            brokenSource: lastBrokenSource,
            originalRequest
          })
        )
      ];
    } else {
      messages = [...initialMessages, new SystemMessage(patchRequiredInstruction)];
    }
  }

  finishTurn({
    accepted: false,
    errorClass: invokeErrored ? 'invoke-error' : (classifyAgentTurnError(lastError) ?? 'no-patch')
  });
  return {
    message: lastError ? `${labels.failurePrefix}: ${lastError}` : labels.noApplyMessage,
    raw: lastResult,
    metadata: { agent: agentName, error: lastError ?? null }
  };
}
