import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPatch, createInitialDiagramState } from '../src/diagramSchema.js';

test('applyPatch accepts valid patch and increments revision', () => {
  const initial = createInitialDiagramState();
  const result = applyPatch(initial, {
    previousRevisionId: 0,
    nextRevisionId: 1,
    mermaidSource: 'flowchart TD\n  A --> B',
    reason: 'test patch'
  });

  assert.equal(result.accepted, true);
  assert.equal(result.state.revisionId, 1);
  assert.match(result.state.mermaidSource, /A --> B/);
});

test('applyPatch rejects stale revisions', () => {
  const initial = createInitialDiagramState();
  const result = applyPatch(initial, {
    previousRevisionId: 9,
    nextRevisionId: 10,
    mermaidSource: 'flowchart TD\n  A --> B',
    reason: 'stale patch'
  });

  assert.equal(result.accepted, false);
  assert.match(result.error, /Revision mismatch/);
});
