import test from 'node:test';
import assert from 'node:assert/strict';
import {
  A2UI_BASIC_CATALOG_ID,
  A2UI_CRITIQUE_SURFACE_ID,
  buildCritiqueActionableA2uiMessages
} from '../src/critiqueA2uiMessages.js';

test('buildCritiqueActionableA2uiMessages returns empty array when no actionable section', () => {
  assert.deepEqual(buildCritiqueActionableA2uiMessages('## Summary\n\n- Only.\n'), []);
});

test('buildCritiqueActionableA2uiMessages returns createSurface, updateComponents, updateDataModel', () => {
  const md = `## Summary\n\nOk.\n\n## Actionable improvements\n\n- Fix A\n- Fix B\n`;
  const msgs = buildCritiqueActionableA2uiMessages(md);
  assert.equal(msgs.length, 3);
  assert.equal(msgs[0].version, 'v0.9');
  assert.equal(msgs[0].createSurface.surfaceId, A2UI_CRITIQUE_SURFACE_ID);
  assert.equal(msgs[0].createSurface.catalogId, A2UI_BASIC_CATALOG_ID);
  assert.equal(msgs[1].updateComponents.surfaceId, A2UI_CRITIQUE_SURFACE_ID);
  assert.ok(Array.isArray(msgs[1].updateComponents.components));
  assert.equal(msgs[2].updateDataModel.path, '/');
  assert.equal(msgs[2].updateDataModel.value.checks.length, 2);
  assert.equal(msgs[2].updateDataModel.value.checks[0].label, 'Fix A');
  assert.equal(msgs[2].updateDataModel.value.checks[0].value, false);
});
