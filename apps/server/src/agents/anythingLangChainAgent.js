import { HumanMessage } from '@langchain/core/messages';
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
  extractTextContent,
  forwardNormalizedAgentStreamEvent,
  invokeChatModelToClient,
  normalizeAgentStreamEvent
} from './_lib/diagramAgentHelpers.js';
import { invokePatchAgentWithRepair } from './_lib/invokePatchAgentWithRepair.js';
import { createPatchToolStreamTracker } from './streamPatchToolTelemetry.js';
import { buildAdvisorSuggestionBlock } from './mermaidAnalysisPrompts.js';

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

export function buildAnythingTransformUserContent({ mode, currentHtml, russDepth, advisorPrompt }) {
  const modeInstructions = {
    gilfoyle:
      'Fix what is actually wrong with the current document — layout, typography, color, interaction feel, and copy. Reach first for what the page already implies but never shows: the state that exists and is never rendered, the control that looks interactive and is not, the copy naming something other than what it does. Keep the concept and structure.',
    dinesh:
      'Fix what is actually wrong with the current document — layout, typography, color, interaction feel, and copy. Reach first for what the page has not survived yet: the empty state, the error path, the long string that overflows, the interaction with no way back. Keep the concept and structure. The fix must be genuinely right; any prose you emit afterwards makes sure the credit for it lands.',
    erlich:
      'Elevate the current document — rethink the presentation or interaction model for the same subject, the way only a visionary founder could. You may restructure freely.',
    russ: `Escalate like Russ Hanneman — push the spectacle further (depth ${russDepth ?? 1}). More motion, more interactivity, bolder visuals, still on-subject and still self-contained. Tres commas energy; swear when hyped (fuck / what the fuck); never mean to the user; never sexual.`,
    barker:
      'Take the liberty of executing the requested change tightly. No additions beyond the implied scope.'
  };
  // Gilfoyle, Dinesh and Barker are scoped changes to an existing document —
  // targeted edits keep the untouched 95% of the page byte-identical instead of
  // trusting a full regeneration to reproduce it. Erlich and Russ
  // restructure freely, so a full rewrite is the honest tool there.
  const preferEdits = mode === 'gilfoyle' || mode === 'dinesh' || mode === 'barker';
  return [
    modeInstructions[mode] ?? modeInstructions.gilfoyle,
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
    kind === 'jared'
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

  async function invokeAgentStream({ agent, messages, abortSignal, emit, modelFallback = '' }) {
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
      contentType: 'anything',
      patchToolName: 'apply_anything_patch',
      agentName: 'anything',
      stateStore,
      env,
      userMessages,
      opts,
      buildAgent,
      invokeAgentStream,
      extractProseSource: extractHtmlFromAssistantResult,
      buildRepairInstruction: buildAnythingRepairInstruction,
      patchRequiredInstruction: ANYTHING_PATCH_REQUIRED_INSTRUCTION,
      isSyntaxFixerAvailable: isAnythingSyntaxFixerAvailable,
      repairWithFixer: repairAnythingWithFixer,
      labels: {
        phaseInvokeId: 'anything_invoke',
        phaseRepairId: (attempt) => `anything_repair_${attempt}`,
        invokeLabel: 'Building page…',
        repairLabel: (attempt, max) => `Repairing page (attempt ${attempt} of ${max})…`,
        retryPlanBeat: (attempt, max, tierNote) =>
          `Previous page patch did not validate — retrying while keeping your intent (attempt ${attempt} of ${max})${tierNote}.`,
        successMessage: 'Page updated.',
        proseRecoveryReason: 'prose-html recovery',
        proseRecoveryValidator: 'prose-html-recovery',
        validationFailedFallback: 'HTML validation failed',
        syntaxFixerSuccessMessage: 'Page updated (repaired by syntax fixer).',
        syntaxFixerRepairedDetail: 'Repaired invalid page HTML and applied the patch.',
        syntaxFixerStoreRejectedFallback: 'Page validation failed after syntax fixer.',
        syntaxFixerFailedFallback: 'Syntax fixer could not repair the page HTML.',
        failurePrefix: 'Page update failed',
        noApplyMessage: 'Page update did not apply.'
      }
    });
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
      russDepth,
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
              russDepth,
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
      const backend = resolveLlmBackend(env, profile);
      const modelId = resolveModelId(env, profile, backend);
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
        if (typeof emit === 'function') {
          return await invokeChatModelToClient(model, messages, emit, {
            modelId,
            callId: `analyze-anything-${kind}`
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
