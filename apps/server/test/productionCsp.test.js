import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProductionContentSecurityPolicy } from '../src/security/productionCsp.js';

test('production CSP allows bundled Monaco workers and editor styles', () => {
  const policy = buildProductionContentSecurityPolicy();
  assert.match(policy, /script-src[^;]*blob:/);
  assert.match(policy, /worker-src[^;]*'self'/);
  assert.match(policy, /worker-src[^;]*blob:/);
  assert.match(policy, /style-src-elem[^;]*blob:/);
  assert.match(policy, /style-src[^;]*blob:/);
  assert.match(policy, /font-src[^;]*cdn\.jsdelivr\.net/);
  assert.match(policy, /img-src[^;]*blob:/);
  assert.match(policy, /media-src[^;]*'self'/);
  assert.match(policy, /media-src[^;]*data:/);
  assert.match(policy, /media-src[^;]*blob:/);
});
