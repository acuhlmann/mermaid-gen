import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createSignalsRouter } from '../src/routes/signals.js';
import { recordUxSignal } from '../src/metrics/uxSignalMetrics.js';

const ON = { MERMAID_METRICS: '1' };
const retry = { kind: 'retry', contentType: 'mermaid', failureClass: 'timeout' };

/**
 * Mirrors production: `trust proxy 1` (bootstrapServer.js) and the global `express.json()` that
 * loadServerApp installs before every router.
 */
function bootServer(options = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  const recorded = [];
  const lines = [];
  const env = options.env ?? ON;
  app.use(
    '/api/signals',
    createSignalsRouter({
      env,
      record: (signal) => {
        recorded.push(signal);
        recordUxSignal(signal, { env, sink: (line) => lines.push(line) });
      },
      ...options
    })
  );
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      const close = () =>
        new Promise((done) => {
          server.closeAllConnections?.();
          server.close(() => done());
        });
      resolve({ port, recorded, lines, close });
    });
  });
}

function post(port, body, headers = {}) {
  const isText = typeof body === 'string';
  return fetch(`http://127.0.0.1:${port}/api/signals`, {
    method: 'POST',
    headers: {
      'content-type': isText ? 'text/plain;charset=UTF-8' : 'application/json',
      ...headers
    },
    body: isText ? body : JSON.stringify(body)
  });
}

test('signals: a valid JSON batch is recorded signal by signal and answered 204', async () => {
  const srv = await bootServer();
  try {
    const res = await post(srv.port, {
      v: 1,
      signals: [retry, { kind: 'run_stop', contentType: 'chart' }]
    });
    assert.equal(res.status, 204);
    assert.deepEqual(srv.recorded, [retry, { kind: 'run_stop', contentType: 'chart' }]);
  } finally {
    await srv.close();
  }
});

test('signals: a text/plain beacon body is accepted', async () => {
  const srv = await bootServer();
  try {
    const res = await post(srv.port, JSON.stringify({ v: 1, signals: [retry] }));
    assert.equal(res.status, 204);
    assert.equal(srv.recorded.length, 1);
  } finally {
    await srv.close();
  }
});

test('signals: log lines carry no IP, user agent, cookie or payload echo', async () => {
  const srv = await bootServer();
  try {
    await post(
      srv.port,
      { v: 1, signals: [retry] },
      {
        'user-agent': 'UniqueAgent/9.9',
        'x-forwarded-for': '198.51.100.23',
        cookie: 'archislop_visitor_badge=abc'
      }
    );
    assert.equal(srv.lines.length, 1);
    for (const needle of ['198.51.100.23', '127.0.0.1', 'UniqueAgent', 'archislop_visitor_badge']) {
      assert.equal(srv.lines[0].includes(needle), false, needle);
    }
  } finally {
    await srv.close();
  }
});

test('signals: extra fields, server kinds, oversize batches and junk are 400 with nothing recorded', async () => {
  const srv = await bootServer();
  try {
    const bodies = [
      { v: 1, signals: [{ ...retry, prompt: 'my secret' }] },
      { v: 1, signals: [{ kind: 'graph_edit', contentType: 'mermaid', afterAgent: true }] },
      { v: 1, signals: Array.from({ length: 51 }, () => retry) },
      { v: 2, signals: [retry] },
      'not json at all'
    ];
    for (const body of bodies) {
      const res = await post(srv.port, body);
      assert.equal(res.status, 400);
      const text = await res.text();
      assert.equal(text.includes('my secret'), false);
    }
    assert.deepEqual(srv.recorded, []);
  } finally {
    await srv.close();
  }
});

test('signals: switched off, the route still answers 204 and records nothing', async () => {
  const srv = await bootServer({ env: {} });
  try {
    const res = await post(srv.port, { v: 1, signals: [retry] });
    assert.equal(res.status, 204);
    assert.deepEqual(srv.recorded, []);
  } finally {
    await srv.close();
  }
});

test('signals: a body over 16 KB is refused', async () => {
  const srv = await bootServer();
  try {
    const padding = 'x'.repeat(17 * 1024);
    const res = await post(srv.port, { v: 1, signals: [retry], padding });
    assert.equal(res.status, 413);
    assert.deepEqual(srv.recorded, []);
  } finally {
    await srv.close();
  }
});

test('signals: the rate limit keys on req.ip, so a forged X-Forwarded-For prefix cannot evade it', async () => {
  const srv = await bootServer({ maxBatches: 2 });
  try {
    // Behind Cloud Run the trusted proxy appends the real client address last; anything before it
    // is whatever the client wrote. The old first-entry key would have given each request a fresh
    // bucket here.
    const statuses = [];
    for (let i = 0; i < 3; i++) {
      const res = await post(
        srv.port,
        { v: 1, signals: [retry] },
        { 'x-forwarded-for': `10.0.0.${i}, 203.0.113.7` }
      );
      statuses.push(res.status);
    }
    assert.deepEqual(statuses, [204, 204, 429]);
  } finally {
    await srv.close();
  }
});
