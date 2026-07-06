import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAndPrepareAnythingPatch,
  validateAnythingStrict
} from '../src/tools/anythingHtmlTool.js';
import { createDiagramStateStore } from '../src/state/diagramStateStore.js';

const HELLO_DOC = `<!DOCTYPE html>
<html>
  <head><style>body { margin: 0; font-family: sans-serif; }</style></head>
  <body><h1>Hello</h1><script>document.title = 'hi';</script></body>
</html>`;

const CURRENT_STATE = {
  revisionId: 3,
  diagramSource: '<p>old</p>',
  styleConfig: null,
  contentType: 'anything',
  updatedAt: new Date().toISOString(),
  history: []
};

test('validateAndPrepareAnythingPatch accepts a full HTML document', async () => {
  const result = await validateAndPrepareAnythingPatch({
    currentState: CURRENT_STATE,
    proposedDiagramSource: HELLO_DOC,
    reason: 'test'
  });

  assert.equal(result.accepted, true);
  assert.equal(result.patch.contentType, 'anything');
  assert.equal(result.patch.previousRevisionId, 3);
  assert.equal(result.patch.nextRevisionId, 4);
  assert.equal(result.patch.styleConfig, null);
  assert.match(result.patch.diagramSource, /<h1>Hello<\/h1>/);
  assert.equal(result.metadata.validator, 'anything-html');
});

test('validateAndPrepareAnythingPatch rejects external URLs', async () => {
  const bad = HELLO_DOC.replace('<h1>', '<img src="https://evil.com/x.png"><h1>');
  const result = await validateAndPrepareAnythingPatch({
    currentState: CURRENT_STATE,
    proposedDiagramSource: bad,
    reason: 'test'
  });
  assert.equal(result.accepted, false);
  assert.match(result.error, /external URL/i);
});

test('validateAndPrepareAnythingPatch rejects JS syntax errors', async () => {
  const bad = HELLO_DOC.replace("document.title = 'hi';", 'function {');
  const result = await validateAndPrepareAnythingPatch({
    currentState: CURRENT_STATE,
    proposedDiagramSource: bad,
    reason: 'test'
  });
  assert.equal(result.accepted, false);
  assert.match(result.error, /Script block/i);
});

test('validateAndPrepareAnythingPatch strips a fenced html block', async () => {
  const result = await validateAndPrepareAnythingPatch({
    currentState: CURRENT_STATE,
    proposedDiagramSource: `\`\`\`html\n${HELLO_DOC}\n\`\`\``,
    reason: 'test'
  });

  assert.equal(result.accepted, true);
  assert.ok(!result.patch.diagramSource.includes('```'));
});

test('validateAndPrepareAnythingPatch rejects prose without markup', async () => {
  const result = await validateAndPrepareAnythingPatch({
    currentState: CURRENT_STATE,
    proposedDiagramSource: 'Sure! Here is a page about penguins.',
    reason: 'test'
  });

  assert.equal(result.accepted, false);
  assert.match(result.error, /does not look like markup/);
});

test('validateAnythingStrict mirrors the tool validation', () => {
  assert.equal(validateAnythingStrict(HELLO_DOC).valid, true);
  assert.equal(validateAnythingStrict('no tags here').valid, false);
  assert.equal(validateAnythingStrict(123).valid, false);
});

test('store applies HTML to the anything slot and keeps siblings untouched', async () => {
  const store = createDiagramStateStore();
  const mermaidBefore = store.getSlot('mermaid');

  const result = await store.applyDiagramSource({
    contentType: 'anything',
    diagramSource: HELLO_DOC,
    reason: 'agent update'
  });

  assert.equal(result.accepted, true);
  assert.equal(result.state.revisionId, 1);
  assert.equal(result.state.contentType, 'anything');
  assert.match(store.getSlot('anything').diagramSource, /<h1>Hello<\/h1>/);
  assert.equal(store.getSlot('mermaid'), mermaidBefore);
});

test('store rejects non-markup for the anything slot without mutating it', async () => {
  const store = createDiagramStateStore();
  const before = store.getSlot('anything');

  const result = await store.applyDiagramSource({
    contentType: 'anything',
    diagramSource: 'just prose',
    reason: 'bad update'
  });

  assert.equal(result.accepted, false);
  assert.equal(store.getSlot('anything'), before);
});

test('store syncs client HTML into the anything slot and accepts clearing', async () => {
  const store = createDiagramStateStore();

  const synced = await store.syncClientDiagramSource({
    contentType: 'anything',
    diagramSource: HELLO_DOC
  });
  assert.equal(synced.accepted, true);
  assert.equal(synced.state.revisionId, 1);

  const cleared = await store.syncClientDiagramSource({
    contentType: 'anything',
    diagramSource: ''
  });
  assert.equal(cleared.accepted, true);
  assert.equal(cleared.state.diagramSource, '');
});

test('store can activate the anything content type', () => {
  const store = createDiagramStateStore();
  const slot = store.setActiveContentType('anything');
  assert.equal(slot.contentType, 'anything');
  assert.equal(store.getActiveContentType(), 'anything');
});
