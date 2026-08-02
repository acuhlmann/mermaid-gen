import test from 'node:test';
import assert from 'node:assert/strict';
import { EventSchemas } from '@ag-ui/core';
import { AGUI_CUSTOM_NAME_CONTENT_TYPE, AGUI_CUSTOM_NAME_MODEL_CALL } from '@archislop/shared';
import { resolveAutoIntentContentType } from '../src/routes/resolveAutoContentType.js';
import { createDiagramStateStore } from '../src/state/diagramStateStore.js';

test('resolveAutoIntentContentType onResolved emits AG-UI CUSTOM content_type wire events', async () => {
  const store = createDiagramStateStore();
  const captured = [];

  const resolved = await resolveAutoIntentContentType({
    payload: {
      contentType: 'auto',
      prompt: 'draw a flowchart of checkout',
      revisionId: 0,
      diagramSource: ''
    },
    getSlot: (contentType) => store.getSlot(contentType),
    onResolved: (evt) => captured.push(evt),
    env: {}
  });

  const contentEvt = captured.find((evt) => evt.name === AGUI_CUSTOM_NAME_CONTENT_TYPE);
  assert.ok(contentEvt, 'expected content_type CUSTOM event');
  assert.equal(contentEvt.type, 'CUSTOM');
  assert.equal(contentEvt.value?.contentType, resolved.contentType);
  EventSchemas.parse(contentEvt);
});

test('resolveAutoIntentContentType bills classifier usage via model_call CUSTOM events', async () => {
  const store = createDiagramStateStore();
  const captured = [];

  await resolveAutoIntentContentType({
    payload: {
      contentType: 'auto',
      prompt: 'bar chart of revenue',
      revisionId: 0,
      diagramSource: ''
    },
    getSlot: (contentType) => store.getSlot(contentType),
    onResolved: (evt) => captured.push(evt),
    infer: async () => ({
      contentType: 'chart',
      reason: 'numbers',
      classified: true,
      usage: { inputTokens: 20, outputTokens: 8 },
      model: 'gemini-2.5-flash-lite'
    })
  });

  const modelCalls = captured.filter((evt) => evt.name === AGUI_CUSTOM_NAME_MODEL_CALL);
  assert.equal(modelCalls.length, 2);
  assert.equal(modelCalls[0].value.phase, 'start');
  assert.equal(modelCalls[1].value.phase, 'end');
  assert.equal(modelCalls[1].value.model, 'gemini-2.5-flash-lite');
  assert.equal(modelCalls[1].value.inputTokens, 20);
  assert.equal(modelCalls[1].value.outputTokens, 8);
  EventSchemas.parse(modelCalls[0]);
  EventSchemas.parse(modelCalls[1]);

  const contentEvt = captured.find((evt) => evt.name === AGUI_CUSTOM_NAME_CONTENT_TYPE);
  assert.equal(contentEvt?.value?.contentType, 'chart');
});
