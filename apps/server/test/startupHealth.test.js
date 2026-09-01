import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createStartupHealthRoute } from '../src/startupHealth.js';

/** Mount the startup route ahead of the real one, the way `bootstrapServer` does. */
async function withApp(isReady, run) {
  const app = express();
  app.get('/api/health', createStartupHealthRoute(isReady));
  // Stand-in for what `attachRoutes` registers later in the stack.
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', runtimeReady: true }));

  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, () => resolve(listener));
    listener.on('error', reject);
  });
  try {
    await run(server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('the startup window answers /api/health 503, so the probe is not just a socket check', async () => {
  await withApp(
    () => false,
    async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      // 200 here is what makes Cloud Run release the queued cold-start request
      // into an app with no static handler, no SPA fallback and no API routes:
      // `Cannot GET /` instead of the waking shell. See startupHealth.js.
      assert.equal(res.status, 503);
      assert.deepEqual(await res.json(), { status: 'starting', runtimeReady: false });
    }
  );
});

test('the startup window response is one coldStartGate reads as "still waking"', async () => {
  await withApp(
    () => false,
    async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      // The two halves of `isHealthReadyResponse` in
      // apps/web/src/utils/coldStartGate.js: `!response.ok` short-circuits, and
      // the body would fail the `runtimeReady !== false` check anyway.
      assert.equal(res.ok, false);
      assert.equal((await res.json()).runtimeReady, false);
    }
  );
});

test('once the runtime is up the real health route owns the path again', async () => {
  await withApp(
    () => true,
    async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { status: 'ok', runtimeReady: true });
    }
  );
});

test('readiness is read per request, not captured when the route is built', async () => {
  let ready = false;
  await withApp(
    () => ready,
    async (port) => {
      assert.equal((await fetch(`http://127.0.0.1:${port}/api/health`)).status, 503);
      ready = true;
      assert.equal((await fetch(`http://127.0.0.1:${port}/api/health`)).status, 200);
    }
  );
});
