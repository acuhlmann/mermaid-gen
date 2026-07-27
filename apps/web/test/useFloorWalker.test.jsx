// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useFloorWalker } from '../src/components/officeFloor/useFloorWalker.js';

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
});
