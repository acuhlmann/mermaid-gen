import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGUI_CUSTOM_NAME_A2UI,
  agUiDraftSourcePath,
  agUiRevisionPath,
  AGUI_STATE_PATH_FORMS_REVISION,
  createLegacyA2uiStreamEvent,
  LEGACY_STREAM_TYPE_A2UI
} from '../src/agUiWireConstants.js';

test('createLegacyA2uiStreamEvent matches legacy stream type and forwards messages', () => {
  const msgs = [{ op: 'test' }];
  const evt = createLegacyA2uiStreamEvent(msgs);
  assert.equal(evt.type, LEGACY_STREAM_TYPE_A2UI);
  assert.equal(AGUI_CUSTOM_NAME_A2UI, 'a2ui');
  assert.deepEqual(evt.messages, msgs);
});

test('agUiRevisionPath and agUiDraftSourcePath include forms slot', () => {
  assert.equal(agUiRevisionPath('forms'), AGUI_STATE_PATH_FORMS_REVISION);
  assert.equal(agUiDraftSourcePath('forms'), '/forms/draftSource');
});
