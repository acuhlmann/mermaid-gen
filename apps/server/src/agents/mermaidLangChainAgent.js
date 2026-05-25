import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { createAgent } from 'langchain';
import { createDiagramTools } from './diagramTools.js';
import { isSyntaxValidationError } from './mermaidReliabilitySkill.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import { computeLineDiffStats } from '../utils/patchLineStats.js';
import { createDiagramAgentMiddleware } from './agentGraphConfig.js';
import { recordAgentTurn, classifyAgentTurnError } from '../metrics/agentTurnMetrics.js';
import { inferDiagramType } from './inferDiagramType.js';
import { getRulePack } from '../prompts/mermaidSyntaxGuard.js';
import { repairMermaidWithFixer, isSyntaxFixerAvailable } from './mermaidSyntaxFixer.js';
import { extractTextContent } from '../utils/extractTextContent.js';
import { emitPlanBeat, emitServerMutationPlanBeats } from './planBeatMessages.js';
import {
  captureMessagesFromStreamEvent,
  extractFinalMessage,
  extractLastAttemptedToolSource,
  extractToolFailureError,
  normalizeAgentStreamEvent,
  toLangChainMessages
} from './_lib/diagramAgentHelpers.js';
import {
  resolveInvokeKeepaliveIntervalMs,
  runAgentTurn,
  runInvokeWithStreamingKeepalive
} from './_lib/diagramAgentStreaming.js';
import { createDiagramAgentCache } from './_lib/diagramAgentCache.js';
import { createLazyAgentService } from './_lib/createLazyAgentService.js';

export {
  captureMessagesFromStreamEvent,
  extractFinalMessage,
  normalizeAgentStreamEvent,
  resolveInvokeKeepaliveIntervalMs,
  runInvokeWithStreamingKeepalive,
  toLangChainMessages
};

/** Mermaid-specialized lookup of the last patch source attempted in this run. */
export function extractLastAttemptedMermaidSource(result) {
  return extractLastAttemptedToolSource(result, 'apply_mermaid_patch');
}
import {
  buildAgentRunBudgetExceededMessage,
  inferMermaidTopKeyword,
  isMermaidTransformConstraintError,
  resolveAgentRepairMaxAttempts,
  resolveAgentRunBudgetMs
} from '@archislop/shared';
import {
  createLlmChatModel,
  createOpenRouterModel,
  isLlmConfigured,
  LlmNotConfiguredError,
  normalizeModelProfile,
  resolveLlmBackend,
  resolveModelId
} from './llmProvider.js';

export {
  createDeepSeekChatModel,
  createOpenRouterModel,
  createVertexChatModel,
  DEFAULT_DEEPSEEK_MODEL_FAST,
  DEFAULT_DEEPSEEK_MODEL_QUALITY,
  DEFAULT_OPENROUTER_MODEL_FAST,
  DEFAULT_OPENROUTER_MODEL_QUALITY,
  DEFAULT_VERTEX_MODEL_FAST,
  DEFAULT_VERTEX_MODEL_QUALITY,
  isLlmConfigured,
  LlmNotConfiguredError,
  normalizeModelProfile,
  resolveDeepSeekModelId,
  resolveLlmBackend,
  resolveModelId,
  resolveOpenRouterModelId,
  resolveVertexModelId
} from './llmProvider.js';
const INTENT_PROFILE_DEFAULTS = {
  temperature: 0.7,
  topP: 1,
  maxNodes: 25,
  styleGuide: 'balanced',
  persona: 'creative architect'
};

import {
  TRANSFORM_MODEL_LIMITS,
  GO_MAD_TRANSFORM_MAX_TOKENS,
  isTransformMode,
  buildFocusScopeInstructions,
  buildAnalyzeFocusInstructions,
  clampGoMadDepth,
  goMadTransformModelOptions,
  transformModeModelOptions,
  buildTransformUserContent,
  buildAdvisorSuggestionBlock,
  ANALYSIS_SYSTEM_PROMPT,
  ANALYSIS_CRITIQUE_SYSTEM_APPEND,
  ANALYSIS_EXPLAIN_SYSTEM_APPEND,
  buildCritiqueTask,
  buildExplainTask
} from './mermaidAnalysisPrompts.js';

export {
  TRANSFORM_MODEL_LIMITS,
  GO_MAD_TRANSFORM_MAX_TOKENS,
  isTransformMode,
  buildFocusScopeInstructions,
  buildAnalyzeFocusInstructions,
  clampGoMadDepth,
  goMadTransformModelOptions,
  transformModeModelOptions,
  buildTransformUserContent
} from './mermaidAnalysisPrompts.js';

