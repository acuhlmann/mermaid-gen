import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createAgent } from 'langchain';
import { createChartTools } from './diagramTools.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import { CHART_SYSTEM_PROMPT } from '../prompts/chartSystemPrompt.js';
import {
  appendLanguageInstruction,
  appendProseLanguageInstruction,
  MATCH_USER_LANGUAGE_RULE
} from '@archislop/shared';
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
  extractTextContent,
  forwardNormalizedAgentStreamEvent,
  invokeChatModelToClient,
  normalizeAgentStreamEvent
} from './_lib/diagramAgentHelpers.js';
import { invokePatchAgentWithRepair } from './_lib/invokePatchAgentWithRepair.js';
import { createPatchToolStreamTracker } from './streamPatchToolTelemetry.js';
import { repairChartWithFixer, isChartSyntaxFixerAvailable } from './chartSyntaxFixer.js';
import { buildAdvisorSuggestionBlock } from './mermaidAnalysisPrompts.js';
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
  return appendLanguageInstruction(parts.join('\n\n'), prompt, currentDsl);
}

export function buildChartTransformUserContent({
  mode,
  currentDsl,
  russDepth,
  advisorPrompt,
  focusScope
}) {
  const modeInstructions = {
    gilfoyle:
      'Fix what is actually wrong with the current chart — mark choice, encoding clarity, color accessibility, and data ordering. Reach first for what the data already says but the encoding hides: the ordering that reveals the real ranking, the truncated axis that overstates a gap, the encoding that misstates the comparison. Keep the same data and chart family unless a small swap clearly serves the story.',
    dinesh:
      'Fix what is actually wrong with the current chart — mark choice, encoding clarity, color accessibility, and data ordering. Reach first for what the chart does not handle: missing or zero values, the unlabeled outlier, the category that gets cut off, the legend nobody can read at this size. Keep the same data and chart family unless a small swap clearly serves the story. The fix must be genuinely right; any prose you emit afterwards makes sure the credit for it lands.',
    erlich:
      'Elevate the current chart — try a different mark/encoding combination or reshape the data presentation with founder-grade boldness. You may switch chart families.',
    russ: `Escalate like Russ Hanneman — push the data viz further (depth ${russDepth ?? 1}). Layered marks, faceted views, exaggerated encodings. On-subject tres commas energy; swear when hyped; never mean to the user.`,
    barker:
      'Take the liberty of executing the requested change tightly. No additions beyond the implied scope.'
  };
  return [
    modeInstructions[mode] ?? modeInstructions.gilfoyle,
    focusScope,
    `Current chart DSL:\n\n\`\`\`json\n${currentDsl}\n\`\`\``,
    buildAdvisorSuggestionBlock(advisorPrompt),
    'Call apply_chart_patch with the full JSON wrapper.'
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildChartAnalyzeUserContent({
  kind,
  currentDsl,
  focusScope,
  advisorPrompt,
  lastUserPrompt
}) {
  const task = kind === 'jared' ? CHART_CRITIQUE_TASK : CHART_EXPLAIN_TASK;
  return appendProseLanguageInstruction(
    [
      task,
      focusScope,
      buildAdvisorSuggestionBlock(advisorPrompt),
      `Current chart DSL:\n\n\`\`\`json\n${currentDsl}\n\`\`\``
    ]
      .filter(Boolean)
      .join('\n\n'),
    lastUserPrompt,
    currentDsl,
    advisorPrompt
  );
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
    const backend = resolveLlmBackend(env, profile);
    const modelId = resolveModelId(env, profile, backend);
    const llm = createChatModel(env, { model: modelId, backend, modelProfile: profile });
    return createAgentImpl({ model: llm, tools, systemPrompt: CHART_SYSTEM_PROMPT });
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
    return invokePatchAgentWithRepair({
      contentType: 'chart',
      patchToolName: 'apply_chart_patch',
      agentName: 'chart',
      stateStore,
      env,
      userMessages,
      opts,
      buildAgent,
      invokeAgentStream,
      extractProseSource: extractChartDslFromAssistantResult,
      buildRepairInstruction: buildChartRepairInstruction,
      patchRequiredInstruction: CHART_PATCH_REQUIRED_INSTRUCTION,
      isSyntaxFixerAvailable: isChartSyntaxFixerAvailable,
      repairWithFixer: repairChartWithFixer,
      labels: {
        phaseInvokeId: 'chart_invoke',
        phaseRepairId: (attempt) => `chart_repair_${attempt}`,
        invokeLabel: 'Composing chart…',
        repairLabel: (attempt, max) => `Repairing chart (attempt ${attempt} of ${max})…`,
        retryPlanBeat: (attempt, max, tierNote) =>
          `Previous chart patch did not validate — retrying while keeping your intent (attempt ${attempt} of ${max})${tierNote}.`,
        successMessage: 'Chart updated.',
        proseRecoveryReason: 'prose-dsl recovery',
        proseRecoveryValidator: 'prose-dsl-recovery',
        validationFailedFallback: 'Chart validation failed',
        syntaxFixerSuccessMessage: 'Chart updated (repaired by syntax fixer).',
        syntaxFixerRepairedDetail: 'Repaired invalid chart DSL and applied the patch.',
        syntaxFixerStoreRejectedFallback: 'Chart validation failed after syntax fixer.',
        syntaxFixerFailedFallback: 'Syntax fixer could not repair the chart DSL.',
        failurePrefix: 'Chart update failed',
        noApplyMessage: 'Chart update did not apply.'
      }
    });
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
      russDepth,
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
          content: appendLanguageInstruction(
            buildChartTransformUserContent({
              mode,
              currentDsl: slot.diagramSource,
              russDepth,
              advisorPrompt,
              focusScope
            }),
            slot.lastUserPrompt,
            slot.diagramSource,
            advisorPrompt
          )
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
      const backend = resolveLlmBackend(env, profile);
      const modelId = resolveModelId(env, profile, backend);
      const model = buildAnalysisModel(profile);
      const focusScope = buildChartAnalyzeFocusInstructions(focusNode, kind);
      const messages = [
        new SystemMessage(CHART_ANALYSIS_SYSTEM_PROMPT),
        new HumanMessage(
          buildChartAnalyzeUserContent({
            kind,
            currentDsl: slot.diagramSource,
            focusScope,
            advisorPrompt,
            lastUserPrompt: slot.lastUserPrompt
          })
        )
      ];

      if (typeof emit === 'function') {
        emit({ type: 'phase', id: 'chart_analyze', label: `Analyzing chart (${kind})…` });
      }

      try {
        if (typeof emit === 'function') {
          return await invokeChatModelToClient(model, messages, emit, {
            modelId,
            callId: `analyze-chart-${kind}`
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
