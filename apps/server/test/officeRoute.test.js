import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createOfficeRouter } from '../src/routes/office.js';

function bootServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/office', createOfficeRouter());
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

async function post(port, path, body) {
  return fetch(`http://127.0.0.1:${port}/api/office/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

test('office moment rejects unknown kinds and colleagues', async () => {
  const { port, closeServer } = await bootServer();
  try {
    const badKind = await post(port, 'moment', { kind: 'fax', colleagueId: 'facilities' });
    assert.equal(badKind.status, 400);
    const badColleague = await post(port, 'moment', { kind: 'email', colleagueId: 'theCeo' });
    assert.equal(badColleague.status, 400);
  } finally {
    await closeServer();
  }
});

test('office walkby with an empty diagram short-circuits to a null moment', async () => {
  const { port, closeServer } = await bootServer();
  try {
    const res = await post(port, 'moment', {
      kind: 'walkby',
      colleagueId: 'greybeard',
      diagramSource: '   '
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.moment, null);
  } finally {
    await closeServer();
  }
});

test('office moment reports 503 when no LLM is configured', async () => {
  // The test environment has no provider keys, so the model factory yields null.
  const { port, closeServer } = await bootServer();
  try {
    const res = await post(port, 'moment', {
      kind: 'email',
      colleagueId: 'facilities',
      diagramSource: 'flowchart TD\n A-->B'
    });
    assert.equal(res.status, 503);
  } finally {
    await closeServer();
  }
});

test('office speak returns audio:null when TTS is disabled', async () => {
  const prev = process.env.OFFICE_TTS;
  process.env.OFFICE_TTS = '0';
  const { port, closeServer } = await bootServer();
  try {
    const res = await post(port, 'speak', {
      speakerId: 'intern',
      text: 'sorry if this is a dumb question',
      lang: 'en-US'
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.audio, null);
    assert.equal(body.reason, 'disabled');
  } finally {
    if (prev === undefined) delete process.env.OFFICE_TTS;
    else process.env.OFFICE_TTS = prev;
    await closeServer();
  }
});

test('office speak rejects unknown speakers', async () => {
  const { port, closeServer } = await bootServer();
  try {
    const res = await post(port, 'speak', { speakerId: 'theCeo', text: 'hello' });
    assert.equal(res.status, 400);
  } finally {
    await closeServer();
  }
});

test('office meeting validates the attendee list before touching the model', async () => {
  const { port, closeServer } = await bootServer();
  try {
    const tooFew = await post(port, 'meeting', { attendees: ['scrumMaster', 'exec'] });
    assert.equal(tooFew.status, 400);
    const unknownOnly = await post(port, 'meeting', {
      attendees: ['ghost', 'phantom', 'spectre']
    });
    assert.equal(unknownOnly.status, 400);
    const valid = await post(port, 'meeting', {
      attendees: ['scrumMaster', 'exec', 'greybeard', 'intern'],
      diagramSource: 'flowchart TD\n A-->B'
    });
    assert.equal(valid.status, 503, 'valid seats reach the (unconfigured) model gate');
  } finally {
    await closeServer();
  }
});

test('office interject requires a non-empty interjection', async () => {
  const { port, closeServer } = await bootServer();
  try {
    const res = await post(port, 'meeting/interject', {
      attendees: ['scrumMaster', 'exec', 'greybeard'],
      interjection: ''
    });
    assert.equal(res.status, 400);
  } finally {
    await closeServer();
  }
});