export { inferMermaidTopKeyword } from '@archislop/shared';

async function withTransformContext(stateStore, context, fn) {
  stateStore.setTransformContext(context);
  try {
    return await fn();
  } finally {
    stateStore.clearTransformContext();
  }
}

const SYSTEM_PROMPT = `You are ArchiSlop, an agent that helps edit Mermaid diagrams.

When the user asks for a diagram change:
- Prefer the injected current diagram context; call get_diagram_state at most once if you truly need to confirm revision or state.
- Produce complete Mermaid source, not a partial diff.
- For a satisfied request: call apply_mermaid_patch once with the full updated diagram, then briefly summarize what changed in prose only — do not call tools again after an accepted patch (unless the tool returned accepted:false and you must repair).
- Keep valid Mermaid syntax and preserve useful existing nodes unless the user asks to replace them.
- The user cannot call tools. Never ask the user to call get_diagram_state or apply_mermaid_patch.
- Do not mention internal tool names in user-facing replies.
- Short requests like "simplify it", "make it clearer", or "current diagram" refer to the current diagram.

Mode boundary (Mermaid is for relationships and flow):
- Mermaid is the right fit for flowcharts, sequence diagrams, class/state diagrams, ER diagrams, journeys, timelines, gantt — anything where nodes-and-edges or ordered steps carry the meaning.
- If the user is asking for a *data visualization* (bar chart, line chart, scatter, heatmap, etc.), the chart mode (Vega-Lite) is the better fit; you may briefly say so in prose, but still answer in Mermaid if the user explicitly stayed in this mode.
- If the user is asking for a *narrative infographic* (hero numbers, KPI tiles, summary panels), the infographic mode is the better fit; same guidance.

When the user asks a general question, answer concisely.`;

const REPAIR_ERROR_PATTERN =
  /not valid mermaid|validation failed|parser rejected|missing known diagram type/i;

function defaultChatModelFactory(env, options) {
  return createLlmChatModel(env, options);
}

function createCurrentDiagramContextMessage(stateStore) {
  const state = stateStore.getSlot('mermaid');

  return {
    role: 'system',
    content: `Current diagram context:
- revisionId: ${state.revisionId}
- styleConfig: ${JSON.stringify(state.styleConfig)}
- diagramSource:
\`\`\`mermaid
${state.diagramSource}
\`\`\`

Use this as the current diagram when the user's request is short or refers to "it".`
  };
}

/** When switching from Infographic mode, steer the model to translate the peer DSL instead of guessing from topic alone. */
function createPeerInfographicContextMessage(peerDiagramSource) {
  return {
    role: 'system',
    content: `Mode switch / cross-format: the authoritative content to mirror is the peer Infographic DSL below (not the topic text alone). Reproduce the same entities, relationships, steps, and labels as a valid Mermaid diagram. Call apply_mermaid_patch with complete Mermaid source. Preserve a supported init directive when the current diagram already has one.

Peer Infographic DSL:
\`\`\`
${peerDiagramSource}
\`\`\``
  };
}

export function shouldAttemptSyntaxRepair(errorMessage) {
  if (!errorMessage) return false;
  return (
    REPAIR_ERROR_PATTERN.test(errorMessage) ||
    isSyntaxValidationError(errorMessage) ||
    isMermaidTransformConstraintError(errorMessage)
  );
}

export function buildSyntaxRepairInstruction({ messages, errorMessage, brokenSource, previousAttempts }) {
  const originalRequest = toLangChainMessages(messages)
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join('\n\n')
    .trim();

  const diagramType = inferDiagramType(brokenSource ?? '');
  const rulePack = getRulePack(diagramType);
  const typeHint = diagramType ? `Detected diagram type: ${diagramType}.` : 'Diagram type unknown — pick a fitting Mermaid type.';
  const brokenBlock = brokenSource
    ? `\n\nBroken Mermaid source from your previous attempt:\n\`\`\`mermaid\n${brokenSource.trim()}\n\`\`\``
    : '';
  const priorBlock = Array.isArray(previousAttempts) && previousAttempts.length > 0
    ? `\n\nPrior failed attempts in this repair loop (don't repeat the same mistake — try a different fix):\n${previousAttempts
        .slice(-2)
        .map((entry, index) => {
          const err = (entry?.error ?? '').toString().trim().slice(0, 300);
          const src = (entry?.source ?? '').toString().trim();
          return `Attempt ${index + 1} (error: ${err}):\n\`\`\`mermaid\n${src}\n\`\`\``;
        })
        .join('\n\n')}`
    : '';

  return {
    role: 'user',
    content: `Your previous patch failed Mermaid validation.

