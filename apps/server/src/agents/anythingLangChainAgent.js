import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createAgent } from 'langchain';
import { createAnythingTools } from './diagramTools.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import { ANYTHING_SYSTEM_PROMPT } from '../prompts/anythingSystemPrompt.js';
import { appendLanguageInstruction, appendProseLanguageInstruction } from '@archislop/shared';
import { buildAnythingRepairInstruction } from '../prompts/anythingSyntaxGuard.js';
import { WISE_ARCHITECT_EXPLAIN_VOICE } from '../prompts/wiseArchitectVoice.js';
import { isAnythingSyntaxFixerAvailable, repairAnythingWithFixer } from './anythingSyntaxFixer.js';
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
import { buildAdvisorSuggestionBlock } from './mermaidAnalysisPrompts.js';
import { emitPlanBeat, emitServerMutationPlanBeats } from './planBeatMessages.js';
import { emitSyntaxFixerResult, emitSyntaxFixerStart } from './syntaxFixerTelemetry.js';
import {
  appendLastValidationError,
  buildAgentRunBudgetExceededMessage,
  MIN_AGENT_REPAIR_TURN_BUDGET_MS,
  MIN_SYNTAX_FIXER_BUDGET_MS,
  resolveAgentRepairAttemptProfile,
  resolveAgentRepairMaxAttempts,
  resolveAgentRunBudgetMs
} from '@archislop/shared';
import { createRunDeadlineSignal } from './_lib/agentRunDeadline.js';

const ANYTHING_PATCH_REQUIRED_INSTRUCTION = `Your previous response did not apply an Anything-mode update.
- You MUST apply it now through a tool: apply_anything_edit with targeted search/replace blocks for a scoped change to the existing document, or apply_anything_patch once with a complete, self-contained HTML document. Then briefly summarize in prose only.
- Do not return prose only, and do not paste the document into prose — it goes through the tool.
- Do not mention tool names in your final user-facing summary.`;

function defaultChatModelFactory(env, options) {
  return createLlmChatModel(env, options);
}

/**
 * Some models emit the HTML document as a fenced block in prose instead of calling
 * apply_anything_patch. Scan the last assistant message for a fenced html block (or a
 * bare document starting at <!doctype / <html) so the caller can route it through the
 * same tool path.
 */
function extractHtmlFromAssistantResult(result) {
  const messages = result?.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    const type = m?.type ?? m?.role ?? m?.kwargs?.role ?? '';
    if (type !== 'ai' && type !== 'assistant') continue;
    const raw = extractTextContent(m?.content ?? m?.kwargs?.content ?? '');
    if (!raw?.trim()) continue;

    const fenced = raw.match(/```(?:html)?\s*\n?([\s\S]*?)\n?```/i);
    if (fenced && /<[a-zA-Z!/]/.test(fenced[1])) {
      return fenced[1].trim();
    }
    const docStart = raw.search(/<!doctype\s+html|<html[\s>]/i);
    if (docStart !== -1) {
      const tailEnd = raw.toLowerCase().lastIndexOf('</html>');
      const end = tailEnd !== -1 ? tailEnd + '</html>'.length : raw.length;
      return raw.slice(docStart, end).trim();
    }
  }
  return null;
}

function buildIntentUserContent({ prompt, currentHtml, peerContext }) {
  const parts = [];
  parts.push(`User request: ${prompt.trim()}`);
  if (currentHtml?.trim()) {
    parts.push(`Current HTML document:\n\n\`\`\`html\n${currentHtml}\n\`\`\``);
  } else {
    parts.push('There is no current document — emit a fresh, complete HTML document.');
  }
  if (peerContext?.contentType && peerContext?.diagramSource?.trim()) {
    parts.push(
      `The user is converting from ${peerContext.contentType}. Use this as the subject context (do NOT translate 1:1 — build the freeform experience the source implies):\n\n\`\`\`\n${peerContext.diagramSource}\n\`\`\``
    );
  }
  parts.push('Call apply_anything_patch with the full HTML document.');
  return appendLanguageInstruction(parts.join('\n\n'), prompt, currentHtml);
}

