import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createAgent } from 'langchain';
import { createChartTools } from './diagramTools.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import { CHART_SYSTEM_PROMPT } from '../prompts/chartSystemPrompt.js';
import { buildChartRepairInstruction } from '../prompts/chartSyntaxGuard.js';
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
  normalizeAgentStreamEvent,
  toLangChainMessages
} from './_lib/diagramAgentHelpers.js';
import { createPatchToolStreamTracker } from './streamPatchToolTelemetry.js';
import { repairChartWithFixer, isChartSyntaxFixerAvailable } from './chartSyntaxFixer.js';
import { emitPlanBeat, emitServerMutationPlanBeats } from './planBeatMessages.js';
import {
  buildAgentRunBudgetExceededMessage,
  resolveAgentRepairMaxAttempts,
  resolveAgentRunBudgetMs
} from '@archislop/shared';

const CHART_PATCH_REQUIRED_INSTRUCTION = `Your previous response did not apply a chart patch.
- You MUST call apply_chart_patch now once with a complete, valid chart DSL JSON wrapper, then briefly summarize in prose only.
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

function extractOriginalRequest(userMessages) {
  if (!Array.isArray(userMessages)) return null;
  for (const m of userMessages) {
    if ((m?.role ?? m?.kwargs?.role) !== 'user') continue;
    const text =
      typeof m?.content === 'string' ? m.content : extractTextContent(m?.content ?? m?.kwargs?.content);
    if (text && text.trim()) return text.trim();
  }
  return null;
}

function buildIntentUserContent({ prompt, currentDsl, peerContext }) {
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
  parts.push('Call apply_chart_patch with the full JSON wrapper.');
  return parts.join('\n\n');
}

function buildTransformUserContent({ mode, currentDsl, goMadDepth }) {
  const modeInstructions = {
    refine: 'Refine the current chart — improve mark choice, encoding clarity, color accessibility, and data ordering. Keep the same data and chart family unless a small swap clearly serves the story.',
    innovate: 'Innovate on the current chart — try a different mark/encoding combination or reshape the data presentation. You may switch chart families.',
    goMad: `Go mad on this chart — push the data viz further (depth ${goMadDepth ?? 1}). Layered marks, faceted views, exaggerated encodings.`,
    exec: 'Execute the requested change tightly. No additions beyond the implied scope.'
  };
  return [
    modeInstructions[mode] ?? modeInstructions.refine,
    `Current chart DSL:\n\n\`\`\`json\n${currentDsl}\n\`\`\``,
    'Call apply_chart_patch with the full JSON wrapper.'
  ].join('\n\n');
}

function buildAnalyzeUserContent({ kind, currentDsl }) {
  const task =
    kind === 'critique'
      ? 'Critique this chart in 3-5 short paragraphs. Call out: does the mark choice fit the data? Is the encoding readable? Are there accessibility / color / scale issues? Does the chart actually answer a question?'
      : 'Explain this chart in 3-5 short paragraphs. Describe what data the chart shows, what insights the encoding surfaces, and what each mark/axis means.';
  return [task, `Current chart DSL:\n\n\`\`\`json\n${currentDsl}\n\`\`\``].join('\n\n');
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
          if (normalized) emit(normalized);
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
    const maxRepairAttempts = resolveAgentRepairMaxAttempts(runProfile, env, 'chart');
    const runBudgetMs = resolveAgentRunBudgetMs(runProfile, env);
    const turnStarted = Date.now();
    const beforeRevision = stateStore.getSlot('chart').revisionId;
    const originalRequest = extractOriginalRequest(userMessages);

    let messages = toLangChainMessages(userMessages);
    let lastResult = null;
    let lastError = null;
    let lastBrokenSource = null;
    let syntaxFixerTried = false;
    const agent = buildAgent(runProfile);

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
        metadata: { agent: 'chart', error: lastError, code: reason.code }
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
      const stop = stopReason();
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

      const result = await invokeAgentStream({ agent, messages, abortSignal, emit });
      if (result?.error) {
        lastError = result.error;
        if (typeof emit === 'function') emit({ type: 'error', message: lastError });
        break;
      }

      lastResult = result;
      const currentRevision = stateStore.getSlot('chart').revisionId;
      if (currentRevision !== beforeRevision) {
        return {
          message: extractFinalMessage(result) || 'Chart updated.',
          raw: result,
          metadata: { agent: 'chart' }
        };
      }

      if (!requirePatch) {
        return {
          message: extractFinalMessage(result) || 'Done.',
          raw: result,
          metadata: { agent: 'chart' }
        };
      }

      let failureError = extractToolFailureError(result);

      if (!failureError) {
        const proseDsl = extractChartDslFromAssistantResult(result);
        if (proseDsl) {
          const applied = await stateStore.applyDiagramSource({
            contentType: 'chart',
            diagramSource: proseDsl,
            reason: 'prose-dsl recovery'
          });
          if (applied.accepted) {
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
          const fixerStop = stopReason();
          if (fixerStop) return finishStoppedRun(fixerStop);
          syntaxFixerTried = true;
          if (typeof emit === 'function') {
            emitPlanBeat(
              emit,
              'Chart DSL failed validation — running a quick syntax pass before retrying.',
              'server'
            );
            emit({ type: 'phase', id: 'chart_syntax_fixer', label: 'Chart syntax fixer…' });
          }
          const fixerOutcome = await repairChartWithFixer({
            brokenSource: lastBrokenSource,
            parseError: failureError,
            originalRequest,
            env
          });
          if (fixerOutcome.accepted && fixerOutcome.diagramSource) {
            const applied = await stateStore.applyDiagramSource({
              contentType: 'chart',
              diagramSource: fixerOutcome.diagramSource,
              reason: 'syntax-fixer repair'
            });
            if (applied.accepted) {
              return {
                message: 'Chart updated (repaired by syntax fixer).',
                raw: result,
                metadata: { agent: 'chart', validator: 'syntax-fixer' }
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
            buildChartRepairInstruction({
              errorMessage: failureError,
              brokenSource: lastBrokenSource,
              originalRequest
            })
          )
        ];
      } else {
        messages = [...messages, new SystemMessage(CHART_PATCH_REQUIRED_INSTRUCTION)];
      }
    }

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
      const slot = stateStore.getSlot('chart');
      if (!slot.diagramSource?.trim()) {
        return { message: 'Nothing to transform — generate a chart first.', raw: null };
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

    async applyAnalyzeIntent({ kind, focusNode, modelProfile, emit }) {
      const slot = stateStore.getSlot('chart');
      if (!slot.diagramSource?.trim()) {
        return { message: 'Nothing to analyze — generate a chart first.', raw: null };
      }
      const profile = normalizeModelProfile(modelProfile);
      const model = buildAnalysisModel(profile);
      const messages = [
        new HumanMessage(
          `${CHART_SYSTEM_PROMPT}\n\n${buildAnalyzeUserContent({ kind, currentDsl: slot.diagramSource })}`
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
    }
  });
}