Validator error:
${errorMessage}

${typeHint}

${rulePack}
Repair instructions:
- Apply the smallest change that fixes the error while preserving the user's intent.
- Call apply_mermaid_patch with complete, valid Mermaid source.
- Do not mention tool names in your final user-facing summary.${brokenBlock}${priorBlock}

Original user request:
${originalRequest || '(No explicit user request provided.)'}`
  };
}

export function buildPatchRequiredInstruction({ messages }) {
  const originalRequest = toLangChainMessages(messages)
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join('\n\n')
    .trim();

  return {
    role: 'user',
    content: `Your previous response did not apply a diagram patch.\n\nRepair instructions:\n- You MUST call apply_mermaid_patch now once with complete, valid Mermaid source, then summarize in prose only (no further tool calls after acceptance).\n- Do not ask the user for more details or scope questions; infer a minimal valid diagram that matches the stated topic or request, then call apply_mermaid_patch.\n- Keep the update smaller if needed so it remains valid.\n- Do not return prose only.\n- Do not mention tool names in your final user-facing summary.\n\nOriginal user request:\n${originalRequest || '(No explicit user request provided.)'}`
  };
}

/** Prepended to agent input when the app requires a diagram patch (prompt-bar Go, transforms, style). Exported for tests. */
export function buildDiagramMutationSystemMessage() {
  return {
    role: 'system',
    content: `Diagram mutation mode (app-enforced):
- The user's message is always an instruction to create or change the Mermaid diagram on the canvas. It is not a request for a tutoring session or a clarification questionnaire unless the text is literally empty or unintelligible gibberish.
- If the request is broad (for example a single topic or concept name), infer a reasonable default scope and diagram type and implement it. Do not refuse or stall by asking the user for more detail instead of drawing.
- Your first successful action is calling apply_mermaid_patch with complete valid Mermaid source. After acceptance, add a brief prose summary only (no further tool calls).
- Even when unsure, prefer a minimal valid overview diagram over prose-only clarification.`
  };
}

/**
 * Builds an advisory system message that injects the active diagram type's rule pack BEFORE the
 * first agent turn — so common foot-guns (style A,B,C; reserved words; ER attr order; classDef on
 * [*]) are warned against on initial generation, not only after a parse failure.
 *
 * For modes that may switch diagram type (innovate / goMad), the rules are marked advisory so the
 * agent doesn't anchor on the wrong type.
 *
 * Exported for tests.
 *
 * @param {{ stateStore: { getSlot: (kind: string) => { diagramSource?: string } }, mode?: string | null }} args
 * @returns {{ role: 'system', content: string } | null}
 */
export function buildSyntaxGuidanceSystemMessage({ stateStore, mode }) {
  const source = stateStore?.getSlot?.('mermaid')?.diagramSource ?? '';
  const detected = inferDiagramType(source);
  if (!detected) return null;
  const rulePack = getRulePack(detected);
  const mayChangeType = mode === 'innovate' || mode === 'goMad';
  const lead = mayChangeType
    ? `Active diagram type: ${detected}. The rules below apply IF you keep this type. If you switch types (allowed in this mode), the rules below no longer apply — use the target type's syntax instead.`
    : `Active diagram type: ${detected}. Apply these rules when generating the patch (don't wait for a parser failure):`;
  return {
    role: 'system',
    content: `${lead}

${rulePack}`
  };
}

function formatAgentInvokeFailure(error, env = process.env) {
  const detail = redactSecrets(error instanceof Error ? error.message : String(error));
  const regionHint = /region|not available in your country|unsupported_country/i.test(detail)
    ? '\n\nIf this is a **region / model availability** issue, set `DEEPSEEK_MODEL*` / `OPENROUTER_MODEL*` / `VERTEX_MODEL*` tier env vars in your server `.env` (for example OpenRouter `qwen/qwen3-32b` or DeepSeek `deepseek-v4-flash`), then restart the API server.\n'
    : '';
  const toolsHint = /tool|tools|function[_ ]?call|parallel_tool|unsupported/i.test(detail)
    ? '\n\nIf failures mention tools or function calling, pick an OpenRouter model that reliably supports agent tool use in your region (for example `qwen/qwen3-30b-a3b` or `qwen/qwen3-32b`).\n'
    : '';
  const vertexHint =
    resolveLlmBackend(env) === 'vertex' && /permission|403|forbidden|iam|aiplatform/i.test(detail)
      ? '\n\nIf you are on **Cloud Run** with Vertex, confirm the runtime service account has `roles/aiplatform.user` and that `aiplatform.googleapis.com` is enabled (see `docs/deploy/gcp.md`).\n'
      : '';
  return {
    message: `**Model request failed**\n\n${detail}${regionHint}${toolsHint}${vertexHint}`,
    raw: null
  };
}

