import { AGUI_EVENT_TYPE, isAgUiWireEvent } from './agUiEventTypes.js';
import type { LegacyStreamEvent } from './legacyStreamEvents.js';
import {
  AGUI_CUSTOM_NAME_A2UI,
  AGUI_CUSTOM_NAME_ARTIFACT,
  AGUI_CUSTOM_NAME_CONTENT_TYPE,
  AGUI_CUSTOM_NAME_LEGACY,
  AGUI_CUSTOM_NAME_MODEL_CALL,
  AGUI_CUSTOM_NAME_PLAN_BEAT,
  AGUI_CUSTOM_NAME_STATUS,
  AGUI_CUSTOM_NAME_TOOL_APPLY_RESULT,
  AGUI_CUSTOM_NAME_SYNTAX_FIXER,
  AGUI_STATE_PATH_LAST_PATCH_SUMMARY,
  LEGACY_STREAM_TYPE_A2UI,
  LEGACY_STREAM_TYPE_CONTENT_TYPE,
  LEGACY_STREAM_TYPE_PLAN_BEAT,
  agUiDraftSourcePath,
  agUiRevisionPath
} from './agUiWireConstants.js';

/** A loosely-typed AG-UI wire event: a discriminating `type` plus arbitrary fields. */
type AgUiEvent = { type: string; timestamp?: number; [key: string]: unknown };

function nowMs(): number {
  return Date.now();
}

function withMeta(evt: AgUiEvent): AgUiEvent {
  if (evt.timestamp == null) evt.timestamp = nowMs();
  return evt;
}

