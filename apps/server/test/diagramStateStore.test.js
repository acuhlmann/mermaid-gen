import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiagramStateStore } from '../src/state/diagramStateStore.js';

test('diagram state store applies a valid Mermaid update', async () => {
  const store = createDiagramStateStore();

  const result = await store.applyMermaidSource({
    mermaidSource: 'flowchart TD\n  Start[Start] --> API[API]',
    reason: 'test update'
  });

  assert.equal(result.accepted, true);
  assert.equal(result.patch.previousRevisionId, 0);
  assert.equal(result.state.revisionId, 1);
  assert.match(result.state.mermaidSource, /^%%\{init:/);
  assert.equal(result.state.styleConfig.theme, 'base');
  assert.equal(result.state.styleConfig.look, 'neo');
  assert.match(store.getState().mermaidSource, /API/);
});

test('diagram state store rejects invalid Mermaid without mutating state', async () => {
  const store = createDiagramStateStore();
  const before = store.getState();

  const result = await store.applyMermaidSource({
    mermaidSource: 'not-a-diagram',
    reason: 'invalid update'
  });

  assert.equal(result.accepted, false);
  assert.equal(store.getState(), before);
});

test('diagram state store rejects invalid client sync source without mutating state', async () => {
  const store = createDiagramStateStore();
  const before = store.getState();

  const result = await store.syncClientMermaidSource({
    mermaidSource: 'flowchart TD\n  A['
  });

  assert.equal(result.accepted, false);
  assert.equal(store.getState(), before);
});
