import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EventSchemas,
  EventType,
  RunStartedEventSchema,
  RunFinishedEventSchema,
  RunErrorEventSchema,
  StepStartedEventSchema,
  StepFinishedEventSchema,
  TextMessageStartEventSchema,
  TextMessageContentEventSchema,
  TextMessageEndEventSchema,
  ToolCallStartEventSchema,
  ToolCallArgsEventSchema,
  ToolCallEndEventSchema,
  StateSnapshotEventSchema,
  StateDeltaEventSchema,
  CustomEventSchema
} from '@ag-ui/core';
import {
  createAgentStreamEmitter,
  customEvent,
  newRunIds,
  runError,
  runFinished,
  runStarted,
  stateDelta,
  stateSnapshot,
  stepFinished,
  stepStarted,
  textMessageContent,
  textMessageEnd,
  textMessageStart,
  toolCallArgs,
  toolCallEnd,
  toolCallStart,
  AGUI_EVENT_TYPE
} from '@archislop/shared';

test('AGUI_EVENT_TYPE values match @ag-ui/core EventType enum', () => {
  for (const [k, v] of Object.entries(AGUI_EVENT_TYPE)) {
    assert.equal(EventType[k], v, `EventType.${k} differs from local constant`);
  }
});

test('runStarted matches RunStartedEventSchema', () => {
  const ids = newRunIds();
  const evt = runStarted(ids);
  RunStartedEventSchema.parse(evt);
});

test('runFinished and runError match their schemas', () => {
  const ids = newRunIds();
  RunFinishedEventSchema.parse(runFinished({ ...ids, result: { revisionChanged: true } }));
  RunErrorEventSchema.parse(runError({ message: 'nope', code: 'oops' }));
});

test('step events match their schemas', () => {
  StepStartedEventSchema.parse(stepStarted({ stepName: 'planning' }));
  StepFinishedEventSchema.parse(stepFinished({ stepName: 'planning' }));
});

test('text message lifecycle events match their schemas', () => {
  TextMessageStartEventSchema.parse(textMessageStart({ messageId: 'm1', role: 'assistant' }));
  TextMessageContentEventSchema.parse(textMessageContent({ messageId: 'm1', delta: 'hello' }));
  TextMessageEndEventSchema.parse(textMessageEnd({ messageId: 'm1' }));
});

test('tool call lifecycle events match their schemas', () => {
  ToolCallStartEventSchema.parse(
    toolCallStart({ toolCallId: 't1', toolCallName: 'apply_infographic_patch' })
  );
  ToolCallArgsEventSchema.parse(toolCallArgs({ toolCallId: 't1', delta: '{"a":1' }));
  ToolCallEndEventSchema.parse(toolCallEnd({ toolCallId: 't1' }));
});

test('state events match their schemas', () => {
  StateSnapshotEventSchema.parse(stateSnapshot({ snapshot: { revisionId: 4 } }));
  StateDeltaEventSchema.parse(stateDelta({ delta: [{ op: 'replace', path: '/x', value: 1 }] }));
});

test('customEvent matches CustomEventSchema', () => {
  CustomEventSchema.parse(customEvent({ name: 'status', value: { text: 'hi' } }));
});

test('every helper validates against EventSchemas discriminated union', () => {
  const ids = newRunIds();
  const samples = [
    runStarted(ids),
    stepStarted({ stepName: 'planning' }),
    stepFinished({ stepName: 'planning' }),
    textMessageStart({ messageId: 'm1' }),
    textMessageContent({ messageId: 'm1', delta: 'x' }),
    textMessageEnd({ messageId: 'm1' }),
    toolCallStart({ toolCallId: 't1', toolCallName: 'k' }),
    toolCallArgs({ toolCallId: 't1', delta: '{}' }),
    toolCallEnd({ toolCallId: 't1' }),
    stateSnapshot({ snapshot: {} }),
    stateDelta({ delta: [] }),
    customEvent({ name: 'x', value: 1 }),
    runFinished({ ...ids, result: { revisionChanged: false } }),
    runError({ message: 'oops' })
  ];
  for (const s of samples) {
    EventSchemas.parse(s);
  }
});

