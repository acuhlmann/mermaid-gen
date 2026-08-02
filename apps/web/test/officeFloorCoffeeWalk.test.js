// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFloorCoffeeWalk } from '../src/components/officeFloor/useFloorCoffeeWalk.js';
import { propTileFor } from '../src/utils/officeFloorMovement.js';

describe('useFloorCoffeeWalk', () => {
  it('walks you to the coffee machine once the break is accepted', () => {
    const walkTo = vi.fn();
    renderHook(() =>
      useFloorCoffeeWalk({
        coffee: { id: 'coffee-1', accepted: true },
        walkTo
      })
    );
    expect(walkTo).toHaveBeenCalledWith(propTileFor('coffeeMachine'));
  });

  it('does not walk while the invite is still pending', () => {
    const walkTo = vi.fn();
    renderHook(() =>
      useFloorCoffeeWalk({
        coffee: { id: 'coffee-1', accepted: false },
        walkTo
      })
    );
    expect(walkTo).not.toHaveBeenCalled();
  });

  it('does nothing when there is no coffee break', () => {
    const walkTo = vi.fn();
    renderHook(() => useFloorCoffeeWalk({ coffee: null, walkTo }));
    expect(walkTo).not.toHaveBeenCalled();
  });

  it('does not walk during a physical meeting', () => {
    const walkTo = vi.fn();
    renderHook(() =>
      useFloorCoffeeWalk({
        coffee: { id: 'coffee-1', accepted: true },
        walkTo,
        suspended: true
      })
    );
    expect(walkTo).not.toHaveBeenCalled();
  });
});
