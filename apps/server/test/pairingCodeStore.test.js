import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPairingCodeStore,
  normalizePairingCode
} from '../src/state/pairingCodeStore.js';

test('normalizePairingCode uppercases and validates length', () => {
  assert.equal(normalizePairingCode('ab12cd'), 'AB12CD');
  assert.equal(normalizePairingCode('  xy9z2w '), 'XY9Z2W');
  assert.equal(normalizePairingCode('short'), null);
  assert.equal(normalizePairingCode('toolong1'), null);
});

test('pairingCodeStore getOrCreateCode is stable per session', () => {
  const store = createPairingCodeStore();
  const a = store.getOrCreateCode('session-a');
  const b = store.getOrCreateCode('session-a');
  assert.equal(a, b);
  assert.equal(store.resolve(a), 'session-a');
});

test('pairingCodeStore resolve returns null for unknown code', () => {
  const store = createPairingCodeStore();
  store.getOrCreateCode('session-b');
  assert.equal(store.resolve('ZZZZZZ'), null);
});

test('pairingCodeStore regenerate issues a new code', () => {
  const store = createPairingCodeStore();
  const first = store.getOrCreateCode('session-c');
  const second = store.regenerate('session-c');
  assert.notEqual(first, second);
  assert.equal(store.resolve(first), null);
  assert.equal(store.resolve(second), 'session-c');
});

test('pairingCodeStore resolveDetailed reports expired codes', () => {
  const store = createPairingCodeStore({ defaultTtlMs: 1, inviteTtlMs: 1 });
  const code = store.getOrCreateCode('session-exp');
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const result = store.resolveDetailed(code);
        assert.equal(result.ok, false);
        assert.equal(result.reason, 'expired');
        resolve();
      } catch (error) {
        reject(error);
      }
    }, 20);
  });
});
