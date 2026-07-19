// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_USER_NAME,
  _resetUserIdentityForTests,
  getStoredUserName,
  resolveUserName,
  setUserName,
  subscribe
} from '../src/state/userIdentityStore.js';
import {
  OFFICE_USER_NAME_STORAGE_KEY,
  USER_NAME_MAX_LENGTH
} from '../src/utils/officeAmbienceStorage.js';

beforeEach(() => {
  window.localStorage.clear();
  _resetUserIdentityForTests();
});

afterEach(() => {
  window.localStorage.clear();
  _resetUserIdentityForTests();
});

describe('userIdentityStore', () => {
  it('resolves the funny default when the badge is blank', () => {
    expect(getStoredUserName()).toBe('');
    expect(resolveUserName()).toBe(DEFAULT_USER_NAME);
  });

  it('persists a chosen name and uses it everywhere', () => {
    setUserName('Richard');
    expect(getStoredUserName()).toBe('Richard');
    expect(resolveUserName()).toBe('Richard');
    expect(window.localStorage.getItem(OFFICE_USER_NAME_STORAGE_KEY)).toBe('Richard');
  });

  it('trims and caps the stored name, and clears back to the default when emptied', () => {
    setUserName('   Erlich   ');
    expect(getStoredUserName()).toBe('Erlich');

    setUserName('x'.repeat(USER_NAME_MAX_LENGTH + 10));
    expect(getStoredUserName()).toHaveLength(USER_NAME_MAX_LENGTH);

    setUserName('   ');
    expect(getStoredUserName()).toBe('');
    expect(resolveUserName()).toBe(DEFAULT_USER_NAME);
    expect(window.localStorage.getItem(OFFICE_USER_NAME_STORAGE_KEY)).toBeNull();
  });

  it('notifies subscribers only on a real change', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    setUserName('Dinesh');
    expect(listener).toHaveBeenCalledTimes(1);
    setUserName('Dinesh'); // no-op — same value
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setUserName('Gilfoyle');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
