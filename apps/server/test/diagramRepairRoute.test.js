import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createDiagramRepairRouter } from '../src/routes/diagramRepair.js';
import { createDiagramStateStore } from '../src/state/diagramStateStore.js';

function bootServer({ stateStore, repairImpl, isFixerAvailable }) {
  const app = express();
  app.use(express.json());
  const sessionId = 'test-session';
  app.use(
    '/api/diagram',
    createDiagramRepairRouter({
      resolveServices: () => ({ sessionId, stateStore }),
      env: { OPENROUTER_API_KEY: 'test' },
      repairImpl,
      isFixerAvailable: isFixerAvailable ?? (() => true)
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
