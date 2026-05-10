import test from 'node:test';
import assert from 'node:assert/strict';
import { redactSecrets } from '../src/utils/redactSecrets.js';

test('redactSecrets masks OpenRouter-style keys', () => {
  const msg = 'Request failed: sk-or-v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  assert.match(redactSecrets(msg), /\[REDACTED\]/);
  assert.doesNotMatch(redactSecrets(msg), /sk-or-v1-/);
});

test('redactSecrets masks Bearer tokens', () => {
  assert.equal(redactSecrets('Upstream said Bearer eyJhbGciOiJIUzI1NiJ'), 'Upstream said Bearer [REDACTED]');
});
