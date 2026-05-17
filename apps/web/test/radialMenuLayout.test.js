import { describe, expect, it } from 'vitest';
import {
  adjacentButtonSeparationPx,
  chipBoundingClearancePx,
  RADIAL_MIN_CENTER_SEPARATION_PX,
  resolveArcGeometry
} from '../src/utils/radialMenuLayout.js';

describe('radialMenuLayout', () => {
  it('widens the arc so many buttons do not overlap at the base radius', () => {
    const { radiusPx, spreadDeg } = resolveArcGeometry(7, 82);
    const separation = adjacentButtonSeparationPx(7, radiusPx, spreadDeg);
    expect(separation).toBeGreaterThanOrEqual(RADIAL_MIN_CENTER_SEPARATION_PX - 0.5);
  });

  it('keeps a modest action count near the preferred radius', () => {
    const { radiusPx, spreadDeg } = resolveArcGeometry(2, 82);
    expect(radiusPx).toBe(82);
    expect(spreadDeg).toBeGreaterThanOrEqual(165);
  });

  it('pushes the arc outward when the center chip is large', () => {
    const clearance = chipBoundingClearancePx(220, 48, 34);
    const { radiusPx } = resolveArcGeometry(3, 82, clearance);
    expect(radiusPx).toBeGreaterThanOrEqual(clearance);
  });
});
