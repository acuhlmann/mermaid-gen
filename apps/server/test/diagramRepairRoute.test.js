import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createDiagramRepairRouter } from '../src/routes/diagramRepair.js';
import { createDiagramStateStore } from '../src/state/diagramStateStore.js';

function bootServer({
  stateStore,
  repairImpl,
  isFixerAvailable,
  repairAnythingImpl,
  isAnythingFixerAvailable
}) {
  const app = express();
  app.use(express.json());
  const sessionId = 'test-session';
  app.use(
    '/api/diagram',
    createDiagramRepairRouter({
      resolveServices: () => ({ sessionId, stateStore }),
      env: { OPENROUTER_API_KEY: 'test' },
      repairImpl,
      isFixerAvailable: isFixerAvailable ?? (() => true),
      repairAnythingImpl,
      isAnythingFixerAvailable: isAnythingFixerAvailable ?? (() => true)
    })
  );
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const closeServer = () =>
        new Promise((done) => {
          server.closeAllConnections?.();
          server.close(() => done());
        });
      resolve({ port, closeServer });
    });
  });
}

async function postRenderError(port, body) {
  return fetch(`http://127.0.0.1:${port}/api/diagram/render-error`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

test('render-error repair: happy path applies fixer output and bumps revision', async () => {
  const stateStore = createDiagramStateStore();
  // Seed with a source that passes parser validation but supposedly fails browser render.
  await stateStore.applyDiagramSource({
    contentType: 'mermaid',
    diagramSource: 'flowchart TD\n  A --> B',
    reason: 'seed'
  });
  const seeded = stateStore.getSlot('mermaid');

  const fakeFixer = async () => ({
    accepted: true,
    diagramSource: 'flowchart TD\n  A[Start] --> B[End]'
  });

  const { port, closeServer } = await bootServer({ stateStore, repairImpl: fakeFixer });
  try {
    const res = await postRenderError(port, {
      revisionId: seeded.revisionId,
      source: seeded.diagramSource,
      renderError: 'theme "forrest" is not registered'
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.repaired, true);
    assert.match(body.state.diagramSource, /A\[Start\]/);
    assert.ok(body.state.revisionId > seeded.revisionId);
  } finally {
    await closeServer();
  }
});

test('render-error repair: stale revision returns reason:stale without touching state', async () => {
  const stateStore = createDiagramStateStore();
  await stateStore.applyDiagramSource({
    contentType: 'mermaid',
    diagramSource: 'flowchart TD\n  A --> B',
    reason: 'seed'
  });
  const current = stateStore.getSlot('mermaid');

  let fixerCalls = 0;
  const fakeFixer = async () => {
    fixerCalls += 1;
    return { accepted: true, diagramSource: 'flowchart TD\n  X --> Y' };
  };

  const { port, closeServer } = await bootServer({ stateStore, repairImpl: fakeFixer });
  try {
    const res = await postRenderError(port, {
      revisionId: current.revisionId - 1,
      source: 'flowchart TD\n  A --> B',
      renderError: 'oops'
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.repaired, false);
    assert.equal(body.reason, 'stale');
    assert.equal(fixerCalls, 0, 'fixer should not run on stale revision');
    assert.equal(stateStore.getSlot('mermaid').revisionId, current.revisionId);
  } finally {
    await closeServer();
  }
});

test('render-error repair: returns 503 when fixer is not configured', async () => {
  const stateStore = createDiagramStateStore();
  await stateStore.applyDiagramSource({
    contentType: 'mermaid',
    diagramSource: 'flowchart TD\n  A --> B',
    reason: 'seed'
  });
  const seeded = stateStore.getSlot('mermaid');

  const { port, closeServer } = await bootServer({
    stateStore,
    repairImpl: async () => ({ accepted: false, error: 'should not be called' }),
    isFixerAvailable: () => false
  });
  try {
    const res = await postRenderError(port, {
      revisionId: seeded.revisionId,
      source: seeded.diagramSource,
      renderError: 'x'
    });
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.repaired, false);
    assert.match(body.error, /not configured/);
  } finally {
    await closeServer();
  }
});

test('render-error repair: fixer rejection surfaces as repaired:false', async () => {
  const stateStore = createDiagramStateStore();
  await stateStore.applyDiagramSource({
    contentType: 'mermaid',
    diagramSource: 'flowchart TD\n  A --> B',
    reason: 'seed'
  });
  const seeded = stateStore.getSlot('mermaid');

  const { port, closeServer } = await bootServer({
    stateStore,
    repairImpl: async () => ({ accepted: false, error: 'fixer gave up' })
  });
  try {
    const res = await postRenderError(port, {
      revisionId: seeded.revisionId,
      source: seeded.diagramSource,
      renderError: 'x'
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.repaired, false);
    assert.match(body.error, /fixer gave up/);
    assert.equal(stateStore.getSlot('mermaid').revisionId, seeded.revisionId);
  } finally {
    await closeServer();
  }
});

test('render-error repair: invalid payload returns 400', async () => {
  const stateStore = createDiagramStateStore();
  const { port, closeServer } = await bootServer({
    stateStore,
    repairImpl: async () => ({ accepted: false })
  });
  try {
    const res = await postRenderError(port, { revisionId: -1, source: '', renderError: '' });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.repaired, false);
  } finally {
    await closeServer();
  }
});

const VALID_ANYTHING_DOC =
  '<!DOCTYPE html>\n<html>\n<head><style>body { margin: 0; }</style></head>\n' +
  '<body>\n<h1>Repaired</h1><p>Now valid.</p>\n</body>\n</html>';

const BROKEN_ANYTHING_DOC =
  '<!DOCTYPE html>\n<html>\n<head><style>body { margin: 0; }</style></head>\n' +
  '<body>\n<h1>Broken</h1>\n</body>\n</html>';

test('render-error repair: anything routes to the anything fixer and applies to the anything slot', async (t) => {
  // The runtime check spawns a jsdom child process; it has its own coverage
  // (anythingRuntimeCheck.test.js). Disable it here so the route test stays fast
  // and deterministic — we're asserting routing + apply, not the ladder itself.
  const prev = process.env.ANYTHING_RUNTIME_CHECK;
  process.env.ANYTHING_RUNTIME_CHECK = '0';
  t.after(() => {
    if (prev === undefined) delete process.env.ANYTHING_RUNTIME_CHECK;
    else process.env.ANYTHING_RUNTIME_CHECK = prev;
  });

  const stateStore = createDiagramStateStore();
  await stateStore.applyDiagramSource({
    contentType: 'anything',
    diagramSource: BROKEN_ANYTHING_DOC,
    reason: 'seed'
  });
  const seeded = stateStore.getSlot('anything');

  let mermaidFixerCalls = 0;
  const { port, closeServer } = await bootServer({
    stateStore,
    // Prove the mermaid fixer is NOT called for an anything payload.
    repairImpl: async () => {
      mermaidFixerCalls += 1;
      return { accepted: true, diagramSource: 'flowchart TD\n  A --> B' };
    },
    repairAnythingImpl: async () => ({ accepted: true, diagramSource: VALID_ANYTHING_DOC })
  });
  try {
    const res = await postRenderError(port, {
      revisionId: seeded.revisionId,
      source: seeded.diagramSource,
      renderError: 'Uncaught ReferenceError: foo is not defined',
      contentType: 'anything'
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.repaired, true);
    assert.equal(body.state.contentType, 'anything');
    assert.match(body.state.diagramSource, /Now valid/);
    assert.ok(body.state.revisionId > seeded.revisionId);
    assert.equal(mermaidFixerCalls, 0, 'mermaid fixer must not run for anything payloads');
  } finally {
    await closeServer();
  }
});

test('render-error repair: anything returns 503 when the anything fixer is unconfigured', async () => {
  const stateStore = createDiagramStateStore();
  const { port, closeServer } = await bootServer({
    stateStore,
    repairAnythingImpl: async () => ({ accepted: false, error: 'should not be called' }),
    isAnythingFixerAvailable: () => false
  });
  try {
    const res = await postRenderError(port, {
      revisionId: 0,
      source: BROKEN_ANYTHING_DOC,
      renderError: 'x',
      contentType: 'anything'
    });
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.repaired, false);
    assert.match(body.error, /not configured/);
  } finally {
    await closeServer();
  }
});
