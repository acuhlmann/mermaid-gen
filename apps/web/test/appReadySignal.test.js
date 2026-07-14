// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { APP_READY_EVENT, markAppReady, waitForAppReady } from '../src/utils/appReadySignal.js';

describe('appReadySignal', () => {
  afterEach(() => {
    delete document.documentElement.dataset.archislopAppReady;
  });

  it('resolves immediately when the app was already marked ready', async () => {
    document.documentElement.dataset.archislopAppReady = 'true';
    await expect(waitForAppReady({ timeoutMs: 10 })).resolves.toBeUndefined();
  });

  it('waits for the ready event', async () => {
    vi.useFakeTimers();
    const readyPromise = waitForAppReady({ timeoutMs: 5_000 });
    markAppReady();
    await readyPromise;
    vi.useRealTimers();
  });

  it('dispatches a named custom event once', () => {
    const handler = vi.fn();
    window.addEventListener(APP_READY_EVENT, handler);
    markAppReady();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dataset.archislopAppReady).toBe('true');
    window.removeEventListener(APP_READY_EVENT, handler);
  });
});
