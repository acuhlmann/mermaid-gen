import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMetaphorAnalyzeFocusInstructions,
  buildMetaphorFocusScopeInstructions
} from '../src/agents/metaphorFocusInstructions.js';

test('buildMetaphorFocusScopeInstructions returns empty for non-metaphor focus', () => {
  assert.equal(buildMetaphorFocusScopeInstructions({ id: 'x', selectionKind: 'node' }), '');
});

test('buildMetaphorFocusScopeInstructions scopes to item id', () => {
  const text = buildMetaphorFocusScopeInstructions({
    id: 'billing',
    label: 'Billing API',
    selectionKind: 'metaphor-item'
  });
  assert.match(text, /billing/);
  assert.match(text, /Billing API/);
});

test('buildMetaphorAnalyzeFocusInstructions explain vs critique', () => {
  const focus = { id: 'cache', label: 'Cache', selectionKind: 'metaphor-item' };
  assert.match(buildMetaphorAnalyzeFocusInstructions(focus, 'explain'), /spatial story/);
  assert.match(buildMetaphorAnalyzeFocusInstructions(focus, 'jared'), /magnitude/);
});
