import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createAgent } from 'langchain';
import { createMetaphorTools } from './diagramTools.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import { METAPHOR_SYSTEM_PROMPT } from '../prompts/metaphorSystemPrompt.js';
import { appendLanguageInstruction, appendProseLanguageInstruction } from '@archislop/shared';
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
  extractTextContent,
  forwardNormalizedAgentStreamEvent,
  invokeChatModelToClient,
  normalizeAgentStreamEvent
} from './_lib/diagramAgentHelpers.js';
import { invokePatchAgentWithRepair } from './_lib/invokePatchAgentWithRepair.js';
import { createPatchToolStreamTracker } from './streamPatchToolTelemetry.js';
import { repairMetaphorWithFixer, isMetaphorSyntaxFixerAvailable } from './metaphorSyntaxFixer.js';

const METAPHOR_PATCH_REQUIRED_INSTRUCTION = `Your previous response did not apply a metaphor patch.
- You MUST call apply_metaphor_patch now once with complete, valid metaphor DSL JSON, then briefly summarize in prose only.
- Do not return prose only.
- Do not mention tool names in your final user-facing summary.`;

function defaultChatModelFactory(env, options) {
  return createLlmChatModel(env, options);
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

function buildIntentUserContent({ prompt, currentDsl, peerContext, uiLocale }) {
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
  return appendLanguageInstruction(parts.join('\n\n'), prompt, currentDsl, { uiLocale });
}

function buildTransformUserContent({ mode, currentDsl, russDepth }) {
  const modeInstructions = {
    gilfoyle:
      'Fix what is actually wrong with the current metaphor — labels, unbalanced magnitudes, a loose spatial story. Reach first for what the scene already claims but does not show: the magnitude that contradicts its own label, the relationship the arrangement implies and never draws. Keep the same metaphor type.',
    dinesh:
      'Fix what is actually wrong with the current metaphor — labels, unbalanced magnitudes, a loose spatial story. Reach first for what the scene leaves out and would fall over without: the missing counterweight, the element the metaphor quietly depends on, the piece that has nowhere to go when it fails. Keep the same metaphor type. The fix must be genuinely right; any prose you emit afterwards makes sure the credit for it lands.',
    erlich:
      'Elevate the current metaphor — try a different metaphor type or a fresh angle on the subject, bolder than anyone asked for. You may switch metaphors.',
    russ: `Escalate like Russ Hanneman — push the spatial story further (depth ${russDepth ?? 1}). Exaggerate, recombine, surprise. On-subject tres commas energy; swear when hyped; never mean to the user.`,
    barker:
      'Take the liberty of executing the requested change tightly. No additions beyond the implied scope.'
  };
  return [
    modeInstructions[mode] ?? modeInstructions.gilfoyle,
    `Current metaphor DSL:\n\n\`\`\`json\n${currentDsl}\n\`\`\``,
    'Call apply_metaphor_patch with the full JSON DSL.'
  ].join('\n\n');
}

function buildAnalyzeUserContent({
  kind,
  currentDsl,
  focusScope,
  lastUserPrompt,
  advisorPrompt,
  uiLocale
}) {
  const task = kind === 'jared' ? METAPHOR_CRITIQUE_TASK : METAPHOR_EXPLAIN_TASK;
  return appendProseLanguageInstruction(
    [task, focusScope, `Current metaphor DSL:\n\n\`\`\`json\n${currentDsl}\n\`\`\``]
      .filter(Boolean)
      .join('\n\n'),
    lastUserPrompt,
    currentDsl,
    advisorPrompt,
    { uiLocale }
  );
}

export function createMetaphorLangChainAgent({
  stateStore,
  env = process.env,
  createChatModel = defaultChatModelFactory,
  createAgentImpl = createAgent
}) {
  const tools = createMetaphorTools({ stateStore });

  function buildAgent(profile) {
    const backend = resolveLlmBackend(env, profile);
    const modelId = resolveModelId(env, profile, backend);
    const llm = createChatModel(env, { model: modelId, backend, modelProfile: profile });
    return createAgentImpl({ model: llm, tools, systemPrompt: METAPHOR_SYSTEM_PROMPT });
  }

  function buildAnalysisModel(profile) {
    const backend = resolveLlmBackend(env, profile);
    const modelId = resolveModelId(env, profile, backend);
    return createChatModel(env, { model: modelId, backend, modelProfile: profile });
  }

  async function invokeAgentStream({ agent, messages, abortSignal, emit, modelFallback = '' }) {
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
          const normalized = normalizeAgentStreamEvent(ev, { modelFallback });
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
    return invokePatchAgentWithRepair({
      contentType: 'metaphor3d',
      patchToolName: 'apply_metaphor_patch',
      agentName: 'metaphor3d',
      stateStore,
      env,
      userMessages,
      opts,
      buildAgent,
      invokeAgentStream,
      extractProseSource: extractMetaphorDslFromAssistantResult,
      buildRepairInstruction: buildMetaphorRepairInstruction,
      patchRequiredInstruction: METAPHOR_PATCH_REQUIRED_INSTRUCTION,
      isSyntaxFixerAvailable: isMetaphorSyntaxFixerAvailable,
      repairWithFixer: repairMetaphorWithFixer,
      labels: {
        phaseInvokeId: 'metaphor_invoke',
        phaseRepairId: (attempt) => `metaphor_repair_${attempt}`,
        invokeLabel: 'Composing metaphor…',
        repairLabel: (attempt, max) => `Repairing metaphor (attempt ${attempt} of ${max})…`,
        retryPlanBeat: (attempt, max, tierNote) =>
          `Previous metaphor patch did not validate — retrying while keeping your intent (attempt ${attempt} of ${max})${tierNote}.`,
        successMessage: 'Metaphor updated.',
        proseRecoveryReason: 'prose-dsl recovery',
        proseRecoveryValidator: 'prose-dsl-recovery',
        validationFailedFallback: 'Metaphor validation failed',
        syntaxFixerSuccessMessage: 'Metaphor updated (repaired by syntax fixer).',
        syntaxFixerRepairedDetail: 'Repaired invalid metaphor DSL and applied the patch.',
        syntaxFixerStoreRejectedFallback: 'Metaphor validation failed after syntax fixer.',
        syntaxFixerFailedFallback: 'Syntax fixer could not repair the metaphor DSL.',
        failurePrefix: 'Metaphor update failed',
        noApplyMessage: 'Metaphor update did not apply.'
      }
    });
  }

  return {
    async applyIntent({
      prompt,
      focusNode,
      modelProfile,
      emit,
      peerContext,
      abortSignal,
      uiLocale
    }) {
      const slot = stateStore.getSlot('metaphor3d');
      const profile = normalizeModelProfile(modelProfile);
      const userMessages = [
        {
          role: 'user',
          content: buildIntentUserContent({
            prompt,
            currentDsl: slot.diagramSource,
            peerContext,
            uiLocale
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
      russDepth,
      abortSignal,
      uiLocale
    }) {
      const slot = stateStore.getSlot('metaphor3d');
      if (!slot.diagramSource?.trim()) {
        return { message: 'Nothing to transform — generate a metaphor first.', raw: null };
      }
      const profile = normalizeModelProfile(modelProfile);
      const userMessages = [
        {
          role: 'user',
          content: appendLanguageInstruction(
            buildTransformUserContent({
              mode,
              currentDsl: slot.diagramSource,
              russDepth
            }),
            slot.lastUserPrompt,
            slot.diagramSource,
            { uiLocale }
          )
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

    async applyAnalyzeIntent({ kind, focusNode, modelProfile, emit, uiLocale }) {
      const slot = stateStore.getSlot('metaphor3d');
      if (!slot.diagramSource?.trim()) {
        return { message: 'Nothing to analyze — generate a metaphor first.', raw: null };
      }
      const profile = normalizeModelProfile(modelProfile);
      const backend = resolveLlmBackend(env, profile);
      const modelId = resolveModelId(env, profile, backend);
      const model = buildAnalysisModel(profile);
      const focusScope = buildMetaphorAnalyzeFocusInstructions(focusNode, kind);
      const messages = [
        new SystemMessage(METAPHOR_ANALYSIS_SYSTEM_PROMPT),
        new HumanMessage(
          buildAnalyzeUserContent({
            kind,
            currentDsl: slot.diagramSource,
            focusScope,
            lastUserPrompt: slot.lastUserPrompt,
            uiLocale
          })
        )
      ];

      if (typeof emit === 'function') {
        emit({ type: 'phase', id: 'metaphor_analyze', label: `Analyzing metaphor (${kind})…` });
      }

      try {
        if (typeof emit === 'function') {
          return await invokeChatModelToClient(model, messages, emit, {
            modelId,
            callId: `analyze-metaphor-${kind}`
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
