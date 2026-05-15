import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiagramStateStore } from '../src/state/diagramStateStore.js';

test('store applies a valid Mermaid update to the mermaid slot', async () => {
  const store = createDiagramStateStore();

  const result = await store.applyDiagramSource({
    contentType: 'mermaid',
    diagramSource: 'flowchart TD\n  Start[Start] --> API[API]',
    reason: 'test update'
  });

  assert.equal(result.accepted, true);
  assert.equal(result.patch.previousRevisionId, 0);
  assert.equal(result.patch.contentType, 'mermaid');
  assert.equal(result.state.revisionId, 1);
  assert.match(result.state.diagramSource, /^%%\{init:/);
  assert.equal(result.state.styleConfig.theme, 'base');
  assert.equal(result.state.styleConfig.look, 'neo');
  assert.match(store.getSlot('mermaid').diagramSource, /API/);
});

test('store rejects invalid Mermaid without mutating the mermaid slot', async () => {
  const store = createDiagramStateStore();
  const before = store.getSlot('mermaid');

  const result = await store.applyDiagramSource({
    contentType: 'mermaid',
    diagramSource: 'not-a-diagram',
    reason: 'invalid update'
  });

  assert.equal(result.accepted, false);
  assert.equal(store.getSlot('mermaid'), before);
});

test('store rejects invalid client sync source without mutating state', async () => {
  const store = createDiagramStateStore();
  const before = store.getSlot('mermaid');

  const result = await store.syncClientDiagramSource({
    contentType: 'mermaid',
    diagramSource: 'flowchart TD\n  A['
  });

  assert.equal(result.accepted, false);
  assert.equal(store.getSlot('mermaid'), before);
});

test('store accepts empty client sync source as cleared mermaid diagram', async () => {
  const store = createDiagramStateStore();

  await store.syncClientDiagramSource({
    contentType: 'mermaid',
    diagramSource: 'flowchart TD\n  A --> B'
  });
  const result = await store.syncClientDiagramSource({
    contentType: 'mermaid',
    diagramSource: ''
  });

  assert.equal(result.accepted, true);
  assert.equal(result.state.revisionId, 2);
  assert.equal(result.state.diagramSource, '');
});

test('store keeps infographic slot independent of mermaid mutations', async () => {
  const store = createDiagramStateStore();
  const infographicBefore = store.getSlot('infographic');

  await store.applyDiagramSource({
    contentType: 'mermaid',
    diagramSource: 'flowchart TD\n  A --> B',
    reason: 'mermaid change'
  });

  assert.equal(store.getSlot('infographic'), infographicBefore);
  assert.equal(store.getSlot('infographic').revisionId, 0);
  assert.equal(store.getSlot('mermaid').revisionId, 1);
});

test('store applies infographic DSL via dispatcher', async () => {
  const store = createDiagramStateStore();

  const result = await store.applyDiagramSource({
    contentType: 'infographic',
    diagramSource:
      'infographic list-row-simple-horizontal-arrow\n  data\n    lists\n      - label Step 1\n        desc Start\n      - label Step 2\n        desc Build',
    reason: 'infographic update'
  });

  assert.equal(result.accepted, true);
  assert.equal(result.patch.contentType, 'infographic');
  assert.equal(result.state.styleConfig, null);
  assert.equal(result.state.contentType, 'infographic');
  assert.equal(store.getSlot('infographic').revisionId, 1);
  assert.equal(store.getSlot('mermaid').revisionId, 0);
});

test('store rejects infographic DSL with unknown template', async () => {
  const store = createDiagramStateStore();
  const before = store.getSlot('infographic');

  const result = await store.applyDiagramSource({
    contentType: 'infographic',
    diagramSource: 'infographic made-up-template\n  data\n    lists',
    reason: 'bad template'
  });

  assert.equal(result.accepted, false);
  assert.match(result.error, /Unknown template/);
  assert.equal(store.getSlot('infographic'), before);
});

test('store switches active content type and preserves both slots', async () => {
  const store = createDiagramStateStore();
  assert.equal(store.getActiveContentType(), 'mermaid');

  const switched = store.setActiveContentType('infographic');
  assert.equal(store.getActiveContentType(), 'infographic');
  assert.equal(switched.contentType, 'infographic');

  store.setActiveContentType('mermaid');
  assert.equal(store.getActiveContentType(), 'mermaid');
  assert.equal(store.getActiveSlot().contentType, 'mermaid');
});

test('setLastUserPrompt persists trimmed prompt on the slot', () => {
  const store = createDiagramStateStore();
  assert.equal(store.getSlot('mermaid').lastUserPrompt, null);

  const next = store.setLastUserPrompt({ contentType: 'mermaid', prompt: '  show solar system  ' });
  assert.equal(next.lastUserPrompt, 'show solar system');
  assert.equal(store.getSlot('mermaid').lastUserPrompt, 'show solar system');
});

test('setLastUserPrompt ignores blank/whitespace inputs', () => {
  const store = createDiagramStateStore();
  store.setLastUserPrompt({ contentType: 'mermaid', prompt: 'topic A' });
  store.setLastUserPrompt({ contentType: 'mermaid', prompt: '   ' });
  store.setLastUserPrompt({ contentType: 'mermaid', prompt: '' });
  store.setLastUserPrompt({ contentType: 'mermaid', prompt: undefined });
  assert.equal(store.getSlot('mermaid').lastUserPrompt, 'topic A');
});

test('setLastUserPrompt is independent across slots', () => {
  const store = createDiagramStateStore();
  store.setLastUserPrompt({ contentType: 'mermaid', prompt: 'mermaid topic' });
  store.setLastUserPrompt({ contentType: 'infographic', prompt: 'infographic topic' });
  assert.equal(store.getSlot('mermaid').lastUserPrompt, 'mermaid topic');
  assert.equal(store.getSlot('infographic').lastUserPrompt, 'infographic topic');
});

test('setLastUserPrompt truncates very long prompts to 4000 chars', () => {
  const store = createDiagramStateStore();
  const longPrompt = 'x'.repeat(5000);
  store.setLastUserPrompt({ contentType: 'mermaid', prompt: longPrompt });
  assert.equal(store.getSlot('mermaid').lastUserPrompt.length, 4000);
});

test('mirrorLastUserPromptToSibling copies topic to sibling without changing diagramSource', () => {
  const store = createDiagramStateStore();
  const mermaidBefore = store.getSlot('mermaid').diagramSource;
  const infographicBefore = store.getSlot('infographic').diagramSource;

  store.setLastUserPrompt({ contentType: 'infographic', prompt: 'Solar system' });
  store.mirrorLastUserPromptToSibling({ contentType: 'infographic', prompt: 'Solar system' });

  assert.equal(store.getSlot('infographic').lastUserPrompt, 'Solar system');
  assert.equal(store.getSlot('mermaid').lastUserPrompt, 'Solar system');
  assert.equal(store.getSlot('mermaid').diagramSource, mermaidBefore);
  assert.equal(store.getSlot('infographic').diagramSource, infographicBefore);
});

test('mirrorLastUserPromptToSibling ignores blank prompts', () => {
  const store = createDiagramStateStore();
  store.setLastUserPrompt({ contentType: 'mermaid', prompt: 'keep me' });
  store.mirrorLastUserPromptToSibling({ contentType: 'mermaid', prompt: '   ' });
  assert.equal(store.getSlot('infographic').lastUserPrompt, null);
});
