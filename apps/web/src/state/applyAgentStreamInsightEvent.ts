import {
  LEGACY_STREAM_TYPE_A2UI,
  LEGACY_STREAM_TYPE_CONTENT_TYPE,
  normalizeContentType,
  resolveCritiqueAnalyzeFinalText,
  formatModelUsageDetail,
  formatModelUsageWithCost,
  type AgentCostEstimatesPayload,
  type A2uiV09Message,
  type DiagramState,
  type LegacyErrorEvent,
  type LegacyFinalEvent,
  type LegacyStatusEvent,
  type LegacyStreamEvent,
  type LegacyTokenEvent,
  type LegacyToolEndEvent,
  type LegacyToolStartEvent,
  type LegacyToolApplyResultEvent
} from '@archislop/shared';
import { resolveAgentStreamFailureStatus } from '../utils/agentStreamFailureStatus.js';
import { getActiveControlsCopy } from '../i18n/activeControlsCopy.js';
import { summarizeInsightNowStatus } from '../utils/insightNowStatus.js';
import {
  coercePatchApplyDisplayStats,
  formatPatchApplyDetail
} from '../utils/formatTechnicalActionDetail.js';

const AUTO_DIAGRAM_CHANGE_HIGHLIGHT_PENDING_TIMEOUT_MS = 10000;
const AUTO_DIAGRAM_HIGHLIGHT_VARIANTS = new Set(['intent', 'refine', 'erlich', 'goMad']);

