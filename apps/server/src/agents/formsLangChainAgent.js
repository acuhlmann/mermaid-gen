import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createAgent } from 'langchain';
import { createFormsTools } from './diagramTools.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import { FORMS_SYSTEM_PROMPT } from '../prompts/formsSystemPrompt.js';
import {
  appendLanguageInstruction,
  appendProseLanguageInstruction,
  parseFormsA2ui
} from '@archislop/shared';
import {
  buildFormsRepairInstruction,
  FORMS_ANALYSIS_SYSTEM_PROMPT,
  FORMS_CRITIQUE_TASK,
  FORMS_EXPLAIN_TASK
} from '../prompts/formsSyntaxGuard.js';
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
  invokeChatModelToClient,
  normalizeAgentStreamEvent,
  toLangChainMessages
} from './_lib/diagramAgentHelpers.js';
import { createPatchToolStreamTracker } from './streamPatchToolTelemetry.js';
import { classifyAgentTurnError, recordAgentTurn } from '../metrics/agentTurnMetrics.js';
import { buildAdvisorSuggestionBlock } from './mermaidAnalysisPrompts.js';
import { emitPlanBeat, emitServerMutationPlanBeats } from './planBeatMessages.js';
import { emitSyntaxFixerResult, emitSyntaxFixerStart } from './syntaxFixerTelemetry.js';
import { isFormsSyntaxFixerAvailable, repairFormsWithFixer } from './formsSyntaxFixer.js';
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

const FORMS_PATCH_REQUIRED_INSTRUCTION = `Your previous response did not apply a forms patch.
- You MUST call apply_forms_patch now once with a complete, valid forms document JSON, then briefly summarize in prose only.
- Do not return prose only.
- Do not mention tool names in your final user-facing summary.`;

function defaultChatModelFactory(env, options) {
  return createLlmChatModel(env, options);
}

/**
 * Some models emit the forms document as a fenced JSON block in prose instead of
 * calling apply_forms_patch. Scan the last assistant message for such a block (or
 * for a bare JSON object carrying the forms marker) so the caller can route it
 * through the same tool path.
 */
function extractFormsDocFromAssistantResult(result) {
  const messages = result?.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    const type = m?.type ?? m?.role ?? m?.kwargs?.role ?? '';
    if (type !== 'ai' && type !== 'assistant') continue;
    const raw = extractTextContent(m?.content ?? m?.kwargs?.content ?? '');
    if (!raw?.trim()) continue;

    const fenced = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
    if (fenced && fenced[1].includes('"archislopFormsVersion"')) {
      return fenced[1].trim();
    }
    const braceStart = raw.indexOf('{');
    const braceEnd = raw.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
      const candidate = raw.slice(braceStart, braceEnd + 1);
      if (candidate.includes('"archislopFormsVersion"')) return candidate.trim();
    }
  }
  return null;
}

function buildIntentUserContent({ prompt, currentDoc, peerContext }) {
  const parts = [];
  parts.push(`User request: ${prompt.trim()}`);
  if (currentDoc?.trim()) {
    const title = describeCurrentForm(currentDoc);
    parts.push(
      `The most recently rendered form was ${title}. The user has just interacted with it and moved on. Generate the NEXT form in the endless corporate gauntlet — acknowledge their (implied) submission with bureaucratic non-sequiturs, bump the form code, and pile on fresh tedium. Do NOT reuse the same form.`
    );
  } else {
    parts.push(
      'There is no current form — open the gauntlet with a fresh intake/eligibility form.'
    );
  }
  if (peerContext?.contentType && peerContext?.diagramSource?.trim()) {
    parts.push(
      `The user is converting from ${peerContext.contentType}. Use it as the subject the bureaucracy is nominally about (do NOT translate 1:1 — invent the intake paperwork that this subject would spawn):\n\n\`\`\`\n${peerContext.diagramSource}\n\`\`\``
    );
  }
  parts.push('Call apply_forms_patch with the full forms document JSON.');
  return appendLanguageInstruction(parts.join('\n\n'), prompt, currentDoc);
}

