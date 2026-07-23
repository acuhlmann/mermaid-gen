// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getResetVersion,
  resetAllFloatingWindows,
  resetFloatingWindow,
  resetFloatingWindowControlForTests,
  subscribeFloatingWindowReset
} from '../src/state/floatingWindowControl.js';

describe('floatingWindowControl', () => {
  beforeEach(() => {
    resetFloatingWindowControlForTests();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bumps a per-window reset version in isolation', () => {
    expect(getResetVersion('a')).toBe(0);
    resetFloatingWindow('a');
    expect(getResetVersion('a')).toBe(1);
    expect(getResetVersion('b')).toBe(0);
  });

  it('resetAll bumps every window version at once', () => {
    resetFloatingWindow('a'); // a = 1
    resetAllFloatingWindows(); // global + 1
    expect(getResetVersion('a')).toBe(2);
    expect(getResetVersion('b')).toBe(1);
  });

  it('clears the stored position for a window', () => {
    window.sessionStorage.setItem('floating-window:a', JSON.stringify({ left: 1, top: 2 }));
    resetFloatingWindow('a');
    expect(window.sessionStorage.getItem('floating-window:a')).toBeNull();
  });

  it('resetAll clears every floating-window position but leaves other keys', () => {
    window.sessionStorage.setItem('floating-window:a', '{}');
    window.sessionStorage.setItem('floating-window:b', '{}');
    window.sessionStorage.setItem('unrelated', 'keep');
    resetAllFloatingWindows();
    expect(window.sessionStorage.getItem('floating-window:a')).toBeNull();
    expect(window.sessionStorage.getItem('floating-window:b')).toBeNull();
    expect(window.sessionStorage.getItem('unrelated')).toBe('keep');
  });

  it('notifies subscribers on reset and stops after unsubscribe', () => {
    const fn = vi.fn();
    const unsub = subscribeFloatingWindowReset(fn);
    resetFloatingWindow('a');
    expect(fn).toHaveBeenCalledTimes(1);
    unsub();
    resetFloatingWindow('a');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
