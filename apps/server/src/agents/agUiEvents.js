// AG-UI wire-protocol event builders and an emit adapter that translates the
// project's legacy internal event shapes ({type:'phase'|'token'|...}) into
// AG-UI's standard event types. The runtime values mirror EventType from
// @ag-ui/core so consumers can parse with @ag-ui/core's Zod schemas.

import { randomUUID } from 'node:crypto';

export const AGUI_EVENT_TYPE = Object.freeze({
  TEXT_MESSAGE_START: 'TEXT_MESSAGE_START',
  TEXT_MESSAGE_CONTENT: 'TEXT_MESSAGE_CONTENT',
  TEXT_MESSAGE_END: 'TEXT_MESSAGE_END',
  TOOL_CALL_START: 'TOOL_CALL_START',
  TOOL_CALL_ARGS: 'TOOL_CALL_ARGS',
  TOOL_CALL_END: 'TOOL_CALL_END',
  STATE_SNAPSHOT: 'STATE_SNAPSHOT',
  STATE_DELTA: 'STATE_DELTA',
  CUSTOM: 'CUSTOM',
  RUN_STARTED: 'RUN_STARTED',
  RUN_FINISHED: 'RUN_FINISHED',
  RUN_ERROR: 'RUN_ERROR',
  STEP_STARTED: 'STEP_STARTED',
  STEP_FINISHED: 'STEP_FINISHED'
});

function nowMs() {
  return Date.now();
}

function withMeta(evt) {
  if (evt.timestamp == null) evt.timestamp = nowMs();
  return evt;
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

// Translate a legacy patch_summary artifact into a synthetic RFC 6902 JSON
// Patch (op:'replace' on /<contentType>/revisionId, with line stats annotated
// via op:'add' on /lastPatchSummary).
function patchSummaryToJsonPatch(evt, contentType) {
  const slot = contentType === 'infographic' ? 'infographic' : 'mermaid';
  return [
    { op: 'replace', path: `/${slot}/revisionId`, value: evt.revisionId },
    {
      op: 'add',
      path: '/lastPatchSummary',
      value: {
        contentType: slot,
        revisionId: evt.revisionId,
        linesAdded: evt.linesAdded ?? 0,
        linesRemoved: evt.linesRemoved ?? 0
      }
    }
  ];
}

// Adapts the legacy `emit(evt)` contract used inside the agents to AG-UI events
// written to the SSE stream. The agents do not need to change.
//
// Lifecycle notes:
// - We open a TEXT_MESSAGE on first 'token' and close it on 'final' or 'error'.
// - 'phase' becomes STEP_STARTED; we close the prior phase via STEP_FINISHED to
//   keep the AG-UI step stack balanced.
// - 'final' fans out into TEXT_MESSAGE_END (if open), STATE_SNAPSHOT (if state
//   carried), and RUN_FINISHED. The route owns RUN_STARTED/RUN_ERROR around
//   this adapter so unhandled errors still get a proper envelope.
export function createAgUiEmit({ rawEmit, threadId, runId, contentType, initialStep = null }) {
  let activeMessageId = null;
  let activeStep = initialStep || null;
  let activeToolCallId = null;

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

  return function emit(evt) {
    if (!evt || typeof evt !== 'object') return;
    switch (evt.type) {
      case 'phase': {
        endActiveMessage();
        endActiveStep();
        const name = String(evt.label || evt.id || 'step');
        activeStep = name;
        return rawEmit(stepStarted({ stepName: name }));
      }
      case 'status':
        return rawEmit(customEvent({ name: 'status', value: { text: String(evt.text ?? '') } }));
      case 'token': {
        const delta = typeof evt.text === 'string' ? evt.text : '';
        if (!delta) return;
        if (!activeMessageId) {
          activeMessageId = `msg_${randomUUID()}`;
          rawEmit(textMessageStart({ messageId: activeMessageId, role: 'assistant' }));
        }
        return rawEmit(textMessageContent({ messageId: activeMessageId, delta }));
      }
      case 'artifact':
        if (evt.kind === 'patch_summary') {
          return rawEmit(stateDelta({ delta: patchSummaryToJsonPatch(evt, contentType) }));
        }
        return rawEmit(customEvent({ name: 'artifact', value: evt }));
      case 'tool_start': {
        const id = evt.id || `tool_${randomUUID()}`;
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
        // Live draft DSL streamed from the agent's tool-call args. Exposed as a
        // transient `<contentType>/draftSource` state field via RFC 6902 patch,
        // so any AG-UI-compliant client renders it via standard state-sync —
        // no custom event subscription required. Not persisted; cleared on
        // final/error below.
        const ct = evt.contentType || contentType || 'infographic';
        const value = typeof evt.accumulated === 'string' ? evt.accumulated : '';
        return rawEmit(
          stateDelta({ delta: [{ op: 'replace', path: `/${ct}/draftSource`, value }] })
        );
      }
      case 'error': {
        endActiveMessage();
        endActiveStep();
        // Explicitly clear any in-flight draft so client state mirrors agree.
        if (contentType) {
          rawEmit(stateDelta({ delta: [{ op: 'remove', path: `/${contentType}/draftSource` }] }));
        }
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
        // Clear the draft before snapshotting authoritative state. Order
        // matters: a state-sync client should see the remove, then the snapshot
        // wholesale-replace, then RUN_FINISHED.
        if (contentType) {
          rawEmit(stateDelta({ delta: [{ op: 'remove', path: `/${contentType}/draftSource` }] }));
        }
        if (evt.state) rawEmit(stateSnapshot({ snapshot: evt.state }));
        const result = {
          revisionChanged: Boolean(evt.revisionChanged),
          ...(typeof evt.message === 'string' ? { message: evt.message } : {}),
          ...(typeof evt.analyzeText === 'string' ? { analyzeText: evt.analyzeText } : {})
        };
        return rawEmit(runFinished({ threadId, runId, result }));
      }
      default:
        // Unknown legacy event — surface as custom for forward-compat.
        return rawEmit(customEvent({ name: 'legacy', value: evt }));
    }
  };
}

export function newRunIds() {
  return { threadId: `thr_${randomUUID()}`, runId: `run_${randomUUID()}` };
}
