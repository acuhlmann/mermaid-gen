import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { createAgent } from 'langchain';
import { createDiagramTools } from './diagramTools.js';
import { isSyntaxValidationError, looksLikeMermaid } from './mermaidReliabilitySkill.js';
import {
  appendLanguageInstruction,
  appendProseLanguageInstruction,
  MATCH_USER_LANGUAGE_RULE
} from '@archislop/shared';
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
  emitSyntaxFixerResult,
  emitSyntaxFixerStart,
  emitSyntaxFixerModelCall
} from './syntaxFixerTelemetry.js';
import {
  captureMessagesFromStreamEvent,
  extractFinalMessage,
  extractLastAttemptedToolSource,
  extractToolFailureError,
  normalizeAgentStreamEvent,
  streamChatModelToClient,
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

/**
 * First non-blank, non-`%%` line of a candidate source. Init directives
 * (%%{init: …}%%) and %% comments legally precede the diagram declaration,
 * so the type check has to skip past them.
 */
function firstMeaningfulMermaidLine(text) {
  for (const line of String(text ?? '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('%%')) continue;
    return trimmed;
  }
  return '';
}

const FENCED_BLOCK_PATTERN = /```([A-Za-z0-9_-]*)[^\S\n]*\n([\s\S]*?)```/g;

/**
 * Some models emit the diagram as a fenced block in prose instead of calling
 * apply_mermaid_patch — the dominant failure of hot transform turns (Russ).
 * Mirror of the prose-recovery extractors in the anything/chart/infographic/
 * metaphor agents: salvage that source so the caller can route it through the
 * normal validation pipeline instead of paying a full patch-retry model turn.
 */
export function extractMermaidFromAssistantResult(result) {
  const messages = result?.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    const isAssistant =
      m?._getType?.() === 'ai' ||
      m?.type === 'ai' ||
      m?.role === 'assistant' ||
      m?.kwargs?.role === 'assistant';
    if (!isAssistant) continue;
    const raw = extractTextContent(m?.content ?? m?.kwargs?.content ?? '');
    if (!raw?.trim()) continue;
    for (const match of raw.matchAll(FENCED_BLOCK_PATTERN)) {
      const lang = (match[1] ?? '').toLowerCase();
      if (lang && lang !== 'mermaid') continue;
      const body = (match[2] ?? '').trim();
      if (body && looksLikeMermaid(firstMeaningfulMermaidLine(body))) return body;
    }
    const bare = raw.trim();
    if (!bare.includes('```') && looksLikeMermaid(firstMeaningfulMermaidLine(bare))) {
      return bare;
    }
  }
  return null;
}
import {
  appendLastValidationError,
  buildAgentRunBudgetExceededMessage,
  isMermaidTransformConstraintError,
  MIN_AGENT_REPAIR_TURN_BUDGET_MS,
  MIN_SYNTAX_FIXER_BUDGET_MS,
  resolveAgentRepairAttemptProfile,
  resolveAgentRepairMaxAttempts,
  resolveAgentRunBudgetMs
} from '@archislop/shared';
import { createRunDeadlineSignal } from './_lib/agentRunDeadline.js';
import {
  createLlmChatModel,
  createOpenRouterModel,
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
  resolveDecorativeModelLabel,
  resolveLlmBackend,
  resolveLlmModelLabel,
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
  RUSS_TRANSFORM_MAX_TOKENS,
  isTransformMode,
  buildFocusScopeInstructions,
  buildAnalyzeFocusInstructions,
  clampRussDepth,
  russTransformModelOptions,
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
  RUSS_TRANSFORM_MAX_TOKENS,
  isTransformMode,
  buildFocusScopeInstructions,
  buildAnalyzeFocusInstructions,
  clampRussDepth,
  russTransformModelOptions,
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

${MATCH_USER_LANGUAGE_RULE}
- When the user's request is in Chinese (or another non-English language), keep all diagram labels, node text, and prose summaries in that same language — never translate unprompted.

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

export function buildSyntaxRepairInstruction({
  messages,
  errorMessage,
  brokenSource,
  previousAttempts
}) {
  const originalRequest = toLangChainMessages(messages)
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join('\n\n')
    .trim();

  const diagramType = inferDiagramType(brokenSource ?? '');
  const rulePack = getRulePack(diagramType);
  const typeHint = diagramType
    ? `Detected diagram type: ${diagramType}.`
    : 'Diagram type unknown — pick a fitting Mermaid type.';
  const brokenBlock = brokenSource
    ? `\n\nBroken Mermaid source from your previous attempt:\n\`\`\`mermaid\n${brokenSource.trim()}\n\`\`\``
    : '';
  const priorBlock =
    Array.isArray(previousAttempts) && previousAttempts.length > 0
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
 * For modes that may switch diagram type (erlich / russ), the rules are marked advisory so the
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
  const mayChangeType = mode === 'erlich' || mode === 'russ';
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
    resolveRepairAgent = null,
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
  // Every model turn shares this deadline-capped signal so an in-flight call cannot
  // overrun the run budget; `abortSignal` stays untouched for user-stop detection.
  const runSignal = createRunDeadlineSignal({
    abortSignal,
    budgetMs: runBudgetMs,
    startedAt: turnStarted
  });
  let repairAttempts = 0;
  /** @param {{accepted: boolean, validator?: string | null, errorClass?: string | null}} sample */
  const finishTurn = (sample) => {
    recordAgentTurn(
      {
        contentType: 'mermaid',
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

  /**
   * @param {number} [minRemainingMs] Stop early when less than this much budget remains —
   * starting a unit of work that cannot finish inside the budget only delays the failure.
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

  const finishStoppedRun = (reason, raw = null, lastValidationError = null) => {
    // Carry the last validator diagnostic into the failure message so the UI can show
    // WHY the run ran out of time (what was invalid), not just that it timed out.
    const message = appendLastValidationError(reason.message, lastValidationError);
    if (typeof emit === 'function' && reason.code === 'run_budget_exceeded') {
      emit({ type: 'error', code: reason.code, message });
    }
    finishTurn({ accepted: false, errorClass: reason.errorClass });
    return { message, raw, metadata: { error: lastValidationError ?? null, code: reason.code } };
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
      abortSignal: runSignal,
      patchToolName: 'apply_mermaid_patch',
      contentType: 'mermaid',
      emitDraftPreview: false,
      modelFallback: modelLabel ?? ''
    });
  } catch (error) {
    const stop = stopReason();
    if (stop) return finishStoppedRun(stop);
    finishTurn({ accepted: false, errorClass: 'invoke-error' });
    return formatAgentInvokeFailure(error, env);
  }

  let firstMessage = extractFinalMessage(firstResult);
  const afterFirstRevision = stateStore.getSlot('mermaid').revisionId;
  let firstError = extractToolFailureError(firstResult);

  if (afterFirstRevision !== beforeRevision) {
    emitPatchSummaryArtifact(emit, stateStore, beforeRevision, beforeSource);
    finishTurn({ accepted: true, validator: 'first-try' });
    return {
      message: firstMessage,
      raw: firstResult
    };
  }

  // Prose recovery — the same salvage every other diagram agent does: when the model
  // pasted the diagram into prose instead of calling apply_mermaid_patch, route that
  // source through the normal validation pipeline before paying a full patch-retry
  // model turn. A rejected candidate still helps: it seeds the syntax fixer / repair
  // loop with a concrete broken source instead of re-rolling the same dice.
  let proseBrokenSource = null;
  if (requirePatch && !firstError) {
    const proseMermaid = extractMermaidFromAssistantResult(firstResult);
    if (proseMermaid) {
      const applied = await stateStore.applyDiagramSource({
        contentType: 'mermaid',
        diagramSource: proseMermaid,
        reason: 'prose-mermaid recovery'
      });
      if (applied?.accepted) {
        emitPatchSummaryArtifact(emit, stateStore, beforeRevision, beforeSource);
        finishTurn({ accepted: true, validator: 'prose-mermaid-recovery' });
        return {
          message: firstMessage,
          raw: firstResult,
          metadata: { validator: 'prose-mermaid-recovery' }
        };
      }
      firstError = applied?.error ?? 'Mermaid validation failed.';
      proseBrokenSource = proseMermaid;
    }
  }

  if (requirePatch && !firstError) {
    // When the first agent turn produces prose without calling apply_mermaid_patch (or, worse,
    // produces incoherent high-temperature token soup as Russ sometimes does at deeper tiers),
    // re-running the same hot agent against the same prompt usually just produces the same
    // failure. Fall back to a stable agent (typically the fast non-transform agent at sane
    // temperature) when one was provided. This is the no-patch analogue of the syntax fixer.
    const retryAgent = stableAgent ?? agent;
    const usingStable = retryAgent !== agent;
    try {
      const retryStop = stopReason(MIN_AGENT_REPAIR_TURN_BUDGET_MS);
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
        abortSignal: runSignal,
        patchToolName: 'apply_mermaid_patch',
        contentType: 'mermaid',
        emitDraftPreview: false,
        modelFallback: modelLabel ?? ''
      });
      if (stateStore.getSlot('mermaid').revisionId !== beforeRevision) {
        emitPatchSummaryArtifact(emit, stateStore, beforeRevision, beforeSource);
        finishTurn({
          accepted: true,
          validator: usingStable ? 'patch-retry-stable' : 'patch-retry'
        });
        return {
          message: extractFinalMessage(patchRetryResult),
          raw: patchRetryResult
        };
      }
      const patchRetryError = extractToolFailureError(patchRetryResult);
      if (patchRetryError && shouldAttemptSyntaxRepair(patchRetryError)) {
        // A patch landed on the retry turn but failed validation — seed the syntax
        // fixer / quality-escalation loop instead of stopping as "no patch".
        firstError = patchRetryError;
        firstResult = patchRetryResult;
        firstMessage = extractFinalMessage(patchRetryResult);
        const retryBroken = extractLastAttemptedMermaidSource(patchRetryResult);
        if (retryBroken) proseBrokenSource = retryBroken;
      } else {
        finishTurn({
          accepted: false,
          errorClass: patchRetryError ? classifyAgentTurnError(patchRetryError) : 'no-patch'
        });
        return {
          message: extractFinalMessage(patchRetryResult),
          raw: patchRetryResult,
          metadata: { error: patchRetryError ?? null }
        };
      }
    } catch (error) {
      const stop = stopReason();
      if (stop) return finishStoppedRun(stop, firstResult);
      finishTurn({ accepted: false, errorClass: 'invoke-error' });
      return formatAgentInvokeFailure(error, env);
    }
  }

  if (!shouldAttemptSyntaxRepair(firstError)) {
    finishTurn({ accepted: false, errorClass: classifyAgentTurnError(firstError) });
    return {
      message: firstError ? `Diagram update failed: ${firstError}` : firstMessage,
      raw: firstResult,
      metadata: { error: firstError ?? null }
    };
  }

  let latestError = firstError;
  let latestResult = firstResult;
  let brokenSource = extractLastAttemptedMermaidSource(firstResult) ?? proseBrokenSource;
  const originalRequest = toLangChainMessages(messages)
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n\n')
    .trim();

  // Tool-less single-shot fixer using a cheap fast model. Independent of the intent/transform
  // model so repair runs on a small model regardless of caller profile. If the fixer accepts,
  // apply through the same patch pipeline (which re-validates and runs the sanitizer once more
  // for safety) and short-circuit the agent loop. Transform-policy rejections (e.g. Russ
  // tier ≥3 "switch diagram type") are semantic constraints the low-temperature syntax fixer
  // cannot satisfy — routing them there is guaranteed wasted budget, so those go straight to
  // the full-agent repair turn.
  if (
    brokenSource &&
    isSyntaxFixerAvailable(env) &&
    !isMermaidTransformConstraintError(latestError)
  ) {
    try {
      const fixerStop = stopReason(MIN_SYNTAX_FIXER_BUDGET_MS);
      if (fixerStop) return finishStoppedRun(fixerStop, firstResult, latestError);
      repairAttempts += 1;
      emitSyntaxFixerStart(emit, { contentType: 'mermaid', triggerError: latestError });
      const fixerOutcome = await repairMermaidWithFixer({
        brokenSource,
        parseError: latestError,
        originalRequest,
        env,
        abortSignal: runSignal,
        onModelCall: (usage) => emitSyntaxFixerModelCall(emit, usage)
        // No previousAttempts on first fixer call — this is the first repair pass.
      });
      if (fixerOutcome.accepted && fixerOutcome.diagramSource) {
        const applied = await stateStore.applyDiagramSource({
          contentType: 'mermaid',
          diagramSource: fixerOutcome.diagramSource,
          reason: 'syntax-fixer repair'
        });
        if (applied?.accepted) {
          emitSyntaxFixerResult(emit, {
            contentType: 'mermaid',
            outcome: 'repaired',
            detail: 'Repaired invalid diagram source and applied the patch.'
          });
          emitPatchSummaryArtifact(emit, stateStore, beforeRevision, beforeSource);
          finishTurn({ accepted: true, validator: 'syntax-fixer' });
          return {
            message: firstMessage || 'Done.',
            raw: firstResult,
            metadata: {
              repairedBy: 'syntax-fixer',
              diagramType: fixerOutcome.metadata?.diagramType ?? null
            }
          };
        }
        // Fixer's source was valid in isolation but the state store rejected it (unlikely);
        // fall through to the full-agent repair loop with that error as new context.
        latestError = applied?.error ?? latestError;
        emitSyntaxFixerResult(emit, {
          contentType: 'mermaid',
          outcome: 'store_rejected',
          error: applied?.error ?? 'Diagram validation failed after syntax fixer.'
        });
      } else if (fixerOutcome.error) {
        // Use the fixer's diagnostic to better seed the full-agent repair on fallback.
        latestError = `${latestError}\nFixer diagnostic: ${fixerOutcome.error}`;
        emitSyntaxFixerResult(emit, {
          contentType: 'mermaid',
          outcome: 'fixer_failed',
          error: fixerOutcome.error
        });
      } else {
        emitSyntaxFixerResult(emit, {
          contentType: 'mermaid',
          outcome: 'fixer_failed',
          error: 'Syntax fixer could not repair the diagram source.'
        });
      }
    } catch (error) {
      // Telemetry only — fixer failures must never break the repair fallback.
      const exceptionMessage = error instanceof Error ? error.message : String(error);
      latestError = `${latestError}\nFixer exception: ${exceptionMessage}`;
      emitSyntaxFixerResult(emit, {
        contentType: 'mermaid',
        outcome: 'fixer_failed',
        error: exceptionMessage
      });
    }
  }

  const maxRepairAttempts = resolveAgentRepairMaxAttempts(runProfile, env, 'mermaid');

  const repairHistory = [];
  for (let attempt = 1; attempt <= maxRepairAttempts; attempt += 1) {
    repairAttempts += 1;
    const repairProfile = resolveAgentRepairAttemptProfile(runProfile, attempt);
    // Attempt 1+ climbs to Quality regardless of Brain (see resolveAgentRepairAttemptProfile).
    let repairAgent = stableAgent ?? agent;
    if (typeof resolveRepairAgent === 'function') {
      const escalated = resolveRepairAgent(repairProfile, attempt);
      if (escalated) repairAgent = escalated;
    } else if (repairProfile === 'quality' && stableAgent && stableAgent !== agent) {
      // No resolver — stay on the incoming agent when climbing isn't possible.
      repairAgent = agent;
    }
    const repairBackend = resolveLlmBackend(env, repairProfile);
    const repairModelFallback = repairBackend
      ? `${repairBackend}:${resolveModelId(env, repairProfile, repairBackend)}`
      : (modelLabel ?? '');
    let retryResult;
    try {
      const repairStop = stopReason(MIN_AGENT_REPAIR_TURN_BUDGET_MS);
      if (repairStop) return finishStoppedRun(repairStop, latestResult, latestError);
      if (typeof emit === 'function') {
        const tierNote = repairProfile === 'quality' ? ' (quality model)' : '';
        emitPlanBeat(
          emit,
          `Repairing invalid Mermaid while keeping your intent (attempt ${attempt} of ${maxRepairAttempts})${tierNote}.`,
          'server'
        );
        emit({
          type: 'phase',
          id: 'syntax_repair',
          label: `Syntax repair (attempt ${attempt} of ${maxRepairAttempts})…`
        });
        emit({
          type: 'status',
          text: `Repairing Mermaid syntax (attempt ${attempt} of ${maxRepairAttempts})${tierNote}…`
        });
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
        abortSignal: runSignal,
        patchToolName: 'apply_mermaid_patch',
        contentType: 'mermaid',
        emitDraftPreview: false,
        modelFallback: repairModelFallback
      });
    } catch (error) {
      const stop = stopReason();
      if (stop) return finishStoppedRun(stop, latestResult, latestError);
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
      // Keep the freshest diagnostic (e.g. a transform-constraint or stale-revision error)
      // so the exhausted-run message below reports the real blocker.
      if (retryError) latestError = retryError;
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
  // Repair attempts exhausted — return the validator's root cause instead of the model's
  // prose so the UI (and chat reply) shows exactly what was invalid in the DSL.
  return {
    message: latestError
      ? `Diagram update failed: ${latestError}`
      : extractFinalMessage(latestResult),
    raw: latestResult,
    metadata: { error: latestError ?? null }
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

  /** Prompt-bar Go (`applyIntent`) and generic `invoke` — does not use transform/Russ sampling. */
  const getDefaultAgent = cache.getDefaultAgent;

  /** Shape buttons Gilfoyle / Erlich / Russ / Align — hotter tiers apply only to Russ via `russTransformModelOptions`. */
  function getTransformAgent(mode, profile = 'fast', russDepth) {
    const safeMode = isTransformMode(mode) ? mode : 'gilfoyle';
    return cache.getTransformAgent(safeMode, profile, russDepth);
  }

  const getAnalysisModel = cache.getAnalysisModel;
  const chatModelFor = cache.chatModelFor;
  const resolveModelLabel = cache.resolveModelLabel;

  async function invokeMutation(agent, userMessages, opts, emit) {
    return invokeWithRepair(agent, userMessages, { ...opts, emit }, stateStore, env);
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

    async applyIntent({
      prompt,
      settings,
      focusNode,
      modelProfile,
      emit,
      peerContext,
      abortSignal,
      uiLocale
    }) {
      const resolvedSettings = { ...INTENT_PROFILE_DEFAULTS, ...settings };
      const focusScope = buildFocusScopeInstructions(focusNode);

      const userContent = appendLanguageInstruction(
        `Interpret and apply the user's requested diagram change strictly according to their wording.

Broad or short requests (for example a single topic name) still require a concrete diagram now: choose a sensible default overview (main entities and flows) instead of asking the user for clarification.

Settings (response shaping only):
- temperature: ${resolvedSettings.temperature}
- topP: ${resolvedSettings.topP}
- maxNodes: ${resolvedSettings.maxNodes}
- styleGuide: ${resolvedSettings.styleGuide}
- persona: ${resolvedSettings.persona}

User request:
${prompt}${focusScope}`,
        prompt,
        stateStore.getSlot('mermaid').diagramSource,
        { uiLocale }
      );

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
          resolveRepairAgent: (profile) => getDefaultAgent(profile),
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
      russDepth,
      abortSignal,
      advisorPrompt,
      uiLocale
    }) {
      const depth = mode === 'russ' ? clampRussDepth(russDepth ?? 1) : null;
      return withTransformContext(stateStore, { mode, russDepth: depth }, async () => {
        const currentState = stateStore.getSlot('mermaid');
        const transformAgent = getTransformAgent(mode, modelProfile, russDepth);
        const focusScope = buildFocusScopeInstructions(focusNode);

        return invokeMutation(
          transformAgent,
          [
            {
              role: 'user',
              content: appendLanguageInstruction(
                buildTransformUserContent({
                  mode,
                  diagramSource: currentState.diagramSource,
                  focusScope,
                  russDepth,
                  advisorPrompt
                }),
                currentState.lastUserPrompt,
                currentState.diagramSource,
                advisorPrompt,
                { uiLocale }
              )
            }
          ],
          {
            requirePatch: true,
            mode,
            profile: normalizeModelProfile(modelProfile),
            modelLabel: resolveModelLabel(modelProfile),
            // Hot Russ (and Erlich at temp 0.82) agents can produce prose-without-patch or
            // high-entropy token soup at deeper tiers. Fall back to the stable fast non-transform
            // agent for the patch_retry turn so we're not just rolling the same dice twice.
            stableAgent: getDefaultAgent('fast'),
            resolveRepairAgent: (profile) => getDefaultAgent(profile),
            abortSignal,
            focusNode
          },
          emit
        );
      });
    },

    async applyStyleIntent({ prompt, settings, abortSignal }) {
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
          modelLabel: resolveModelLabel('fast'),
          resolveRepairAgent: (profile) => getDefaultAgent(profile),
          abortSignal
        },
        stateStore,
        env
      );
    },

    async applyAnalyzeIntent({ kind, focusNode, modelProfile, emit, advisorPrompt, uiLocale }) {
      const state = stateStore.getSlot('mermaid');
      const focusScope = buildAnalyzeFocusInstructions(focusNode, kind);
      const stakeholderBlock = buildAdvisorSuggestionBlock(advisorPrompt);
      const task =
        kind === 'jared'
          ? buildCritiqueTask(focusNode, focusScope, state.diagramSource)
          : buildExplainTask(focusNode, focusScope, state.diagramSource);
      const scopedTask = stakeholderBlock ? `${task}${stakeholderBlock}` : task;
      const humanPrefix = focusNode?.id ? `${focusScope.trim()}\n\n` : '';
      const diagramBlock = `\`\`\`mermaid\n${state.diagramSource}\n\`\`\``;
      const analysisBody = appendProseLanguageInstruction(
        `${humanPrefix}${scopedTask}\n\n${diagramBlock}`,
        state.lastUserPrompt,
        state.diagramSource,
        advisorPrompt,
        { uiLocale }
      );

      const profile = normalizeModelProfile(modelProfile);
      const backend = resolveLlmBackend(env, profile);
      const modelId = resolveModelId(env, profile, backend);
      let analysisModel = getAnalysisModel(backend, modelId, kind);

      const analysisSystem =
        kind === 'jared'
          ? `${ANALYSIS_SYSTEM_PROMPT}${ANALYSIS_CRITIQUE_SYSTEM_APPEND}`
          : `${ANALYSIS_SYSTEM_PROMPT}${ANALYSIS_EXPLAIN_SYSTEM_APPEND}`;
      const messages = [new SystemMessage(analysisSystem), new HumanMessage(analysisBody)];

      if (typeof emit === 'function') {
        emit({ type: 'phase', id: 'analyze_stream', label: 'Streaming analysis…' });
        let fullText = '';
        try {
          fullText = await streamChatModelToClient(analysisModel, messages, emit, {
            modelId,
            callId: `analyze-mermaid-${kind}`
          });
        } catch (error) {
          emit({
            type: 'error',
            message: redactSecrets(error instanceof Error ? error.message : String(error))
          });
          if (backend === 'vertex' && env.OPENROUTER_API_KEY) {
            const orModel = resolveOpenRouterModelId(env, profile);
            analysisModel = createOpenRouterModel(env, {
              model: orModel,
              temperature: kind === 'jared' ? 0.52 : 0.42,
              maxTokens: 1800
            });
            try {
              fullText = await streamChatModelToClient(analysisModel, messages, emit, {
                modelId: orModel,
                callId: `analyze-mermaid-${kind}-fallback`
              });
              return { message: fullText.trim() || 'Done.', raw: null };
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
