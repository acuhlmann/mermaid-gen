import test from 'node:test';
import assert from 'node:assert/strict';
import { signGodIngestBody, verifyGodIngestRequest } from '../src/god/godIngestAuth.js';

test('verifyGodIngestRequest accepts a matching signature inside the skew window', () => {
  const body = '{"runId":"1","events":[]}';
  const ts = 1_760_000_000;
  const sig = signGodIngestBody('secret', ts, body);
  const result = verifyGodIngestRequest({
    secret: 'secret',
    timestampHeader: String(ts),
    signatureHeader: sig,
    body,
    nowSec: ts + 10
  });
  assert.equal(result.ok, true);
});
