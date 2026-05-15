import test from 'node:test';
import assert from 'node:assert/strict';

import { signInviteToken, verifyInviteToken } from '../src/utils/inviteToken.js';

test('inviteToken sign and verify round-trip', () => {
  const token = signInviteToken({ sessionId: 'room-abc', ttlMs: 60_000 });
  const verified = verifyInviteToken(token);
  assert.equal(verified?.sessionId, 'room-abc');
});

test('inviteToken rejects tampered token', () => {
  const token = signInviteToken({ sessionId: 'room-abc', ttlMs: 60_000 });
  const tampered = `${token}x`;
  assert.equal(verifyInviteToken(tampered), null);
});
