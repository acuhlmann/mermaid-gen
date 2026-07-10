import test from 'node:test';
import assert from 'node:assert/strict';

import { assertProductionInviteSecret, DEV_INVITE_TOKEN_SECRET } from '../src/utils/inviteToken.js';

test('assertProductionInviteSecret allows dev default outside production', () => {
  const prevNode = process.env.NODE_ENV;
  const prevSecret = process.env.INVITE_TOKEN_SECRET;
  delete process.env.NODE_ENV;
  delete process.env.INVITE_TOKEN_SECRET;
  assert.doesNotThrow(() => assertProductionInviteSecret());
  if (prevNode === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNode;
  if (prevSecret === undefined) delete process.env.INVITE_TOKEN_SECRET;
  else process.env.INVITE_TOKEN_SECRET = prevSecret;
});

test('assertProductionInviteSecret rejects dev default in production', () => {
  const prevNode = process.env.NODE_ENV;
  const prevSecret = process.env.INVITE_TOKEN_SECRET;
  process.env.NODE_ENV = 'production';
  delete process.env.INVITE_TOKEN_SECRET;
  assert.throws(() => assertProductionInviteSecret(), /INVITE_TOKEN_SECRET must be set/);
  process.env.INVITE_TOKEN_SECRET = 'test-production-secret-value';
  assert.doesNotThrow(() => assertProductionInviteSecret());
  if (prevNode === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNode;
  if (prevSecret === undefined) delete process.env.INVITE_TOKEN_SECRET;
  else process.env.INVITE_TOKEN_SECRET = prevSecret;
});

test('DEV_INVITE_TOKEN_SECRET is stable for tests', () => {
  assert.match(DEV_INVITE_TOKEN_SECRET, /change-in-production/);
});
