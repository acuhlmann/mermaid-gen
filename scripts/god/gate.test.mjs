import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GOD_CONFIG_DEFAULTS, godConfigToVars } from '@archislop/shared/godBudget.js';
import { runGate, writeGateOutputs } from './gate.mjs';
import { fetchUpstreamBalanceUsd } from './upstream.mjs';

const ENABLED = godConfigToVars({ ...GOD_CONFIG_DEFAULTS, enabled: true });

test('gate refuses when God is disabled', () => {
  const decision = runGate({
    vars: godConfigToVars(GOD_CONFIG_DEFAULTS),
    now: Date.parse('2026-10-15T07:00:00.000Z'),
    openGodPrs: 0,
    newSignals: 100,
    balanceUsd: 5,
    force: true
  });
  assert.equal(decision.go, false);
  assert.equal(decision.reason, 'disabled');
});

test('gate goes when enabled, forced, and caps clear', () => {
  const decision = runGate({
    vars: ENABLED,
    now: Date.parse('2026-10-15T07:00:00.000Z'),
    openGodPrs: 0,
    newSignals: 100,
    balanceUsd: 5,
    force: true,
    requestedTier: 'observe',
    focus: 'mermaid'
  });
  assert.equal(decision.go, true);
  assert.equal(decision.reason, 'go');
  assert.equal(decision.tier, 'observe');
  assert.equal(decision.focus, 'mermaid');
});

test('gate refuses an open God PR even when forced', () => {
  const decision = runGate({
    vars: ENABLED,
    now: Date.parse('2026-10-15T07:00:00.000Z'),
    openGodPrs: 1,
    newSignals: 100,
    balanceUsd: 5,
    force: true
  });
  assert.equal(decision.go, false);
  assert.equal(decision.reason, 'open_pr');
});

test('writeGateOutputs appends GitHub Actions files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'god-gate-'));
  const outputPath = path.join(dir, 'out');
  const summaryPath = path.join(dir, 'summary');
  const decision = runGate({
    vars: ENABLED,
    now: Date.parse('2026-10-15T07:00:00.000Z'),
    openGodPrs: 0,
    balanceUsd: null,
    force: true
  });
  writeGateOutputs(decision, { outputPath, summaryPath });
  const out = fs.readFileSync(outputPath, 'utf8');
  assert.match(out, /^go=true$/m);
  assert.match(out, /^tier=propose$/m);
  assert.match(fs.readFileSync(summaryPath, 'utf8'), /ArchiSlop God — gate/);
});

test('the gate names the wallet a go would bill', () => {
  const decision = runGate({
    vars: ENABLED,
    now: Date.parse('2026-10-15T07:00:00.000Z'),
    openGodPrs: 0,
    balanceUsd: null,
    force: true
  });
  assert.equal(decision.wallet, 'openrouter');
  assert.equal(
    runGate({
      vars: ENABLED,
      now: Date.parse('2026-10-15T07:00:00.000Z'),
      openGodPrs: 0,
      balanceUsd: null,
      force: true,
      wallet: 'deepseek'
    }).wallet,
    'deepseek'
  );
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'god-gate-wallet-'));
  const outputPath = path.join(dir, 'out');
  writeGateOutputs(decision, { outputPath, summaryPath: path.join(dir, 'summary') });
  assert.match(fs.readFileSync(outputPath, 'utf8'), /^wallet=openrouter$/m);
});

test('fetchUpstreamBalanceUsd bills the smallest figure the gateway admits to', async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith('/key')) {
      return {
        ok: true,
        json: async () => ({
          data: { limit: 5, limit_remaining: 3.25, budgets: [{ remaining_usd: 4 }] }
        })
      };
    }
    return { ok: true, json: async () => ({ data: { total_credits: 30, total_usage: 21.5 } }) };
  };
  // min(3.25 key cap, 4 budget, 8.5 credits): the key cap is what God may still spend.
  assert.equal(await fetchUpstreamBalanceUsd('openrouter', 'k', { fetchImpl }), 3.25);
});

test('an uncapped gateway key falls back to the prepaid credit balance', async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith('/key')) {
      return { ok: true, json: async () => ({ data: { limit: null, limit_remaining: null } }) };
    }
    return { ok: true, json: async () => ({ data: { total_credits: 30, total_usage: 29.4 } }) };
  };
  assert.equal(await fetchUpstreamBalanceUsd('openrouter', 'k', { fetchImpl }), 0.6);
});

test('fetchUpstreamBalanceUsd returns null on failure, and without a key', async () => {
  assert.equal(await fetchUpstreamBalanceUsd('openrouter', undefined), null);
  assert.equal(
    await fetchUpstreamBalanceUsd('openrouter', 'k', { fetchImpl: async () => ({ ok: false }) }),
    null
  );
  assert.equal(
    await fetchUpstreamBalanceUsd('openrouter', 'k', {
      fetchImpl: async () => {
        throw new Error('offline');
      }
    }),
    null
  );
});

test('the rollback wallet still reads its own first-party prepaid balance', async () => {
  assert.equal(
    await fetchUpstreamBalanceUsd('deepseek', 'k', {
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ balance_infos: [{ currency: 'USD', total_balance: '12.5' }] })
      })
    }),
    12.5
  );
});
