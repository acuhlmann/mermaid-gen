import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiagramTools } from '../src/agents/diagramTools.js';
import { createDiagramStateStore } from '../src/state/diagramStateStore.js';

test('apply_mermaid_patch tool applies valid Mermaid source', async () => {
  const stateStore = createDiagramStateStore();
  const [, applyMermaidPatch] = createDiagramTools({ stateStore });

  const payload = await applyMermaidPatch.invoke({
    diagramSource: 'flowchart TD\n  Start[Start] --> Gateway[API Gateway]',
    reason: 'add gateway'
  });
  const result = JSON.parse(payload);

  assert.equal(result.accepted, true);
  assert.equal(result.state.revisionId, 1);
  assert.match(stateStore.getState().diagramSource, /Gateway/);
});

test('apply_mermaid_patch tool rejects invalid Mermaid source', async () => {
  const stateStore = createDiagramStateStore();
  const before = stateStore.getState();
  const [, applyMermaidPatch] = createDiagramTools({ stateStore });

  const payload = await applyMermaidPatch.invoke({
    diagramSource: 'not-a-diagram',
    reason: 'bad update'
  });
  const result = JSON.parse(payload);

  assert.equal(result.accepted, false);
  assert.equal(stateStore.getState(), before);
});
