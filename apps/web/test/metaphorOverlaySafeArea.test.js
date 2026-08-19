import { describe, expect, it } from 'vitest';
import {
  CHROME_ATTR,
  overlaySafeArea,
  safeAreaChanged
} from '../src/components/metaphorScenes/overlaySafeArea.js';

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

/** A panel rect, in the canvas's own pixel space. */
function panel(left, top, width, height) {
  return { left, top, right: left + width, bottom: top + height };
}

describe('overlaySafeArea', () => {
  it('reserves the top for a full-width reading strip', () => {
    // The measured phone case: the strip is 185px of an 844px canvas, and the
    // scene used to be fitted to the whole canvas and then drawn under it.
    const area = overlaySafeArea(PHONE, [panel(8, 0, 374, 185)]);
    expect(area.top).toBeCloseTo(185 / 844, 2);
    expect(area.bottom).toBe(0);
    expect(area.left).toBe(0);
    expect(area.right).toBe(0);
  });

  it('charges a corner card less than a band across the same edge', () => {
    const band = overlaySafeArea(PHONE, [panel(0, 700, 390, 144)]);
    const card = overlaySafeArea(PHONE, [panel(200, 700, 180, 144)]);
    expect(card.bottom).toBeGreaterThan(0);
    expect(card.bottom).toBeLessThan(band.bottom * 0.75);
  });

  it('gives a panel one edge, not two', () => {
    // The composite's layer key sits in a corner. Reserving both the bottom and
    // the right for it would pay for one card twice and push the world into a
    // quarter of the canvas.
    const area = overlaySafeArea(DESKTOP, [panel(1170, 760, 256, 126)]);
    const claimed = ['top', 'right', 'bottom', 'left'].filter((edge) => area[edge] > 0);
    expect(claimed).toHaveLength(1);
  });

  it('ignores a panel too thin to matter', () => {
    const area = overlaySafeArea(DESKTOP, [panel(20, 876, 120, 12)]);
    expect(area).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('keeps the largest claim per edge rather than adding them up', () => {
    const area = overlaySafeArea(PHONE, [panel(0, 0, 390, 120), panel(0, 0, 390, 185)]);
    expect(area.top).toBeCloseTo(185 / 844, 2);
  });

  it('returns nothing for a canvas with no size', () => {
    expect(overlaySafeArea({ width: 0, height: 0 }, [panel(0, 0, 10, 10)])).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    });
  });
});

describe('safeAreaChanged', () => {
  it('ignores a sub-pixel reflow so a measure/refit loop cannot start', () => {
    expect(safeAreaChanged({ top: 0.2, right: 0, bottom: 0, left: 0 }, { top: 0.205 })).toBe(false);
  });

  it('reports a real change', () => {
    expect(safeAreaChanged({ top: 0.2, right: 0, bottom: 0, left: 0 }, { top: 0.3 })).toBe(true);
  });
});

describe('chrome marking', () => {
  it('names the attribute the overlays tag themselves with', () => {
    // The measurement is by attribute rather than by class list so that adding
    // a transient panel (the read, the pick) cannot accidentally join the set
    // the camera fits around.
    expect(CHROME_ATTR).toBe('data-metaphor-chrome');
  });
});