import {
  STREAM_ERROR_NO_MUTATION_REVISION,
  emitIntentTransformStreamResult
} from './_lib/diagramAgentStreamResult.js';

export { STREAM_ERROR_NO_MUTATION_REVISION, emitIntentTransformStreamResult };

/** Above this combined line count the O(M*N) LCS diff gets noticeable; we still emit the artifact but skip the per-line tally. */
const PATCH_SUMMARY_DIFF_MAX_LINES = 800;

function emitPatchSummaryArtifact(emit, stateStore, beforeRevision, beforeSource) {
  if (typeof emit !== 'function') return;
  const after = stateStore.getSlot('mermaid');
  if (after.revisionId === beforeRevision) return;
  const afterSource = after.diagramSource;
  const beforeLineCount = typeof beforeSource === 'string' ? beforeSource.split('\n').length : 0;
  const afterLineCount = typeof afterSource === 'string' ? afterSource.split('\n').length : 0;
  let linesAdded = 0;
  let linesRemoved = 0;
  if (beforeLineCount + afterLineCount <= PATCH_SUMMARY_DIFF_MAX_LINES) {
    const stats = computeLineDiffStats(beforeSource, afterSource);
    linesAdded = stats.linesAdded;
    linesRemoved = stats.linesRemoved;
  }
  emit({
    type: 'artifact',
    kind: 'patch_summary',
    revisionId: after.revisionId,
    linesAdded,
    linesRemoved
  });
}

