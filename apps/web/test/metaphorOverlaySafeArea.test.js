import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CHROME_ATTR,
  EXTERNAL_CHROME_ATTR,
  measureExternalChromeInsets,
  measureOverlaySafeArea,
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

  it('gives a wide bottom band the bottom edge, not the left one it sits nearest', () => {
    // The measured phone case for the app's composer band: it is 7px from the
    // left of a 390px canvas and 42px from the bottom, so a nearest-edge rule
    // read it as a left-hand panel and reserved 94% of the left edge for a band
    // 97px tall. The band is 705..802 of 844, and the bottom is the only edge a
    // reservation for it costs anything reasonable on.
    const area = overlaySafeArea(PHONE, [
      { left: 7, top: 705, right: 365, bottom: 802 },
      { left: 0, top: 807, right: 390, bottom: 844 }
    ]);
    expect(area.left).toBe(0);
    expect(area.right).toBe(0);
    expect(area.top).toBe(0);
    // The deeper of the two, not their sum: the taskbar sits inside the band
    // the composer already claimed.
    expect(area.bottom).toBeCloseTo(139 / 844, 2);
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

  it('has the insights embed opt out, so the hatch is not tested and dead', () => {
    // `includeExternal: false` existed from the day external chrome was first
    // measured and nothing in production passed it. It matters now that the
    // bottom band is marked too: `.bottom-chrome` keeps the width it pads away
    // when the insights pane is open, so an embed inside that pane would
    // reserve a band for chrome that has already stepped aside for it.
    const source = readFileSync(
      fileURLToPath(new URL('../src/components/InsightsEmbeddedDiagram.jsx', import.meta.url)),
      'utf8'
    );
    expect(source).toMatch(/<MetaphorRenderer[\s\S]{0,600}?measureAppChrome=\{false\}/);
  });

  it('names the external-chrome attribute the top-shell tags itself with', () => {
    // The metaphor camera fit reserves for the app's fixed top-shell too, so
    // the accented item is not framed under the brand chip on phones. See
    // TopShell.jsx.
    expect(EXTERNAL_CHROME_ATTR).toBe('data-app-chrome');
  });
});

/** Build a stub Element the measure functions can consume. */
function stubElement(rect, options = {}) {
  const chromeNodes = (options.chrome ?? []).map((chromeRect) => ({
    getBoundingClientRect() {
      return chromeRect;
    }
  }));
  return {
    ownerDocument: null,
    style: {
      _values: {},
      getPropertyValue(key) {
        return this._values[key] ?? '';
      },
      setProperty(key, value) {
        this._values[key] = value;
      },
      removeProperty(key) {
        delete this._values[key];
      }
    },
    getBoundingClientRect() {
      return rect;
    },
    querySelectorAll(selector) {
      // Very small selector engine: only the two attribute selectors the
      // production code uses. Returning `chrome` for CHROME_ATTR keeps the
      // existing measurement path stable.
      if (selector === `[${CHROME_ATTR}]`) return chromeNodes;
      return [];
    }
  };
}

/**
 * Build a stub document that returns tagged external-chrome elements.
 *
 * `fullscreenContains` stands in for `document.fullscreenElement.contains(node)`
 * — null means no element is fullscreen, which is the ordinary case.
 */
function stubDocument(externalRects, { fullscreenContains = null } = {}) {
  const nodes = externalRects.map((rect) => ({
    getBoundingClientRect() {
      return rect;
    }
  }));
  return {
    fullscreenElement:
      fullscreenContains === null ? null : { contains: (node) => fullscreenContains(node) },
    querySelectorAll(selector) {
      if (selector === `[${EXTERNAL_CHROME_ATTR}]`) return nodes;
      return [];
    }
  };
}

