import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { estimateLlmCostUsd, mergeLlmTokenRates } from '@archislop/shared/llmCostEstimate.js';
import { createUsageTracker, drainSseLines, startMeterProxy } from './meterProxy.mjs';
import { UPSTREAM_PROFILES, adaptBodyForWallet } from './upstream.mjs';
import { FAKE_USAGE, startFakeDeepSeek } from './fixtures/fakeDeepSeek.mjs';

const REAL_KEY = 'sk-real-key-never-leaves-the-proxy';

async function setup(overrides = {}) {
  const upstream = await startFakeDeepSeek(overrides.upstream);
  const events = [];
  const proxy = await startMeterProxy({
    apiKey: REAL_KEY,
    upstream: upstream.url,
    maxUsd: 1,
    onEvent: (event) => events.push(event),
    ...overrides.proxy
  });
  const close = async () => {
    await proxy.close();
    await upstream.close();
  };
  return { upstream, proxy, events, close };
}

function anthropicCall(proxy, body, token = proxy.clientToken) {
  return fetch(`${proxy.anthropicBaseUrl}/v1/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': token },
    body: JSON.stringify({ model: 'deepseek-v4-pro', max_tokens: 16, messages: [], ...body })
  });
}

const expectedProUsd = () =>
  estimateLlmCostUsd({
    inputTokens: FAKE_USAGE.input + FAKE_USAGE.cacheRead,
    cacheHitInputTokens: FAKE_USAGE.cacheRead,
    outputTokens: FAKE_USAGE.output,
    model: 'deepseek-v4-pro',
    rates: mergeLlmTokenRates({})
  });

test('anthropic call: the real key goes upstream, the client token and unknown fields do not', async () => {
  const { upstream, proxy, events, close } = await setup();
  try {
    const res = await anthropicCall(proxy, {
      dsh_session_log: { events: ['the whole session'] },
      metadata: { user_id: 'someone' }
    });
    assert.equal(res.status, 200);
    const sent = upstream.requests[0];
    assert.equal(sent.headers['x-api-key'], REAL_KEY);
    assert.equal(sent.headers.authorization, undefined);
    assert.equal('dsh_session_log' in sent.body, false);
    assert.equal('metadata' in sent.body, false);
    assert.deepEqual(proxy.usage().strippedFields.sort(), ['dsh_session_log', 'metadata']);
    assert.ok(events.some((e) => e.type === 'stripped' && e.field === 'dsh_session_log'));
  } finally {
    await close();
  }
});

test('anthropic call: usage is priced with cache reads at the conservative rate', async () => {
  const { proxy, close } = await setup();
  try {
    await (await anthropicCall(proxy, {})).text();
    const usage = proxy.usage();
    assert.equal(usage.calls, 1);
    assert.equal(usage.inputTokens, FAKE_USAGE.input + FAKE_USAGE.cacheRead);
    assert.equal(usage.cacheHitTokens, FAKE_USAGE.cacheRead);
    assert.equal(usage.outputTokens, FAKE_USAGE.output);
    assert.ok(Math.abs(usage.usd - expectedProUsd()) < 1e-9);
    assert.deepEqual(usage.models, ['deepseek-v4-pro']);
  } finally {
    await close();
  }
});

test('anthropic stream: bytes pass through untouched and usage is read from the events', async () => {
  const { proxy, close } = await setup();
  try {
    const res = await anthropicCall(proxy, { stream: true });
    const text = await res.text();
    assert.match(res.headers.get('content-type'), /text\/event-stream/);
    assert.match(text, /event: message_start/);
    assert.match(text, /"text":"ok"/);
    assert.equal(proxy.usage().outputTokens, FAKE_USAGE.output);
    assert.ok(Math.abs(proxy.usage().usd - expectedProUsd()) < 1e-9);
  } finally {
    await close();
  }
});

test('openai stream: include_usage is injected so the final chunk can be metered', async () => {
  const { upstream, proxy, close } = await setup();
  try {
    const res = await fetch(`${proxy.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${proxy.clientToken}` },
      body: JSON.stringify({ model: 'deepseek-v4-flash', stream: true, messages: [] })
    });
    await res.text();
    assert.deepEqual(upstream.requests[0].body.stream_options, { include_usage: true });
    assert.equal(upstream.requests[0].headers.authorization, `Bearer ${REAL_KEY}`);
    const usage = proxy.usage();
    assert.equal(usage.inputTokens, FAKE_USAGE.input);
    assert.equal(usage.cacheHitTokens, FAKE_USAGE.cacheRead);
    assert.ok(usage.usd > 0);
  } finally {
    await close();
  }
});

test('the per-run cap answers 402 and records the stop reason', async () => {
  const { upstream, proxy, events, close } = await setup({
    upstream: { usage: { input: 2_000_000, cacheRead: 0, output: 0 } },
    proxy: { maxUsd: 0.5 }
  });
  try {
    assert.equal((await anthropicCall(proxy, {})).status, 200);
    const refused = await anthropicCall(proxy, {});
    assert.equal(refused.status, 402);
    assert.equal(upstream.requests.length, 1);
    assert.equal(proxy.stopReason(), 'budget');
    assert.ok(events.some((e) => e.type === 'budget'));
  } finally {
    await close();
  }
});

test('an upstream 402 (empty balance) is passed through and recorded as balance', async () => {
  const { proxy, close } = await setup({ upstream: { status: 402 } });
  try {
    assert.equal((await anthropicCall(proxy, {})).status, 402);
    assert.equal(proxy.stopReason(), 'balance');
    assert.equal(proxy.usage().calls, 0);
  } finally {
    await close();
  }
});

test('routes outside the allowlist are refused and never reach upstream', async () => {
  const { upstream, proxy, events, close } = await setup();
  try {
    for (const route of ['/anthropic/v1/files', '/user/balance', '/v1/embeddings']) {
      const res = await fetch(`${proxy.baseUrl}${route}`, {
        method: 'POST',
        headers: { 'x-api-key': proxy.clientToken },
        body: '{}'
      });
      assert.equal(res.status, 404, route);
    }
    assert.equal(upstream.requests.length, 0);
    assert.equal(proxy.usage().blocked.length, 3);
    assert.ok(events.some((e) => e.type === 'blocked' && e.path === '/user/balance'));
  } finally {
    await close();
  }
});

async function gatewaySetup(overrides = {}) {
  const upstream = await startFakeDeepSeek(overrides.upstream);
  const events = [];
  const proxy = await startMeterProxy({
    apiKey: REAL_KEY,
    upstream: upstream.url,
    upstreamProfile: 'openrouter',
    maxUsd: 1,
    onEvent: (event) => events.push(event),
    ...overrides.proxy
  });
  const close = async () => {
    await proxy.close();
    await upstream.close();
  };
  return { upstream, proxy, events, close };
}

test('the gateway profile dials the gateway path, with Bearer auth and the gateway model id', async () => {
  const { upstream, proxy, close } = await gatewaySetup();
  try {
    assert.equal((await anthropicCall(proxy, {})).status, 200);
    const sent = upstream.requests[0];
    assert.equal(sent.path, '/messages');
    assert.equal(sent.headers.authorization, `Bearer ${REAL_KEY}`);
    assert.equal(sent.headers['x-api-key'], undefined);
    // The harness asked for its own catalog id; only the wire carries the publisher prefix, so the
    // spike's `model_honoured` check still reads the id the run was configured with.
    assert.equal(sent.body.model, 'deepseek/deepseek-v4-pro');
    assert.deepEqual(proxy.usage().models, ['deepseek-v4-pro']);
    assert.equal(proxy.wallet.profile, 'openrouter');
    assert.deepEqual(proxy.usage().blocked, []);
  } finally {
    await close();
  }
});

test('the gateway chat wire lands on the gateway chat path with a prefixed slug', async () => {
  const { upstream, proxy, close } = await gatewaySetup();
  try {
    const res = await fetch(`${proxy.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${proxy.clientToken}` },
      body: JSON.stringify({ model: 'deepseek-v4-flash', messages: [] })
    });
    assert.equal(res.status, 200);
    assert.equal(upstream.requests[0].path, '/chat/completions');
    assert.equal(upstream.requests[0].body.model, 'deepseek/deepseek-v4-flash');
  } finally {
    await close();
  }
});

test('what the gateway says it cost is the spend, and the cap binds on it', async () => {
  const { upstream, proxy, close } = await gatewaySetup({
    upstream: { cost: 0.5 },
    proxy: { maxUsd: 0.45 }
  });
  try {
    assert.equal((await anthropicCall(proxy, {})).status, 200);
    const usage = proxy.usage();
    assert.equal(usage.usd, 0.5, 'the invoice, not the first-party table price');
    assert.equal(usage.gatewayUsd, 0.5);
    assert.equal(usage.gatewayCalls, 1);
    assert.ok(Math.abs(usage.estimatedUsd - expectedProUsd()) < 1e-9);
    assert.ok(usage.usd > usage.estimatedUsd);
    // 0.5 of a 0.6 cap spent: the next call is refused without ever reaching the wallet.
    assert.equal((await anthropicCall(proxy, {})).status, 402);
    assert.equal(proxy.stopReason(), 'budget');
    assert.equal(upstream.requests.length, 1);
  } finally {
    await close();
  }
});

test('a wallet reporting zero cost is not believed to be free', async () => {
  const { proxy, close } = await gatewaySetup({ upstream: { cost: 0 } });
  try {
    assert.equal((await anthropicCall(proxy, {})).status, 200);
    assert.ok(Math.abs(proxy.usage().usd - expectedProUsd()) < 1e-9);
    assert.equal(proxy.usage().gatewayUsd, 0);
  } finally {
    await close();
  }
});

test('the gateway translation is scoped to what the gateway ignores', () => {
  const openrouter = UPSTREAM_PROFILES.openrouter;
  const deepseek = UPSTREAM_PROFILES.deepseek;
  // Brain's lane asks for reasoning off in DeepSeek's own spelling; the gateway accepts that field
  // and ignores it, so the intent has to arrive as `reasoning` or the probe pays for thinking.
  const chat = { model: 'deepseek-v4-flash', messages: [], thinking: { type: 'disabled' } };
  adaptBodyForWallet(openrouter, 'openai', chat);
  assert.equal(chat.thinking, undefined);
  assert.deepEqual(chat.reasoning, { enabled: false });

  // A request that never asked to switch reasoning off keeps its default — the harness still thinks.
  const plain = { model: 'deepseek-v4-pro', messages: [] };
  adaptBodyForWallet(openrouter, 'openai', plain);
  assert.equal(plain.reasoning, undefined);

  // The rollback wallet and the Anthropic wire are untouched: only the gateway's chat shape needs it.
  const firstParty = { model: 'deepseek-v4-flash', messages: [], thinking: { type: 'disabled' } };
  adaptBodyForWallet(deepseek, 'openai', firstParty);
  assert.deepEqual(firstParty.thinking, { type: 'disabled' });
  const anthropic = { model: 'deepseek-v4-pro', messages: [], thinking: { type: 'disabled' } };
  adaptBodyForWallet(openrouter, 'anthropic', anthropic);
  assert.deepEqual(anthropic.thinking, { type: 'disabled' });
});

test('the proxy translates the chat wire before it leaves', async () => {
  const { upstream, proxy, close } = await gatewaySetup();
  try {
    const res = await fetch(`${proxy.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${proxy.clientToken}` },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        max_tokens: 8,
        thinking: { type: 'disabled' },
        messages: [{ role: 'user', content: 'hi' }]
      })
    });
    assert.equal(res.status, 200);
    const sent = upstream.requests[0].body;
    assert.equal(sent.thinking, undefined);
    assert.deepEqual(sent.reasoning, { enabled: false });
  } finally {
    await close();
  }
});

test('count_tokens is answered locally when the gateway has no such route', async () => {
  const { upstream, proxy, close } = await gatewaySetup();
  try {
    const res = await fetch(`${proxy.anthropicBaseUrl}/v1/messages/count_tokens`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': proxy.clientToken },
      body: JSON.stringify({
        model: 'deepseek-v4-pro',
        messages: [{ role: 'user', content: 'hi' }]
      })
    });
    assert.equal(res.status, 200);
    assert.ok((await res.json()).input_tokens >= 1);
    assert.equal(upstream.requests.length, 0, 'a token count must never reach the paid wallet');
    assert.equal(proxy.usage().usd, 0);
    assert.equal(proxy.usage().localCountTokens, 1);
    // Not counted as a refused route: the spike's `no_unknown_routes` check must stay green.
    assert.deepEqual(proxy.usage().blocked, []);
  } finally {
    await close();
  }
});

test('the first-party wallet still gets the wire the proxy was built against', async () => {
  const { upstream, proxy, close } = await setup();
  try {
    assert.equal((await anthropicCall(proxy, {})).status, 200);
    assert.equal(upstream.requests[0].path, '/anthropic/v1/messages');
    assert.equal(upstream.requests[0].headers['x-api-key'], REAL_KEY);
    assert.equal(upstream.requests[0].body.model, 'deepseek-v4-pro');
    assert.equal(proxy.wallet.profile, 'deepseek');
    assert.equal(proxy.usage().gatewayCalls, 0);
    assert.ok(Math.abs(proxy.usage().usd - expectedProUsd()) < 1e-9);
  } finally {
    await close();
  }
});

test('a wrong or missing client token is 401, and the real key is never accepted from a client', async () => {
  const { upstream, proxy, close } = await setup();
  try {
    assert.equal((await anthropicCall(proxy, {}, 'guess')).status, 401);
    assert.equal((await anthropicCall(proxy, {}, REAL_KEY)).status, 401);
    assert.equal(upstream.requests.length, 0);
  } finally {
    await close();
  }
});

test('models outside the allowlist are refused; harness aliases are priced by their slug', async () => {
  const { proxy, close } = await setup();
  try {
    assert.equal((await anthropicCall(proxy, { model: 'claude-opus-4' })).status, 400);
    assert.equal((await anthropicCall(proxy, { model: 'deepseek-flash' })).status, 200);
    const flashUsd = estimateLlmCostUsd({
      inputTokens: FAKE_USAGE.input + FAKE_USAGE.cacheRead,
      cacheHitInputTokens: FAKE_USAGE.cacheRead,
      outputTokens: FAKE_USAGE.output,
      model: 'deepseek-v4-flash',
      rates: mergeLlmTokenRates({})
    });
    assert.ok(Math.abs(proxy.usage().usd - flashUsd) < 1e-9);
  } finally {
    await close();
  }
});

test('the key file is read once and deleted; an empty one is an error', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'god-key-'));
  const keyFile = path.join(dir, 'key');
  fs.writeFileSync(keyFile, `${REAL_KEY}\n`);
  const proxy = await startMeterProxy({ keyFile, maxUsd: 1, upstream: 'http://127.0.0.1:9' });
  assert.equal(fs.existsSync(keyFile), false);
  await proxy.close();
  fs.writeFileSync(keyFile, '  ');
  await assert.rejects(() => startMeterProxy({ keyFile, maxUsd: 1 }), /empty/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('usage tracker and SSE splitter handle both shapes and partial lines', () => {
  const tracker = createUsageTracker();
  const tail = drainSseLines(
    'data: {"type":"message_start","message":{"usage":{"input_tokens":10,"output_tokens":1}}}\n' +
      'data: [DONE]\n' +
      'data: {"type":"message_delta","usage":{"output_tokens":7}}\ndata: {"type":"mess',
    (event) => tracker.feed(event)
  );
  assert.equal(tail, 'data: {"type":"mess');
  assert.deepEqual(tracker.result(), { inputTokens: 10, cacheHitTokens: 0, outputTokens: 7 });
  const openai = createUsageTracker();
  openai.feed({ usage: { prompt_tokens: 50, completion_tokens: 5, prompt_cache_hit_tokens: 40 } });
  assert.deepEqual(openai.result(), { inputTokens: 50, cacheHitTokens: 40, outputTokens: 5 });
  assert.equal(createUsageTracker().result(), null);
});