/** Short human label for the current form (title + code) for repair/next-form context. */
function describeCurrentForm(currentDoc) {
  const parsed = parseFormsA2ui(currentDoc);
  if (!parsed.ok) return 'a form';
  const code = parsed.doc.formCode ? ` (${parsed.doc.formCode})` : '';
  return `"${parsed.doc.formTitle}"${code}`;
}

export function buildFormsTransformUserContent({ mode, currentDoc, goMadDepth, advisorPrompt }) {
  const modeInstructions = {
    refine:
      'Refine the current form — keep the same intake step but sharpen the copy, tighten the layout, and make the absurdity land harder. Keep the fields and structure.',
    innovate:
      'Innovate on the current form — same bureaucratic subject, a different form structure or gimmick. You may restructure freely.',
    goMad: `Go mad on this form — escalate the bureaucracy (depth ${goMadDepth ?? 1}). More sections, more mandatory attestations, more self-cancelling rules, nested sub-forms via Cards and Tabs. Still a working, submittable form.`,
    exec: 'Execute the requested change tightly. No additions beyond the implied scope.'
  };
  return [
    modeInstructions[mode] ?? modeInstructions.refine,
    `Current forms document:\n\n\`\`\`json\n${currentDoc}\n\`\`\``,
    buildAdvisorSuggestionBlock(advisorPrompt),
    'Call apply_forms_patch with the full forms document JSON.'
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildFormsAnalyzeUserContent({ kind, currentDoc, advisorPrompt, lastUserPrompt }) {
  const task = kind === 'critique' ? FORMS_CRITIQUE_TASK : FORMS_EXPLAIN_TASK;
  return appendProseLanguageInstruction(
    [
      task,
      buildAdvisorSuggestionBlock(advisorPrompt),
      `Current forms document:\n\n\`\`\`json\n${currentDoc}\n\`\`\``
    ]
      .filter(Boolean)
      .join('\n\n'),
    lastUserPrompt,
    currentDoc,
    advisorPrompt
  );
}

export function createFormsLangChainAgent({
  stateStore,
  env = process.env,
  createChatModel = defaultChatModelFactory,
  createAgentImpl = createAgent
}) {
  const tools = createFormsTools({ stateStore });

  function buildAgent(profile) {
    const backend = resolveLlmBackend(env, profile);
    const modelId = resolveModelId(env, profile, backend);
    const llm = createChatModel(env, { model: modelId, backend, modelProfile: profile });
    return createAgentImpl({ model: llm, tools, systemPrompt: FORMS_SYSTEM_PROMPT });
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
        // Partial forms JSON is meaningless to render, so no draft preview —
        // the canvas updates atomically when the patch validates.
        const patchTelemetry = createPatchToolStreamTracker({
          emit,
          patchToolName: 'apply_forms_patch',
          contentType: 'forms',
          emitDraftPreview: false
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
      originalRequest: originalRequestOverride = null
    } = opts ?? {};
    const runProfile = normalizeModelProfile(profile);
    const maxRepairAttempts = resolveAgentRepairMaxAttempts(runProfile, env, 'forms');
    const runBudgetMs = resolveAgentRunBudgetMs(runProfile, env, mode);
    const turnStarted = Date.now();
    const runSignal = createRunDeadlineSignal({
      abortSignal,
      budgetMs: runBudgetMs,
      startedAt: turnStarted
    });
    const beforeRevision = stateStore.getSlot('forms').revisionId;
    const originalRequest = originalRequestOverride ?? extractOriginalRequest(userMessages);

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
    const finishTurn = (sample) => {
      recordAgentTurn(
        {
          contentType: 'forms',
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
        metadata: { agent: 'forms', error: lastError ?? null, code: reason.code }
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
        contentType: 'forms'
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
            `Previous form did not validate — retrying while keeping your intent (attempt ${attempt} of ${maxRepairAttempts})${tierNote}.`,
            'server'
          );
        }
        emit({
          type: 'phase',
          id: attempt === 0 ? 'forms_invoke' : `forms_repair_${attempt}`,
          label:
            attempt === 0
              ? 'Issuing form…'
              : `Repairing form (attempt ${attempt} of ${maxRepairAttempts})…`
        });
      }

      const result = await invokeAgentStream({ agent, messages, abortSignal: runSignal, emit });
      if (result?.error) {
        const abortStop = stopReason();
        if (abortStop) return finishStoppedRun(abortStop);
        lastError = result.error;
        invokeErrored = true;
        if (typeof emit === 'function') emit({ type: 'error', message: lastError });
        break;
      }

      lastResult = result;
      const currentRevision = stateStore.getSlot('forms').revisionId;
      if (currentRevision !== beforeRevision) {
        finishTurn({
          accepted: true,
          validator: attempt === 0 ? 'first-try' : `repair-attempt-${attempt}`
        });
        return {
          message: extractFinalMessage(result) || 'Form issued.',
          raw: result,
          metadata: { agent: 'forms' }
        };
      }

      if (!requirePatch) {
        return {
          message: extractFinalMessage(result) || 'Done.',
          raw: result,
          metadata: { agent: 'forms' }
        };
      }

      let failureError = extractToolFailureError(result);

      if (!failureError && !result) {
        failureError = 'Agent stream ended without a model response or tool result.';
        lastError = failureError;
      }

      if (!failureError) {
        const proseDoc = extractFormsDocFromAssistantResult(result);
        if (proseDoc) {
          const applied = await stateStore.applyDiagramSource({
            contentType: 'forms',
            diagramSource: proseDoc,
            reason: 'prose-doc recovery'
          });
          if (applied.accepted) {
            finishTurn({ accepted: true, validator: 'prose-doc-recovery' });
            return {
              message: extractFinalMessage(result) || 'Form issued.',
              raw: result,
              metadata: { agent: 'forms', validator: 'prose-doc-recovery' }
            };
          }
          failureError = applied.error ?? 'Forms validation failed';
          lastBrokenSource = proseDoc;
          lastError = failureError;
        }
      }

      if (failureError) {
        lastError = failureError;
        lastBrokenSource =
          extractLastAttemptedToolSource(result, 'apply_forms_patch') || lastBrokenSource;

        if (!syntaxFixerTried && lastBrokenSource && isFormsSyntaxFixerAvailable(env)) {
          const fixerStop = stopReason(MIN_SYNTAX_FIXER_BUDGET_MS);
          if (fixerStop) return finishStoppedRun(fixerStop);
          syntaxFixerTried = true;
          repairAttempts += 1;
          emitSyntaxFixerStart(emit, { contentType: 'forms', triggerError: failureError });
          const fixerOutcome = await repairFormsWithFixer({
            brokenSource: lastBrokenSource,
            parseError: failureError,
            originalRequest,
            env,
            abortSignal: runSignal
          });
          if (fixerOutcome.accepted && fixerOutcome.diagramSource) {
            const applied = await stateStore.applyDiagramSource({
              contentType: 'forms',
              diagramSource: fixerOutcome.diagramSource,
              reason: 'syntax-fixer repair'
            });
            if (applied.accepted) {
              emitSyntaxFixerResult(emit, {
                contentType: 'forms',
                outcome: 'repaired',
                detail: 'Repaired invalid forms document and applied the patch.'
              });
              finishTurn({ accepted: true, validator: 'syntax-fixer' });
              return {
                message: 'Form issued (repaired by syntax fixer).',
                raw: result,
                metadata: { agent: 'forms', validator: 'syntax-fixer' }
              };
            }
            lastError = `${failureError}\n(fixer attempt also rejected: ${applied.error})`;
            emitSyntaxFixerResult(emit, {
              contentType: 'forms',
              outcome: 'store_rejected',
              error: applied.error ?? 'Forms validation failed after syntax fixer.'
            });
          } else {
            lastError = `${failureError}\n(syntax fixer: ${fixerOutcome.error})`;
            emitSyntaxFixerResult(emit, {
              contentType: 'forms',
              outcome: 'fixer_failed',
              error: fixerOutcome.error ?? 'Syntax fixer could not repair the forms document.'
            });
          }
        }

        messages = [
          ...initialMessages,
          new SystemMessage(
            buildFormsRepairInstruction({
              errorMessage: failureError,
              brokenSource: lastBrokenSource,
              originalRequest
            })
          )
        ];
      } else {
        messages = [...initialMessages, new SystemMessage(FORMS_PATCH_REQUIRED_INSTRUCTION)];
      }
    }

    finishTurn({
      accepted: false,
      errorClass: invokeErrored ? 'invoke-error' : (classifyAgentTurnError(lastError) ?? 'no-patch')
    });
    return {
      message: lastError ? `Form update failed: ${lastError}` : 'Form update did not apply.',
      raw: lastResult,
      metadata: { agent: 'forms', error: lastError ?? null }
    };
  }

  return {
    async applyIntent({ prompt, focusNode, modelProfile, emit, peerContext, abortSignal }) {
      const slot = stateStore.getSlot('forms');
      const profile = normalizeModelProfile(modelProfile);
      const userMessages = [
        {
          role: 'user',
          content: buildIntentUserContent({
            prompt,
            currentDoc: slot.diagramSource,
            peerContext
          })
        }
      ];

      return invokeWithRepair(userMessages, {
        requirePatch: true,
        emit,
        profile,
        abortSignal,
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
      const slot = stateStore.getSlot('forms');
      if (!slot.diagramSource?.trim()) {
        return { message: 'Nothing to transform — generate a form first.', raw: null };
      }
      const profile = normalizeModelProfile(modelProfile);
      const userMessages = [
        {
          role: 'user',
          content: appendLanguageInstruction(
            buildFormsTransformUserContent({
              mode,
              currentDoc: slot.diagramSource,
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
        emit({ type: 'phase', id: 'forms_transform', label: 'Transforming form…' });
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
      const slot = stateStore.getSlot('forms');
      if (!slot.diagramSource?.trim()) {
        return { message: 'Nothing to analyze — generate a form first.', raw: null };
      }
      const profile = normalizeModelProfile(modelProfile);
      const backend = resolveLlmBackend(env, profile);
      const modelId = resolveModelId(env, profile, backend);
      const model = buildAnalysisModel(profile);
      const messages = [
        new SystemMessage(FORMS_ANALYSIS_SYSTEM_PROMPT),
        new HumanMessage(
          buildFormsAnalyzeUserContent({
            kind,
            currentDoc: slot.diagramSource,
            advisorPrompt,
            lastUserPrompt: slot.lastUserPrompt
          })
        )
      ];

      if (typeof emit === 'function') {
        emit({ type: 'phase', id: 'forms_analyze', label: `Analyzing form (${kind})…` });
      }

      try {
        if (typeof emit === 'function') {
          return await invokeChatModelToClient(model, messages, emit, {
            modelId,
            callId: `analyze-forms-${kind}`
          });
        }
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
export function createLazyFormsAgentService({ stateStore, env = process.env }) {
  return createLazyAgentService({
    contentType: 'forms',
    stateStore,
    env,
    buildService: () => createFormsLangChainAgent({ stateStore, env }),
    streamLabels: {
      analyze: 'Analyzing form…',
      intent: 'Issuing form…',
      transform: 'Transforming form…'
    },
    transformExtraFields: ['advisorPrompt'],
    analyzeExtraFields: ['advisorPrompt']
  });
}
