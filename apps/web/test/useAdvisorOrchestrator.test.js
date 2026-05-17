// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADVISOR_IDLE_PAUSE_MS,
  useAdvisorOrchestrator
} from '../src/hooks/useAdvisorOrchestrator.js';
import { ADVISOR_MUTED_STORAGE_KEY } from '../src/utils/advisorMuteStorage.js';

const GAP_MS = 2200;

function defaultParams(overrides = {}) {
  return {
    getDiagramSource: () => 'flowchart LR\n  A-->B',
    getContentType: () => 'mermaid',
    getSessionId: () => 'test-session',
    pause: false,
    ...overrides
  };
}

describe('useAdvisorOrchestrator', () => {
  let fetchMock;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        persona: 'refine',
        suggestion: 'Rename A — clearer.',
        highlightIds: ['A']
      })
    });
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    window.localStorage.removeItem(ADVISOR_MUTED_STORAGE_KEY);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    window.localStorage.removeItem(ADVISOR_MUTED_STORAGE_KEY);
  });

  it('persists explicit mute via toggleMute', () => {
    const { result } = renderHook(() => useAdvisorOrchestrator(defaultParams()));

    expect(result.current.isMuted).toBe(false);

    act(() => {
      result.current.toggleMute();
    });
    expect(result.current.isMuted).toBe(true);
    expect(window.localStorage.getItem(ADVISOR_MUTED_STORAGE_KEY)).toBe('1');

    act(() => {
      result.current.toggleMute();
    });
    expect(result.current.isMuted).toBe(false);
    expect(window.localStorage.getItem(ADVISOR_MUTED_STORAGE_KEY)).toBeNull();
  });

  it('respects initialMuted without calling fetch while muted', async () => {
    renderHook(() => useAdvisorOrchestrator(defaultParams({ initialMuted: true })));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS * 5);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pauses LLM calls while the tab is hidden', async () => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });

    renderHook(() => useAdvisorOrchestrator(defaultParams()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS * 10);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('silently pauses after idle and resumes on user activity', async () => {
    vi.setSystemTime(new Date(0));
    const { rerender } = renderHook(
      ({ pause }) => useAdvisorOrchestrator(defaultParams({ pause })),
      { initialProps: { pause: false } }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const callsAfterFirst = fetchMock.mock.calls.length;

    await act(async () => {
      rerender({ pause: true });
    });
    vi.setSystemTime(new Date(ADVISOR_IDLE_PAUSE_MS + 1000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS * 2);
    });
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);

    await act(async () => {
      rerender({ pause: false });
    });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });
});
