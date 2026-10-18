import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { signGodIngestBody } from '../src/god/godIngestAuth.js';
import { createGodLiveIngestHandler, createGodLiveReadRouter } from '../src/routes/godLive.js';
import { resetGodLiveStore } from '../src/god/godLiveStore.js';

const NOW = Date.parse('2026-10-18T12:00:00.000Z');
const ENV = { GOD_INGEST_SECRET: 'ingest-test-secret' };

const event = (seq) => ({
  seq,
  ts: '2026-10-18T12:00:00.000Z',
  type: 'status',
  text: `step-${seq}`
});

function postLive(app, body, { secret = ENV.GOD_INGEST_SECRET, ts = Math.floor(NOW / 1000) } = {}) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      fetch(`http://127.0.0.1:${port}/api/god/live`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-god-timestamp': String(ts),
          'x-god-signature': signGodIngestBody(secret, ts, raw)
        },
        body: raw
      })
        .then(async (res) => {
          server.close();
          resolve({ status: res.status, text: await res.text() });
        })
        .catch((err) => {
          server.close();
          reject(err);
        });
    });
  });
}

test('POST /api/god/live accepts a signed batch and GET returns events after a cursor', async () => {
  resetGodLiveStore();
  const app = express();
  app.post(
    '/api/god/live',
    express.raw({ type: 'application/json' }),
    createGodLiveIngestHandler({ env: ENV, nowMs: () => NOW })
  );
  app.use('/api/god', createGodLiveReadRouter());

  app.use('/api/god', createGodLiveReadRouter());

  const batch = { runId: '18234567890', events: [event(0), event(1)] };
  const posted = await postLive(app, batch);
  assert.equal(posted.status, 204);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/api/god/live/18234567890?after=-1`);
  const json = await res.json();
  server.close();
  assert.equal(json.events.length, 2);
  assert.equal(json.lastSeq, 1);
});

test('POST /api/god/live rejects replayed sequence numbers', async () => {
  resetGodLiveStore();
  const app = express();
  app.post(
    '/api/god/live',
    express.raw({ type: 'application/json' }),
    createGodLiveIngestHandler({ env: ENV, nowMs: () => NOW })
  );

  await postLive(app, { runId: '1', events: [event(0)] });
  const replay = await postLive(app, { runId: '1', events: [event(0)] });
  assert.equal(replay.status, 409);
});

test('POST /api/god/live fails closed when the secret is unset', async () => {
  resetGodLiveStore();
  const app = express();
  app.post(
    '/api/god/live',
    express.raw({ type: 'application/json' }),
    createGodLiveIngestHandler({ env: {}, nowMs: () => NOW })
  );
  const res = await postLive(app, { runId: '1', events: [event(0)] });
  assert.equal(res.status, 503);
});
