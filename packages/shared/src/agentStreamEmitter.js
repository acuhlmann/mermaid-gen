import { AGUI_EVENT_TYPE, isAgUiWireEvent } from './agUiEventTypes.js';
import {
  AGUI_CUSTOM_NAME_A2UI,
  AGUI_CUSTOM_NAME_ARTIFACT,
  AGUI_CUSTOM_NAME_LEGACY,
  AGUI_CUSTOM_NAME_STATUS,
  AGUI_STATE_PATH_LAST_PATCH_SUMMARY,
  LEGACY_STREAM_TYPE_A2UI,
  agUiDraftSourcePath,
  agUiRevisionPath
} from './agUiWireConstants.js';

function nowMs() {
  return Date.now();
}

function withMeta(evt) {
  if (evt.timestamp == null) evt.timestamp = nowMs();
  return evt;
}

function randomId(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${uuid}`;
}

export function runStarted({ threadId, runId, parentRunId }) {
  return withMeta({
    type: AGUI_EVENT_TYPE.RUN_STARTED,
    threadId,
    runId,
    ...(parentRunId != null ? { parentRunId } : {})
  });
}

export function runFinished({ threadId, runId, result }) {
  return withMeta({
    type: AGUI_EVENT_TYPE.RUN_FINISHED,
    threadId,
    runId,
    ...(result !== undefined ? { result } : {})
  });
}

export function runError({ message, code }) {
  return withMeta({
    type: AGUI_EVENT_TYPE.RUN_ERROR,
    message: String(message ?? ''),
    ...(code ? { code } : {})
  });
}

export function stepStarted({ stepName }) {
  return withMeta({ type: AGUI_EVENT_TYPE.STEP_STARTED, stepName: String(stepName) });
}

export function stepFinished({ stepName }) {
  return withMeta({ type: AGUI_EVENT_TYPE.STEP_FINISHED, stepName: String(stepName) });
}

export function textMessageStart({ messageId, role = 'assistant' }) {
  return withMeta({ type: AGUI_EVENT_TYPE.TEXT_MESSAGE_START, messageId, role });
}

export function textMessageContent({ messageId, delta }) {
  return withMeta({ type: AGUI_EVENT_TYPE.TEXT_MESSAGE_CONTENT, messageId, delta });
}

export function textMessageEnd({ messageId }) {
  return withMeta({ type: AGUI_EVENT_TYPE.TEXT_MESSAGE_END, messageId });
}

export function toolCallStart({ toolCallId, toolCallName, parentMessageId }) {
  return withMeta({
    type: AGUI_EVENT_TYPE.TOOL_CALL_START,
    toolCallId,
    toolCallName,
    ...(parentMessageId ? { parentMessageId } : {})
  });
}

export function toolCallArgs({ toolCallId, delta }) {
  return withMeta({ type: AGUI_EVENT_TYPE.TOOL_CALL_ARGS, toolCallId, delta });
}

export function toolCallEnd({ toolCallId }) {
  return withMeta({ type: AGUI_EVENT_TYPE.TOOL_CALL_END, toolCallId });
}

export function stateSnapshot({ snapshot }) {
  return withMeta({ type: AGUI_EVENT_TYPE.STATE_SNAPSHOT, snapshot });
}

export function stateDelta({ delta }) {
  return withMeta({ type: AGUI_EVENT_TYPE.STATE_DELTA, delta });
}

export function customEvent({ name, value }) {
  return withMeta({ type: AGUI_EVENT_TYPE.CUSTOM, name, value });
}

function patchSummaryToJsonPatch(evt, contentType) {
  const slot = contentType === 'infographic' ? 'infographic' : 'mermaid';
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
}) {
  let activeMessageId = null;
  let activeStep = initialStep || null;
  let activeToolCallId = null;
  // AG-UI verifier rejects every event after RUN_ERROR (and after RUN_FINISHED). Track the
  // terminal state here so duplicate cleanup paths — e.g. transform turns that emit `error`
  // when no patch landed and then still emit `final` — silently no-op instead of producing
  // "Cannot send event type 'STATE_DELTA': The run has already errored" on the client.
  let terminalState = null;

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

  function emitAgUi(evt) {
    return rawEmit(withMeta(evt));
  }

  function emitLegacy(evt) {
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
        const id = evt.id || randomId('tool');
        activeToolCallId = id;
        return rawEmit(toolCallStart({ toolCallId: id, toolCallName: String(evt.name ?? 'tool') }));
      }
      case 'tool_end': {
        const id = evt.id || activeToolCallId;
        activeToolCallId = null;
        if (!id) return;
        return rawEmit(toolCallEnd({ toolCallId: id }));
      }
      case 'draftPreview': {
        const ct = evt.contentType || contentType || 'infographic';
        const value = typeof evt.accumulated === 'string' ? evt.accumulated : '';
        return rawEmit(stateDelta({ delta: [{ op: 'replace', path: agUiDraftSourcePath(ct), value }] }));
      }
      case 'error': {
        endActiveMessage();
        endActiveStep();
        if (contentType) {
          rawEmit(stateDelta({ delta: [{ op: 'remove', path: agUiDraftSourcePath(contentType) }] }));
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
          rawEmit(stateDelta({ delta: [{ op: 'remove', path: agUiDraftSourcePath(contentType) }] }));
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

  function emit(evt) {
    if (terminalState) return;
    if (isAgUiWireEvent(evt)) {
      if (evt.type === AGUI_EVENT_TYPE.RUN_ERROR) terminalState = 'error';
      else if (evt.type === AGUI_EVENT_TYPE.RUN_FINISHED) terminalState = 'finished';
      return emitAgUi(evt);
    }
    return emitLegacy(evt);
  }

  emit.phase = (id, label) => emit({ type: 'phase', id, label });
  emit.status = (text) => emit({ type: 'status', text });
  emit.token = (text) => emit({ type: 'token', text });
  emit.a2ui = (messages) => emit({ type: LEGACY_STREAM_TYPE_A2UI, messages });
  emit.patchSummary = ({ revisionId, linesAdded = 0, linesRemoved = 0 }) =>
    emit({ type: 'artifact', kind: 'patch_summary', revisionId, linesAdded, linesRemoved });
  emit.toolStart = (name, id) => emit({ type: 'tool_start', name, id });
  emit.toolEnd = (name, id) => emit({ type: 'tool_end', name, id });
  emit.draftPreview = (draftContentType, accumulated) =>
    emit({ type: 'draftPreview', contentType: draftContentType, accumulated });
  emit.error = (message, code) => emit({ type: 'error', message, code });
  emit.final = (payload) => emit({ type: 'final', ...payload });

  return emit;
}

/** @deprecated Use `createAgentStreamEmitter` */
export const createAgUiEmit = createAgentStreamEmitter;

export function newRunIds() {
  return { threadId: randomId('thr'), runId: randomId('run') };
}
