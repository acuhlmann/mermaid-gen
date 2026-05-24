// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADVISOR_IDLE_PAUSE_MS,
  pushProposalHistory,
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

  it('clears thinkingPersona and reschedules when the 12s safety timeout aborts the request', async () => {
    // Reproduces the Wise Architect "stuck thinking…" bug: when the slow-side
    // architect call exceeds SUGGEST_TIMEOUT_MS the AbortError used to silently
    // return, leaving the thinking indicator pinned and the loop dead.
    mockPersonaPick('explain');
    let abortListener;
    fetchMock.mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        abortListener = () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        };
        init?.signal?.addEventListener?.('abort', abortListener);
      });
    });

    const { result } = renderHook(() => useAdvisorOrchestrator(defaultParams()));

    // First tick fires and sets thinkingPersona while the fetch hangs.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });
    expect(result.current.thinkingPersona).toBe('explain');
    expect(result.current.suggestion).toBeNull();

    // Push past the 12s in-tick safety timeout — controller.abort() fires.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_500);
      await Promise.resolve();
    });

    expect(result.current.thinkingPersona).toBeNull();
  });

  it('goBack and goForward walk proposal history without losing accept handlers', async () => {
    let call = 0;
    fetchMock.mockImplementation(() => {
      call += 1;
      const suggestions = ['First tip.', 'Second tip.', 'Third tip.'];
      const text = suggestions[call - 1] ?? 'Third tip.';
      return Promise.resolve({
        ok: true,
        json: async () => ({
          persona: 'refine',
          suggestion: text,
          highlightIds: ['A']
        })
      });
    });

    const { result } = renderHook(() => useAdvisorOrchestrator(defaultParams()));
    const expected = ['First tip.', 'Second tip.', 'Third tip.'];

    for (let i = 0; i < 3; i += 1) {
      if (i > 0) {
        act(() => {
          result.current.dismiss();
        });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(GAP_MS + 100);
          await Promise.resolve();
        });
      } else {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(GAP_MS + 100);
          await Promise.resolve();
        });
      }
      expect(result.current.suggestion).toBe(expected[i]);
    }

    expect(result.current.suggestion).toBe('Third tip.');
    expect(result.current.showHistoryNav).toBe(true);
    expect(result.current.canGoForward).toBe(false);

    act(() => {
      result.current.goBack();
    });
    expect(result.current.suggestion).toBe('Second tip.');
    expect(result.current.canGoForward).toBe(true);
    expect(result.current.canGoBack).toBe(true);

    act(() => {
      result.current.goBack();
      result.current.goBack();
    });
    expect(result.current.suggestion).toBe('First tip.');
    expect(result.current.canGoBack).toBe(false);
    expect(result.current.canGoForward).toBe(true);

    act(() => {
      result.current.goForward();
    });
    expect(result.current.suggestion).toBe('Second tip.');
  });

  it('promptNext triggers a new fetch and clears activePersona on dismiss', async () => {
    mockPersonaPick('refine');
    const { result } = renderHook(() => useAdvisorOrchestrator(defaultParams()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });
    expect(result.current.suggestion).toBeTruthy();
    expect(result.current.activePersona).toBe('refine');

    act(() => {
      result.current.dismiss();
    });
    expect(result.current.suggestion).toBeNull();
    expect(result.current.activePersona).toBeNull();

    mockPersonaPick('critique');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        persona: 'critique',
        suggestion: 'Audit the edges.',
        highlightIds: ['A']
      })
    });

    act(() => {
      result.current.promptNext();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalled();
    const lastBody = JSON.parse(fetchMock.mock.calls.at(-1)[1].body);
    expect(lastBody.persona).toBe('critique');
    expect(result.current.suggestion).toBe('Audit the edges.');
    expect(result.current.activePersona).toBe('critique');
  });

  it('promptNext with persona forces that stakeholder in the request body', async () => {
    mockPersonaPick('refine');
    const { result } = renderHook(() => useAdvisorOrchestrator(defaultParams()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });
    fetchMock.mockClear();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        persona: 'exec',
        suggestion: 'Board-ready summary.',
        highlightIds: []
      })
    });

    act(() => {
      result.current.promptNext({ persona: 'exec' });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
      await Promise.resolve();
      await Promise.resolve();
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.persona).toBe('exec');
  });

  it('pushProposalHistory keeps index when browsing and a new suggestion arrives', () => {
    const entry = (text) => ({
      persona: 'refine',
      suggestion: text,
      suggestionKind: 'suggestion',
      highlightIds: []
    });
    const base = {
      entries: [entry('a'), entry('b')],
      index: 0
    };
    const next = pushProposalHistory(base, entry('c'), { atLiveEnd: false });
    expect(next.entries.map((e) => e.suggestion)).toEqual(['a', 'c']);
    expect(next.index).toBe(0);
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
