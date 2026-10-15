import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GOD_CONFIG_DEFAULTS, godConfigToVars } from '@archislop/shared/godBudget.js';
import { runGate, writeGateOutputs, fetchDeepSeekBalanceUsd } from './gate.mjs';

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

test('fetchDeepSeekBalanceUsd returns null on failure', async () => {
  assert.equal(await fetchDeepSeekBalanceUsd(undefined), null);
  assert.equal(
    await fetchDeepSeekBalanceUsd('k', {
      fetchImpl: async () => ({ ok: false })
    }),
    null
  );
  assert.equal(
    await fetchDeepSeekBalanceUsd('k', {
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ balance_infos: [{ currency: 'USD', total_balance: '12.5' }] })
      })
    }),
    12.5
  );
});
