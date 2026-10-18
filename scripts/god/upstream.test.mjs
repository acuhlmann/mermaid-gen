import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_UPSTREAM,
  UPSTREAM_PROFILES,
  canonicalModelId,
  fetchUpstreamBalanceUsd,
  resolveGodKey,
  resolveUpstreamProfile,
  resolveWallet,
  upstreamBaseUrl,
  upstreamModelId,
  upstreamPathFor
} from './upstream.mjs';

test("the gateway wallet is the default, and it is God's own key — never the app key", () => {
  assert.equal(DEFAULT_UPSTREAM, 'https://openrouter.ai/api/v1');
  assert.equal(resolveWallet(undefined, {}).includes('openrouter.ai'), true);
  assert.equal(UPSTREAM_PROFILES.openrouter.keyEnv, 'OPENROUTER_GOD_KEY');
  // The app's variable is OPENROUTER_API_KEY; God must never resolve to it.
  assert.notEqual(UPSTREAM_PROFILES.openrouter.keyEnv, 'OPENROUTER_API_KEY');
});

test('GOD_UPSTREAM switches the wallet, and an explicit flag beats it', () => {
  assert.equal(resolveWallet(undefined, { GOD_UPSTREAM: 'deepseek' }), 'deepseek');
  assert.equal(resolveWallet('openrouter', { GOD_UPSTREAM: 'deepseek' }), 'openrouter');
  assert.equal(resolveWallet(undefined, {}).includes('openrouter.ai'), true);
});

test('profiles are picked by host, so a rollback is a URL and a test fake stays first-party', () => {
  assert.equal(resolveUpstreamProfile('https://openrouter.ai/api/v1').name, 'openrouter');
  assert.equal(resolveUpstreamProfile('https://openrouter.ai').name, 'openrouter');
  assert.equal(resolveUpstreamProfile('https://api.deepseek.com').name, 'deepseek');
  assert.equal(resolveUpstreamProfile('openrouter').name, 'openrouter');
  assert.equal(resolveUpstreamProfile('deepseek').name, 'deepseek');
  // An unknown host (a 127.0.0.1 fixture, a proxy) keeps the passthrough wire the tests speak.
  assert.equal(resolveUpstreamProfile('http://127.0.0.1:4321').name, 'deepseek');
});

test('an explicit base URL wins, with its path intact and no trailing slash', () => {
  const openrouter = UPSTREAM_PROFILES.openrouter;
  assert.equal(
    upstreamBaseUrl(openrouter, 'https://example.test/gateway/'),
    'https://example.test/gateway'
  );
  assert.equal(upstreamBaseUrl(openrouter, 'openrouter'), openrouter.baseUrl);
  assert.equal(upstreamBaseUrl(openrouter, undefined), openrouter.baseUrl);
});

test('the client-facing route is rewritten per wallet, and count_tokens is answered locally', () => {
  const openrouter = UPSTREAM_PROFILES.openrouter;
  const deepseek = UPSTREAM_PROFILES.deepseek;
  // dsh and the probe server keep their own paths; only the dial changes.
  assert.equal(upstreamPathFor(openrouter, '/anthropic/v1/messages'), '/messages');
  assert.equal(upstreamPathFor(openrouter, '/v1/chat/completions'), '/chat/completions');
  assert.equal(upstreamPathFor(openrouter, '/chat/completions'), '/chat/completions');
  // null = the gateway has no such route (measured 404), so the proxy answers it itself.
  assert.equal(upstreamPathFor(openrouter, '/anthropic/v1/messages/count_tokens'), null);
  // A wallet that serves it keeps the passthrough shape.
  assert.equal(
    upstreamPathFor(deepseek, '/anthropic/v1/messages/count_tokens'),
    '/anthropic/v1/messages/count_tokens'
  );
  // A route the map does not name at all is undefined, which the proxy refuses rather than dials blind.
  assert.equal(upstreamPathFor(openrouter, '/v1/messages/anything-else'), undefined);
});

