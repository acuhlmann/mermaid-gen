import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { captionFitsCanvas } from '../src/components/metaphorScenes/accentCaptionFit.js';
import { accentRodScale } from '../src/components/metaphorScenes/accentRodScale.js';

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
