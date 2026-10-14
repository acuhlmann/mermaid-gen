import test from 'node:test';
import assert from 'node:assert/strict';
import { isUxSignalsEnabled, recordUxSignal } from '../src/metrics/uxSignalMetrics.js';

const ON = { MERMAID_METRICS: '1', APP_BUILD_SHA: '409d700abc12' };
const signal = { kind: 'retry', contentType: 'mermaid', failureClass: 'timeout' };

function capture(env, value = signal) {
  const lines = [];
  const out = recordUxSignal(value, { env, sink: (line) => lines.push(line) });
  return { out, lines };
}

test('ux signals follow MERMAID_METRICS and have their own kill switch', () => {
  assert.equal(isUxSignalsEnabled({}), false);
  assert.equal(isUxSignalsEnabled(ON), true);
  assert.equal(isUxSignalsEnabled({ ...ON, UX_SIGNALS: '0' }), false);
  assert.equal(isUxSignalsEnabled({ ...ON, UX_SIGNALS: 'off' }), false);
  assert.equal(isUxSignalsEnabled({ ...ON, UX_SIGNALS: '1' }), true);
  assert.equal(isUxSignalsEnabled({ UX_SIGNALS: '1' }), false);
});

test('recordUxSignal writes one tagged, build-stamped line', () => {
  const { out, lines } = capture(ON);
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.tag, 'ux_signal');
  assert.equal(parsed.sha, '409d700abc12');
  assert.equal(parsed.kind, 'retry');
  assert.equal(parsed.failureClass, 'timeout');
  assert.deepEqual(Object.keys(parsed).sort(), [
    'contentType',
    'failureClass',
    'kind',
    'rev',
    'sha',
    'tag',
    'ts'
  ]);
  assert.equal(out.kind, 'retry');
});

test('recordUxSignal emits nothing while disabled', () => {
  const { out, lines } = capture({});
  assert.equal(out, null);
  assert.equal(lines.length, 0);
});

test('recordUxSignal drops anything the schema rejects instead of repairing it', () => {
  for (const bad of [
    { ...signal, prompt: 'draw my secret org chart' },
    { kind: 'retry', contentType: 'mermaid', failureClass: 'because I said so' },
    { kind: 'not_a_kind' },
    null,
    'retry'
  ]) {
    const { out, lines } = capture(ON, bad);
    assert.equal(out, null);
    assert.equal(lines.length, 0);
  }
});

test('recordUxSignal never throws when the sink fails', () => {
  assert.doesNotThrow(() =>
    recordUxSignal(signal, {
      env: ON,
      sink: () => {
        throw new Error('stdout closed');
      }
    })
  );
});
