// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useFloorWalker } from '../src/components/officeFloor/useFloorWalker.js';
import { OFFICE_CHROME_COPY } from '../src/utils/officeCast.js';

afterEach(() => {
  cleanup();
});

describe('useFloorWalker', () => {
  it('keeps the walker visible while departing after walkBy clears', () => {
    const walkBy = { id: 'wb1', colleagueId: 'intern' };
    const { result, rerender } = renderHook(({ wb }) => useFloorWalker(wb), {
      initialProps: { wb: walkBy }
    });

    expect(result.current.walker).toEqual(walkBy);
    expect(result.current.departing).toBe(false);

    rerender({ wb: null });
    expect(result.current.walker).toEqual(walkBy);
    expect(result.current.departing).toBe(true);

    act(() => {
      result.current.handleDeparted();
    });
    expect(result.current.walker).toBeNull();
    expect(result.current.departing).toBe(false);
  });

  it('replaces the departing copy when a new walkBy arrives', () => {
    const first = { id: 'wb1', colleagueId: 'intern' };
    const second = { id: 'wb2', colleagueId: 'greybeard' };
    const { result, rerender } = renderHook(({ wb }) => useFloorWalker(wb), {
      initialProps: { wb: first }
    });

    rerender({ wb: null });
    expect(result.current.departing).toBe(true);

    rerender({ wb: second });
    expect(result.current.walker).toEqual(second);
    expect(result.current.departing).toBe(false);
  });
  /*
   * Queue 13's second half: the departing copy carries what they say about
   * being waved off, and **only** when the ✕ was the thing that cleared the
   * store. This hook is the only place on the floor that can tell the press
   * from the 24 s TTL, which is why the line is derived here and not in a
   * component that sees the result of both.
   */
  describe('the refusal line', () => {
    const PITCH = {
      id: 'wb1',
      colleagueId: 'greybeard',
      body: 'We tried that in 1979.',
      actionPrompt: 'Add the legacy system'
    };

    it('says a bank line on the way home when the ✕ was pressed', () => {
      const { result, rerender } = renderHook(({ wb }) => useFloorWalker(wb), {
        initialProps: { wb: PITCH }
      });

      act(() => {
        result.current.handleRefused('wb1');
      });
      rerender({ wb: null });

      expect(result.current.departing).toBe(true);
      expect(result.current.walker.refused).toBe(true);
      expect(OFFICE_CHROME_COPY.floor.declined).toContain(result.current.walker.body);
      // The offer is over: a second chance to take it is the pitch chasing you.
      expect(result.current.walker.actionPrompt).toBeUndefined();
    });

    /*
     * The control that carries the whole claim. A clock running out says
     * nothing for the same reason it writes nothing — it never comes through
     * the press handler — and from one tick later the two endings are
     * indistinguishable, so without this case the feature would look identical
     * on a night the ✕ had come unwired.
     */
    it('says nothing when the walk-by expired instead of being refused', () => {
      const { result, rerender } = renderHook(({ wb }) => useFloorWalker(wb), {
        initialProps: { wb: PITCH }
      });

      rerender({ wb: null });

      expect(result.current.departing).toBe(true);
      expect(result.current.walker).toEqual(PITCH);
      expect(result.current.walker.refused).toBeUndefined();
    });

    /** The gate the beat already has: a remark closes in silence. */
    it('says nothing when the bubble offered nothing to refuse', () => {
      const remark = { id: 'wb2', colleagueId: 'greybeard', body: 'Your auth box is a lie.' };
      const { result, rerender } = renderHook(({ wb }) => useFloorWalker(wb), {
        initialProps: { wb: remark }
      });

      act(() => {
        result.current.handleRefused('wb2');
      });
      rerender({ wb: null });

      expect(result.current.walker).toEqual(remark);
      expect(result.current.walker.refused).toBeUndefined();
    });

    /** A press aimed at a walk-by that is no longer on screen answers nothing. */
    it('ignores a press that names a different walk-by', () => {
      const { result, rerender } = renderHook(({ wb }) => useFloorWalker(wb), {
        initialProps: { wb: PITCH }
      });

      act(() => {
        result.current.handleRefused('wb-stale');
      });
      rerender({ wb: null });

      expect(result.current.walker).toEqual(PITCH);
    });

    /*
     * A rolled line that never got spent must not ride the *next* departure —
     * somebody apologising for an idea you did take is the inverse of the
     * failure the beat's twin probe exists for.
     */
    it('drops an unspent refusal when a new walk-by arrives', () => {
      const second = { id: 'wb3', colleagueId: 'intern', body: 'Second!' };
      const { result, rerender } = renderHook(({ wb }) => useFloorWalker(wb), {
        initialProps: { wb: PITCH }
      });

      act(() => {
        result.current.handleRefused('wb1');
      });
      rerender({ wb: second });
      rerender({ wb: null });

      expect(result.current.walker).toEqual(second);
      expect(result.current.walker.refused).toBeUndefined();
    });
  });
});
