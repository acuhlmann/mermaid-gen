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
  assert.equal(result.metadata.runtimeChecked, true);
});

test('validateAndPrepareAnythingPatch rejects when the runtime check fails', async () => {
  const result = await validateAndPrepareAnythingPatch({
    currentState: CURRENT_STATE,
    proposedDiagramSource: HELLO_DOC,
    reason: 'test',
    runtimeCheckImpl: async () => ({
      ok: false,
      code: 'runtime_error',
      error: 'Page JavaScript failed at runtime:\n- ReferenceError: boom',
      warnings: []
    })
  });

  assert.equal(result.accepted, false);
  assert.equal(result.code, 'runtime_error');
  assert.match(result.error, /ReferenceError: boom/);
});

test('validateAndPrepareAnythingPatch merges runtime warnings into metadata', async () => {
  const result = await validateAndPrepareAnythingPatch({
    currentState: CURRENT_STATE,
    proposedDiagramSource: HELLO_DOC,
    reason: 'test',
    runtimeCheckImpl: async () => ({ ok: true, warnings: ['console.error: minor noise'] })
  });

  assert.equal(result.accepted, true);
  assert.deepEqual(result.metadata.warnings, ['console.error: minor noise']);
});

test('validateAndPrepareAnythingPatch skips the runtime layer when asked or disabled', async () => {
  const neverCalled = async () => {
    throw new Error('runtime check must not run');
  };

  const skipped = await validateAndPrepareAnythingPatch({
    currentState: CURRENT_STATE,
    proposedDiagramSource: HELLO_DOC,
    reason: 'test',
    runtimeCheck: false,
    runtimeCheckImpl: neverCalled
  });
  assert.equal(skipped.accepted, true);
  assert.equal(skipped.metadata.runtimeChecked, false);

  const disabled = await validateAndPrepareAnythingPatch({
    currentState: CURRENT_STATE,
    proposedDiagramSource: HELLO_DOC,
    reason: 'test',
    env: { ANYTHING_RUNTIME_CHECK: '0' },
    runtimeCheckImpl: neverCalled
  });
  assert.equal(disabled.accepted, true);
  assert.equal(disabled.metadata.runtimeChecked, false);
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

// Runtime-clean statically (valid JS syntax), broken the moment it executes.
const RUNTIME_BROKEN_DOC = `<!DOCTYPE html>
<html>
  <head></head>
  <body><h1>Broken</h1><script>callThatDoesNotExist();</script></body>
</html>`;

test('store agent apply rejects runtime-broken HTML (end-to-end runtime check)', async () => {
  const store = createDiagramStateStore();
  const before = store.getSlot('anything');

  const result = await store.applyDiagramSource({
    contentType: 'anything',
    diagramSource: RUNTIME_BROKEN_DOC,
    reason: 'agent update'
  });

  assert.equal(result.accepted, false);
  assert.equal(result.code, 'runtime_error');
  assert.match(result.error, /callThatDoesNotExist/);
  assert.equal(store.getSlot('anything'), before);
});

test('store client sync accepts runtime-broken HTML (runtime check is agent-only)', async () => {
  const store = createDiagramStateStore();

  const synced = await store.syncClientDiagramSource({
    contentType: 'anything',
    diagramSource: RUNTIME_BROKEN_DOC
  });

  assert.equal(synced.accepted, true);
  assert.match(synced.state.diagramSource, /callThatDoesNotExist/);
});

test('store can activate the anything content type', () => {
  const store = createDiagramStateStore();
  const slot = store.setActiveContentType('anything');
  assert.equal(slot.contentType, 'anything');
  assert.equal(store.getActiveContentType(), 'anything');
});

// ── @lib: markers (allowlisted inline libraries) ─────────────────────────────

const D3_MARKER_DOC = `<!DOCTYPE html>
<html>
  <head><!-- @lib:d3 --><style>body { margin: 0; }</style></head>
  <body>
    <h1>Bars</h1><svg id="viz" width="300" height="120"></svg>
    <script>
      const data = [4, 8, 15, 16];
      d3.select('#viz').selectAll('rect').data(data).join('rect')
        .attr('x', (d, i) => i * 72)
        .attr('y', (d) => 120 - d * 4)
        .attr('width', 60)
        .attr('height', (d) => d * 4);
    </script>
  </body>
</html>`;

test('marker doc: stored patch keeps the marker; runtime check gets the expanded doc', async () => {
  let runtimeInput = null;
  const result = await validateAndPrepareAnythingPatch({
    currentState: CURRENT_STATE,
    proposedDiagramSource: D3_MARKER_DOC,
    reason: 'test',
    runtimeCheckImpl: async (html) => {
      runtimeInput = html;
      return { ok: true, warnings: [] };
    }
  });

  assert.equal(result.accepted, true);
  assert.deepEqual(result.metadata.libs, ['d3']);
  // The revision that will be stored/synced/exposed over MCP stays marker-form…
  assert.match(result.patch.diagramSource, /<!-- @lib:d3 -->/);
  assert.ok(!result.patch.diagramSource.includes('data-archislop-lib'));
  // …while the executed document carries the vendored source instead.
  assert.match(runtimeInput, /<script data-archislop-lib="d3"/);
  assert.ok(!runtimeInput.includes('@lib:d3'));
});

test('unknown lib marker is rejected with the allowlist in the error', async () => {
  const result = await validateAndPrepareAnythingPatch({
    currentState: CURRENT_STATE,
    proposedDiagramSource: HELLO_DOC.replace('<head>', '<head><!-- @lib:jquery -->'),
    reason: 'test'
  });

  assert.equal(result.accepted, false);
  assert.equal(result.code, 'unknown_lib');
  assert.match(result.error, /@lib:jquery/);
  assert.match(result.error, /@lib:d3/);
});

test('validateAnythingStrict rejects unknown lib markers too', () => {
  const result = validateAnythingStrict(HELLO_DOC.replace('<head>', '<head><!-- @lib:nope -->'));
  assert.equal(result.valid, false);
  assert.equal(result.code, 'unknown_lib');
  assert.equal(result.validator, 'anything-html-lib');
});

test('marker doc passes the real jsdom runtime check with d3 injected (end-to-end)', async () => {
  const result = await validateAndPrepareAnythingPatch({
    currentState: CURRENT_STATE,
    proposedDiagramSource: D3_MARKER_DOC,
    reason: 'test'
  });

  assert.equal(result.accepted, true, result.accepted ? undefined : result.error);
  assert.equal(result.metadata.runtimeChecked, true);
});

test('using d3 without the marker fails the runtime check (no ambient injection)', async () => {
  const result = await validateAndPrepareAnythingPatch({
    currentState: CURRENT_STATE,
    proposedDiagramSource: D3_MARKER_DOC.replace('<!-- @lib:d3 -->', ''),
    reason: 'test'
  });

  assert.equal(result.accepted, false);
  assert.equal(result.code, 'runtime_error');
  assert.match(result.error, /d3/);
});
