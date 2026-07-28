// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADVISOR_IDLE_PAUSE_MS,
  ADVISOR_ORDER,
  advisorPickWeight,
  pickWeightedPersona,
  pushProposalHistory,
  shouldDiscardForFocusChange,
  useAdvisorOrchestrator
} from '../src/hooks/useAdvisorOrchestrator.js';
import { CAST_TIERS } from '../src/utils/castTiers.js';
import { ADVISOR_MUTED_STORAGE_KEY } from '../src/utils/advisorMuteStorage.js';

const GAP_MS = 2200;

/** Seeded PRNG so the rotation-frequency sweep is deterministic, never flaky. */
function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

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

  describe('shouldDiscardForFocusChange', () => {
    it('ignores hover→selected on the same node', () => {
      expect(shouldDiscardForFocusChange('hover:Auth', 'selected:Auth')).toBe(false);
    });

    it('discards when selection moves to a different node', () => {
      expect(shouldDiscardForFocusChange('selected:Auth', 'selected:Payment')).toBe(true);
    });

    it('keeps viewport replies when the user first selects a node mid-fetch', () => {
      expect(shouldDiscardForFocusChange(null, 'selected:Auth')).toBe(false);
    });
  });

  // Reachability ladder (docs/recipes/replicate-tv-character.md): Barker is on
  // Your Team but throttled; pure seniors never join the proactive rotation.
  describe('roundtable membership and pick weight', () => {
    it('seats every team persona plus dual-home Barker', () => {
      for (const id of CAST_TIERS.team) {
        expect(ADVISOR_ORDER, `team persona ${id}`).toContain(id);
      }
      expect(ADVISOR_ORDER).toContain('barker');
    });

    it('keeps the summoned-only seniors out of the rotation', () => {
      // Gavin Belson (ex-Marcus/`cto`) plus Sasha and Diane — pure seniors stay out.
      for (const id of ['belson', 'cto', 'ciso', 'cfo']) {
        expect(ADVISOR_ORDER, `senior ${id}`).not.toContain(id);
      }
    });

    it('throttles Barker to half a peer weight', () => {
      expect(advisorPickWeight('barker')).toBe(0.5);
      for (const id of CAST_TIERS.team) {
        expect(advisorPickWeight(id), `peer ${id}`).toBe(1);
      }
    });

    it('draws Barker about half as often as a peer across the roll space', () => {
      const counts = Object.fromEntries(ADVISOR_ORDER.map((id) => [id, 0]));
      const samples = 11_000;
      for (let i = 0; i < samples; i += 1) {
        counts[pickWeightedPersona(ADVISOR_ORDER, i / samples)] += 1;
      }
      // 6 peers at weight 1 + Barker at 0.5 → total 6.5, so peers = 2/13 and
      // Barker = 1/13. (Was 2/11 and 1/11 before Dinesh took the seventh seat.)
      for (const id of CAST_TIERS.team) {
        expect(counts[id] / samples, `peer ${id} share`).toBeCloseTo(2 / 13, 3);
      }
      expect(counts.barker / samples).toBeCloseTo(1 / 13, 3);
    });

    it('keeps the throttle after the repeat filter drops the previous speaker', () => {
      const pool = ADVISOR_ORDER.filter((id) => id !== 'gilfoyle');
      const counts = Object.fromEntries(pool.map((id) => [id, 0]));
      const samples = 9000;
      for (let i = 0; i < samples; i += 1) {
        counts[pickWeightedPersona(pool, i / samples)] += 1;
      }
      expect(counts.barker / counts.erlich).toBeCloseTo(0.5, 2);
    });

    it('gives Barker ~8% of a long rotation against ~15% per peer', () => {
      // Walks the real loop: each turn re-filters the previous speaker out, so
      // the run frequency is the chain's stationary distribution rather than
      // the raw weights — pi(j) ∝ w(j) * (total - w(j)). With 6 peers + Barker
      // at 0.5 the total is 6.5, so a peer weighs 1 * 5.5 = 5.5 and Barker
      // 0.5 * 6 = 3 out of 36 — 0.545x a peer, not a flat 0.5x. This is the
      // "eventually surfaces Jack, but not every other bubble" smoke in
      // deterministic form.
      const turns = 120_000;
      const counts = Object.fromEntries(ADVISOR_ORDER.map((id) => [id, 0]));
      const nextRoll = mulberry32(0x5eed);
      let previous = null;
      let repeats = 0;
      for (let i = 0; i < turns; i += 1) {
        const pool = previous ? ADVISOR_ORDER.filter((id) => id !== previous) : ADVISOR_ORDER;
        const picked = pickWeightedPersona(pool, nextRoll());
        if (picked === previous) repeats += 1;
        previous = picked;
        counts[picked] += 1;
      }
      expect(repeats, 'never repeats the previous speaker').toBe(0);
      for (const id of CAST_TIERS.team) {
        expect(counts[id] / turns, `peer ${id} share`).toBeCloseTo(5.5 / 36, 2);
      }
      expect(counts.barker / turns).toBeCloseTo(3 / 36, 2);
    });

    it('never returns a persona from an empty pool', () => {
      expect(pickWeightedPersona([], 0.5)).toBeNull();
      expect(pickWeightedPersona(['gilfoyle'], 0.999999)).toBe('gilfoyle');
    });
  });

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        persona: 'gilfoyle',
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

  /**
   * Force pickNextPersona to return a specific persona by landing Math.random
   * in the middle of that persona's cumulative-weight band (weights are not
   * uniform — Barker is throttled to 0.5).
   */
  function mockPersonaPick(persona) {
    const total = ADVISOR_ORDER.reduce((sum, id) => sum + advisorPickWeight(id), 0);
    const before = ADVISOR_ORDER.slice(0, ADVISOR_ORDER.indexOf(persona)).reduce(
      (sum, id) => sum + advisorPickWeight(id),
      0
    );
    vi.spyOn(Math, 'random').mockReturnValue((before + advisorPickWeight(persona) / 2) / total);
  }

  it('lets Barker take a proactive turn without being summoned', async () => {
    mockPersonaPick('barker');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        persona: 'barker',
        suggestion: 'Three boxes. The board reads three boxes.',
        highlightIds: []
      })
    });

    const { result } = renderHook(() => useAdvisorOrchestrator(defaultParams()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });

    // No promptNext / forced persona — the ambient loop picked him.
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).persona).toBe('barker');
    expect(result.current.activePersona).toBe('barker');
  });

  it('surfaces suggestionKind from the API payload', async () => {
    mockPersonaPick('barker');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        persona: 'barker',
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

  it('reports token usage to onUsage so advisor spend can be billed', async () => {
    mockPersonaPick('barker');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        persona: 'barker',
        suggestion: 'Three boxes total.',
        highlightIds: [],
        usage: { inputTokens: 180, outputTokens: 24 },
        model: 'gemini-2.5-flash'
      })
    });
    const onUsage = vi.fn();
    renderHook(() => useAdvisorOrchestrator(defaultParams({ onUsage })));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });

    expect(onUsage).toHaveBeenCalledWith({
      inputTokens: 180,
      outputTokens: 24,
      model: 'gemini-2.5-flash'
    });
  });

  it('does not call onUsage when the server reported no usage', async () => {
    mockPersonaPick('barker');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ persona: 'barker', suggestion: 'No usage here.', highlightIds: [] })
    });
    const onUsage = vi.fn();
    renderHook(() => useAdvisorOrchestrator(defaultParams({ onUsage })));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });

    expect(onUsage).not.toHaveBeenCalled();
  });

  it('coerces explain persona to comment even when API says suggestion', async () => {
    mockPersonaPick('richard');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        persona: 'richard',
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
    mockPersonaPick('barker');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        persona: 'barker',
        suggestion: 'I have a hard stop in 4 minutes.',
        highlightIds: [],
        kind: 'comment'
      })
    });
    const onAccept = vi.fn();
    const { result } = renderHook(() => useAdvisorOrchestrator(defaultParams({ onAccept })));

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
    mockPersonaPick('richard');
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
    expect(result.current.thinkingPersona).toBe('richard');
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
          persona: 'gilfoyle',
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
    mockPersonaPick('gilfoyle');
    const { result } = renderHook(() => useAdvisorOrchestrator(defaultParams()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });
    expect(result.current.suggestion).toBeTruthy();
    expect(result.current.activePersona).toBe('gilfoyle');

    act(() => {
      result.current.dismiss();
    });
    expect(result.current.suggestion).toBeNull();
    expect(result.current.activePersona).toBeNull();

    mockPersonaPick('jared');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        persona: 'jared',
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
    expect(lastBody.persona).toBe('jared');
    expect(result.current.suggestion).toBe('Audit the edges.');
    expect(result.current.activePersona).toBe('jared');
  });

  it('promptNext with persona forces that stakeholder in the request body', async () => {
    mockPersonaPick('gilfoyle');
    const { result } = renderHook(() => useAdvisorOrchestrator(defaultParams()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });
    fetchMock.mockClear();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        persona: 'barker',
        suggestion: 'Board-ready summary.',
        highlightIds: []
      })
    });

    act(() => {
      result.current.promptNext({ persona: 'barker' });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
      await Promise.resolve();
      await Promise.resolve();
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.persona).toBe('barker');
  });

  it('includes chart labels in proactive advisor requests', async () => {
    const chart = JSON.stringify({
      archislopVersion: 1,
      theme: 'whiteboard',
      spec: {
        title: 'Revenue by quarter',
        data: { values: [{ quarter: 'Q1', revenue: 120 }] },
        mark: 'bar',
        encoding: {
          x: { field: 'quarter', type: 'ordinal', title: 'Quarter' },
          y: { field: 'revenue', type: 'quantitative', title: 'Revenue' }
        }
      }
    });
    renderHook(() =>
      useAdvisorOrchestrator(
        defaultParams({
          getContentType: () => 'chart',
          getDiagramSource: () => chart
        })
      )
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.contentType).toBe('chart');
    expect(body.visibleLabels).toEqual(
      expect.arrayContaining(['Revenue by quarter', 'Quarter', 'Q1'])
    );
  });

  it('includes Anything labels in proactive advisor requests', async () => {
    const html = `<!doctype html><html><head></head><body>
      <h1>Launch Plan</h1><button>Start simulation</button>
    </body></html>`;
    renderHook(() =>
      useAdvisorOrchestrator(
        defaultParams({
          getContentType: () => 'anything',
          getDiagramSource: () => html
        })
      )
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.contentType).toBe('anything');
    expect(body.visibleLabels).toEqual(expect.arrayContaining(['Launch Plan', 'Start simulation']));
  });

  it('promptNext during an in-flight fetch does not trigger failure backoff (Wise Architect cast switch)', async () => {
    mockPersonaPick('gilfoyle');
    let resolveFirst;
    const firstHang = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    fetchMock
      .mockImplementationOnce((_url, init) => {
        init?.signal?.addEventListener?.('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          resolveFirst({ ok: false, aborted: true, err });
        });
        return firstHang.then((result) => {
          if (result?.aborted) throw result.err;
          return result;
        });
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          persona: 'richard',
          suggestion: 'Picture, if you will, a saga from Order to Payment.',
          highlightIds: ['Order'],
          kind: 'comment'
        })
      });

    const { result } = renderHook(() => useAdvisorOrchestrator(defaultParams()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });
    expect(result.current.thinkingPersona).toBe('gilfoyle');

    act(() => {
      result.current.promptNext({ persona: 'richard' });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.thinkingPersona).toBeNull();
    expect(result.current.activePersona).toBe('richard');
    expect(result.current.suggestion).toMatch(/saga/i);
    expect(result.current.suggestionKind).toBe('comment');
  });

  it('pushProposalHistory keeps index when browsing and a new suggestion arrives', () => {
    const entry = (text) => ({
      persona: 'gilfoyle',
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
        useAdvisorOrchestrator(defaultParams({ focusKey, focusSource: focusSource ?? 'selected' })),
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

  it('does not wipe a bubble when focus debounce fires after fetch landed for the same focus', async () => {
    mockPersonaPick('richard');
    let resolveFetch;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = () =>
            resolve({
              ok: true,
              json: async () => ({
                persona: 'richard',
                suggestion: 'Picture, if you will, a bounded context.',
                highlightIds: ['A'],
                kind: 'comment'
              })
            });
        })
    );

    const { result } = renderHook(
      ({ focusKey, focusSource }) =>
        useAdvisorOrchestrator(
          defaultParams({
            focusKey,
            focusSource,
            getFocusDescriptor: () =>
              focusKey ? { id: 'A', label: 'A', source: focusSource ?? 'selected' } : null
          })
        ),
      { initialProps: { focusKey: 'selected:A', focusSource: 'selected' } }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });
    expect(result.current.thinkingPersona).toBe('richard');

    await act(async () => {
      resolveFetch();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.suggestion).toMatch(/bounded context/i);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
      await Promise.resolve();
    });

    expect(result.current.suggestion).toMatch(/bounded context/i);
  });

  it('keeps a viewport reply when the user first selects a node mid-fetch', async () => {
    mockPersonaPick('richard');
    let resolveFirst;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = () =>
            resolve({
              ok: true,
              json: async () => ({
                persona: 'richard',
                suggestion: 'Viewport-era wisdom that should stay visible.',
                highlightIds: [],
                kind: 'comment'
              })
            });
        })
    );

    const { result, rerender } = renderHook(
      ({ focusKey, focusSource }) =>
        useAdvisorOrchestrator(
          defaultParams({
            focusKey,
            focusSource,
            getFocusDescriptor: () =>
              focusKey ? { id: 'A', label: 'A', source: focusSource ?? 'selected' } : null
          })
        ),
      { initialProps: { focusKey: null, focusSource: null } }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });
    expect(result.current.thinkingPersona).toBe('richard');

    rerender({ focusKey: 'selected:A', focusSource: 'selected' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 + 50);
      await Promise.resolve();
    });
    expect(result.current.thinkingPersona).toBe('richard');

    await act(async () => {
      resolveFirst();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.suggestion).toBe('Viewport-era wisdom that should stay visible.');
    expect(result.current.suggestionKind).toBe('comment');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('discards and re-ticks when explicit selection moves to a different node mid-fetch', async () => {
    mockPersonaPick('richard');
    let resolveFirst;
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = () =>
              resolve({
                ok: true,
                json: async () => ({
                  persona: 'richard',
                  suggestion: 'Wisdom for node A that should never flash.',
                  highlightIds: ['A'],
                  kind: 'comment'
                })
              });
          })
      )
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          persona: 'richard',
          suggestion: 'Focused wisdom for node B.',
          highlightIds: ['B'],
          kind: 'comment'
        })
      });

    const { result, rerender } = renderHook(
      ({ focusKey, focusSource }) =>
        useAdvisorOrchestrator(
          defaultParams({
            focusKey,
            focusSource,
            getFocusDescriptor: () =>
              focusKey
                ? {
                    id: focusKey.split(':')[1] || 'A',
                    label: focusKey.split(':')[1] || 'A',
                    source: focusSource ?? 'selected'
                  }
                : null
          })
        ),
      { initialProps: { focusKey: 'selected:A', focusSource: 'selected' } }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });
    expect(result.current.thinkingPersona).toBe('richard');

    rerender({ focusKey: 'selected:B', focusSource: 'selected' });

    await act(async () => {
      resolveFirst();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.suggestion).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 200);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.suggestion).toBe('Focused wisdom for node B.');
    expect(result.current.suggestionKind).toBe('comment');
  });

  it('does not wipe a thinking fetch when hover focus flickers', async () => {
    mockPersonaPick('gilfoyle');
    let resolveFetch;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = () =>
            resolve({
              ok: true,
              json: async () => ({
                persona: 'gilfoyle',
                suggestion: 'Rename the gateway node.',
                highlightIds: ['A']
              })
            });
        })
    );

    const { result, rerender } = renderHook(
      ({ focusKey, focusSource }) =>
        useAdvisorOrchestrator(
          defaultParams({
            focusKey,
            focusSource,
            getFocusDescriptor: () =>
              focusKey
                ? {
                    id: focusKey.split(':')[1] || 'A',
                    label: 'A',
                    source: focusSource ?? 'hover'
                  }
                : null
          })
        ),
      { initialProps: { focusKey: null, focusSource: null } }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });
    expect(result.current.thinkingPersona).toBe('gilfoyle');

    // Pointer travel over nodes while the LLM is thinking — must not cancel.
    rerender({ focusKey: 'hover:A', focusSource: 'hover' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
      await Promise.resolve();
    });
    expect(result.current.thinkingPersona).toBe('gilfoyle');
    expect(result.current.suggestion).toBeNull();

    rerender({ focusKey: 'hover:B', focusSource: 'hover' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
      await Promise.resolve();
    });
    expect(result.current.thinkingPersona).toBe('gilfoyle');

    await act(async () => {
      resolveFetch();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.suggestion).toBe('Rename the gateway node.');
    expect(result.current.activePersona).toBe('gilfoyle');
    expect(result.current.thinkingPersona).toBeNull();
  });

  it('keeps a fresh suggestion visible through immediate post-render focus churn', async () => {
    mockPersonaPick('richard');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        persona: 'richard',
        suggestion: 'Stakeholders have convened.',
        highlightIds: [],
        kind: 'comment'
      })
    });

    const { result, rerender } = renderHook(
      ({ focusKey, focusSource }) =>
        useAdvisorOrchestrator(
          defaultParams({
            focusKey,
            focusSource,
            getFocusDescriptor: () =>
              focusKey ? { id: 'A', label: 'A', source: focusSource ?? 'selected' } : null
          })
        ),
      { initialProps: { focusKey: null, focusSource: null } }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });
    expect(result.current.suggestion).toBe('Stakeholders have convened.');

    rerender({ focusKey: 'selected:A', focusSource: 'selected' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
      await Promise.resolve();
    });

    expect(result.current.suggestion).toBe('Stakeholders have convened.');
  });

  it('keeps thinking visible when selection debounce fires during an in-flight fetch', async () => {
    mockPersonaPick('gilfoyle');
    let resolveFetch;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = () =>
            resolve({
              ok: true,
              json: async () => ({
                persona: 'gilfoyle',
                suggestion: 'Tighten the gateway label.',
                highlightIds: ['Gateway']
              })
            });
        })
    );

    const { result, rerender } = renderHook(
      ({ focusKey, focusSource }) =>
        useAdvisorOrchestrator(
          defaultParams({
            focusKey,
            focusSource,
            getFocusDescriptor: () =>
              focusKey
                ? { id: 'Gateway', label: 'Gateway', source: focusSource ?? 'selected' }
                : null
          })
        ),
      { initialProps: { focusKey: null, focusSource: null } }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });
    expect(result.current.thinkingPersona).toBe('gilfoyle');

    rerender({ focusKey: 'selected:Gateway', focusSource: 'selected' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 + 50);
      await Promise.resolve();
    });
    expect(result.current.thinkingPersona).toBe('gilfoyle');

    await act(async () => {
      resolveFetch();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.thinkingPersona).toBeNull();
    expect(result.current.suggestion).toBe('Tighten the gateway label.');
  });

  it('keeps a reply when hover upgrades to selected on the same node mid-fetch', async () => {
    mockPersonaPick('richard');
    let resolveFetch;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = () =>
            resolve({
              ok: true,
              json: async () => ({
                persona: 'richard',
                suggestion: 'The gateway mediates trust.',
                highlightIds: ['Gateway'],
                kind: 'comment'
              })
            });
        })
    );

    const { result, rerender } = renderHook(
      ({ focusKey, focusSource }) =>
        useAdvisorOrchestrator(
          defaultParams({
            focusKey,
            focusSource,
            getFocusDescriptor: () =>
              focusKey ? { id: 'Gateway', label: 'Gateway', source: focusSource ?? 'hover' } : null
          })
        ),
      { initialProps: { focusKey: 'hover:Gateway', focusSource: 'hover' } }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });
    expect(result.current.thinkingPersona).toBe('richard');

    rerender({ focusKey: 'selected:Gateway', focusSource: 'selected' });

    await act(async () => {
      resolveFetch();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.suggestion).toBe('The gateway mediates trust.');
    expect(result.current.suggestionKind).toBe('comment');
  });

  it('does not clear thinking on a brief loading pause flicker', async () => {
    mockPersonaPick('gilfoyle');
    let resolveFetch;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = () =>
            resolve({
              ok: true,
              json: async () => ({
                persona: 'gilfoyle',
                suggestion: 'Still here after the flicker.',
                highlightIds: ['A']
              })
            });
        })
    );

    const { result, rerender } = renderHook(
      ({ pause }) => useAdvisorOrchestrator(defaultParams({ pause })),
      { initialProps: { pause: false } }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });
    expect(result.current.thinkingPersona).toBe('gilfoyle');

    rerender({ pause: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
      await Promise.resolve();
    });
    expect(result.current.thinkingPersona).toBe('gilfoyle');

    rerender({ pause: false });
    await act(async () => {
      resolveFetch();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.suggestion).toBe('Still here after the flicker.');
  });

  it('surfaces the speech bubble when the reply lands while still paused', async () => {
    mockPersonaPick('gilfoyle');
    let resolveFetch;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = () =>
            resolve({
              ok: true,
              json: async () => ({
                persona: 'gilfoyle',
                suggestion: 'Keep me after loading owns the canvas.',
                highlightIds: ['A']
              })
            });
        })
    );

    const { result, rerender } = renderHook(
      ({ pause }) => useAdvisorOrchestrator(defaultParams({ pause })),
      { initialProps: { pause: false } }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });
    expect(result.current.thinkingPersona).toBe('gilfoyle');

    // Loading/streaming flips pause true while the advisor fetch is still in flight.
    rerender({ pause: true });
    await act(async () => {
      resolveFetch();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.suggestion).toBe('Keep me after loading owns the canvas.');
    expect(result.current.activePersona).toBe('gilfoyle');
    expect(result.current.thinkingPersona).toBeNull();

    // Sustained pause must not wipe a landed proposal (only blocks new ticks).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
      await Promise.resolve();
    });
    expect(result.current.suggestion).toBe('Keep me after loading owns the canvas.');
  });

  it('keeps an in-flight proposal across a brief document.hidden flicker', async () => {
    mockPersonaPick('gilfoyle');
    let resolveFetch;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = () =>
            resolve({
              ok: true,
              json: async () => ({
                persona: 'gilfoyle',
                suggestion: 'Survived the mobile visibility flicker.',
                highlightIds: ['A']
              })
            });
        })
    );

    const { result } = renderHook(() => useAdvisorOrchestrator(defaultParams()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });
    expect(result.current.thinkingPersona).toBe('gilfoyle');

    await act(async () => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    // In-flight thinking must survive — wiping here was the mobile "flash then gone" path.
    expect(result.current.thinkingPersona).toBe('gilfoyle');

    await act(async () => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
      resolveFetch();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.suggestion).toBe('Survived the mobile visibility flicker.');
    expect(result.current.thinkingPersona).toBeNull();
  });

  it('dumbDown steps simpleLevel through the shared ladder and requests gibberish at the end', async () => {
    mockPersonaPick('richard');
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          persona: 'richard',
          suggestion: "Notice Conway's Law — the diagram mirrors the team.",
          highlightIds: ['Team'],
          kind: 'comment'
        })
      })
      .mockImplementation((_url, init) => {
        const body = JSON.parse(init?.body ?? '{}');
        if (body.style === 'gibberish') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              persona: 'richard',
              suggestion: 'goo ga team bwah nya!!!',
              highlightIds: ['Team'],
              kind: 'comment'
            })
          });
        }
        const level = body.simpleLevel ?? 1;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            persona: 'richard',
            suggestion: `Simplified level ${level} for the team.`,
            highlightIds: ['Team'],
            kind: 'comment'
          })
        });
      });

    const { result } = renderHook(() => useAdvisorOrchestrator(defaultParams()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });
    expect(result.current.activePersona).toBe('richard');
    expect(result.current.architectDumbLevel).toBe(0);

    await act(async () => {
      await result.current.dumbDown();
      await Promise.resolve();
    });
    let body = JSON.parse(fetchMock.mock.calls.at(-1)[1].body);
    expect(body.mode).toBe('dumb');
    expect(body.simpleLevel).toBe(1);
    expect(body.previousSuggestion).toMatch(/Conway/i);
    expect(result.current.architectDumbLevel).toBe(1);
    expect(result.current.suggestion).toBe('Simplified level 1 for the team.');

    await act(async () => {
      await result.current.dumbDown();
      await Promise.resolve();
    });
    body = JSON.parse(fetchMock.mock.calls.at(-1)[1].body);
    expect(body.simpleLevel).toBe(2);
    expect(result.current.architectDumbLevel).toBe(2);

    for (let level = 3; level <= 6; level += 1) {
      await act(async () => {
        await result.current.dumbDown();
        await Promise.resolve();
      });
      body = JSON.parse(fetchMock.mock.calls.at(-1)[1].body);
      expect(body.simpleLevel).toBe(level);
      expect(result.current.architectDumbLevel).toBe(level);
    }

    await act(async () => {
      await result.current.dumbDown();
      await Promise.resolve();
    });
    body = JSON.parse(fetchMock.mock.calls.at(-1)[1].body);
    expect(body.style).toBe('gibberish');
    expect(body.simpleLevel).toBeUndefined();
    expect(result.current.architectDumbLevel).toBe(7);
    expect(result.current.suggestion).toMatch(/goo ga/i);
  });

  it('does not auto-dismiss a landed proposal while pause stays true', async () => {
    mockPersonaPick('richard');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        persona: 'richard',
        suggestion: 'Still visible after the stream pause.',
        highlightIds: [],
        kind: 'comment'
      })
    });

    const { result, rerender } = renderHook(
      ({ pause }) => useAdvisorOrchestrator(defaultParams({ pause })),
      { initialProps: { pause: false } }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GAP_MS + 100);
      await Promise.resolve();
    });
    expect(result.current.suggestion).toBe('Still visible after the stream pause.');

    rerender({ pause: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
      await Promise.resolve();
    });
    expect(result.current.suggestion).toBe('Still visible after the stream pause.');

    rerender({ pause: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_500);
      await Promise.resolve();
    });
    expect(result.current.suggestion).toBeNull();
  });
});
