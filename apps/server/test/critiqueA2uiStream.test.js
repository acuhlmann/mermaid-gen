import test from 'node:test';
import assert from 'node:assert/strict';
import { emitCritiqueA2uiBeforeFinal } from '../src/agents/critiqueA2uiStream.js';

test('emitCritiqueA2uiBeforeFinal emits a2ui when critique has actionable items', () => {
  const out = [];
  const emit = (evt) => out.push(evt);
  const md = `## Actionable improvements\n\n- One\n`;
  emitCritiqueA2uiBeforeFinal(emit, { kind: 'critique', analyzeText: md });
  assert.equal(out.length, 1);
  assert.equal(out[0].type, 'a2ui');
  assert.ok(Array.isArray(out[0].messages));
  assert.ok(out[0].messages.length >= 1);
});

test('emitCritiqueA2uiBeforeFinal skips non-critique', () => {
  const out = [];
  emitCritiqueA2uiBeforeFinal((e) => out.push(e), { kind: 'explain', analyzeText: '## Actionable\n\n- X\n' });
  assert.deepEqual(out, []);
});
