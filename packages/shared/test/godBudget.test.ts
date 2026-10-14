import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GOD_CONFIG_DEFAULTS,
  GOD_CONFIG_VARIABLES,
  GOD_HARD_LIMITS,
  clampGodConfig,
  decideGodRun,
  godConfigToVars,
  isHourInGodWindow,
  lowerGodTier,
  parseGodWindow,
  readGodConfigFromVars,
  type GodRunDecisionInput
} from '../src/godBudget.js';

const HOUR = 3_600_000;
const at = (iso: string) => new Date(iso).getTime();

function input(overrides: Partial<GodRunDecisionInput> = {}): GodRunDecisionInput {
  return {
    config: { ...GOD_CONFIG_DEFAULTS, enabled: true },
    now: at('2026-10-14T07:17:00Z'),
    lastActAt: at('2026-10-13T07:17:00Z'),
    openGodPrs: 0,
    balanceUsd: 10,
    monthSpendUsd: 0,
    newSignals: 500,
    ...overrides
  };
}

test('defaults are safe: disabled, propose, inside every hard limit', () => {
  assert.equal(GOD_CONFIG_DEFAULTS.enabled, false);
  assert.equal(GOD_CONFIG_DEFAULTS.autonomy, 'propose');
  assert.deepEqual(clampGodConfig(GOD_CONFIG_DEFAULTS), GOD_CONFIG_DEFAULTS);
  assert.deepEqual(clampGodConfig(null), GOD_CONFIG_DEFAULTS);
  assert.deepEqual(clampGodConfig('garbage'), GOD_CONFIG_DEFAULTS);
});

test('clampGodConfig pins every number to the hard limits', () => {
  const huge = clampGodConfig({
    everyHours: 0,
    maxMinutes: 10_000,
    maxUsdPerRun: 999,
    maxUsdPerMonth: 1e9
  });
  assert.equal(huge.everyHours, GOD_HARD_LIMITS.minEveryHours);
  assert.equal(huge.maxMinutes, GOD_HARD_LIMITS.maxMinutes);
  assert.equal(huge.maxUsdPerRun, GOD_HARD_LIMITS.maxUsdPerRun);
  assert.equal(huge.maxUsdPerMonth, GOD_HARD_LIMITS.maxUsdPerMonth);
  const tiny = clampGodConfig({ maxMinutes: 1, maxUsdPerRun: 0.001, everyHours: 1e6 });
  assert.equal(tiny.maxMinutes, GOD_HARD_LIMITS.minMinutes);
  assert.equal(tiny.maxUsdPerRun, GOD_HARD_LIMITS.minUsdPerRun);
  assert.equal(tiny.everyHours, GOD_HARD_LIMITS.maxEveryHours);
});

test('a per-run cap never exceeds the monthly cap', () => {
  const config = clampGodConfig({ maxUsdPerRun: 5, maxUsdPerMonth: 2 });
  assert.equal(config.maxUsdPerRun, 2);
});

test('malformed fields fall back individually', () => {
  const config = clampGodConfig({
    enabled: 'yes',
    autonomy: 'god-mode',
    windowUtc: 'all day',
    everyHours: 6
  });
  assert.equal(config.enabled, GOD_CONFIG_DEFAULTS.enabled);
  assert.equal(config.autonomy, GOD_CONFIG_DEFAULTS.autonomy);
  assert.equal(config.windowUtc, GOD_CONFIG_DEFAULTS.windowUtc);
  assert.equal(config.everyHours, 6);
});

test('repo variables round-trip through godConfigToVars / readGodConfigFromVars', () => {
  const config = clampGodConfig({ ...GOD_CONFIG_DEFAULTS, enabled: true, everyHours: 6 });
  const vars = godConfigToVars(config);
  assert.equal(vars[GOD_CONFIG_VARIABLES.enabled], 'true');
  assert.deepEqual(readGodConfigFromVars(vars), config);
  assert.deepEqual(readGodConfigFromVars({}), GOD_CONFIG_DEFAULTS);
  const sloppy = readGodConfigFromVars({ GOD_ENABLED: ' ON ', GOD_AUTONOMY: 'Ship' });
  assert.equal(sloppy.enabled, true);
  assert.equal(sloppy.autonomy, 'ship');
});

