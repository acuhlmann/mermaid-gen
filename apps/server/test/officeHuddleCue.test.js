/**
 * The pair's unprompted turns on the wire: an edit reaction and a lull.
 *
 * Its own file, not a case in `officeRoute.test.js`, because the office router
 * sits behind a module-level per-IP LLM rate limiter (60 a minute) and that file
 * already spends 57 of them; one process per file gives this one a fresh budget.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createOfficeRouter } from '../src/routes/office.js';
import { UNCONFIGURED_LLM_ENV } from './helpers/testEnv.js';

function bootServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/office', createOfficeRouter({ env: UNCONFIGURED_LLM_ENV }));
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const closeServer = () =>
        new Promise((done) => {
          server.closeAllConnections?.();
          server.close(() => done());
        });
      resolve({ port: server.address().port, closeServer });
    });
  });
}

function postHuddle(port, body) {
  return fetch(`http://127.0.0.1:${port}/api/office/huddle`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'pair', attendees: ['gilfoyle'], ...body })
  });
}

test('office huddle accepts the unprompted pair cues and rejects unknown ones', async () => {
  const { port, closeServer } = await bootServer();
  try {
    // An edit reaction carries what you changed as its own transcript role.
    const edit = await postHuddle(port, {
      cue: 'edit',
      turns: [
        { role: 'partner', text: 'Auth is doing two jobs.' },
        { role: 'edit', text: 'added a box "Cache"' }
      ]
    });
    assert.equal(edit.status, 503, 'reaches the model gate, not a 400');

    const lull = await postHuddle(port, {
      cue: 'lull',
      turns: [{ role: 'partner', text: 'Auth is doing two jobs.' }]
    });
    assert.equal(lull.status, 503);

    const unknown = await postHuddle(port, { cue: 'nag' });
    assert.equal(unknown.status, 400);
  } finally {
    await closeServer();
  }
});
