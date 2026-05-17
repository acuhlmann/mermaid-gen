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

  /** Force pickNextPersona to return a specific persona (ADVISOR_ORDER index). */
  function mockPersonaPick(persona) {
    const order = ['refine', 'innovate', 'goMad', 'critique', 'explain', 'exec'];
    const idx = order.indexOf(persona);
    vi.spyOn(Math, 'random').mockReturnValue((idx + 0.01) / order.length);
  }

  it('surfaces suggestionKind from the API payload', async () => {
    mockPersonaPick('exec');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        persona: 'exec',
        suggestion: 'Just give me three bullets.',
        highlightIds: [],
        kind: 'comment'
      })
    });

    const { result } = renderHook(() => useAdvisorOrchestrator(defaultParams()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });

    expect(result.current.suggestion).toBe('Just give me three bullets.');
    expect(result.current.suggestionKind).toBe('comment');
  });

  it('coerces explain persona to comment even when API says suggestion', async () => {
    mockPersonaPick('explain');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        persona: 'explain',
        suggestion: 'Rename Auth → Auth Gate.',
        highlightIds: ['Auth'],
        kind: 'suggestion'
      })
    });

    const { result } = renderHook(() => useAdvisorOrchestrator(defaultParams()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });

    expect(result.current.suggestionKind).toBe('comment');
  });

  it('accept is a no-op for comment-kind bubbles', async () => {
    mockPersonaPick('exec');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        persona: 'exec',
        suggestion: 'I have a hard stop in 4 minutes.',
        highlightIds: [],
        kind: 'comment'
      })
    });
    const onAccept = vi.fn();
    const { result } = renderHook(() =>
      useAdvisorOrchestrator(defaultParams({ onAccept }))
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });

    act(() => {
      result.current.accept();
    });

    expect(onAccept).not.toHaveBeenCalled();
    expect(result.current.suggestion).toBe('I have a hard stop in 4 minutes.');
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

  it('keeps a pinned suggestion when canvas focus changes', async () => {
    const { result, rerender } = renderHook(
      ({ focusKey, focusSource }) =>
        useAdvisorOrchestrator(
          defaultParams({ focusKey, focusSource: focusSource ?? 'selected' })
        ),
      { initialProps: { focusKey: 'selected:A', focusSource: 'selected' } }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.suggestion).toBe('Rename A — clearer.');

    act(() => {
      result.current.togglePin();
    });
    expect(result.current.isPinned).toBe(true);

    fetchMock.mockClear();

    rerender({ focusKey: 'selected:B', focusSource: 'selected' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 + GAP_MS + 15_000);
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.suggestion).toBe('Rename A — clearer.');
    expect(result.current.isPinned).toBe(true);
  });
});