test('createAgentStreamEmitter translates a full legacy lifecycle into AG-UI events', () => {
  const ids = newRunIds();
  const captured = [];
  const emit = createAgentStreamEmitter({
    rawEmit: (e) => captured.push(e),
    threadId: ids.threadId,
    runId: ids.runId,
    contentType: 'infographic'
  });

  emit({ type: 'phase', id: 'planning', label: 'Planning…' });
  emit({ type: 'token', text: 'hi ' });
  emit({ type: 'token', text: 'there' });
  emit({ type: 'tool_start', id: 'tool_1', name: 'apply_infographic_patch' });
  emit({
    type: 'draftPreview',
    contentType: 'infographic',
    accumulated: '# Title',
    delta: '# Title'
  });
  emit({ type: 'tool_end', id: 'tool_1', name: 'apply_infographic_patch' });
  emit({ type: 'artifact', kind: 'patch_summary', revisionId: 7, linesAdded: 3, linesRemoved: 1 });
  emit({ type: 'final', revisionChanged: true, message: 'done', state: { revisionId: 7 } });

  // First event is STEP_STARTED for the legacy phase.
  assert.equal(captured[0].type, 'STEP_STARTED');
  assert.equal(captured[0].stepName, 'planning\x1fPlanning…');

  // Tokens open a TEXT_MESSAGE_START + emit TEXT_MESSAGE_CONTENT deltas.
  const startIdx = captured.findIndex((e) => e.type === 'TEXT_MESSAGE_START');
  assert.ok(startIdx >= 0, 'missing TEXT_MESSAGE_START');
  const contents = captured.filter((e) => e.type === 'TEXT_MESSAGE_CONTENT');
  assert.equal(contents.length, 2);
  assert.equal(contents[0].delta, 'hi ');
  assert.equal(contents[1].delta, 'there');

  // draftPreview rides on a STATE_DELTA replace op against /infographic/draftSource.
  const draftDelta = captured.find(
    (e) =>
      e.type === 'STATE_DELTA' &&
      e.delta.some((op) => op.path === '/infographic/draftSource' && op.op === 'replace')
  );
  assert.ok(draftDelta, 'missing /infographic/draftSource replace patch');
  const draftOp = draftDelta.delta.find((op) => op.path === '/infographic/draftSource');
  assert.equal(draftOp.value, '# Title');

  // Final must clear the draft via a STATE_DELTA remove BEFORE the snapshot.
  const removeIdx = captured.findIndex(
    (e) =>
      e.type === 'STATE_DELTA' &&
      e.delta.some((op) => op.path === '/infographic/draftSource' && op.op === 'remove')
  );
  const snapIdx = captured.findIndex((e) => e.type === 'STATE_SNAPSHOT');
  assert.ok(removeIdx > 0, 'missing draftSource remove on final');
  assert.ok(removeIdx < snapIdx, 'draftSource remove must precede snapshot');

  // Tool calls become TOOL_CALL_START / TOOL_CALL_END with the same id.
  const toolStart = captured.find((e) => e.type === 'TOOL_CALL_START');
  const toolEnd = captured.find((e) => e.type === 'TOOL_CALL_END');
  assert.equal(toolStart.toolCallId, 'tool_1');
  assert.equal(toolEnd.toolCallId, 'tool_1');

  // Artifact becomes STATE_DELTA carrying a /<slot>/revisionId replace plus
  // a /lastPatchSummary add. Several other STATE_DELTAs flow (draft source
  // replace, draft source remove), so select by content.
  const summaryDelta = captured.find(
    (e) =>
      e.type === 'STATE_DELTA' &&
      e.delta.some((op) => op.path === '/infographic/revisionId' && op.value === 7)
  );
  assert.ok(summaryDelta, 'missing STATE_DELTA with /infographic/revisionId');

  // Final fans out: end any open message, snapshot, then RUN_FINISHED.
  const endMsg = captured.findIndex((e) => e.type === 'TEXT_MESSAGE_END');
  const snap = captured.findIndex((e) => e.type === 'STATE_SNAPSHOT');
  const finished = captured.findIndex((e) => e.type === 'RUN_FINISHED');
  assert.ok(
    endMsg > 0 && snap > endMsg && finished > snap,
    'final must order END → SNAPSHOT → FINISHED'
  );
  assert.equal(captured[finished].runId, ids.runId);
  assert.equal(captured[finished].result.revisionChanged, true);

  // Every emitted event must validate against the AG-UI discriminated union.
  for (const e of captured) {
    EventSchemas.parse(e);
  }
});

test('createAgentStreamEmitter on legacy error closes open message + emits RUN_ERROR', () => {
  const ids = newRunIds();
  const captured = [];
  const emit = createAgentStreamEmitter({
    rawEmit: (e) => captured.push(e),
    threadId: ids.threadId,
    runId: ids.runId,
    contentType: 'mermaid'
  });
  emit({ type: 'phase', id: 'invoke', label: 'Generating…' });
  emit({ type: 'token', text: 'partial' });
  emit({ type: 'error', message: 'boom', code: 'oops' });

  const endIdx = captured.findIndex((e) => e.type === 'TEXT_MESSAGE_END');
  const errIdx = captured.findIndex((e) => e.type === 'RUN_ERROR');
  assert.ok(endIdx > 0, 'should close text message before erroring');
  assert.equal(captured[errIdx].message, 'boom');
  assert.equal(captured[errIdx].code, 'oops');
  for (const e of captured) {
    EventSchemas.parse(e);
  }
});
