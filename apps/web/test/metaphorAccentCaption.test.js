import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { captionFitsCanvas } from '../src/components/metaphorScenes/accentCaptionFit.js';
import { accentRodScale } from '../src/components/metaphorScenes/accentRodScale.js';
import { accentRodLean } from '../src/components/metaphorScenes/accentRodLean.js';
import { coveredFraction } from '../src/components/metaphorScenes/labelDeclutter.js';

/** The plate a note of `chars` is drawn at, in CSS pixels. */
function plate(chars, lines = 1) {
  // Mirrors AccentCaption's own estimate: CAPTION_SIZE 0.38 world units at
  // CAPTION_TARGET_PX 12, wrapping at CAPTION_MAX_WIDTH 7.
  const width = Math.min(7, chars * 0.38 * 0.56) + 0.38 * 1.4;
  const height = lines * 0.38 * 1.32 + 0.38 * 0.8;
  return { widthPx: (width / 0.38) * 12, heightPx: (height / 0.38) * 12 };
}

describe('captionFitsCanvas', () => {
  it('stands the caption down on a phone, where the strip is a band', () => {
    // The strip spans the canvas a hundred pixels above the scene and prints
    // this exact sentence (accentThesisFromDsl), so the pin's copy is the same
    // claim twice within one glance — and the second copy is drawn over the
    // subject. Measured on the fused commerce composite: 224 CSS px of a 390px
    // phone, straight across the islands.
    expect(captionFitsCanvas(plate(30), { width: 390, height: 844 })).toBe(false);
  });

  it('stands it down on a foldable cover for the same reason', () => {
    expect(captionFitsCanvas(plate(30), { width: 717, height: 512 })).toBe(false);
  });

  it('keeps it on a roomy canvas, where the claim rides the item', () => {
    expect(captionFitsCanvas(plate(30), { width: 1440, height: 900 })).toBe(true);
  });

  it('stands down a four-line note in a short landscape window', () => {
    // The case the band rule cannot catch: wide enough that the strip is still
    // a row, short enough that the plate is a fifth of the frame. The caption
    // is screen-constant, so a long note is the same pixels everywhere.
    expect(captionFitsCanvas(plate(120, 4), { width: 1024, height: 380 })).toBe(false);
    expect(captionFitsCanvas(plate(120, 4), { width: 1024, height: 900 })).toBe(true);
  });

  it('says yes when the canvas has not been measured yet', () => {
    // First frame: refusing to draw on a zero-size canvas would flash the
    // caption in a beat later on every mount.
    expect(captionFitsCanvas(plate(30), { width: 0, height: 0 })).toBe(true);
  });
});

describe('the caption yields to the panels rather than fighting them', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../src/components/metaphorScenes/MetaphorAccents.jsx', import.meta.url)),
    'utf8'
  );

  it('registers as pinned but willing to disappear', () => {
    // Pinned so no item label can push the scene's own thesis aside; yielding
    // so the pin cannot become the panel collision it was meant to escape —
    // the accented item is usually the tallest thing in the scene, so its
    // caption floats up into exactly where the reading strip is.
    expect(source).toMatch(/pinned:\s*true/);
    expect(source).toMatch(/yieldWhenUnreadable:\s*true/);
  });

  it('actually fades — a no-op apply would make yielding invisible', () => {
    // It shipped with `apply: () => {}` because nothing could hide it. A
    // registration that yields and then paints anyway is worse than not
    // yielding: the pass believes the box is free and hands it to a label.
    expect(source).not.toMatch(/apply:\s*\(\)\s*=>\s*\{\}/);
    expect(source).toMatch(/plateRef/);
    expect(source).toMatch(/ruleRef/);
  });
});

/**
 * The rod's two screen-space bounds.
 *
 * The pin head is floored and the stem is held constant, and the reason they
 * are two numbers rather than one is in `accentRodScale.js`: driven from a
 * single uniform scale they fight, and the galaxy fixture came back with a
 * SHORTER stem and a head shrunk from 7 px to 3 px — worse on both counts than
 * the defect being fixed.
 *
 * The distances below are the ones measured on the three standing viewports:
 * a nine-service city sits ~62 world units from the camera, a layer cake ~20,
 * a subway network ~15.
 */
