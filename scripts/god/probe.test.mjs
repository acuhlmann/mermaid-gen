import test from 'node:test';
import assert from 'node:assert/strict';
import { GOD_HARD_LIMITS } from '@archislop/shared/godBudget.js';
import { ContentTypeSchema } from '@archislop/shared';
import {
  PROBE_MAX_USD,
  parseAgentTurnLines,
  probeBudget,
  probeServerEnv,
  sendProbe,
  summarizeProbe
} from './probe.mjs';
import { PROBE_CORPUS } from './probeCorpus.mjs';

const turn = (contentType, accepted, repairAttempts = 0, errorClass = null) =>
  JSON.stringify({ tag: 'agent_turn', contentType, accepted, repairAttempts, errorClass });

test('the corpus covers every slot God can name, twice, with unique ids', () => {
  const ids = new Set(PROBE_CORPUS.map((c) => c.id));
  assert.equal(ids.size, PROBE_CORPUS.length);
  for (const ct of ContentTypeSchema.options) {
    assert.equal(
      PROBE_CORPUS.filter((c) => c.contentType === ct).length,
      2,
      `${ct} needs exactly two probe prompts so pooled samples stay comparable`
    );
  }
});

test('parseAgentTurnLines keeps agent_turn lines and ignores everything else the server prints', () => {
  const text = [
    'server listening on 4100',
    turn('mermaid', true, 1),
    '{"tag":"ux_signal","kind":"retry"}',
    '{not json',
    turn('chart', false, 2, 'parser-rejected')
  ].join('\n');
  assert.deepEqual(parseAgentTurnLines(text), [
    { contentType: 'mermaid', accepted: true, repairAttempts: 1, errorClass: null },
    { contentType: 'chart', accepted: false, repairAttempts: 2, errorClass: 'parser-rejected' }
  ]);
});

test('summarizeProbe counts a case with no agent_turn line as a turn that was not accepted', () => {
  const summary = summarizeProbe({
    cases: [{ contentType: 'mermaid' }, { contentType: 'mermaid' }, { contentType: 'chart' }],
    turns: parseAgentTurnLines(turn('mermaid', true, 1)),
    usd: 0.0123456789
  });
  assert.deepEqual(summary, {
    turns: 3,
    usd: 0.012346,
    slots: [
      { contentType: 'mermaid', turns: 2, accepted: 1, repairAttempts: 1 },
      { contentType: 'chart', turns: 1, accepted: 0, repairAttempts: 0 }
    ]
  });
});

test('a transport failure is not product evidence: it leaves the sample entirely', () => {
  const summary = summarizeProbe({
    cases: [{ contentType: 'forms' }, { contentType: 'forms' }],
    turns: parseAgentTurnLines(
      [turn('forms', true, 0), turn('forms', false, 0, 'invoke-error')].join('\n')
    ),
    usd: 0.01
  });
  assert.deepEqual(summary.slots, [
    { contentType: 'forms', turns: 1, accepted: 1, repairAttempts: 0 }
  ]);
});

test('a run the money cap cut short keeps its spend and drops every outcome', () => {
  const summary = summarizeProbe({
    cases: [{ contentType: 'anything' }],
    turns: parseAgentTurnLines(turn('anything', false, 3)),
    usd: 0.25,
    capped: true
  });
  assert.deepEqual(summary, { turns: 0, usd: 0.25, slots: [] });
});

test('probeBudget never takes more than PROBE_MAX_USD and always leaves the act its minimum', () => {
  assert.equal(probeBudget(1), PROBE_MAX_USD);
  assert.equal(probeBudget(0.2), Math.round((0.2 - GOD_HARD_LIMITS.minUsdPerRun) * 100) / 100);
  assert.equal(probeBudget(GOD_HARD_LIMITS.minUsdPerRun), 0);
  assert.equal(probeBudget('nope'), 0);
  for (const tick of [0.05, 0.1, 0.3, 1, 5]) {
    assert.ok(tick - probeBudget(tick) >= GOD_HARD_LIMITS.minUsdPerRun - 1e-9);
  }
});

test('the probe server inherits no secret from the runner and talks only to the proxy', () => {
  const env = probeServerEnv({
    port: 4321,
    proxyBaseUrl: 'http://127.0.0.1:9999',
    clientToken: 'god-token',
    base: {
      PATH: '/usr/bin',
      HOME: '/home/runner',
      OPENROUTER_GOD_KEY: 'sk-or-real',
      GITHUB_TOKEN: 'ghs_x',
      GOOGLE_APPLICATION_CREDENTIALS: '/tmp/creds.json'
    }
  });
  assert.equal(env.DEEPSEEK_API_KEY, 'god-token');
  assert.equal(env.DEEPSEEK_API_BASE, 'http://127.0.0.1:9999');
  assert.equal(env.MERMAID_METRICS, '1');
  assert.equal(env.LLM_PROVIDER, 'deepseek');
  for (const value of Object.values(env)) {
    assert.ok(!['sk-or-real', 'ghs_x', '/tmp/creds.json'].includes(value));
  }
});

test('sendProbe posts an empty-canvas intent and reports transport errors as status 0', async () => {
  /** @type {{ url: string, init: RequestInit } | null} */
  let seen = null;
  const ok = await sendProbe(
    'http://probe.invalid',
    { contentType: 'chart', prompt: 'A bar chart' },
    'god-probe-1-0',
    {
      fetchImpl: async (url, init) => {
        seen = { url: String(url), init };
        return new Response('{}', { status: 200 });
      }
    }
  );
  assert.equal(ok.status, 200);
  assert.equal(seen?.url, 'http://probe.invalid/api/copilotkit/intent');
  assert.equal(new Headers(seen?.init.headers).get('x-session-id'), 'god-probe-1-0');
  assert.deepEqual(JSON.parse(String(seen?.init.body)), {
    prompt: 'A bar chart',
    revisionId: 0,
    diagramSource: '',
    contentType: 'chart',
    modelProfile: 'fast'
  });

  const failed = await sendProbe('http://probe.invalid', PROBE_CORPUS[0], 's', {
    fetchImpl: async () => {
      throw new Error('ECONNREFUSED');
    }
  });
  assert.equal(failed.status, 0);
});
