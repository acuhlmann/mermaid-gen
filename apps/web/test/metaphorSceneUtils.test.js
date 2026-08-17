import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { isDarkBackdrop, shiftColor } from '../src/components/metaphorScenes/sceneUtils.js';
import { METAPHOR_THEME_PRESETS } from '../src/utils/metaphorThemePresets.js';

const hex = (color) => `#${color.getHexString()}`;

/** Perceptual lightness of the result, read back in the space callers think in. */
function lightnessOf(color) {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl, THREE.SRGBColorSpace);
  return hsl.l;
}

describe('shiftColor', () => {
  // The scenes call this ~80 times, almost always with deltas of ±0.04…0.2, and
  // they mean them perceptually: "the same material, a bit darker". three's
  // colour management converts to LINEAR on construction, where an ordinary
  // mid-tone sits around l = 0.09 — so those deltas went negative and clamped to
  // pure black. Measured on the bridge: shore slabs rendering #020000.
  it('darkens a mid-tone instead of clamping it to black', () => {
    for (const base of ['#2c4a6e', '#39434f', '#8b5a2b', '#3d9a4a', '#5b6478']) {
      const darker = shiftColor(base, { lightness: -0.1 });
      expect(hex(darker)).not.toBe('#000000');
      expect(lightnessOf(darker)).toBeGreaterThan(0.02);
    }
  });

  it('moves lightness by roughly the requested amount', () => {
    const base = new THREE.Color('#4a6c96');
    const start = lightnessOf(base);
    expect(lightnessOf(shiftColor('#4a6c96', { lightness: -0.1 }))).toBeCloseTo(start - 0.1, 2);
    expect(lightnessOf(shiftColor('#4a6c96', { lightness: 0.12 }))).toBeCloseTo(start + 0.12, 2);
  });

  it('keeps a zero shift a no-op', () => {
    expect(hex(shiftColor('#8b5a2b', {}))).toBe('8b5a2b'.padStart(7, '#'));
  });

  it('still clamps at the ends rather than wrapping', () => {
    expect(lightnessOf(shiftColor('#ffffff', { lightness: 0.5 }))).toBeCloseTo(1, 3);
    expect(lightnessOf(shiftColor('#000000', { lightness: -0.5 }))).toBeCloseTo(0, 3);
  });

  it('scales saturation and rotates hue without touching the others', () => {
    const desaturated = shiftColor('#3d9a4a', { satScale: 0.2 });
    const hsl = { h: 0, s: 0, l: 0 };
    desaturated.getHSL(hsl, THREE.SRGBColorSpace);
    expect(hsl.s).toBeLessThan(0.2);
    expect(hsl.l).toBeCloseTo(lightnessOf(new THREE.Color('#3d9a4a')), 2);
  });
});

describe('isDarkBackdrop', () => {
  // MetaphorAccents gates its additive light shaft on this: additive blending can
  // only brighten, so over whiteboard's near-white sky a beam is invisible and a
  // normal-blended cone reads as a smudge on the subject.
  it('treats noir and blueprint as dark enough for additive glow', () => {
    expect(isDarkBackdrop({ skyHorizonColor: '#1a2433' })).toBe(true);
    expect(isDarkBackdrop({ background: '#0b0f19' })).toBe(true);
    expect(isDarkBackdrop(METAPHOR_THEME_PRESETS.noir)).toBe(true);
    expect(isDarkBackdrop(METAPHOR_THEME_PRESETS.blueprint)).toBe(true);
  });

  it('treats whiteboard as too bright for additive glow', () => {
    expect(isDarkBackdrop(METAPHOR_THEME_PRESETS.whiteboard)).toBe(false);
  });

  it('returns false when no backdrop colour is available', () => {
    expect(isDarkBackdrop({})).toBe(false);
  });
});