describe('measureOverlaySafeArea with external chrome', () => {
  it('reserves for a top-shell that paints over the top of the canvas', () => {
    // The phone case: a 390x844 canvas with a top-shell running full-width at
    // top: 16px for ~48px of height. Without external chrome we would report
    // a zero safe area; with it, the top band is claimed and the camera can
    // frame the scene BELOW the brand chip.
    const canvas = { left: 0, top: 0, right: 390, bottom: 844, width: 390, height: 844 };
    const chrome = { left: 16, top: 16, right: 374, bottom: 64, width: 358, height: 48 };
    const container = stubElement(canvas);
    const area = measureOverlaySafeArea(container, { document: stubDocument([chrome]) });
    expect(area?.top).toBeGreaterThan(0);
    expect(area?.top).toBeCloseTo(64 / 844, 2);
    expect(area?.bottom).toBe(0);
  });

  it('opts out of external chrome when includeExternal is false', () => {
    // The insights embed does not paint the app's top-shell over its canvas,
    // so it needs an escape hatch that turns the external-chrome reservation
    // off. Without this flag every embedded scene would refit for chrome that
    // is not covering it.
    const canvas = { left: 0, top: 0, right: 390, bottom: 844, width: 390, height: 844 };
    const chrome = { left: 16, top: 16, right: 374, bottom: 64, width: 358, height: 48 };
    const container = stubElement(canvas);
    const area = measureOverlaySafeArea(container, {
      document: stubDocument([chrome]),
      includeExternal: false
    });
    expect(area).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('ignores app chrome outside the fullscreen element, which paints nothing', () => {
    // Native fullscreen renders only the fullscreen element's own subtree, but
    // the rest of the document keeps its layout: getBoundingClientRect still
    // reports the top-shell at its usual 16px. Without the containment check a
    // fullscreen scene frames itself around chrome nobody can see.
    const canvas = { left: 0, top: 0, right: 390, bottom: 844, width: 390, height: 844 };
    const chrome = { left: 16, top: 16, right: 374, bottom: 64, width: 358, height: 48 };
    const container = stubElement(canvas);
    const area = measureOverlaySafeArea(container, {
      document: stubDocument([chrome], { fullscreenContains: () => false })
    });
    expect(area).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('clips the reservation to the canvas — a top-shell above the canvas box costs nothing', () => {
    // Not every embed sits under the top-shell — some inline canvases start
    // 200px below the shell. Reserving for chrome that is not actually
    // covering the canvas would push the scene into a gap for no reason.
    const canvas = { left: 0, top: 200, right: 390, bottom: 900, width: 390, height: 700 };
    const chrome = { left: 16, top: 16, right: 374, bottom: 64, width: 358, height: 48 };
    const container = stubElement(canvas);
    const area = measureOverlaySafeArea(container, { document: stubDocument([chrome]) });
    expect(area).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});

describe('measureExternalChromeInsets', () => {
  it('returns raw pixels — the CSS variable format the reading strip reads', () => {
    // measureOverlaySafeArea returns fractions for the camera; the reading
    // strip needs pixels for its `top:` offset. Both paths are driven off the
    // same rects but shape their result differently.
    const canvas = { left: 0, top: 0, right: 390, bottom: 844, width: 390, height: 844 };
    const chrome = { left: 16, top: 16, right: 374, bottom: 64, width: 358, height: 48 };
    const container = stubElement(canvas);
    const insets = measureExternalChromeInsets(container, { document: stubDocument([chrome]) });
    expect(insets).toEqual({ top: 64, right: 0, bottom: 0, left: 0 });
  });

  it('reports zero for every edge when nothing external is tagged', () => {
    // Fullscreen mode removes the top-shell entirely — the measurement finds
    // no marked chrome and the reading strip's `top` collapses to its base
    // 12px through the `var(..., 0px)` fallback.
    const canvas = { left: 0, top: 0, right: 1440, bottom: 900, width: 1440, height: 900 };
    const container = stubElement(canvas);
    const insets = measureExternalChromeInsets(container, { document: stubDocument([]) });
    expect(insets).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('reports the bottom band the composer and the taskbar make together', () => {
    // The pixel path is what the panels read: the layer key, the tap inspector
    // and the guided read all push up off `--metaphor-app-bottom-inset`. The
    // measured phone case — composer band 705..802, taskbar 807..844 of an
    // 844px canvas — has to come back as one 139px reservation covering both,
    // not as the taskbar's 37px and not as the two added together.
    const canvas = { left: 0, top: 0, right: 390, bottom: 844, width: 390, height: 844 };
    const composer = { left: 7, top: 705, right: 365, bottom: 802, width: 358, height: 97 };
    const taskbar = { left: 0, top: 807, right: 390, bottom: 844, width: 390, height: 37 };
    const container = stubElement(canvas);
    const insets = measureExternalChromeInsets(container, {
      document: stubDocument([composer, taskbar])
    });
    expect(insets).toEqual({ top: 0, right: 0, bottom: 139, left: 0 });
  });

  it('gives one panel one edge — a corner card does not claim both', () => {
    // A hypothetical bottom-right corner control marked as app chrome must
    // pick one edge, not both, or the reservation would double-charge and
    // squeeze the scene into the middle. Same rule as the fractional path.
    const canvas = { left: 0, top: 0, right: 1440, bottom: 900, width: 1440, height: 900 };
    const chrome = {
      left: 1240,
      top: 780,
      right: 1400,
      bottom: 860,
      width: 160,
      height: 80
    };
    const container = stubElement(canvas);
    const insets = measureExternalChromeInsets(container, { document: stubDocument([chrome]) });
    const claimed = ['top', 'right', 'bottom', 'left'].filter((edge) => insets[edge] > 0);
    expect(claimed).toHaveLength(1);
  });
});