test('windows: start inclusive, end exclusive, wrapping midnight', () => {
  assert.deepEqual(parseGodWindow('06-12'), { startHour: 6, endHour: 12 });
  assert.equal(parseGodWindow('06-06'), null);
  assert.equal(parseGodWindow('6-12'), null);
  assert.equal(isHourInGodWindow(6, '06-12'), true);
  assert.equal(isHourInGodWindow(11, '06-12'), true);
  assert.equal(isHourInGodWindow(12, '06-12'), false);
  assert.equal(isHourInGodWindow(23, '22-04'), true);
  assert.equal(isHourInGodWindow(3, '22-04'), true);
  assert.equal(isHourInGodWindow(4, '22-04'), false);
  assert.equal(isHourInGodWindow(0, '00-24'), true);
  assert.equal(isHourInGodWindow(23, '00-24'), true);
  assert.equal(isHourInGodWindow(7, 'nonsense'), false);
});

test('lowerGodTier only ever lowers', () => {
  assert.equal(lowerGodTier('propose', 'observe'), 'observe');
  assert.equal(lowerGodTier('propose', 'ship'), 'propose');
  assert.equal(lowerGodTier('ship', null), 'ship');
});

test('a due run inside the window goes, with the configured tier and caps', () => {
  const decision = decideGodRun(input());
  assert.equal(decision.go, true);
  assert.equal(decision.reason, 'go');
  assert.equal(decision.tier, 'propose');
  assert.equal(decision.maxMinutes, GOD_CONFIG_DEFAULTS.maxMinutes);
  assert.equal(decision.maxUsd, GOD_CONFIG_DEFAULTS.maxUsdPerRun);
  assert.equal(decision.nextDueAt, null);
});

test('the cadence tolerates a tick that lands a few seconds early', () => {
  const lastActAt = at('2026-10-13T07:17:30Z');
  assert.equal(decideGodRun(input({ lastActAt })).go, true);
  const notDue = decideGodRun(input({ lastActAt: at('2026-10-14T01:00:00Z') }));
  assert.equal(notDue.reason, 'not_due');
  assert.ok(notDue.nextDueAt);
});

test('absolute stops hold even for "Run now"', () => {
  const force = { force: true };
  const disabled = input({ ...force, config: { ...GOD_CONFIG_DEFAULTS, enabled: false } });
  assert.equal(decideGodRun(disabled).reason, 'disabled');
  assert.equal(decideGodRun(input({ ...force, openGodPrs: 1 })).reason, 'open_pr');
  assert.equal(decideGodRun(input({ ...force, monthSpendUsd: 19.99 })).reason, 'month_cap');
  assert.equal(decideGodRun(input({ ...force, balanceUsd: 0.05 })).reason, 'balance_low');
});

test('"Run now" skips the window, the cadence and the signal floor', () => {
  const now = at('2026-10-14T20:00:00Z');
  const base = { now, lastActAt: now - HOUR, newSignals: 3 };
  assert.equal(decideGodRun(input(base)).reason, 'outside_window');
  assert.equal(decideGodRun(input({ ...base, force: true })).go, true);
});

test('thin traffic waits; unknown signal counts and balances do not block', () => {
  assert.equal(decideGodRun(input({ newSignals: 5 })).reason, 'insufficient_signals');
  assert.equal(decideGodRun(input({ newSignals: null })).go, true);
  assert.equal(decideGodRun(input({ balanceUsd: null })).go, true);
});

test('the per-run cap shrinks to what is left of the month', () => {
  const decision = decideGodRun(input({ monthSpendUsd: 19.6 }));
  assert.equal(decision.go, true);
  assert.equal(decision.maxUsd, 0.4);
});

test('a dispatch may lower the tier but never raise it', () => {
  assert.equal(decideGodRun(input({ requestedTier: 'observe' })).tier, 'observe');
  assert.equal(decideGodRun(input({ requestedTier: 'ship' })).tier, 'propose');
});

test('first-ever run: no lastActAt is always due', () => {
  assert.equal(decideGodRun(input({ lastActAt: null })).go, true);
});