function randomId(prefix: string): string {
  const uuid =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${uuid}`;
}

export function runStarted({
  threadId,
  runId,
  parentRunId
}: {
  threadId: string;
  runId: string;
  parentRunId?: string;
}) {
  return withMeta({
    type: AGUI_EVENT_TYPE.RUN_STARTED,
    threadId,
    runId,
    ...(parentRunId != null ? { parentRunId } : {})
  });
}

export function runFinished({
  threadId,
  runId,
  result
}: {
  threadId: string;
  runId: string;
  result?: unknown;
}) {
  return withMeta({
    type: AGUI_EVENT_TYPE.RUN_FINISHED,
    threadId,
    runId,
    ...(result !== undefined ? { result } : {})
  });
}

export function runError({ message, code }: { message?: unknown; code?: unknown }) {
  return withMeta({
    type: AGUI_EVENT_TYPE.RUN_ERROR,
    message: String(message ?? ''),
    ...(code ? { code } : {})
  });
}

export function stepStarted({ stepName }: { stepName: string }) {
  return withMeta({ type: AGUI_EVENT_TYPE.STEP_STARTED, stepName: String(stepName) });
}

export function stepFinished({ stepName }: { stepName: string }) {
  return withMeta({ type: AGUI_EVENT_TYPE.STEP_FINISHED, stepName: String(stepName) });
}

export function textMessageStart({
  messageId,
  role = 'assistant'
}: {
  messageId: string;
  role?: string;
}) {
  return withMeta({ type: AGUI_EVENT_TYPE.TEXT_MESSAGE_START, messageId, role });
}

export function textMessageContent({ messageId, delta }: { messageId: string; delta: string }) {
  return withMeta({ type: AGUI_EVENT_TYPE.TEXT_MESSAGE_CONTENT, messageId, delta });
}

export function textMessageEnd({ messageId }: { messageId: string }) {
  return withMeta({ type: AGUI_EVENT_TYPE.TEXT_MESSAGE_END, messageId });
}

export function toolCallStart({
  toolCallId,
  toolCallName,
  parentMessageId
}: {
  toolCallId: string;
  toolCallName: string;
  parentMessageId?: string;
}) {
  return withMeta({
    type: AGUI_EVENT_TYPE.TOOL_CALL_START,
    toolCallId,
    toolCallName,
    ...(parentMessageId ? { parentMessageId } : {})
  });
}

export function toolCallArgs({ toolCallId, delta }: { toolCallId: string; delta: string }) {
  return withMeta({ type: AGUI_EVENT_TYPE.TOOL_CALL_ARGS, toolCallId, delta });
}

export function toolCallEnd({ toolCallId }: { toolCallId: string }) {
  return withMeta({ type: AGUI_EVENT_TYPE.TOOL_CALL_END, toolCallId });
}

export function stateSnapshot({ snapshot }: { snapshot: unknown }) {
  return withMeta({ type: AGUI_EVENT_TYPE.STATE_SNAPSHOT, snapshot });
}

export function stateDelta({ delta }: { delta: unknown }) {
  return withMeta({ type: AGUI_EVENT_TYPE.STATE_DELTA, delta });
}

export function customEvent({ name, value }: { name: string; value: unknown }) {
  return withMeta({ type: AGUI_EVENT_TYPE.CUSTOM, name, value });
}

function patchSummaryToJsonPatch(evt: Record<string, unknown>, contentType: string | undefined) {
  const slot =
    contentType === 'infographic' ||
    contentType === 'metaphor3d' ||
    contentType === 'chart' ||
    contentType === 'anything' ||
    contentType === 'forms'
      ? contentType
      : 'mermaid';
  return [
    { op: 'replace', path: agUiRevisionPath(slot), value: evt.revisionId },
    {
      op: 'add',
      path: AGUI_STATE_PATH_LAST_PATCH_SUMMARY,
      value: {
        contentType: slot,
        revisionId: evt.revisionId,
        linesAdded: evt.linesAdded ?? 0,
        linesRemoved: evt.linesRemoved ?? 0
      }
    }
  ];
}

/**
 * Agent stream emitter: maps semantic / legacy events to AG-UI wire events.
 * Used by LangChain agents (via `emit`) and by the agent-stream route wrapper.
 *
 * @param {{ rawEmit: (evt: object) => void, threadId: string, runId: string, contentType?: string, initialStep?: string | null }} opts
 */
export function createAgentStreamEmitter({
  rawEmit,
  threadId,
  runId,
  contentType,
  initialStep = null
}: {
  rawEmit: (evt: AgUiEvent) => void;
  threadId: string;
  runId: string;
  contentType?: string;
  initialStep?: string | null;
}) {
  let activeMessageId: string | null = null;
  let activeStep: string | null = initialStep || null;
  let activeToolCallId: string | null = null;
  // AG-UI verifier rejects every event after RUN_ERROR (and after RUN_FINISHED). Track the
  // terminal state here so duplicate cleanup paths — e.g. transform turns that emit `error`
  // when no patch landed and then still emit `final` — silently no-op instead of producing
  // "Cannot send event type 'STATE_DELTA': The run has already errored" on the client.
  let terminalState: 'error' | 'finished' | null = null;

  function endActiveMessage() {
    if (activeMessageId) {
      rawEmit(textMessageEnd({ messageId: activeMessageId }));
      activeMessageId = null;
    }
  }

  function endActiveStep() {
    if (activeStep) {
      rawEmit(stepFinished({ stepName: activeStep }));
      activeStep = null;
    }
  }

  function emitAgUi(evt: AgUiEvent) {
    return rawEmit(withMeta(evt));
  }

  function emitLegacy(evt: LegacyStreamEvent) {
    if (!evt || typeof evt !== 'object') return;
    switch (evt.type) {
      case 'phase': {
        endActiveMessage();
        endActiveStep();
        const id = String(evt.id || 'step');
        const label = String(evt.label || evt.id || 'Working…');
        const stepWire = `${id}\x1f${label}`;
        activeStep = stepWire;
        return rawEmit(stepStarted({ stepName: stepWire }));
      }
      case 'status':
        return rawEmit(
          customEvent({ name: AGUI_CUSTOM_NAME_STATUS, value: { text: String(evt.text ?? '') } })
        );
      case LEGACY_STREAM_TYPE_PLAN_BEAT: {
        const text = String(evt.text ?? '').trim();
        if (!text) return;
        const source = evt.source === 'agent' ? 'agent' : 'server';
        return rawEmit(customEvent({ name: AGUI_CUSTOM_NAME_PLAN_BEAT, value: { text, source } }));
      }
      case LEGACY_STREAM_TYPE_CONTENT_TYPE: {
        const contentType = String(evt.contentType ?? '').trim();
        if (!contentType) return;
        const reason = typeof evt.reason === 'string' ? evt.reason.trim() : '';
        return rawEmit(
          customEvent({
            name: AGUI_CUSTOM_NAME_CONTENT_TYPE,
            value: {
              contentType,
              ...(reason ? { reason } : {})
            }
          })
        );
      }
      case 'token': {
        const delta = typeof evt.text === 'string' ? evt.text : '';
        if (!delta) return;
        if (!activeMessageId) {
          activeMessageId = randomId('msg');
          rawEmit(textMessageStart({ messageId: activeMessageId, role: 'assistant' }));
        }
        return rawEmit(textMessageContent({ messageId: activeMessageId, delta }));
      }
      case LEGACY_STREAM_TYPE_A2UI:
        if (Array.isArray(evt.messages) && evt.messages.length > 0) {
          return rawEmit(
            customEvent({ name: AGUI_CUSTOM_NAME_A2UI, value: { messages: evt.messages } })
          );
        }
        return;
      case 'artifact':
        if (evt.kind === 'patch_summary') {
          return rawEmit(stateDelta({ delta: patchSummaryToJsonPatch(evt, contentType) }));
        }
        return rawEmit(customEvent({ name: AGUI_CUSTOM_NAME_ARTIFACT, value: evt }));
      case 'tool_start': {
        const id = String(evt.id ?? randomId('tool'));
        activeToolCallId = id;
        return rawEmit(toolCallStart({ toolCallId: id, toolCallName: String(evt.name ?? 'tool') }));
      }
      case 'tool_end': {
        const id = evt.id != null ? String(evt.id) : activeToolCallId;
        activeToolCallId = null;
        if (!id) return;
        return rawEmit(toolCallEnd({ toolCallId: id }));
      }
      case 'tool_apply_result': {
        const name = String(evt.name ?? '');
        if (!name) return;
        const accepted = evt.accepted === true;
        const error = typeof evt.error === 'string' ? evt.error : '';
        if (!accepted && !error) return;
        const value: Record<string, unknown> = {
          name,
          accepted,
          ...(evt.id != null ? { toolCallId: String(evt.id) } : {}),
          ...(accepted ? {} : { error })
        };
        if (accepted) {
          const optionalKeys = [
            'revisionId',
            'reason',
            'validator',
            'sanitizerApplied',
            'linesAdded',
            'linesRemoved',
            'nodesAdded',
            'nodesRemoved',
            'edgesAdded',
            'edgesRemoved'
          ] as const;
          for (const key of optionalKeys) {
            const v = evt[key];
            if (v !== undefined && v !== null) value[key] = v;
          }
        }
        return rawEmit(
          customEvent({
            name: AGUI_CUSTOM_NAME_TOOL_APPLY_RESULT,
            value
          })
        );
      }
      case 'model_call_start':
      case 'model_call_end': {
        const value: Record<string, unknown> = {
          phase: evt.type === 'model_call_start' ? 'start' : 'end',
          ...(typeof evt.callId === 'string' && evt.callId ? { callId: evt.callId } : {}),
          ...(typeof evt.model === 'string' && evt.model ? { model: evt.model } : {})
        };
        if (evt.type === 'model_call_end') {
          if (Number.isFinite(evt.inputTokens)) value.inputTokens = evt.inputTokens;
          if (Number.isFinite(evt.outputTokens)) value.outputTokens = evt.outputTokens;
        }
        return rawEmit(customEvent({ name: AGUI_CUSTOM_NAME_MODEL_CALL, value }));
      }
      case 'syntax_fixer_start':
        return rawEmit(
          customEvent({
            name: AGUI_CUSTOM_NAME_SYNTAX_FIXER,
            value: {
              phase: 'start',
              contentType: String(evt.contentType ?? 'mermaid'),
              triggerError: typeof evt.triggerError === 'string' ? evt.triggerError : ''
            }
          })
        );
      case 'syntax_fixer_result': {
        const outcome = evt.outcome;
        if (outcome !== 'repaired' && outcome !== 'fixer_failed' && outcome !== 'store_rejected') {
          return;
        }
        return rawEmit(
          customEvent({
            name: AGUI_CUSTOM_NAME_SYNTAX_FIXER,
            value: {
              phase: 'result',
              contentType: String(evt.contentType ?? 'mermaid'),
              outcome,
              error: typeof evt.error === 'string' ? evt.error : '',
              detail: typeof evt.detail === 'string' ? evt.detail : ''
            }
          })
        );
      }
      case 'draftPreview': {
        const ct =
          (typeof evt.contentType === 'string' && evt.contentType) || contentType || 'infographic';
        const value = typeof evt.accumulated === 'string' ? evt.accumulated : '';
        return rawEmit(
          stateDelta({ delta: [{ op: 'replace', path: agUiDraftSourcePath(ct), value }] })
        );
      }
      case 'error': {
        endActiveMessage();
        endActiveStep();
        if (contentType) {
          rawEmit(
            stateDelta({ delta: [{ op: 'remove', path: agUiDraftSourcePath(contentType) }] })
          );
        }
        terminalState = 'error';
        return rawEmit(
          runError({
            message: String(evt.message ?? 'Unknown error'),
            code: evt.code
          })
        );
      }
      case 'final': {
        endActiveMessage();
        endActiveStep();
        if (contentType) {
          rawEmit(
            stateDelta({ delta: [{ op: 'remove', path: agUiDraftSourcePath(contentType) }] })
          );
        }
        if (evt.state) rawEmit(stateSnapshot({ snapshot: evt.state }));
        const result = {
          revisionChanged: Boolean(evt.revisionChanged),
          ...(typeof evt.message === 'string' ? { message: evt.message } : {}),
          ...(typeof evt.analyzeText === 'string' ? { analyzeText: evt.analyzeText } : {})
        };
        terminalState = 'finished';
        return rawEmit(runFinished({ threadId, runId, result }));
      }
      default:
        return rawEmit(customEvent({ name: AGUI_CUSTOM_NAME_LEGACY, value: evt }));
    }
  }

  function emit(evt: LegacyStreamEvent | { type: string; [key: string]: unknown }) {
    if (terminalState) return;
    if (isAgUiWireEvent(evt)) {
      if (evt.type === AGUI_EVENT_TYPE.RUN_ERROR) terminalState = 'error';
      else if (evt.type === AGUI_EVENT_TYPE.RUN_FINISHED) terminalState = 'finished';
      return emitAgUi(evt);
    }
    return emitLegacy(evt as LegacyStreamEvent);
  }

  emit.phase = (id: string, label: string) => emit({ type: 'phase', id, label });
  emit.status = (text: string) => emit({ type: 'status', text });
  emit.planBeat = (text: string, source = 'server') =>
    emit({ type: LEGACY_STREAM_TYPE_PLAN_BEAT, text, source });
  emit.token = (text: string) => emit({ type: 'token', text });
  emit.a2ui = (messages: unknown) => emit({ type: LEGACY_STREAM_TYPE_A2UI, messages });
  emit.patchSummary = ({
    revisionId,
    linesAdded = 0,
    linesRemoved = 0
  }: {
    revisionId?: unknown;
    linesAdded?: number;
    linesRemoved?: number;
  }) => emit({ type: 'artifact', kind: 'patch_summary', revisionId, linesAdded, linesRemoved });
  emit.toolStart = (name: string, id?: string) => emit({ type: 'tool_start', name, id });
  emit.toolEnd = (name: string, id?: string) => emit({ type: 'tool_end', name, id });
  emit.draftPreview = (draftContentType: string, accumulated: string) =>
    emit({ type: 'draftPreview', contentType: draftContentType, accumulated });
  emit.error = (message?: unknown, code?: unknown) => emit({ type: 'error', message, code });
  emit.final = (payload: Record<string, unknown>) => emit({ type: 'final', ...payload });

  return emit;
}

/** @deprecated Use `createAgentStreamEmitter` */
export const createAgUiEmit = createAgentStreamEmitter;

export function newRunIds() {
  return { threadId: randomId('thr'), runId: randomId('run') };
}