describe('accentRodScale', () => {
  const view = (distance, viewportHeightPx) => ({
    distance,
    fovDegrees: 45,
    viewportHeightPx,
    pinWidth: 0.84,
    stemHeight: 2.6
  });

  it('grows the pin head on the canvases where it rendered as a speck', () => {
    // Measured before the change: 9 px on a phone, 8 px on a foldable cover.
    expect(accentRodScale(view(62, 844)).pin).toBeGreaterThan(1.5);
    expect(accentRodScale(view(62, 512)).pin).toBeGreaterThan(2.5);
  });

  it('never shrinks a pin head that already reads', () => {
    // The floor is monotone by construction, which is what let one number be
    // chosen from twelve measured cells: no cell that reads today can regress.
    for (const distance of [4, 12, 20, 40, 62, 120]) {
      for (const height of [380, 512, 844, 900, 1600]) {
        expect(accentRodScale(view(distance, height)).pin).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('holds the stem at one on-screen length, shrinking as well as growing', () => {
    // The subway's rod stood 168 px on a desktop and ran off the top of the
    // canvas once the callout left the camera fit; the city's stood 28 px on a
    // phone, too short to stand the pin off the roof it marks.
    const tall = accentRodScale(view(15, 900));
    const short = accentRodScale(view(62, 844));
    expect(tall.stem).toBeLessThan(1);
    expect(short.stem).toBeGreaterThan(1);
  });

  it('keeps the stem inside its pathological-case clamps', () => {
    expect(accentRodScale(view(0.2, 900)).stem).toBeGreaterThanOrEqual(0.5);
    expect(accentRodScale(view(5000, 380)).stem).toBeLessThanOrEqual(4);
  });

  it('lets the two bounds disagree, which is the whole point of the split', () => {
    // A small world on a short canvas: the head wants to grow and the stem
    // wants to shrink. One scalar cannot do both.
    const galaxy = accentRodScale(view(11, 512));
    expect(galaxy.pin).toBeGreaterThanOrEqual(1);
    expect(galaxy.stem).toBeLessThan(galaxy.pin + 1);
  });
});

/**
 * The rod's lean out from behind the app's own panels.
 *
 * All of it is NDC — x and y in −1…1, y UP — the same vocabulary the declutter
 * pass decides a label's fate in. The numbers below are the measured foldable
 * cover: a 717x512 canvas whose reading strip is a 240x166 rail in the top-left
 * corner, which in NDC is x −0.978…−0.308, y 0.352…0.969.
 */
describe('accentRodLean', () => {
  /** The cover's reading rail, as `measureChromeRects` reports it. */
  const rail = { xMin: -0.978, xMax: -0.308, yMin: 0.352, yMax: 0.969 };
  /** A 22px pin head on that canvas: half-extents of 11px on each axis. */
  const head = { w: 11 / 717, h: 11 / 512 };
  /** 38° off an 80px stem is 62px of travel. */
  const cap = { x: (62 * 2) / 717, y: (62 * 2) / 512 };

  const lean = (tip, rects = [rail], maxLean = cap) =>
    accentRodLean({ tip, half: head, rects, maxLean });

  const box = (tip, offset = { x: 0, y: 0 }) => ({
    x: tip.x + offset.x,
    y: tip.y + offset.y,
    halfW: head.w,
    halfH: head.h
  });

  it('does not move a marker nobody is standing on', () => {
    // The common case, and the property that makes the change measurable: with
    // no panels, or with the head clear of them, the rod renders exactly as it
    // always has, so every cell that reads today is provably untouched.
    expect(lean({ x: 0.2, y: 0.4 }, [])).toEqual({ x: 0, y: 0 });
    expect(lean({ x: 0.2, y: 0.4 })).toEqual({ x: 0, y: 0 });
  });

  it('ignores a corner of the head touching a panel edge', () => {
    // The head is emissive, so its outermost pixels bleed. Moving the whole rod
    // because a bloom touches a card is worse than the touch.
    const tip = { x: rail.xMax + head.w * 0.85, y: 0.6 };
    expect(coveredFraction(box(tip), [rail])).toBeGreaterThan(0);
    expect(lean(tip)).toEqual({ x: 0, y: 0 });
  });

  it('leans the head out from under a corner card — the measured river case', () => {
    // `river` on a noir cover: the accented stage plans under the rail, and the
    // marker left 4px of amber on screen. The head sits inside the rail here.
    const tip = { x: -0.4, y: 0.5 };
    expect(coveredFraction(box(tip), [rail])).toBeGreaterThan(0.99);
    const offset = lean(tip);
    expect(offset.x).toBeGreaterThan(0);
    expect(offset.y).toBe(0);
    expect(coveredFraction(box(tip, offset), [rail])).toBeLessThan(0.13);
  });

  it('spends the standoff only when there is no sideways way out', () => {
    // Sideways costs the marker nothing; DOWN walks the head back toward the
    // roofs and spires the stem exists to clear. So at comparable distances the
    // lateral exit wins, and the downward one is still taken when it is the only
    // exit — which is the full-width top band on a phone.
    const band = { xMin: -1, xMax: 1, yMin: 0.72, yMax: 1 };
    const tip = { x: 0.1, y: 0.78 };
    expect(coveredFraction(box(tip), [band])).toBeGreaterThan(0.99);
    const offset = lean(tip, [band]);
    expect(offset.x).toBe(0);
    expect(offset.y).toBeLessThan(0);
    expect(coveredFraction(box(tip, offset), [band])).toBeLessThan(0.13);
  });

  it('never walks the head off the canvas to escape a panel', () => {
    // A rail hugging the right edge: the rightward exit would put the head past
    // x = 1, where it is clipped rather than readable — which is the same
    // failure as being behind the card, with an extra lean paid for it.
    const rightRail = { xMin: 0.6, xMax: 1, yMin: 0.3, yMax: 0.97 };
    const tip = { x: 0.78, y: 0.6 };
    const offset = lean(tip, [rightRail]);
    expect(offset.x).toBeLessThan(0);
    expect(Math.abs(tip.x + offset.x) + head.w).toBeLessThanOrEqual(1);
  });

  it('stays inside the lean cap wherever the head starts', () => {
    // The cap is what keeps the marker honest — past ~40° a leader line stops
    // reading as standing out of the item under it. Swept rather than spot-
    // checked because the fallback branch returns a CLAMPED candidate, which is
    // exactly where an off-by-one would escape.
    for (let x = -0.95; x <= 0.95; x += 0.05) {
      for (let y = -0.95; y <= 0.95; y += 0.05) {
        const offset = lean({ x, y });
        expect(Math.abs(offset.x)).toBeLessThanOrEqual(cap.x + 1e-9);
        expect(Math.abs(offset.y)).toBeLessThanOrEqual(cap.y + 1e-9);
      }
    }
  });

  it('refuses a lean that buys nothing — a rod deep under a wide band', () => {
    // The honest bound on this whole mechanism. A leader line can lean 38°; it
    // cannot walk the width of a panel. Where the head is buried far from every
    // edge, the marker stays vertical and unambiguous rather than tilting for a
    // picture that is no better — the caption and the item's own name already
    // yield there, and the fix for that cell is a camera question, not a
    // geometry one.
    const band = { xMin: -1, xMax: 1, yMin: 0.2, yMax: 1 };
    expect(lean({ x: 0, y: 0.6 }, [band])).toEqual({ x: 0, y: 0 });
  });

  it('is solved from the UNLEANED tip, which is why it cannot oscillate', () => {
    // Re-solving from where the lean just put the head returns zero, by
    // construction — the head is clear now. A dodge that fed on its own output
    // would therefore flip between leaning and not leaning every frame. The
    // caller passes the base geometry every time; this test is what pins that
    // contract from the outside.
    const tip = { x: -0.4, y: 0.5 };
    const offset = lean(tip);
    expect(offset.x).not.toBe(0);
    expect(lean(box(tip, offset))).toEqual({ x: 0, y: 0 });
  });

  it('does not lean for a head with no measurable size', () => {
    // First frame, before the canvas has been measured: a zero-size head has no
    // cover to compute, and leaning on that answer would fling the rod.
    expect(
      accentRodLean({ tip: { x: -0.4, y: 0.5 }, half: { w: 0, h: 0 }, rects: [rail], maxLean: cap })
    ).toEqual({ x: 0, y: 0 });
  });
});
