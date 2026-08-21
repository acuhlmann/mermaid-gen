import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  isDarkBackdrop,
  recedeColor,
  recedeTheme,
  shiftColor
} from '../src/components/metaphorScenes/sceneUtils.js';
import { METAPHOR_THEME_PRESETS } from '../src/utils/metaphorThemePresets.js';

const hex = (color) => `#${color.getHexString()}`;

/** Perceptual lightness of the result, read back in the space callers think in. */
function lightnessOf(color) {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl, THREE.SRGBColorSpace);
  return hsl.l;
}

/** Perceptual saturation, same space and same reason as lightnessOf. */
function saturationOf(color) {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl, THREE.SRGBColorSpace);
  return hsl.s;
}

/** Straight-line distance between two colours in the working space. */
function distance(a, b) {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
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

describe('recedeTheme', () => {
  // Layer focus recedes the layers you are not reading, and it does it by
  // substituting a whole theme rather than teaching thirteen primitives about
  // focus. That only works if the substitution is total and safe.
  it('moves every colour toward the scene horizon, on every preset', () => {
    // Convergence on the horizon is the whole definition of receding, and it is
    // the claim worth sweeping: it holds for a vivid tower and for a pale
    // ground alike. Saturation is not — a pale ground receding into a slightly
    // bluer sky legitimately gains a little on the way, so "everything gets
    // duller" is the wrong physics as well as a failing assertion. The
    // saturation claim is made below, against the case that actually needs it.
    let moved = 0;
    for (const [id, preset] of Object.entries(METAPHOR_THEME_PRESETS)) {
      const muted = recedeTheme(preset);
      const horizon = new THREE.Color(preset.skyHorizonColor ?? preset.background);
      for (const [key, value] of Object.entries(preset)) {
        if (typeof value !== 'string' || !value.startsWith('#')) continue;
        const before = distance(new THREE.Color(value), horizon);
        const after = distance(new THREE.Color(muted[key]), horizon);
        expect(after, `${id}.${key}`).toBeLessThanOrEqual(before + 1e-6);
        if (before > 0.05) {
          // Anything meaningfully away from the horizon has to actually travel,
          // or "receded" is a no-op that still reads as the foreground layer.
          expect(after, `${id}.${key} barely moved`).toBeLessThan(before * 0.9);
          moved += 1;
        }
      }
    }
    // A sweep over a set nothing joins passes while examining nothing.
    expect(moved).toBeGreaterThan(100);
  });

  it('drains saturation against a neutral horizon', () => {
    // The case the effect is for: a vivid body standing in a grey-ish haze has
    // to stop shouting, or the receded layer keeps winning the eye.
    const vivid = '#ef4444';
    const receded = recedeColor(vivid, '#8b95a5');
    expect(saturationOf(receded)).toBeLessThan(saturationOf(new THREE.Color(vivid)) * 0.55);
  });

  it('never recedes a colour to black, on any preset', () => {
    // The trap this whole module is annotated for: a near-black albedo cannot
    // be lit, so a receded layer that clamps to black stops reading as a body
    // standing in the scene and reads as a hole in it.
    for (const [id, preset] of Object.entries(METAPHOR_THEME_PRESETS)) {
      const muted = recedeTheme(preset);
      for (const [key, value] of Object.entries(muted)) {
        if (typeof value !== 'string' || !value.startsWith('#')) continue;
        expect(lightnessOf(new THREE.Color(value)), `${id}.${key}`).toBeGreaterThan(0.02);
      }
    }
  });

  it('leaves non-colour theme entries alone', () => {
    // A receded layer is lit by the same lights as the rest of the world,
    // because it is standing in it — only its albedo moves.
    const preset = METAPHOR_THEME_PRESETS.whiteboard;
    const muted = recedeTheme(preset);
    expect(muted.ambientIntensity).toBe(preset.ambientIntensity);
    expect(muted.directional).toBe(preset.directional);
    // `hemisphere` is ['#hex', '#hex', 0.45] — a mixed array, so it is not a
    // colour list and must survive whole.
    expect(muted.hemisphere).toBe(preset.hemisphere);
  });

  it('recedes a palette array, which is where district colours live', () => {
    const preset = METAPHOR_THEME_PRESETS.whiteboard;
    const muted = recedeTheme(preset);
    const horizon = new THREE.Color(preset.skyHorizonColor);
    expect(muted.districtPalette).toHaveLength(preset.districtPalette.length);
    for (let i = 0; i < preset.districtPalette.length; i += 1) {
      expect(muted.districtPalette[i]).not.toBe(preset.districtPalette[i]);
      expect(distance(new THREE.Color(muted.districtPalette[i]), horizon)).toBeLessThan(
        distance(new THREE.Color(preset.districtPalette[i]), horizon) + 0.02
      );
    }
  });

  it('passes a non-theme through rather than throwing', () => {
    expect(recedeTheme(null)).toBeNull();
  });
});
