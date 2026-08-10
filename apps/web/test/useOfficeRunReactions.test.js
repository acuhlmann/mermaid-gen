// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useOfficeRunReactions,
  RUN_REACTION_DELAY_MS
} from '../src/hooks/useOfficeRunReactions.js';
import { _resetForTests } from '../src/state/officeMomentStore.js';

vi.mock('../utils/officeAmbienceStorage.js', () => ({
  readOfficeCadenceMemory: () => ({ lastFiredAt: 0 }),
  writeOfficeCadenceMemory: vi.fn()
}));

vi.mock('../utils/officeMomentDelivery.js', () => ({
  deliverCannedMoment: vi.fn(() => true),
  deliverLlmMoment: vi.fn(() => false),
  readSlotContext: () => ({ diagramSource: 'graph TD\n  A-->B' }),
  RECENT_MOMENTS_CAP: 8
}));

vi.mock('../state/officeMomentStore.js', () => ({
  getOfficeSnapshot: () => ({ focusTime: false }),
  shouldHoldAmbientOfficeMoments: () => false
}));

describe('useOfficeRunReactions fire()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not throw when a run signal fires (memory read before planRunReaction)', async () => {
    const { rerender } = renderHook(
      ({ runSignal }) =>
        useOfficeRunReactions({
          runSignal,
          getDiagramSource: () => 'graph TD\n  A-->B',
          random: () => 0
        }),
      { initialProps: { runSignal: null } }
    );

    await act(async () => {
      rerender({ runSignal: { id: 1, variant: 'jared' } });
      await vi.advanceTimersByTimeAsync(RUN_REACTION_DELAY_MS + 50);
    });
  });

  it('tells the model a run just landed, which is the only reason it is talking', async () => {
    // The trigger for this whole hook stopped at the hook: the prompt got a
    // plain cold-open IM, so the colleague commented on the diagram as if they
    // had wandered past it rather than on the change that had just happened.
    //
    // Asserted on the real request rather than on a module mock, because the
    // three `vi.mock` calls at the top of this file resolve to `apps/web/utils`
    // — a directory that does not exist — so nothing here is actually mocked.
    _resetForTests();
    window.localStorage.clear();
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          moment: { body: 'those boxes multiplied', colleagueId: 'intern', kind: 'im' }
        })
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = renderHook(
      ({ runSignal }) =>
        useOfficeRunReactions({
          runSignal,
          getDiagramSource: () => 'graph TD\n  A-->B',
          // 0 clears the reaction-chance roll and the LLM-share roll, so the
          // LLM rung is the one taken.
          random: () => 0
        }),
      { initialProps: { runSignal: null } }
    );

    // Two `act` blocks, not one: the effect that schedules the reaction timer
    // flushes when the act scope closes, so advancing the clock in the same
    // block advances it *before* the timer exists and nothing ever fires.
    await act(async () => {
      rerender({ runSignal: { id: 2, variant: 'jared' } });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RUN_REACTION_DELAY_MS + 50);
    });

    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}'));
    expect(body.kind).toBe('im');
    expect(body.situation).toBe('run');
    vi.unstubAllGlobals();
  });
});
