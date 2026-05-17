// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  ADVISOR_MUTED_STORAGE_KEY,
  readAdvisorMuted,
  writeAdvisorMuted
} from '../src/utils/advisorMuteStorage.js';

describe('advisorMuteStorage', () => {
  afterEach(() => {
    window.localStorage.removeItem(ADVISOR_MUTED_STORAGE_KEY);
  });

  it('defaults to unmuted when key is absent', () => {
    expect(readAdvisorMuted()).toBe(false);
  });

  it('reads and writes explicit mute', () => {
    writeAdvisorMuted(true);
    expect(window.localStorage.getItem(ADVISOR_MUTED_STORAGE_KEY)).toBe('1');
    expect(readAdvisorMuted()).toBe(true);
    writeAdvisorMuted(false);
    expect(window.localStorage.getItem(ADVISOR_MUTED_STORAGE_KEY)).toBeNull();
    expect(readAdvisorMuted()).toBe(false);
  });
});
