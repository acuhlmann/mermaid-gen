import assert from 'node:assert/strict';
import test from 'node:test';
import { emitStyleEditsBeforeFinal } from '../src/agents/styleEditsStream.js';

test('emitStyleEditsBeforeFinal emits style_edits artifact', () => {
  const out = [];
  const emit = (e) => out.push(e);
  emitStyleEditsBeforeFinal(emit, {
    analyzeText:
      '5. Replace ::icon(fa fa-fire) with 🔥\n6. Darken tertiary text from #4b3b00 to #3a2a00'
  });
  assert.equal(out.length, 2);
  assert.equal(out[0].kind, 'style_edits');
  assert.equal(out[0].edits.length, 2);
  assert.equal(out[1].type, 'a2ui');
  assert.ok(Array.isArray(out[1].messages));
});
