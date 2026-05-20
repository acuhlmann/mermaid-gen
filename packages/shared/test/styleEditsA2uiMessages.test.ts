import assert from 'node:assert/strict';
import test from 'node:test';
import {
  A2UI_STYLE_EDITS_SURFACE_ID,
  ACTION_APPLY_STYLE_EDITS,
  buildStyleEditsA2uiMessages
} from '../src/styleEditsA2uiMessages.js';
import type { A2uiV09Message } from '../src/legacyStreamEvents.js';
import type { StyleEdit } from '../src/styleEdits.js';

const SAMPLE_EDITS: StyleEdit[] = [
  { kind: 'icon_replace', id: '5', from: 'fa fa-fire', to: '🔥' },
  { kind: 'color_shift', id: '6', variable: 'tertiaryTextColor', from: '#4b3b00', to: '#3a2a00' }
];

test('buildStyleEditsA2uiMessages returns surface and apply action', () => {
  const msgs = buildStyleEditsA2uiMessages(SAMPLE_EDITS);
  assert.ok(msgs.length >= 3);
  assert.equal(msgs[0].createSurface?.surfaceId, A2UI_STYLE_EDITS_SURFACE_ID);
  const msg1 = msgs[1] as A2uiV09Message;
  const btn = (msg1.updateComponents?.components as { id: string; action?: { event?: { name: string } } }[])?.find(
    (c) => c.id === 'btn_apply'
  );
  assert.equal(btn?.action?.event?.name, ACTION_APPLY_STYLE_EDITS);
});

test('buildStyleEditsA2uiMessages returns empty for no edits', () => {
  assert.deepEqual(buildStyleEditsA2uiMessages([]), []);
});
