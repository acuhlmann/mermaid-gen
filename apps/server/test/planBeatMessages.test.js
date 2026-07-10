import test from 'node:test';
import assert from 'node:assert/strict';
import { emitServerMutationPlanBeats } from '../src/agents/planBeatMessages.js';

test('emitServerMutationPlanBeats emits diagram-focused server beats', () => {
  const captured = [];
  const emit = (e) => captured.push(e);
  const stateStore = {
    getSlot: () => ({ diagramSource: 'flowchart TD\n  A --> B' })
  };
  emitServerMutationPlanBeats({
    emit,
    stateStore,
    mode: 'refine',
    messages: [{ role: 'user', content: 'User request:\nAdd a cache layer' }],
    focusNode: { id: 'Cache', label: 'Cache', selectionKind: 'node' },
    contentType: 'mermaid'
  });
  assert.ok(captured.length >= 2);
  assert.equal(
    captured.every((e) => e.type === 'plan_beat' && e.source === 'server'),
    true
  );
  assert.ok(captured.some((e) => e.text.includes('Cache')));
  assert.ok(captured.some((e) => e.text.includes('flowchart') || e.text.includes('Keeping')));
});

test('emitServerMutationPlanBeats skips goMad intent line but keeps focus', () => {
  const captured = [];
  const emit = (e) => captured.push(e);
  emitServerMutationPlanBeats({
    emit,
    stateStore: { getSlot: () => ({ diagramSource: 'sequenceDiagram\n  A->>B: hi' }) },
    mode: 'goMad',
    messages: [{ role: 'user', content: 'Transform mode: GO MAD' }],
    focusNode: { id: 'A', selectionKind: 'node' },
    contentType: 'mermaid'
  });
  assert.ok(!captured.some((e) => e.text.includes('Restructuring')));
  assert.ok(captured.some((e) => e.text.includes('Scoping')));
});