export function buildAnythingTransformUserContent({
  mode,
  currentHtml,
  goMadDepth,
  advisorPrompt
}) {
  const modeInstructions = {
    refine:
      'Refine the current document — polish layout, typography, color, interaction feel, and copy. Keep the concept and structure.',
    innovate:
      'Innovate on the current document — rethink the presentation or interaction model for the same subject. You may restructure freely.',
    goMad: `Go mad on this document — escalate the spectacle (depth ${goMadDepth ?? 1}). More motion, more interactivity, bolder visuals, still on-subject and still self-contained.`,
    exec: 'Execute the requested change tightly. No additions beyond the implied scope.'
  };
  // Refine and Exec are scoped changes to an existing document — targeted
  // edits keep the untouched 95% of the page byte-identical instead of
  // trusting a full regeneration to reproduce it. Innovate and Go Mad
  // restructure freely, so a full rewrite is the honest tool there.
  const preferEdits = mode === 'refine' || mode === 'exec';
  return [
    modeInstructions[mode] ?? modeInstructions.refine,
    `Current HTML document:\n\n\`\`\`html\n${currentHtml}\n\`\`\``,
    buildAdvisorSuggestionBlock(advisorPrompt),
    preferEdits
      ? 'Prefer apply_anything_edit with targeted search/replace blocks (copy each SEARCH block verbatim from the current document, with enough surrounding lines to match exactly once). Fall back to apply_anything_patch with the full HTML document only if the change is sweeping or a SEARCH block cannot be made to match.'
      : 'Call apply_anything_patch with the full HTML document.'
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildAnythingAnalyzeUserContent({
  kind,
  currentHtml,
  advisorPrompt,
  lastUserPrompt
}) {
  const task =
    kind === 'critique'
      ? 'Critique this HTML document in 3-5 short paragraphs. Call out: does the layout communicate the idea? Is the interaction discoverable? Any accessibility, contrast, or responsiveness issues? Does anything violate the sandbox contract (external URLs, storage, network)?'
      : `Explain this HTML document in 3-5 short paragraphs. Describe what the page shows, how the user interacts with it, and how the markup/CSS/JS pieces fit together.\n\n${WISE_ARCHITECT_EXPLAIN_VOICE}`;
  return appendProseLanguageInstruction(
    [
      task,
      buildAdvisorSuggestionBlock(advisorPrompt),
      `Current HTML document:\n\n\`\`\`html\n${currentHtml}\n\`\`\``
    ]
      .filter(Boolean)
      .join('\n\n'),
    lastUserPrompt,
    currentHtml,
    advisorPrompt
  );
}

export function createAnythingLangChainAgent({
  stateStore,
  env = process.env,
  createChatModel = defaultChatModelFactory,
  createAgentImpl = createAgent
}) {
  const tools = createAnythingTools({ stateStore });

  function buildAgent(profile) {
    const backend = resolveLlmBackend(env, profile);
    const modelId = resolveModelId(env, profile, backend);
    const llm = createChatModel(env, { model: modelId, backend, modelProfile: profile });
    return createAgentImpl({ model: llm, tools, systemPrompt: ANYTHING_SYSTEM_PROMPT });
  }

  function buildAnalysisModel(profile) {
    const backend = resolveLlmBackend(env, profile);
    const modelId = resolveModelId(env, profile, backend);
    return createChatModel(env, { model: modelId, backend, modelProfile: profile });
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
          patchToolName: 'apply_anything_patch',
          contentType: 'anything',
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
      // instruction doesn't re-embed the whole current-document block that the first
      // user message carries — anything docs run up to ANYTHING_HTML_MAX_LENGTH, so
      // this is the single largest avoidable payload in the repair prompt. Falls back
      // to extracting the first user message.
      originalRequest: originalRequestOverride = null
    } = opts ?? {};
    const runProfile = normalizeModelProfile(profile);
    const maxRepairAttempts = resolveAgentRepairMaxAttempts(runProfile, env, 'anything');
    const runBudgetMs = resolveAgentRunBudgetMs(runProfile, env, mode);
    const turnStarted = Date.now();
    // Every model turn shares this deadline-capped signal so an in-flight call cannot
    // overrun the run budget; `abortSignal` stays untouched for user-stop detection.
    const runSignal = createRunDeadlineSignal({
      abortSignal,
      budgetMs: runBudgetMs,
      startedAt: turnStarted
    });
    const beforeRevision = stateStore.getSlot('anything').revisionId;
    const originalRequest = originalRequestOverride ?? extractOriginalRequest(userMessages);

    // Repair turns rebuild from this immutable base (mermaid pattern) instead of
    // appending to a growing transcript — otherwise attempt 2 can carry 4+ copies of a
    // ~200 KB document, blowing up token cost superlinearly (audit F1).
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
          contentType: 'anything',
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
      // run ran out of time (what was invalid in the page), not just that it timed out.
      const message = appendLastValidationError(reason.message, lastError);
      if (typeof emit === 'function' && reason.code === 'run_budget_exceeded') {
        emit({ type: 'error', code: reason.code, message });
      }
      finishTurn({ accepted: false, errorClass: reason.errorClass });
      return {
        message,
        raw: lastResult,
        metadata: { agent: 'anything', error: lastError ?? null, code: reason.code }
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
        contentType: 'anything'
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
          emitPlanBeat(
            emit,
            `Previous page patch did not validate — retrying while keeping your intent (attempt ${attempt} of ${maxRepairAttempts})${tierNote}.`,
            'server'
          );
        }
        emit({
          type: 'phase',
          id: attempt === 0 ? 'anything_invoke' : `anything_repair_${attempt}`,
          label:
            attempt === 0
              ? 'Building page…'
              : `Repairing page (attempt ${attempt} of ${maxRepairAttempts})…`
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
      const currentRevision = stateStore.getSlot('anything').revisionId;
      if (currentRevision !== beforeRevision) {
        finishTurn({
          accepted: true,
          validator: attempt === 0 ? 'first-try' : `repair-attempt-${attempt}`
        });
        return {
          message: extractFinalMessage(result) || 'Page updated.',
          raw: result,
          metadata: { agent: 'anything' }
        };
      }

      if (!requirePatch) {
        // Non-mutation runs (no caller today) aren't accept/reject samples — don't record.
        return {
          message: extractFinalMessage(result) || 'Done.',
          raw: result,
          metadata: { agent: 'anything' }
        };
      }

      let failureError = extractToolFailureError(result);

      if (!failureError && !result) {
        failureError = 'Agent stream ended without a model response or tool result.';
        lastError = failureError;
      }

      if (!failureError) {
        const proseHtml = extractHtmlFromAssistantResult(result);
        if (proseHtml) {
          const applied = await stateStore.applyDiagramSource({
            contentType: 'anything',
            diagramSource: proseHtml,
            reason: 'prose-html recovery'
          });
          if (applied.accepted) {
            finishTurn({ accepted: true, validator: 'prose-html-recovery' });
            return {
              message: extractFinalMessage(result) || 'Page updated.',
              raw: result,
              metadata: { agent: 'anything', validator: 'prose-html-recovery' }
            };
          }
          failureError = applied.error ?? 'HTML validation failed';
          lastBrokenSource = proseHtml;
          lastError = failureError;
        }
      }

      if (failureError) {
        lastError = failureError;
        lastBrokenSource =
          extractLastAttemptedToolSource(result, 'apply_anything_patch') || lastBrokenSource;

        if (!syntaxFixerTried && lastBrokenSource && isAnythingSyntaxFixerAvailable(env)) {
          const fixerStop = stopReason(MIN_SYNTAX_FIXER_BUDGET_MS);
          if (fixerStop) return finishStoppedRun(fixerStop);
          syntaxFixerTried = true;
          repairAttempts += 1;
          emitSyntaxFixerStart(emit, { contentType: 'anything', triggerError: failureError });
          const fixerOutcome = await repairAnythingWithFixer({
            brokenSource: lastBrokenSource,
            parseError: failureError,
            originalRequest,
            env,
            abortSignal: runSignal
          });
          if (fixerOutcome.accepted && fixerOutcome.diagramSource) {
            const applied = await stateStore.applyDiagramSource({
              contentType: 'anything',
              diagramSource: fixerOutcome.diagramSource,
              reason: 'syntax-fixer repair'
            });
            if (applied.accepted) {
              emitSyntaxFixerResult(emit, {
                contentType: 'anything',
                outcome: 'repaired',
                detail: 'Repaired invalid page HTML and applied the patch.'
              });
              finishTurn({ accepted: true, validator: 'syntax-fixer' });
              return {
                message: 'Page updated (repaired by syntax fixer).',
                raw: result,
                metadata: { agent: 'anything', validator: 'syntax-fixer' }
              };
            }
            lastError = `${failureError}\n(fixer attempt also rejected: ${applied.error})`;
            emitSyntaxFixerResult(emit, {
              contentType: 'anything',
              outcome: 'store_rejected',
              error: applied.error ?? 'Page validation failed after syntax fixer.'
            });
          } else {
            lastError = `${failureError}\n(syntax fixer: ${fixerOutcome.error})`;
            emitSyntaxFixerResult(emit, {
              contentType: 'anything',
              outcome: 'fixer_failed',
              error: fixerOutcome.error ?? 'Syntax fixer could not repair the page HTML.'
            });
          }
        }

        messages = [
          ...initialMessages,
          new SystemMessage(
            buildAnythingRepairInstruction({
              errorMessage: failureError,
              brokenSource: lastBrokenSource,
              originalRequest
            })
          )
        ];
      } else {
        messages = [...initialMessages, new SystemMessage(ANYTHING_PATCH_REQUIRED_INSTRUCTION)];
      }
    }

    finishTurn({
      accepted: false,
      errorClass: invokeErrored ? 'invoke-error' : (classifyAgentTurnError(lastError) ?? 'no-patch')
    });
    return {
      message: lastError ? `Page update failed: ${lastError}` : 'Page update did not apply.',
      raw: lastResult,
      metadata: { agent: 'anything', error: lastError ?? null }
    };
  }

  return {
    async applyIntent({ prompt, focusNode, modelProfile, emit, peerContext, abortSignal }) {
      const slot = stateStore.getSlot('anything');
      const profile = normalizeModelProfile(modelProfile);
      const userMessages = [
        {
          role: 'user',
          content: buildIntentUserContent({
            prompt,
            currentHtml: slot.diagramSource,
            peerContext
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
      const slot = stateStore.getSlot('anything');
      if (!slot.diagramSource?.trim()) {
        return { message: 'Nothing to transform — generate a page first.', raw: null };
      }
      const profile = normalizeModelProfile(modelProfile);
      const userMessages = [
        {
          role: 'user',
          content: appendLanguageInstruction(
            buildAnythingTransformUserContent({
              mode,
              currentHtml: slot.diagramSource,
              goMadDepth,
              advisorPrompt
            }),
            slot.lastUserPrompt,
            slot.diagramSource,
            advisorPrompt
          )
        }
      ];

      if (typeof emit === 'function') {
        emit({ type: 'phase', id: 'anything_transform', label: 'Transforming page…' });
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

    async applyAnalyzeIntent({ kind, modelProfile, emit, advisorPrompt }) {
      const slot = stateStore.getSlot('anything');
      if (!slot.diagramSource?.trim()) {
        return { message: 'Nothing to analyze — generate a page first.', raw: null };
      }
      const profile = normalizeModelProfile(modelProfile);
      const model = buildAnalysisModel(profile);
      const messages = [
        new HumanMessage(
          `${ANYTHING_SYSTEM_PROMPT}\n\n${buildAnythingAnalyzeUserContent({
            kind,
            currentHtml: slot.diagramSource,
            advisorPrompt,
            lastUserPrompt: slot.lastUserPrompt
          })}`
        )
      ];

      if (typeof emit === 'function') {
        emit({ type: 'phase', id: 'anything_analyze', label: `Analyzing page (${kind})…` });
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
export function createLazyAnythingAgentService({ stateStore, env = process.env }) {
  return createLazyAgentService({
    contentType: 'anything',
    stateStore,
    env,
    buildService: () => createAnythingLangChainAgent({ stateStore, env }),
    streamLabels: {
      analyze: 'Analyzing page…',
      intent: 'Building page…',
      transform: 'Transforming page…'
    },
    transformExtraFields: ['advisorPrompt'],
    analyzeExtraFields: ['advisorPrompt']
  });
}
