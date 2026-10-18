import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GOD_INGEST_MAX_SKEW_SEC,
  GOD_INGEST_SIGNATURE_HEADER,
  GOD_INGEST_TIMESTAMP_HEADER
} from '../src/godIngest.js';

test('god ingest wire constants are stable', () => {
  assert.equal(GOD_INGEST_SIGNATURE_HEADER, 'x-god-signature');
  assert.equal(GOD_INGEST_TIMESTAMP_HEADER, 'x-god-timestamp');
  assert.equal(GOD_INGEST_MAX_SKEW_SEC, 300);
});
