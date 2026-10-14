import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHmac } from 'node:crypto';
import {
  GOD_INGEST_SIGNATURE_HEADER,
  GOD_INGEST_TIMESTAMP_HEADER,
  createIngestClient,
  signGodIngestBody
} from './ingestClient.mjs';

async function startSink(status = 204) {
  const received = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    received.push({ headers: req.headers, body: Buffer.concat(chunks).toString('utf8') });
    res.writeHead(status);
    res.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/api/god/live`,
    received,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      })
  };
}

const event = (seq) => ({ seq, ts: '2026-10-14T07:00:00.000Z', type: 'status', text: 'x' });

test('the signature is HMAC-SHA256 over "<timestamp>.<body>"', () => {
  const expected = createHmac('sha256', 'secret').update('1700000000.{"a":1}').digest('hex');
  assert.equal(signGodIngestBody('secret', '1700000000', '{"a":1}'), `sha256=${expected}`);
});

test('without a URL or secret the client is a silent no-op', async () => {
  for (const options of [
    { url: null, secret: 's' },
    { url: 'http://x', secret: '' }
  ]) {
    const client = createIngestClient({ ...options, runId: '1' });
    assert.equal(client.enabled, false);
    client.push(event(0));
    await client.close();
    assert.deepEqual(client.stats(), { sent: 0, failed: 0, dropped: 0 });
  }
});

test('batches are signed, timestamped and carry the run id', async () => {
  const sink = await startSink();
  try {
    const client = createIngestClient({
      url: sink.url,
      secret: 'shh',
      runId: '18234567890',
      nowSeconds: () => 1_760_000_000
    });
    client.push(event(0));
    client.push(event(1));
    await client.close();
    assert.equal(sink.received.length, 1);
    const [{ headers, body }] = sink.received;
    assert.equal(headers[GOD_INGEST_TIMESTAMP_HEADER], '1760000000');
    assert.equal(
      headers[GOD_INGEST_SIGNATURE_HEADER],
      signGodIngestBody('shh', '1760000000', body)
    );
    assert.deepEqual(JSON.parse(body), { runId: '18234567890', events: [event(0), event(1)] });
    assert.equal(client.stats().sent, 2);
  } finally {
    await sink.close();
  }
});

test('a rejected or unreachable endpoint is counted, never retried, never thrown', async () => {
  const sink = await startSink(401);
  try {
    const client = createIngestClient({ url: sink.url, secret: 's', runId: '1' });
    client.push(event(0));
    await client.close();
    assert.equal(client.stats().failed, 1);
    const dead = createIngestClient({ url: 'http://127.0.0.1:9/x', secret: 's', runId: '1' });
    dead.push(event(0));
    await dead.close();
    assert.equal(dead.stats().failed, 1);
  } finally {
    await sink.close();
  }
});
