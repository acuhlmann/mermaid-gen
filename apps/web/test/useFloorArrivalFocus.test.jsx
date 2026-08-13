// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFloorArrivalFocus } from '../src/components/officeFloor/useFloorArrivalFocus.js';
import { MAX_SCALE } from '../src/hooks/useStageScale.js';

/**
 * Day One follow-cam: a deliberate zoom past fit-to-viewport so the arrival
 * walk has room to pan. Pure scale math — scroll choreography is browser-only.
 */

describe('useFloorArrivalFocus', () => {
  const viewportRef = { current: document.createElement('div') };
  const focusTile = { x: 4, y: 3 };

  it('returns fit scale when the ceremony is not focused', () => {
    const { result } = renderHook(() => useFloorArrivalFocus(viewportRef, focusTile, 0.8, false));
    expect(result.current).toBe(0.8);
  });

  it('boosts past fit-to-viewport during the Day One walk', () => {
    const fitScale = 0.5;
    const { result } = renderHook(() =>
      useFloorArrivalFocus(viewportRef, focusTile, fitScale, true)
    );
    expect(result.current).toBeCloseTo(fitScale * 1.55, 5);
  });

  it('never exceeds the stage scale ceiling', () => {
    const { result } = renderHook(() => useFloorArrivalFocus(viewportRef, focusTile, 1.0, true));
    expect(result.current).toBe(Math.min(MAX_SCALE + 0.45, 1.0 * 1.55));
  });
});
