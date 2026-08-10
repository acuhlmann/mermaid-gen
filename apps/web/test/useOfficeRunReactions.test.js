// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useOfficeRunReactions,
  RUN_REACTION_DELAY_MS
} from '../src/hooks/useOfficeRunReactions.js';
import { _resetForTests } from '../src/state/officeMomentStore.js';

/*
 * This file deliberately runs against the REAL delivery modules, with `fetch`
 * as the only seam.
 *
 * It used to open with three `vi.mock` calls for `officeAmbienceStorage`,
 * `officeMomentDelivery` and `officeMomentStore` — all written as `../utils/…`
 * and `../state/…`, which from `apps/web/test/` resolve to `apps/web/utils/`
 * and `apps/web/state/`: directories that do not exist. Vitest does not fail a
 * mock whose specifier resolves nowhere, so all three silently no-opped and the
 * real modules ran anyway. They have been removed rather than repaired: making
 * them live would stub out the very request these tests assert on, and would
 * re-mock the store this file imports `_resetForTests` from.
 *
 * The general trap, worth remembering: a `vi.mock` path that resolves nowhere
 * fails silently, so a suite can pass for the wrong reason. Note that a `.js`
 * specifier pointing at a `.ts` file is NOT an instance of it — that is the
 * ordinary TypeScript import convention and Vite resolves it.
 */

/** The shape `/api/office/moment` returns; the body text is never asserted on. */
function stubOfficeFetch() {
  const fetchMock = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: async () => ({
        moment: { body: 'those boxes multiplied', colleagueId: 'intern', kind: 'im' }
      })
    })
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** `random: () => 0` clears both the reaction-chance and LLM-share rolls, so the LLM rung is taken. */
function mountHook() {
  return renderHook(
    ({ runSignal }) =>
      useOfficeRunReactions({
        runSignal,
        getDiagramSource: () => 'graph TD\n  A-->B',
        random: () => 0
      }),
    { initialProps: { runSignal: null } }
  );
}

/*
 * Two `act` blocks, never one. The effect that schedules the reaction timer
 * flushes when the act scope closes, so advancing the clock inside the same
 * block advances it *before* the timer exists and nothing ever fires. Measured:
 * one block leaves `fetch` on zero calls, two blocks land exactly one.
 */
async function fireRun(rerender, id) {
  await act(async () => {
    rerender({ runSignal: { id, variant: 'jared' } });
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(RUN_REACTION_DELAY_MS + 50);
  });
}

describe('useOfficeRunReactions fire()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetForTests();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reaches delivery when a run signal fires (memory read before planRunReaction)', async () => {
    // Guards the ordering bug this test was written for: `readOfficeCadenceMemory`
    // must be read before `planRunReaction` consumes it. Asserting that the
    // request actually goes out is what makes that guard real — the previous
    // form only asserted "does not throw" while, as it turns out, never firing.
    const fetchMock = stubOfficeFetch();
    const { rerender } = mountHook();

    await fireRun(rerender, 1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('tells the model a run just landed, which is the only reason it is talking', async () => {
    // The trigger for this whole hook stopped at the hook: the prompt got a
    // plain cold-open IM, so the colleague commented on the diagram as if they
    // had wandered past it rather than on the change that had just happened.
    const fetchMock = stubOfficeFetch();
    const { rerender } = mountHook();

    await fireRun(rerender, 2);

    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}'));
    expect(body.kind).toBe('im');
    expect(body.situation).toBe('run');
  });
});
