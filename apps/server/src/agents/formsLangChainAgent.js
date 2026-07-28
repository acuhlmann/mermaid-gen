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
  extractTextContent,
  forwardNormalizedAgentStreamEvent,
  invokeChatModelToClient,
  normalizeAgentStreamEvent
} from './_lib/diagramAgentHelpers.js';
import { invokePatchAgentWithRepair } from './_lib/invokePatchAgentWithRepair.js';
import { createPatchToolStreamTracker } from './streamPatchToolTelemetry.js';
import { buildAdvisorSuggestionBlock } from './mermaidAnalysisPrompts.js';
import { isFormsSyntaxFixerAvailable, repairFormsWithFixer } from './formsSyntaxFixer.js';

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

export function buildFormsTransformUserContent({ mode, currentDoc, russDepth, advisorPrompt }) {
  const modeInstructions = {
    gilfoyle:
      'Fix what is actually wrong with the current form — keep the same intake step but sharpen the copy, tighten the layout, and make the absurdity land harder. Reach first for what the form already presupposes but never asks: the question that assumes an answer it never collected, the field whose label names something other than what it takes. Keep the fields and structure.',
    dinesh:
      'Fix what is actually wrong with the current form — keep the same intake step but sharpen the copy, tighten the layout, and make the absurdity land harder. Reach first for what the form does not let you survive: the required field with no honest answer, the dead end after submit, the "other" with nowhere to type it. Keep the fields and structure. The fix must be genuinely right; any prose you emit afterwards makes sure the credit for it lands.',
    erlich:
      'Elevate the current form — same bureaucratic subject, a different form structure or gimmick worthy of a visionary. You may restructure freely.',
    russ: `Escalate like Russ Hanneman — escalate the bureaucracy (depth ${russDepth ?? 1}). More sections, more mandatory attestations, more self-cancelling rules, nested sub-forms via Cards and Tabs. Still a working, submittable form. Tres commas energy; never mean.`,
    barker:
      'Take the liberty of executing the requested change tightly. No additions beyond the implied scope.'
  };
  return [
    modeInstructions[mode] ?? modeInstructions.gilfoyle,
    `Current forms document:\n\n\`\`\`json\n${currentDoc}\n\`\`\``,
    buildAdvisorSuggestionBlock(advisorPrompt),
    'Call apply_forms_patch with the full forms document JSON.'
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildFormsAnalyzeUserContent({ kind, currentDoc, advisorPrompt, lastUserPrompt }) {
  const task = kind === 'jared' ? FORMS_CRITIQUE_TASK : FORMS_EXPLAIN_TASK;
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
    return invokePatchAgentWithRepair({
      contentType: 'forms',
      patchToolName: 'apply_forms_patch',
      agentName: 'forms',
      stateStore,
      env,
      userMessages,
      opts,
      buildAgent,
      invokeAgentStream,
      extractProseSource: extractFormsDocFromAssistantResult,
      buildRepairInstruction: buildFormsRepairInstruction,
      patchRequiredInstruction: FORMS_PATCH_REQUIRED_INSTRUCTION,
      isSyntaxFixerAvailable: isFormsSyntaxFixerAvailable,
      repairWithFixer: repairFormsWithFixer,
      labels: {
        phaseInvokeId: 'forms_invoke',
        phaseRepairId: (attempt) => `forms_repair_${attempt}`,
        invokeLabel: 'Issuing form…',
        repairLabel: (attempt, max) => `Repairing form (attempt ${attempt} of ${max})…`,
        retryPlanBeat: (attempt, max, tierNote) =>
          `Previous form did not validate — retrying while keeping your intent (attempt ${attempt} of ${max})${tierNote}.`,
        successMessage: 'Form issued.',
        proseRecoveryReason: 'prose-doc recovery',
        proseRecoveryValidator: 'prose-doc-recovery',
        validationFailedFallback: 'Forms validation failed',
        syntaxFixerSuccessMessage: 'Form issued (repaired by syntax fixer).',
        syntaxFixerRepairedDetail: 'Repaired invalid forms document and applied the patch.',
        syntaxFixerStoreRejectedFallback: 'Forms validation failed after syntax fixer.',
        syntaxFixerFailedFallback: 'Syntax fixer could not repair the forms document.',
        failurePrefix: 'Form update failed',
        noApplyMessage: 'Form update did not apply.'
      }
    });
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
      russDepth,
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
