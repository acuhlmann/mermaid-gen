import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAdvisorRouter } from '../src/routes/advisor.js';

function bootServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/advisor', createAdvisorRouter());
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

async function postSuggest(port, body) {
  return fetch(`http://127.0.0.1:${port}/api/advisor/suggest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

test('advisor suggest accepts chart and anything content types', async () => {
  const { port, closeServer } = await bootServer();
  try {
    for (const contentType of ['chart', 'anything']) {
      const res = await postSuggest(port, {
        persona: 'refine',
        contentType,
        diagramSource: ''
      });
      assert.equal(res.status, 200, `${contentType} should pass schema`);
      const body = await res.json();
      assert.equal(body.persona, 'refine');
      assert.equal(body.suggestion, null);
    }
  } finally {
    await closeServer();
  }
});
