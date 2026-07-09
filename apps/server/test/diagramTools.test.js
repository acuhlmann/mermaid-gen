import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnythingTools, createDiagramTools } from '../src/agents/diagramTools.js';
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

const ANYTHING_DOC = `<!DOCTYPE html>
<html>
  <head><style>body { margin: 0; font-family: sans-serif; }</style></head>
  <body>
    <h1>Solar System</h1>
    <p>Pick a planet.</p>
    <script>document.title = 'planets';</script>
  </body>
</html>`;

async function seedAnythingSlot(stateStore) {
  const seeded = await stateStore.applyDiagramSource({
    contentType: 'anything',
    diagramSource: ANYTHING_DOC,
    reason: 'seed'
  });
  assert.equal(seeded.accepted, true);
}

test('apply_anything_edit applies scoped edits through the full validation ladder', async () => {
  const stateStore = createDiagramStateStore();
  await seedAnythingSlot(stateStore);
  const [, , applyAnythingEdit] = createAnythingTools({ stateStore });

  const payload = await applyAnythingEdit.invoke({
    edits: [{ search: '<h1>Solar System</h1>', replace: '<h1>The Solar System</h1>' }],
    reason: 'sharpen title'
  });
  const result = JSON.parse(payload);

  assert.equal(result.accepted, true);
  assert.equal(result.state.revisionId, 2);
  const source = stateStore.getSlot('anything').diagramSource;
  assert.match(source, /<h1>The Solar System<\/h1>/);
  assert.match(source, /Pick a planet/);
});

test('apply_anything_edit rejects when there is no current document', async () => {
  const stateStore = createDiagramStateStore();
  const [, , applyAnythingEdit] = createAnythingTools({ stateStore });

  const payload = await applyAnythingEdit.invoke({
    edits: [{ search: '<h1>x</h1>', replace: '<h1>y</h1>' }],
    reason: 'edit nothing'
  });
  const result = JSON.parse(payload);

  assert.equal(result.accepted, false);
  assert.match(result.error, /apply_anything_patch/);
});

test('apply_anything_edit rejects unmatched search blocks without touching state', async () => {
  const stateStore = createDiagramStateStore();
  await seedAnythingSlot(stateStore);
  const before = stateStore.getSlot('anything');
  const [, , applyAnythingEdit] = createAnythingTools({ stateStore });

  const payload = await applyAnythingEdit.invoke({
    edits: [{ search: '<h2>Not There</h2>', replace: '<h2>y</h2>' }],
    reason: 'bad edit'
  });
  const result = JSON.parse(payload);

  assert.equal(result.accepted, false);
  assert.match(result.error, /No edits were applied/);
  assert.equal(stateStore.getSlot('anything'), before);
});

test('apply_anything_edit cannot smuggle sandbox violations past the policy lint', async () => {
  const stateStore = createDiagramStateStore();
  await seedAnythingSlot(stateStore);
  const before = stateStore.getSlot('anything');
  const [, , applyAnythingEdit] = createAnythingTools({ stateStore });

  const payload = await applyAnythingEdit.invoke({
    edits: [
      {
        search: "<script>document.title = 'planets';</script>",
        replace: '<script>window.parent.location = "https://evil.example";</script>'
      }
    ],
    reason: 'malicious edit'
  });
  const result = JSON.parse(payload);

  assert.equal(result.accepted, false);
  assert.equal(stateStore.getSlot('anything'), before);
});

test('apply_anything_edit rejects edits that break the page at runtime', async () => {
  const stateStore = createDiagramStateStore();
  await seedAnythingSlot(stateStore);
  const before = stateStore.getSlot('anything');
  const [, , applyAnythingEdit] = createAnythingTools({ stateStore });

  const payload = await applyAnythingEdit.invoke({
    edits: [
      {
        search: "<script>document.title = 'planets';</script>",
        replace: '<script>missingFunction();</script>'
      }
    ],
    reason: 'broken edit'
  });
  const result = JSON.parse(payload);

  assert.equal(result.accepted, false);
  assert.equal(stateStore.getSlot('anything'), before);
});

test('apply_anything_edit rejects no-op edits', async () => {
  const stateStore = createDiagramStateStore();
  await seedAnythingSlot(stateStore);
  const [, , applyAnythingEdit] = createAnythingTools({ stateStore });

  const payload = await applyAnythingEdit.invoke({
    edits: [{ search: '<h1>Solar System</h1>', replace: '<h1>Solar System</h1>' }],
    reason: 'no-op'
  });
  const result = JSON.parse(payload);

  assert.equal(result.accepted, false);
  assert.match(result.error, /no change/);
});
