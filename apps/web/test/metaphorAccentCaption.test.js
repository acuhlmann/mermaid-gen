import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { captionFitsCanvas } from '../src/components/metaphorScenes/accentCaptionFit.js';

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