test('harness ids, rate-table slugs and gateway slugs all canonicalize to one priced id', () => {
  assert.equal(canonicalModelId('deepseek-flash'), 'deepseek-v4-flash');
  assert.equal(canonicalModelId('deepseek-pro'), 'deepseek-v4-pro');
  assert.equal(canonicalModelId('deepseek-v4-pro'), 'deepseek-v4-pro');
  assert.equal(canonicalModelId('deepseek/deepseek-v4-pro'), 'deepseek-v4-pro');
});

test('only the gateway needs a publisher prefix; the first-party wire is untouched', () => {
  const openrouter = UPSTREAM_PROFILES.openrouter;
  const deepseek = UPSTREAM_PROFILES.deepseek;
  assert.equal(upstreamModelId(openrouter, 'deepseek-v4-pro'), 'deepseek/deepseek-v4-pro');
  assert.equal(upstreamModelId(openrouter, 'deepseek-flash'), 'deepseek/deepseek-v4-flash');
  assert.equal(upstreamModelId(openrouter, 'deepseek/deepseek-v4-pro'), 'deepseek/deepseek-v4-pro');
  assert.equal(upstreamModelId(deepseek, 'deepseek-flash'), 'deepseek-flash');
});

test('resolveGodKey keeps --key-file the CI path and errors instead of borrowing another wallet', () => {
  assert.deepEqual(resolveGodKey({ keyFile: '/tmp/k', env: {} }), {
    keyFile: '/tmp/k',
    apiKey: undefined
  });
  // The key lives in the wallet's own variable; nothing here reads DEEPSEEK_API_KEY or the app key.
  assert.deepEqual(
    resolveGodKey({ wallet: 'openrouter', env: { OPENROUTER_GOD_KEY: 'sk-or-god' } }),
    { apiKey: 'sk-or-god' }
  );
  assert.throws(
    () =>
      resolveGodKey({
        wallet: 'openrouter',
        env: { DEEPSEEK_API_KEY: 'sk-app', OPENROUTER_API_KEY: 'sk-app-or' }
      }),
    /OPENROUTER_GOD_KEY/
  );
});

test('the balance is the smallest headroom the gateway admits to', async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith('/key')) {
      return {
        ok: true,
        json: async () => ({
          data: {
            limit: 20,
            limit_remaining: 1.5,
            budgets: [{ remaining_usd: 0.4 }, { remaining_usd: 9 }]
          }
        })
      };
    }
    return { ok: true, json: async () => ({ data: { total_credits: 30, total_usage: 12 } }) };
  };
  // min(1.5 key cap, 0.4 budget, 18 credits) = 0.4: the first thing to run out is the real limit.
  assert.equal(await fetchUpstreamBalanceUsd('openrouter', 'k', { fetchImpl }), 0.4);
});

test('a key with no limit reports uncapped, and an unreadable wallet says nothing', async () => {
  const uncapped = async (url) => {
    if (url.endsWith('/key')) {
      return { ok: true, json: async () => ({ data: { limit: null, limit_remaining: null } }) };
    }
    return { ok: true, json: async () => ({ data: { total_credits: 30, total_usage: 29.95 } }) };
  };
  assert.equal(await fetchUpstreamBalanceUsd('openrouter', 'k', { fetchImpl: uncapped }), 0.05);
  assert.equal(
    await fetchUpstreamBalanceUsd('openrouter', 'k', { fetchImpl: async () => ({ ok: false }) }),
    null
  );
  assert.equal(await fetchUpstreamBalanceUsd('openrouter', undefined, { env: {} }), null);
});

test('a zero-limit figure is never mistaken for uncapped', async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith('/key')) {
      return { ok: true, json: async () => ({ data: { limit: 5, limit_remaining: 0 } }) };
    }
    return { ok: true, json: async () => ({ data: { total_credits: 100, total_usage: 0 } }) };
  };
  // limit_remaining: 0 is a real answer, and it is smaller than the credit balance.
  assert.equal(await fetchUpstreamBalanceUsd('openrouter', 'k', { fetchImpl }), 0);
});
