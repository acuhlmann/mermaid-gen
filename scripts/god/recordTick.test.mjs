import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GodRunRecordSchema } from '@archislop/shared/godSchemas.js';
import { buildTickRecord, main } from './recordTick.mjs';

test('buildTickRecord validates a noop tick', () => {
  const record = buildTickRecord({
    'run-id': '12345',
    reason: 'disabled',
    tier: 'observe',
    focus: 'any',
    go: 'false',
    trigger: 'schedule',
    now: '2026-10-15T07:17:00.000Z'
  });
  assert.equal(record.verdict, 'noop');
  assert.deepEqual(GodRunRecordSchema.parse(record), record);
});

test('main writes runs/ and index/', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'god-tick-'));
  const result = main([
    '--out-dir',
    dir,
    '--run-id',
    '999',
    '--go',
    'true',
    '--reason',
    'go',
    '--tier',
    'propose',
    '--now',
    '2026-10-15T07:17:00.000Z'
  ]);
  assert.equal(result.record.verdict, 'observed');
  assert.ok(fs.existsSync(path.join(dir, 'runs', '999.json')));
  assert.ok(fs.existsSync(path.join(dir, 'index', '2026-10.json')));
});
