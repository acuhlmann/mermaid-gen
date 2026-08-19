import { describe, expect, it } from 'vitest';
import {
  LABEL_TARGET_PX,
  screenConstantScale,
  worldUnitsPerPixel
} from '../src/components/metaphorScenes/metaphorScreenScale.js';

const FOV = 45;

/** The on-screen height, in px, that `worldSize` renders at after scaling. */
function drawnPx({ distance, viewportHeightPx, worldSize, targetPx = LABEL_TARGET_PX }) {
  const scale = screenConstantScale({
    distance,
    fovDegrees: FOV,
    viewportHeightPx,
    worldSize,
    targetPx
  });
  return (worldSize * scale) / worldUnitsPerPixel(distance, FOV, viewportHeightPx);
}

describe('screenConstantScale', () => {
  it('draws the same label at the same pixel size front and back of a scene', () => {
    // The reported symptom: in one fused composite "Shipping API" measured ~26px
    // of cap height and "Browse" ~9px, which reads as a rendering fault rather
    // than as perspective.
    const near = drawnPx({ distance: 22, viewportHeightPx: 900, worldSize: 0.55 });
    const far = drawnPx({ distance: 64, viewportHeightPx: 900, worldSize: 0.55 });
    expect(near).toBeCloseTo(LABEL_TARGET_PX, 4);
    expect(far).toBeCloseTo(LABEL_TARGET_PX, 4);
  });

  it('draws the same label at the same pixel size on a phone and a desktop', () => {
    const phone = drawnPx({ distance: 40, viewportHeightPx: 844, worldSize: 0.55 });
    const desktop = drawnPx({ distance: 40, viewportHeightPx: 1600, worldSize: 0.55 });
    expect(phone).toBeCloseTo(desktop, 4);
  });

  it('holds a 14-unit cake and a 60-unit bridge to one type size', () => {
    const cake = drawnPx({ distance: 14, viewportHeightPx: 900, worldSize: 0.55 });
    const bridge = drawnPx({ distance: 60, viewportHeightPx: 900, worldSize: 0.55 });
    expect(cake).toBeCloseTo(bridge, 4);
  });

  it('clamps rather than dividing by zero on a degenerate camera', () => {
    expect(
      Number.isFinite(
        screenConstantScale({
          distance: 0,
          fovDegrees: FOV,
          viewportHeightPx: 0,
          worldSize: 0.5,
          targetPx: 13
        })
      )
    ).toBe(true);
    expect(
      screenConstantScale({
        distance: 30,
        fovDegrees: FOV,
        viewportHeightPx: 900,
        worldSize: 0,
        targetPx: 13
      })
    ).toBe(1);
  });
});

describe('worldUnitsPerPixel', () => {
  it('grows with distance and shrinks with viewport height', () => {
    expect(worldUnitsPerPixel(60, FOV, 900)).toBeGreaterThan(worldUnitsPerPixel(30, FOV, 900));
    expect(worldUnitsPerPixel(30, FOV, 1800)).toBeLessThan(worldUnitsPerPixel(30, FOV, 900));
  });
});
