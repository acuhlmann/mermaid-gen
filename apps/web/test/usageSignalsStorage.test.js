// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  USAGE_SIGNALS_KEY,
  defaultUsageSignalsEnabled,
  readUsageSignalsPreference,
  resolveUsageSignalsEnabled,
  writeUsageSignalsPreference
} from '../src/utils/usageSignalsStorage.ts';

describe('usageSignalsStorage', () => {
  afterEach(() => window.localStorage.clear());

  it('has no preference until the user chooses', () => {
    expect(readUsageSignalsPreference()).toBe(null);
  });

  it('round-trips an explicit choice', () => {
    writeUsageSignalsPreference(false);
    expect(window.localStorage.getItem(USAGE_SIGNALS_KEY)).toBe('off');
    expect(readUsageSignalsPreference()).toBe(false);
    writeUsageSignalsPreference(true);
    expect(readUsageSignalsPreference()).toBe(true);
  });

  it('ignores a garbled stored value', () => {
    window.localStorage.setItem(USAGE_SIGNALS_KEY, 'maybe');
    expect(readUsageSignalsPreference()).toBe(null);
  });

  it('defaults on, and off when the browser sends Global Privacy Control', () => {
    expect(defaultUsageSignalsEnabled({})).toBe(true);
    expect(defaultUsageSignalsEnabled(undefined)).toBe(true);
    expect(defaultUsageSignalsEnabled({ globalPrivacyControl: true })).toBe(false);
  });

  it('an explicit choice beats the default', () => {
    writeUsageSignalsPreference(false);
    expect(resolveUsageSignalsEnabled()).toBe(false);
  });
});
