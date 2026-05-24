import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProductionContentSecurityPolicy } from '../src/security/productionCsp.js';

test('production CSP allows bundled Monaco workers and editor styles', () => {
  const policy = buildProductionContentSecurityPolicy();
  assert.match(policy, /script-src[^;]*blob:/);
  assert.match(policy, /worker-src[^;]*'self'/);
  assert.match(policy, /worker-src[^;]*blob:/);
  assert.match(policy, /style-src-elem/);
  assert.match(policy, /font-src[^;]*cdn\.jsdelivr\.net/);
});