async function invokeWithRepair(
  agent,
  messages,
  {
    requirePatch = false,
    emit,
    mode,
    profile,
    modelLabel,
    stableAgent,
    peerContext,
    abortSignal,
    focusNode = null
  } = {},
  stateStore,
  env
) {
  const initialSnap = stateStore.getSlot('mermaid');
  const beforeRevision = initialSnap.revisionId;
  const beforeSource = initialSnap.diagramSource;
  const peerInfographicPreface =
    peerContext?.contentType === 'infographic' && typeof peerContext.diagramSource === 'string'
      ? [createPeerInfographicContextMessage(peerContext.diagramSource)]
      : [];
  const syntaxGuidance = requirePatch
    ? buildSyntaxGuidanceSystemMessage({ stateStore, mode })
    : null;
  const baseMessages = [
    ...(requirePatch ? [buildDiagramMutationSystemMessage()] : []),
    ...(syntaxGuidance ? [syntaxGuidance] : []),
    ...peerInfographicPreface,
    createCurrentDiagramContextMessage(stateStore),
    ...toLangChainMessages(messages)
  ];

  const turnStarted = Date.now();
  const runProfile = normalizeModelProfile(profile);
  const runBudgetMs = resolveAgentRunBudgetMs(runProfile, env, mode);
  let repairAttempts = 0;
  /** @param {{accepted: boolean, validator?: string | null, errorClass?: string | null}} sample */
  const finishTurn = (sample) => {
    recordAgentTurn(
      {
        mode: mode ?? 'unknown',
        model: modelLabel ?? null,
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

  const stopReason = () => {
    if (abortSignal?.aborted) {
      return {
        code: 'run_aborted',
        message: 'Agent run was stopped before completion.',
        errorClass: 'run-aborted'
      };
    }
    if (Date.now() - turnStarted >= runBudgetMs) {
      return {
        code: 'run_budget_exceeded',
        message: buildAgentRunBudgetExceededMessage(runProfile, runBudgetMs),
        errorClass: 'budget-exceeded'
      };
    }
    return null;
  };

  const finishStoppedRun = (reason, raw = null) => {
    if (typeof emit === 'function' && reason.code === 'run_budget_exceeded') {
      emit({ type: 'error', code: reason.code, message: reason.message });
    }
    finishTurn({ accepted: false, errorClass: reason.errorClass });
    return { message: reason.message, raw };
  };

  const initialStop = stopReason();
  if (initialStop) {
    return finishStoppedRun(initialStop);
  }

  if (typeof emit === 'function') {
    emitServerMutationPlanBeats({
      emit,
      stateStore,
      mode,
      messages,
      focusNode,
      peerContext,
      contentType: 'mermaid'
    });
    emit({ type: 'phase', id: 'agent_run', label: 'Planning and executing tools…' });
  }

  let firstResult;
  try {
    firstResult = await runAgentTurn({
      agent,
      inputMessages: baseMessages,
      emit,
      env,
      abortSignal,
      patchToolName: 'apply_mermaid_patch',
      contentType: 'mermaid',
      emitDraftPreview: false
    });
  } catch (error) {
    finishTurn({ accepted: false, errorClass: 'invoke-error' });
    return formatAgentInvokeFailure(error, env);
  }

  const firstMessage = extractFinalMessage(firstResult);
  const afterFirstRevision = stateStore.getSlot('mermaid').revisionId;
  const firstError = extractToolFailureError(firstResult);

  if (afterFirstRevision !== beforeRevision) {
    emitPatchSummaryArtifact(emit, stateStore, beforeRevision, beforeSource);
    finishTurn({ accepted: true, validator: 'first-try' });
    return {
      message: firstMessage,
      raw: firstResult
    };
  }

  if (requirePatch && !firstError) {
    // When the first agent turn produces prose without calling apply_mermaid_patch (or, worse,
    // produces incoherent high-temperature token soup as Go Mad sometimes does at deeper tiers),
    // re-running the same hot agent against the same prompt usually just produces the same
    // failure. Fall back to a stable agent (typically the fast non-transform agent at sane
    // temperature) when one was provided. This is the no-patch analogue of the syntax fixer.
    const retryAgent = stableAgent ?? agent;
    const usingStable = retryAgent !== agent;
    try {
      const retryStop = stopReason();
      if (retryStop) return finishStoppedRun(retryStop, firstResult);
      if (typeof emit === 'function') {
        emitPlanBeat(
          emit,
          usingStable
            ? 'First pass did not land a patch — retrying with a steadier model to apply your diagram change.'
            : 'First pass did not land a patch — retrying to apply your diagram change.',
          'server'
        );
        emit({ type: 'phase', id: 'patch_retry', label: 'Retrying diagram patch…' });
        emit({
          type: 'status',
          text: usingStable
            ? 'Retrying with stable model: diagram patch required…'
            : 'Retrying: diagram patch required…'
        });
      }
      const patchRetryResult = await runAgentTurn({
        agent: retryAgent,
        inputMessages: [...baseMessages, buildPatchRequiredInstruction({ messages })],
        emit,
        env,
        abortSignal,
        patchToolName: 'apply_mermaid_patch',
        contentType: 'mermaid',
        emitDraftPreview: false
      });
      if (stateStore.getSlot('mermaid').revisionId !== beforeRevision) {
        emitPatchSummaryArtifact(emit, stateStore, beforeRevision, beforeSource);
        finishTurn({ accepted: true, validator: usingStable ? 'patch-retry-stable' : 'patch-retry' });
        return {
          message: extractFinalMessage(patchRetryResult),
          raw: patchRetryResult
        };
      }
      finishTurn({ accepted: false, errorClass: 'no-patch' });
      return {
        message: extractFinalMessage(patchRetryResult),
        raw: patchRetryResult
      };
    } catch (error) {
      finishTurn({ accepted: false, errorClass: 'invoke-error' });
      return formatAgentInvokeFailure(error, env);
    }
  }

  if (!shouldAttemptSyntaxRepair(firstError)) {
    finishTurn({ accepted: false, errorClass: classifyAgentTurnError(firstError) });
    return {
      message: firstMessage,
      raw: firstResult
    };
  }

  let latestError = firstError;
  let latestResult = firstResult;
  let brokenSource = extractLastAttemptedMermaidSource(firstResult);
  const originalRequest = toLangChainMessages(messages)
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n\n')
    .trim();

  // Tool-less single-shot fixer using a cheap fast model. Independent of the intent/transform
  // model so repair runs on a small model regardless of caller profile. If the fixer accepts,
  // apply through the same patch pipeline (which re-validates and runs the sanitizer once more
  // for safety) and short-circuit the agent loop.
  if (brokenSource && isSyntaxFixerAvailable(env)) {
    try {
      const fixerStop = stopReason();
      if (fixerStop) return finishStoppedRun(fixerStop, firstResult);
      repairAttempts += 1;
      if (typeof emit === 'function') {
        emitPlanBeat(
          emit,
          'Previous patch failed validation — running a quick syntax pass before asking the agent again.',
          'server'
        );
        emit({ type: 'phase', id: 'syntax_fixer', label: 'Mermaid syntax fixer…' });
      }
      const fixerOutcome = await repairMermaidWithFixer({
        brokenSource,
        parseError: latestError,
        originalRequest,
        env
        // No previousAttempts on first fixer call — this is the first repair pass.
      });
      if (fixerOutcome.accepted && fixerOutcome.diagramSource) {
        const applied = await stateStore.applyDiagramSource({
          contentType: 'mermaid',
          diagramSource: fixerOutcome.diagramSource,
          reason: 'syntax-fixer repair'
        });
        if (applied?.accepted) {
          emitPatchSummaryArtifact(emit, stateStore, beforeRevision, beforeSource);
          finishTurn({ accepted: true, validator: 'syntax-fixer' });
          return {
            message: firstMessage || 'Done.',
            raw: firstResult,
            metadata: { repairedBy: 'syntax-fixer', diagramType: fixerOutcome.metadata?.diagramType ?? null }
          };
        }
        // Fixer's source was valid in isolation but the state store rejected it (unlikely);
        // fall through to the full-agent repair loop with that error as new context.
        latestError = applied?.error ?? latestError;
      } else if (fixerOutcome.error) {
        // Use the fixer's diagnostic to better seed the full-agent repair on fallback.
        latestError = `${latestError}\nFixer diagnostic: ${fixerOutcome.error}`;
      }
    } catch (error) {
      // Telemetry only — fixer failures must never break the repair fallback.
      latestError = `${latestError}\nFixer exception: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  const maxRepairAttempts = resolveAgentRepairMaxAttempts(runProfile, env, 'mermaid');
  const repairAgent = stableAgent ?? agent;

  const repairHistory = [];
  for (let attempt = 1; attempt <= maxRepairAttempts; attempt += 1) {
    repairAttempts += 1;
    let retryResult;
    try {
      const repairStop = stopReason();
      if (repairStop) return finishStoppedRun(repairStop, latestResult);
      if (typeof emit === 'function') {
        emitPlanBeat(
          emit,
          `Repairing invalid Mermaid while keeping your intent (attempt ${attempt} of ${maxRepairAttempts}).`,
          'server'
        );
        emit({ type: 'phase', id: 'syntax_repair', label: `Syntax repair (attempt ${attempt} of ${maxRepairAttempts})…` });
        emit({ type: 'status', text: `Repairing Mermaid syntax (attempt ${attempt} of ${maxRepairAttempts})…` });
      }
      retryResult = await runAgentTurn({
        agent: repairAgent,
        inputMessages: [
          ...baseMessages,
          buildSyntaxRepairInstruction({
            messages,
            errorMessage: latestError,
            brokenSource,
            previousAttempts: repairHistory.slice(-2)
          })
        ],
        emit,
        env,
        abortSignal,
        patchToolName: 'apply_mermaid_patch',
        contentType: 'mermaid',
        emitDraftPreview: false
      });
    } catch (error) {
      finishTurn({ accepted: false, errorClass: 'invoke-error' });
      return formatAgentInvokeFailure(error, env);
    }
    latestResult = retryResult;

    const currentRevision = stateStore.getSlot('mermaid').revisionId;
    if (currentRevision !== beforeRevision) {
      emitPatchSummaryArtifact(emit, stateStore, beforeRevision, beforeSource);
      finishTurn({ accepted: true, validator: `repair-attempt-${attempt}` });
      return {
        message: extractFinalMessage(retryResult),
        raw: retryResult
      };
    }

    const retryError = extractToolFailureError(retryResult);
    if (!shouldAttemptSyntaxRepair(retryError)) {
      break;
    }
    // Record this failed attempt before moving on so the next iteration's prompt
    // can show the agent what it already tried.
    repairHistory.push({ source: brokenSource ?? '', error: latestError ?? '' });
    latestError = retryError;
    const nextBroken = extractLastAttemptedMermaidSource(retryResult);
    if (nextBroken) brokenSource = nextBroken;
  }

  finishTurn({ accepted: false, errorClass: classifyAgentTurnError(latestError) });
  return {
    message: extractFinalMessage(latestResult),
    raw: latestResult
  };
}

export function createMermaidLangChainAgent({
  stateStore,
  env = process.env,
  createAgentImpl = createAgent,
  chatModelFactory = defaultChatModelFactory
}) {
  const tools = createDiagramTools({ stateStore });
  const cache = createDiagramAgentCache({
    env,
    systemPrompt: SYSTEM_PROMPT,
    tools,
    chatModelFactory,
    createAgentImpl,
    middleware: createDiagramAgentMiddleware(env)
  });

  /** Prompt-bar Go (`applyIntent`) and generic `invoke` — does not use transform/Go Mad sampling. */
  const getDefaultAgent = cache.getDefaultAgent;

  /** Shape buttons Refine / Innovate / Go Mad / Align — hotter tiers apply only to Go Mad via `goMadTransformModelOptions`. */
  function getTransformAgent(mode, profile = 'fast', goMadDepth) {
    const safeMode = isTransformMode(mode) ? mode : 'refine';
    return cache.getTransformAgent(safeMode, profile, goMadDepth);
  }

  const getAnalysisModel = cache.getAnalysisModel;
  const chatModelFor = cache.chatModelFor;
  const resolveModelLabel = cache.resolveModelLabel;

  async function invokeMutation(agent, userMessages, opts, emit) {
    return invokeWithRepair(
      agent,
      userMessages,
      { ...opts, emit },
      stateStore,
      env
    );
  }

  return {
    async invoke({ messages, modelProfile }) {
      const agent = getDefaultAgent(modelProfile);
      return invokeWithRepair(
        agent,
        messages,
        {
          mode: 'invoke',
          profile: normalizeModelProfile(modelProfile),
          modelLabel: resolveModelLabel(modelProfile)
        },
        stateStore,
        env
      );
    },

    async applyIntent({ prompt, settings, focusNode, modelProfile, emit, peerContext, abortSignal }) {
      const resolvedSettings = { ...INTENT_PROFILE_DEFAULTS, ...settings };
      const focusScope = buildFocusScopeInstructions(focusNode);

      const userContent = `Interpret and apply the user's requested diagram change strictly according to their wording.

Broad or short requests (for example a single topic name) still require a concrete diagram now: choose a sensible default overview (main entities and flows) instead of asking the user for clarification.

Settings (response shaping only):
- temperature: ${resolvedSettings.temperature}
- topP: ${resolvedSettings.topP}
- maxNodes: ${resolvedSettings.maxNodes}
- styleGuide: ${resolvedSettings.styleGuide}
- persona: ${resolvedSettings.persona}

User request:
${prompt}${focusScope}`;

      const agent = getDefaultAgent(modelProfile);
      return invokeMutation(
        agent,
        [{ role: 'user', content: userContent }],
        {
          requirePatch: true,
          mode: 'go',
          profile: normalizeModelProfile(modelProfile),
          modelLabel: resolveModelLabel(modelProfile),
          stableAgent: getDefaultAgent('fast'),
          peerContext,
          abortSignal,
          focusNode
        },
        emit
      );
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
      const depth = mode === 'goMad' ? clampGoMadDepth(goMadDepth ?? 1) : null;
      return withTransformContext(
        stateStore,
        { mode, goMadDepth: depth },
        async () => {
          const currentState = stateStore.getSlot('mermaid');
          const transformAgent = getTransformAgent(mode, modelProfile, goMadDepth);
          const focusScope = buildFocusScopeInstructions(focusNode);

          return invokeMutation(
            transformAgent,
            [
              {
                role: 'user',
                content: buildTransformUserContent({
                  mode,
                  diagramSource: currentState.diagramSource,
                  focusScope,
                  goMadDepth,
                  advisorPrompt
                })
              }
            ],
            {
              requirePatch: true,
              mode,
              profile: normalizeModelProfile(modelProfile),
              modelLabel: resolveModelLabel(modelProfile),
              // Hot Go Mad (and Innovate at temp 0.82) agents can produce prose-without-patch or
              // high-entropy token soup at deeper tiers. Fall back to the stable fast non-transform
              // agent for the patch_retry turn so we're not just rolling the same dice twice.
              stableAgent: getDefaultAgent('fast'),
              abortSignal,
              focusNode
            },
            emit
          );
        }
      );
    },

    async applyStyleIntent({ prompt, settings }) {
      const resolvedSettings = { ...INTENT_PROFILE_DEFAULTS, ...settings };
      const currentState = stateStore.getSlot('mermaid');

      return invokeWithRepair(
        getDefaultAgent('fast'),
        [
          {
            role: 'user',
            content: `Apply a visual styling update to the current Mermaid diagram.\n\nHard requirements:\n- Preserve the diagram structure and all semantic nodes and edges unless the user explicitly asks to change them.\n- You MUST keep or add a top Mermaid init directive in this exact supported form: %%{init: {...}}%%.\n- Use valid JSON inside the init directive.\n- You may update theme, look, themeVariables, themeCSS, and flowchart.curve.\n- You may add Mermaid classDef and class lines only for visual styling.\n- You MUST call apply_mermaid_patch with the full Mermaid source.\n- Do not return only text; apply the style patch.\n\nCurrent committed diagram:\n\`\`\`mermaid\n${currentState.diagramSource}\n\`\`\`\n\nCurrent style config:\n${JSON.stringify(currentState.styleConfig)}\n\nRespect these settings for response style only:\n- temperature: ${resolvedSettings.temperature}\n- topP: ${resolvedSettings.topP}\n- maxNodes: ${resolvedSettings.maxNodes}\n- styleGuide: ${resolvedSettings.styleGuide}\n- persona: ${resolvedSettings.persona}\n\nUser style request:\n${prompt}`
          }
        ],
        {
          requirePatch: true,
          mode: 'style',
          profile: 'fast',
          modelLabel: resolveModelLabel('fast')
        },
        stateStore,
        env
      );
    },

    async applyAnalyzeIntent({ kind, focusNode, modelProfile, emit, advisorPrompt }) {
      const state = stateStore.getSlot('mermaid');
      const focusScope = buildAnalyzeFocusInstructions(focusNode, kind);
      const stakeholderBlock = buildAdvisorSuggestionBlock(advisorPrompt);
      const task =
        kind === 'critique'
          ? buildCritiqueTask(focusNode, focusScope, state.diagramSource)
          : buildExplainTask(focusNode, focusScope, state.diagramSource);
      const scopedTask = stakeholderBlock ? `${task}${stakeholderBlock}` : task;
      const humanPrefix = focusNode?.id ? `${focusScope.trim()}\n\n` : '';
      const diagramBlock = `\`\`\`mermaid\n${state.diagramSource}\n\`\`\``;

      const profile = normalizeModelProfile(modelProfile);
      const backend = resolveLlmBackend(env);
      const modelId = resolveModelId(env, profile, backend);
      let analysisModel = getAnalysisModel(backend, modelId, kind);

      const analysisSystem =
        kind === 'critique'
          ? `${ANALYSIS_SYSTEM_PROMPT}${ANALYSIS_CRITIQUE_SYSTEM_APPEND}`
          : `${ANALYSIS_SYSTEM_PROMPT}${ANALYSIS_EXPLAIN_SYSTEM_APPEND}`;
      const messages = [
        new SystemMessage(analysisSystem),
        new HumanMessage(`${humanPrefix}${scopedTask}\n\n${diagramBlock}`)
      ];

      if (typeof emit === 'function') {
        emit({ type: 'phase', id: 'analyze_stream', label: 'Streaming analysis…' });
        let fullText = '';
        try {
          const stream = await analysisModel.stream(messages);
          for await (const chunk of stream) {
            const piece =
              extractTextContent(chunk?.content) ||
              extractTextContent(chunk?.kwargs?.content) ||
              (typeof chunk?.text === 'string' ? chunk.text : '');
            if (piece) {
              fullText += piece;
              emit({ type: 'token', text: piece });
            }
          }
        } catch (error) {
          emit({
            type: 'error',
            message: redactSecrets(error instanceof Error ? error.message : String(error))
          });
          if (backend === 'vertex' && env.OPENROUTER_API_KEY) {
            const orModel = resolveOpenRouterModelId(env, profile);
            analysisModel = createOpenRouterModel(env, {
              model: orModel,
              temperature: kind === 'critique' ? 0.52 : 0.42,
              maxTokens: 1800
            });
            try {
              const stream2 = await analysisModel.stream(messages);
              let fullText2 = '';
              for await (const chunk of stream2) {
                const piece =
                  extractTextContent(chunk?.content) ||
                  extractTextContent(chunk?.kwargs?.content) ||
                  (typeof chunk?.text === 'string' ? chunk.text : '');
                if (piece) {
                  fullText2 += piece;
                  emit({ type: 'token', text: piece });
                }
              }
              return { message: fullText2.trim() || 'Done.', raw: null };
            } catch {
              // fall through to invoke attempts
            }
          }
          const fallback = await analysisModel.invoke(messages).catch(() => null);
          const text = fallback ? extractTextContent(fallback.content) : '';
          return { message: text || 'Analysis failed.', raw: null };
        }
        return { message: fullText.trim() || 'Done.', raw: null };
      }

      const response = await analysisModel.invoke(messages);
      return {
        message: extractTextContent(response.content).trim() || 'Done.',
        raw: response
      };
    }
  };
}

/**
 * Lazy wrapper that defers agent construction until the first call.
 * Satisfies {@link import('@archislop/shared').DiagramAgentService} with
 * `invoke` and `applyStyleIntent` — both mermaid-only optional methods.
 */
export function createLazyMermaidAgentService({ stateStore, env = process.env }) {
  return createLazyAgentService({
    contentType: 'mermaid',
    stateStore,
    env,
    buildService: () => createMermaidLangChainAgent({ stateStore, env }),
    streamLabels: {
      analyze: 'Analyzing diagram…',
      intent: 'Applying your request…',
      transform: 'Transforming diagram…'
    },
    transformExtraFields: ['advisorPrompt'],
    analyzeExtraFields: ['advisorPrompt'],
    supportsInvoke: true,
    supportsStyleIntent: true
  });
}

export { INTENT_PROFILE_DEFAULTS };
