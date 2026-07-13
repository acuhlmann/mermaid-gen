import test from 'node:test';
import assert from 'node:assert/strict';
import { EventSchemas } from '@ag-ui/core';
import { AGUI_CUSTOM_NAME_CONTENT_TYPE } from '@archislop/shared';
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
    onResolved: (evt) => captured.push(evt)
  });

  assert.equal(captured.length, 1);
  assert.equal(captured[0].type, 'CUSTOM');
  assert.equal(captured[0].name, AGUI_CUSTOM_NAME_CONTENT_TYPE);
  assert.equal(captured[0].value?.contentType, resolved.contentType);
  EventSchemas.parse(captured[0]);
});