function normalizeInsightTextForDedup(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function shouldAppendFinalInsightEcho(
  streamedText: string,
  finalMessage: string | undefined
): boolean {
  const msg = (finalMessage ?? '').trim();
  if (!msg) return false;
  const stream = (streamedText ?? '').trim();
  if (!stream) return true;

  const nMsg = normalizeInsightTextForDedup(msg);
  const nStream = normalizeInsightTextForDedup(stream);
  if (!nMsg) return false;
  if (nStream === nMsg) return false;
  const minSuffixLen = 64;
  if (nMsg.length >= minSuffixLen && nStream.endsWith(nMsg)) return false;
  return true;
}

export type InsightStreamAccumulator = { text: string; estimatedCostUsd: number };

type InsightPhaseRecord = {
  id?: unknown;
  label?: unknown;
  at?: number;
  endAt?: number;
  serverAt?: number;
  serverEndAt?: number;
  [key: string]: unknown;
};

/** Stamp `endAt` on every phase still open, so per-phase durations freeze. */
export function closeOpenInsightPhases(
  phases: unknown,
  endAt: number,
  serverEndAt?: number
): InsightPhaseRecord[] {
  const list = Array.isArray(phases) ? (phases as InsightPhaseRecord[]) : [];
  return list.map((phase) =>
    phase && typeof phase === 'object' && phase.endAt == null && Number.isFinite(phase.at)
      ? { ...phase, endAt, ...(serverEndAt != null ? { serverEndAt } : {}) }
      : phase
  );
}

export type InsightEventContext = {
  sectionId: string;
  operation?: string;
  variant?: string;
  diagramUndoBaseline?: unknown;
  patchInsightEntry: (
    id: string,
    fn: (entry: Record<string, unknown>) => Record<string, unknown>
  ) => void;
  appendToInsight: (id: string, text: string) => void;
  setInsightStatus: (id: string, text: string) => void;
  appendTechnicalAction: (
    id: string,
    name: string,
    status: string,
    opts?: { toolCallId?: string; contextNote?: string; modelName?: string }
  ) => void;
  annotateTechnicalActionResult: (
    id: string,
    name: string,
    opts?: { validationError?: string; toolCallId?: string }
  ) => void;
  finalizeTechnicalActionResult: (
    id: string,
    name: string,
    opts?: {
      status?: 'done' | 'rejected';
      validationError?: string;
      outcomeDetail?: string;
      toolCallId?: string;
    }
  ) => void;
  enrichTechnicalActionDetail: (
    id: string,
    name: string,
    opts?: {
      toolCallId?: string;
      patchStats?: Record<string, unknown>;
      outcomeDetail?: string;
    }
  ) => void;
  lastTokenSoundAtRef: { current: number };
  goMadTokenTickIndexRef: { current: number };
  lastDraftTickAtRef: { current: number };
  tryAgentSound: (fn: ((audioCtx: AudioContext) => void) | (() => void)) => void;
  playGoMadTokenTick?: (audioCtx: AudioContext, idx: number) => void;
  playTokenTickChime?: () => void;
  playToolStartChime?: () => void;
  playToolEndChime?: () => void;
  playDraftTick?: () => void;
  playFailureChime?: () => void;
  playPhaseChangePluck?: () => void;
  playRefineTokenTick?: () => void;
  playErlichTokenTick?: (audioCtx: AudioContext, idx: number) => void;
  playCritiqueTokenTick?: () => void;
  playExplainTokenTick?: () => void;
  playRefinePolishLoop?: () => void;
  playErlichSynthLoop?: () => void;
  playGoMadKlaxonLoop?: () => void;
  playGoMadAirhornBlast?: () => void;
  playCritiqueScribbleLoop?: () => void;
  playCritiquePenStab?: () => void;
  playExplainPageFlipLoop?: () => void;
  setLiveDraftSource: (source: string) => void;
  setLiveDraftContentType: (ct: string | null) => void;
  setGoMadStreak?: (fn: (s: number) => number) => void;
  sessionTopicRef?: { current: string | null };
  crossModeSyncRef?: { current: Record<string, unknown> };
  modeSwitchSync?: boolean;
  modeSwitchPeerRevisionId?: number | null;
  modeSwitchPeerMode?: string | null;
  animateAcceptedSource: (
    state: unknown,
    onDone?: () => void,
    opts?: { denseSteps?: boolean }
  ) => void;
  pendingAutoDiagramHighlightRef: { current: { entryId: string; revisionId: number } | null };
  pendingAutoDiagramHighlightTimeoutRef: { current: ReturnType<typeof setTimeout> | null };
  triggerCompletionDelight: (
    sectionId: string,
    variant: string | undefined,
    extras?: { runCostUsd?: number }
  ) => void;
  onFinal?: (args: { evt: LegacyStreamEvent; finalText: string; sectionId: string }) => void;
  onA2uiMessages?: (messages: A2uiV09Message[], sectionId: string) => void;
  /** Auto mode: server resolved a concrete slot — switch the UI mode picker. */
  onContentTypeResolved?: (args: {
    contentType: string;
    reason?: string;
    sectionId: string;
  }) => void;
  agentCostEstimates?: AgentCostEstimatesPayload | null;
};

/** Reduces post-translator legacy stream events into insights/draft/sound updates. */
export function applyAgentStreamInsightEvent(
  streamAcc: InsightStreamAccumulator,
  ctx: InsightEventContext,
  evt: LegacyStreamEvent | null | undefined
): void {
  if (!evt || typeof evt !== 'object') return;
  if (!Number.isFinite(streamAcc.estimatedCostUsd)) streamAcc.estimatedCostUsd = 0;

  const {
    sectionId,
    operation,
    variant,
    diagramUndoBaseline,
    patchInsightEntry,
    appendToInsight,
    setInsightStatus,
    appendTechnicalAction,
    annotateTechnicalActionResult,
    finalizeTechnicalActionResult,
    enrichTechnicalActionDetail,
    lastTokenSoundAtRef,
    goMadTokenTickIndexRef,
    lastDraftTickAtRef,
    tryAgentSound,
    playGoMadTokenTick,
    playTokenTickChime,
    playToolStartChime,
    playToolEndChime,
    playDraftTick,
    playFailureChime,
    playPhaseChangePluck,
    playRefineTokenTick,
    playErlichTokenTick,
    playCritiqueTokenTick,
    playExplainTokenTick,
    playRefinePolishLoop,
    playErlichSynthLoop,
    playGoMadKlaxonLoop,
    playGoMadAirhornBlast,
    playCritiqueScribbleLoop,
    playCritiquePenStab,
    playExplainPageFlipLoop,
    setLiveDraftSource,
    setLiveDraftContentType,
    setGoMadStreak,
    sessionTopicRef,
    crossModeSyncRef,
    modeSwitchSync,
    modeSwitchPeerRevisionId,
    modeSwitchPeerMode,
    animateAcceptedSource,
    pendingAutoDiagramHighlightRef,
    pendingAutoDiagramHighlightTimeoutRef,
    triggerCompletionDelight,
    onFinal,
    onContentTypeResolved
  } = ctx;

  if (evt.type === LEGACY_STREAM_TYPE_CONTENT_TYPE) {
    const contentType =
      typeof (evt as { contentType?: unknown }).contentType === 'string'
        ? String((evt as { contentType: string }).contentType).trim()
        : '';
    if (!contentType) return;
    const reason =
      typeof (evt as { reason?: unknown }).reason === 'string'
        ? String((evt as { reason: string }).reason).trim()
        : '';
    patchInsightEntry(sectionId, (entry) => ({
      ...entry,
      contentType: normalizeContentType(contentType),
      ...(reason
        ? {
            statusText: reason,
            autoModeReason: reason
          }
        : {})
    }));
    if (typeof onContentTypeResolved === 'function') {
      onContentTypeResolved({ contentType, reason: reason || undefined, sectionId });
    }
    return;
  }

  if (evt.type === 'phase' && 'id' in evt && evt.id && 'label' in evt && evt.label) {
    const now = Date.now();
    const serverAt = typeof evt.timestamp === 'number' ? evt.timestamp : undefined;
    patchInsightEntry(sectionId, (entry) => {
      // A new phase implicitly closes the previous one — stamp its end so the
      // timeline can show how long the run stayed in each step.
      const previous = closeOpenInsightPhases(entry.phases, now, serverAt);
      return {
        ...entry,
        phases: [
          ...previous,
          { id: evt.id, label: evt.label, at: now, ...(serverAt != null ? { serverAt } : {}) }
        ],
        lastPhaseChangedAt: now
      };
    });
    if (typeof playPhaseChangePluck === 'function') {
      tryAgentSound(playPhaseChangePluck);
    }
    if (variant === 'critique' && typeof playCritiquePenStab === 'function') {
      tryAgentSound(playCritiquePenStab);
    } else if (variant === 'goMad') {
      if (Math.random() < 0.18 && typeof playGoMadAirhornBlast === 'function') {
        tryAgentSound(playGoMadAirhornBlast);
      } else if (typeof playGoMadKlaxonLoop === 'function') {
        tryAgentSound(playGoMadKlaxonLoop);
      }
    } else if (variant === 'erlich' && typeof playErlichSynthLoop === 'function') {
      if (Math.random() < 0.5) tryAgentSound(playErlichSynthLoop);
    } else if (variant === 'refine' && typeof playRefinePolishLoop === 'function') {
      if (Math.random() < 0.45) tryAgentSound(playRefinePolishLoop);
    } else if (variant === 'explain' && typeof playExplainPageFlipLoop === 'function') {
      if (Math.random() < 0.45) tryAgentSound(playExplainPageFlipLoop);
    } else if (variant === 'critique' && typeof playCritiqueScribbleLoop === 'function') {
      if (Math.random() < 0.4) tryAgentSound(playCritiqueScribbleLoop);
    }
  } else if (evt.type === 'phase_end') {
    const endNow = Date.now();
    const serverEndAt = typeof evt.timestamp === 'number' ? evt.timestamp : undefined;
    const phaseId = typeof (evt as { id?: unknown }).id === 'string' ? String(evt.id) : '';
    patchInsightEntry(sectionId, (entry) => {
      const list = Array.isArray(entry.phases) ? (entry.phases as InsightPhaseRecord[]) : [];
      let idx = -1;
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const p = list[i];
        if (!p || typeof p !== 'object' || p.endAt != null) continue;
        if (phaseId && p.id !== phaseId) continue;
        idx = i;
        break;
      }
      if (idx < 0) return entry;
      const phases = list.map((p, i) =>
        i === idx ? { ...p, endAt: endNow, ...(serverEndAt != null ? { serverEndAt } : {}) } : p
      );
      return { ...entry, phases };
    });
  } else if (evt.type === 'artifact' && evt.kind === 'patch_summary') {
    patchInsightEntry(sectionId, (entry) => {
      const previousArtifacts = Array.isArray(entry.artifacts) ? entry.artifacts : [];
      const artifact = {
        kind: evt.kind,
        revisionId: evt.revisionId,
        linesAdded: evt.linesAdded,
        linesRemoved: evt.linesRemoved
      };
      const currentActions = Array.isArray(entry.technicalActions) ? entry.technicalActions : [];
      const patchActionIndex = [...currentActions]
        .reverse()
        .findIndex(
          (action) => /patch/i.test(String(action?.name ?? '')) && action?.status === 'done'
        );
      let technicalActions = currentActions;
      if (patchActionIndex >= 0) {
        const realIndex = currentActions.length - 1 - patchActionIndex;
        const action = currentActions[realIndex] as Record<string, unknown>;
        const existingStats = action.patchStats;
        const patchStats = {
          ...(existingStats && typeof existingStats === 'object'
            ? (existingStats as Record<string, unknown>)
            : {}),
          linesAdded: evt.linesAdded ?? 0,
          linesRemoved: evt.linesRemoved ?? 0,
          revisionId: evt.revisionId
        };
        const outcomeDetail = formatPatchApplyDetail(
          coercePatchApplyDisplayStats(
            patchStats,
            typeof action.durationMs === 'number' ? action.durationMs : undefined
          )
        );
        technicalActions = currentActions.map((item, idx) =>
          idx === realIndex
            ? {
                ...item,
                patchStats,
                ...(outcomeDetail ? { outcomeDetail } : {})
              }
            : item
        );
      }
      return {
        ...entry,
        artifacts: [...previousArtifacts, artifact],
        technicalActions
      };
    });
  } else if (evt.type === 'artifact' && evt.kind === 'explain_sections') {
    const sections = Array.isArray(evt.sections) ? evt.sections : [];
    if (sections.length > 0) {
      patchInsightEntry(sectionId, (entry) => ({
        ...entry,
        explainSections: {
          contentType: normalizeContentType(evt.contentType),
          preamble: typeof evt.preamble === 'string' ? evt.preamble : '',
          sections
        }
      }));
    }
  } else if (evt.type === 'artifact' && evt.kind === 'style_edits') {
    const edits = Array.isArray(evt.edits) ? evt.edits : [];
    if (edits.length > 0) {
      patchInsightEntry(sectionId, (entry) => ({
        ...entry,
        styleEdits: edits
      }));
    }
  } else if (
    evt.type === LEGACY_STREAM_TYPE_A2UI &&
    Array.isArray(evt.messages) &&
    evt.messages.length > 0
  ) {
    const surfaceId =
      evt.messages[0]?.createSurface?.surfaceId ?? evt.messages[0]?.updateComponents?.surfaceId;
    const isStyleEditsSurface = surfaceId === 'style-edits';
    patchInsightEntry(sectionId, (entry) => ({
      ...entry,
      ...(isStyleEditsSurface
        ? { styleEditsA2uiMessages: evt.messages }
        : { a2uiMessages: evt.messages })
    }));
    if (typeof ctx.onA2uiMessages === 'function') {
      ctx.onA2uiMessages(evt.messages, sectionId);
    }
  } else if (evt.type === 'token') {
    const tokenEvt = evt as LegacyTokenEvent;
    if (!tokenEvt.text) return;
    streamAcc.text += tokenEvt.text;
    appendToInsight(sectionId, tokenEvt.text);
    const now = Date.now();
    const reduceMotion =
      typeof globalThis.matchMedia === 'function' &&
      globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const goMadDense = variant === 'goMad' && !reduceMotion;
    const minGapMs = goMadDense ? 140 : 210;
    if (now - lastTokenSoundAtRef.current >= minGapMs) {
      lastTokenSoundAtRef.current = now;
      if (goMadDense && playGoMadTokenTick) {
        const idx = goMadTokenTickIndexRef.current;
        goMadTokenTickIndexRef.current = idx + 1;
        tryAgentSound((audioCtx) => playGoMadTokenTick(audioCtx, idx));
      } else if (variant === 'refine' && typeof playRefineTokenTick === 'function') {
        tryAgentSound(playRefineTokenTick);
      } else if (variant === 'erlich' && playErlichTokenTick) {
        const idx = goMadTokenTickIndexRef.current;
        goMadTokenTickIndexRef.current = idx + 1;
        tryAgentSound((audioCtx) => playErlichTokenTick(audioCtx, idx));
      } else if (variant === 'critique' && typeof playCritiqueTokenTick === 'function') {
        tryAgentSound(playCritiqueTokenTick);
      } else if (variant === 'explain' && typeof playExplainTokenTick === 'function') {
        tryAgentSound(playExplainTokenTick);
      } else if (typeof playTokenTickChime === 'function') {
        tryAgentSound(playTokenTickChime);
      }
    }
  } else if (evt.type === 'status') {
    const statusEvt = evt as LegacyStatusEvent;
    if (!statusEvt.text) return;
    setInsightStatus(
      sectionId,
      summarizeInsightNowStatus(
        statusEvt.text,
        { statusText: statusEvt.text },
        getActiveControlsCopy().insights
      )
    );
  } else if (evt.type === 'plan_beat' && evt.text) {
    const text = String(evt.text).trim();
    const source = evt.source === 'agent' ? 'agent' : 'server';
    if (!text) return;
    patchInsightEntry(sectionId, (entry) => {
      const beats = Array.isArray(entry.planBeats)
        ? ([...(entry.planBeats as { text: string; source: string; at: number }[])] as {
            text: string;
            source: string;
            at: number;
          }[])
        : [];
      const last = beats.length > 0 ? beats[beats.length - 1] : null;
      if (source === 'agent' && last?.source === 'agent') {
        beats[beats.length - 1] = { text, source, at: Date.now() };
      } else if (!beats.some((b) => b.text === text)) {
        beats.push({ text, source, at: Date.now() });
      }
      return { ...entry, planBeats: beats };
    });
    setInsightStatus(
      sectionId,
      summarizeInsightNowStatus(text, { statusText: text }, getActiveControlsCopy().insights)
    );
  } else if (evt.type === 'tool_start') {
    const toolEvt = evt as LegacyToolStartEvent;
    if (!toolEvt.name) return;
    appendTechnicalAction(sectionId, toolEvt.name, 'running', {
      ...(toolEvt.id ? { toolCallId: toolEvt.id } : {})
    });
    if (typeof playToolStartChime === 'function') tryAgentSound(playToolStartChime);
  } else if (evt.type === 'tool_end') {
    const toolEvt = evt as LegacyToolEndEvent;
    appendTechnicalAction(sectionId, toolEvt.name ?? '', 'done', {
      ...(toolEvt.id ? { toolCallId: toolEvt.id } : {})
    });
    if (typeof playToolEndChime === 'function') tryAgentSound(playToolEndChime);
  } else if (evt.type === 'tool_apply_result') {
    const resultEvt = evt as LegacyToolApplyResultEvent;
    if (!resultEvt.name) return;
    if (resultEvt.accepted === false && resultEvt.error) {
      annotateTechnicalActionResult(sectionId, resultEvt.name, {
        validationError: resultEvt.error,
        ...(resultEvt.id ? { toolCallId: resultEvt.id } : {})
      });
      return;
    }
    if (resultEvt.accepted !== true) return;
    const patchStats = {
      revisionId: resultEvt.revisionId,
      reason: resultEvt.reason,
      validator: resultEvt.validator,
      sanitizerApplied: resultEvt.sanitizerApplied,
      linesAdded: resultEvt.linesAdded,
      linesRemoved: resultEvt.linesRemoved,
      nodesAdded: resultEvt.nodesAdded,
      nodesRemoved: resultEvt.nodesRemoved,
      edgesAdded: resultEvt.edgesAdded,
      edgesRemoved: resultEvt.edgesRemoved
    };
    enrichTechnicalActionDetail(sectionId, resultEvt.name, {
      ...(resultEvt.id ? { toolCallId: resultEvt.id } : {}),
      patchStats
    });
  } else if (evt.type === 'model_call_start') {
    const callEvt = evt as { type: 'model_call_start'; callId?: string; model?: string };
    appendTechnicalAction(sectionId, 'model_call', 'running', {
      ...(callEvt.callId ? { toolCallId: callEvt.callId } : {}),
      ...(callEvt.model ? { modelName: callEvt.model } : {})
    });
  } else if (evt.type === 'model_call_end') {
    const callEvt = evt as {
      type: 'model_call_end';
      callId?: string;
      model?: string;
      inputTokens?: number;
      outputTokens?: number;
    };
    const costConfig = ctx.agentCostEstimates?.enabled ? ctx.agentCostEstimates : null;
    const { costUsd } = formatModelUsageWithCost(
      {
        inputTokens: callEvt.inputTokens,
        outputTokens: callEvt.outputTokens,
        model: callEvt.model
      },
      costConfig?.rates ?? null
    );
    const usageDetail = formatModelUsageDetail({
      inputTokens: callEvt.inputTokens,
      outputTokens: callEvt.outputTokens
    });
    finalizeTechnicalActionResult(sectionId, 'model_call', {
      status: 'done',
      ...(callEvt.callId ? { toolCallId: callEvt.callId } : {}),
      ...(usageDetail ? { outcomeDetail: usageDetail } : {})
    });
    if (costUsd != null && costUsd > 0) {
      streamAcc.estimatedCostUsd += costUsd;
      patchInsightEntry(sectionId, (entry) => ({
        ...entry,
        estimatedCostUsd:
          (typeof entry.estimatedCostUsd === 'number' && Number.isFinite(entry.estimatedCostUsd)
            ? entry.estimatedCostUsd
            : 0) + costUsd
      }));
    }
  } else if (evt.type === 'syntax_fixer_start') {
    const startEvt = evt as { type: 'syntax_fixer_start'; triggerError?: string };
    const triggerError =
      typeof startEvt.triggerError === 'string' ? startEvt.triggerError.trim() : '';
    appendTechnicalAction(sectionId, 'syntax_fixer', 'running', {
      ...(triggerError ? { contextNote: triggerError } : {})
    });
  } else if (evt.type === 'syntax_fixer_result') {
    const resultEvt = evt as {
      type: 'syntax_fixer_result';
      outcome: 'repaired' | 'fixer_failed' | 'store_rejected';
      error?: string;
      detail?: string;
    };
    if (resultEvt.outcome === 'repaired') {
      const syntaxCopy = getActiveControlsCopy().insights?.syntaxFixer;
      finalizeTechnicalActionResult(sectionId, 'syntax_fixer', {
        status: 'done',
        outcomeDetail:
          (typeof resultEvt.detail === 'string' && resultEvt.detail.trim()) ||
          syntaxCopy?.repaired ||
          'Repaired invalid DSL and applied the patch.'
      });
      return;
    }
    const syntaxCopy = getActiveControlsCopy().insights?.syntaxFixer;
    const errorText =
      (typeof resultEvt.error === 'string' && resultEvt.error.trim()) ||
      (resultEvt.outcome === 'store_rejected'
        ? syntaxCopy?.rejected || 'Syntax fixer output was rejected by validation.'
        : syntaxCopy?.failed || 'Syntax fixer could not repair the source.');
    finalizeTechnicalActionResult(sectionId, 'syntax_fixer', {
      status: 'rejected',
      validationError: errorText
    });
  } else if (evt.type === 'draftPreview') {
    const draftSource =
      typeof evt.source === 'string' && evt.source
        ? evt.source
        : typeof evt.accumulated === 'string'
          ? evt.accumulated
          : '';
    if (
      (evt.contentType === 'infographic' ||
        evt.contentType === 'metaphor3d' ||
        evt.contentType === 'chart' ||
        evt.contentType === 'anything') &&
      draftSource
    ) {
      setLiveDraftSource(draftSource);
      setLiveDraftContentType(evt.contentType);
      const tickNow = Date.now();
      if (tickNow - lastDraftTickAtRef.current >= 110) {
        lastDraftTickAtRef.current = tickNow;
        if (typeof playDraftTick === 'function') tryAgentSound(playDraftTick);
      }
    }
  } else if (evt.type === 'error') {
    const errEvt = evt as LegacyErrorEvent;
    if (!errEvt.message) return;
    appendToInsight(
      sectionId,
      `\n\n**${getActiveControlsCopy().insights?.errorPrefix ?? 'Error'}:** ${errEvt.message}\n\n`
    );
    if (errEvt.code !== 'no_mutation_revision' && typeof playFailureChime === 'function') {
      tryAgentSound(playFailureChime);
    }
    setLiveDraftSource('');
    setLiveDraftContentType(null);
    const failureCopy = getActiveControlsCopy().insights?.streamFailures;
    const failure = resolveAgentStreamFailureStatus({
      operation,
      code: errEvt.code,
      message: errEvt.message,
      copy: failureCopy
    });
    patchInsightEntry(sectionId, (entry) => ({
      ...entry,
      status: 'failed',
      statusText: failure.statusText,
      failureClass: failure.failureClass,
      failureDetail: failure.detail,
      completedAt: Date.now(),
      phases: closeOpenInsightPhases(
        entry.phases,
        Date.now(),
        typeof evt.timestamp === 'number' ? evt.timestamp : undefined
      )
    }));
  } else if (evt.type === 'final') {
    const finalEvt = evt as LegacyFinalEvent;
    const finalState = finalEvt.state as DiagramState | undefined;
    setLiveDraftSource('');
    setLiveDraftContentType(null);
    const mutationBlocked =
      (operation === 'transform' || operation === 'intent') && finalEvt.revisionChanged === false;
    if (variant === 'goMad' && finalEvt.revisionChanged && setGoMadStreak) {
      setGoMadStreak((s) => s + 1);
    }
    if (finalEvt.revisionChanged && finalState?.lastUserPrompt && sessionTopicRef) {
      sessionTopicRef.current = finalState.lastUserPrompt;
    }
    if (finalEvt.revisionChanged && finalState && crossModeSyncRef) {
      if (modeSwitchSync && modeSwitchPeerRevisionId != null && modeSwitchPeerMode) {
        const contentType = normalizeContentType(finalState.contentType);
        crossModeSyncRef.current = {
          ...crossModeSyncRef.current,
          [contentType]: {
            peerMode: modeSwitchPeerMode,
            peerRevisionId: modeSwitchPeerRevisionId,
            targetRevisionId: finalState.revisionId ?? 0
          }
        };
      } else if (!modeSwitchSync) {
        crossModeSyncRef.current = {
          mermaid: null,
          infographic: null,
          metaphor3d: null,
          chart: null,
          forms: null,
          anything: null
        };
      }
    }
    if (finalEvt.revisionChanged && finalState) {
      const shouldAutoHighlight =
        Boolean(diagramUndoBaseline) && AUTO_DIAGRAM_HIGHLIGHT_VARIANTS.has(variant ?? '');
      animateAcceptedSource(
        finalState,
        shouldAutoHighlight
          ? () => {
              pendingAutoDiagramHighlightRef.current = {
                entryId: sectionId,
                revisionId: finalState.revisionId
              };
              if (typeof globalThis.window !== 'undefined') {
                if (pendingAutoDiagramHighlightTimeoutRef.current != null) {
                  globalThis.window.clearTimeout(pendingAutoDiagramHighlightTimeoutRef.current);
                }
                pendingAutoDiagramHighlightTimeoutRef.current = globalThis.window.setTimeout(() => {
                  pendingAutoDiagramHighlightTimeoutRef.current = null;
                  const stillPending = pendingAutoDiagramHighlightRef.current;
                  if (!stillPending || stillPending.entryId !== sectionId) return;
                  pendingAutoDiagramHighlightRef.current = null;
                }, AUTO_DIAGRAM_CHANGE_HIGHLIGHT_PENDING_TIMEOUT_MS);
              }
            }
          : undefined,
        { denseSteps: variant === 'goMad' }
      );
    }
    if (
      finalEvt.message &&
      operation !== 'analyze' &&
      shouldAppendFinalInsightEcho(streamAcc.text, finalEvt.message)
    ) {
      appendToInsight(sectionId, `\n\n— _${finalEvt.message}_`);
    }
    const failureStatus = mutationBlocked
      ? resolveAgentStreamFailureStatus({
          operation,
          code: 'no_mutation_revision',
          message: finalEvt.message,
          copy: getActiveControlsCopy().insights?.streamFailures
        })
      : null;
    const runCostUsd =
      streamAcc.estimatedCostUsd > 0 && Number.isFinite(streamAcc.estimatedCostUsd)
        ? streamAcc.estimatedCostUsd
        : 0;
    patchInsightEntry(sectionId, (entry) => ({
      ...entry,
      status: mutationBlocked ? 'failed' : 'done',
      statusText:
        mutationBlocked && failureStatus
          ? failureStatus.statusText
          : (getActiveControlsCopy().insights?.streamDone ?? 'Done'),
      ...(mutationBlocked && failureStatus
        ? {
            failureClass: failureStatus.failureClass,
            failureDetail: failureStatus.detail
          }
        : {}),
      completedAt: Date.now(),
      phases: closeOpenInsightPhases(
        entry.phases,
        Date.now(),
        typeof evt.timestamp === 'number' ? evt.timestamp : undefined
      ),
      ...(finalEvt.revisionChanged && finalState && entry.diagramUndoBaseline
        ? {
            diagramRevisionApplied: true,
            diagramAfterSource:
              typeof finalState.diagramSource === 'string' ? finalState.diagramSource : null,
            diagramAfterContentType: finalState.contentType ?? null,
            diagramAfterRevisionId: finalState.revisionId ?? null
          }
        : {})
    }));
    if (!mutationBlocked) {
      triggerCompletionDelight(sectionId, variant, { runCostUsd });
    } else if (typeof playFailureChime === 'function') {
      tryAgentSound(playFailureChime);
    }
    if (typeof onFinal === 'function') {
      const finalText =
        operation === 'analyze' && variant === 'critique'
          ? resolveCritiqueAnalyzeFinalText(streamAcc.text, finalEvt.analyzeText)
          : streamAcc.text.trim() ||
            (typeof finalEvt.analyzeText === 'string' ? finalEvt.analyzeText.trim() : '');
      if (operation === 'analyze' && variant === 'critique' && finalText) {
        patchInsightEntry(sectionId, (entry) => ({ ...entry, content: finalText }));
      }
      onFinal({ evt: finalEvt, finalText, sectionId });
    }
  }
}
