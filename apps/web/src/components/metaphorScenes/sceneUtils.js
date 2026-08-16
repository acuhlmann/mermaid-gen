/**
 * Pure (non-component) helpers shared by the metaphor scene modules and
 * MetaphorRenderer. Components live in MetaphorSceneChrome.jsx — keeping this
 * file logic-only satisfies react-refresh/only-export-components.
 */
import * as THREE from 'three';

export { hash01 as idHash, hash01Salted as idHash2 } from '../../utils/seededHash.js';

export function truncateLabel(text, maxLen = 14) {
  if (!text || text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

/** HSL nudge of a base colour (hex or THREE.Color) → a fresh THREE.Color. */
export function shiftColor(input, { lightness = 0, satScale = 1, hueShift = 0 } = {}) {
  const c = new THREE.Color(input);
  const hsl = { h: 0, s: 0, l: 0 };
  // HSL in sRGB, not in the working (linear) space. three's colour management
  // converts on construction, and in linear space an ordinary mid-tone has a
  // lightness around 0.09 — so the −0.1 deltas every caller here passes went
  // NEGATIVE and clamped to pure black. That is what painted the bridge's shore
  // slabs and outcrops solid black on every theme (measured #020000), and it
  // silently flattened every other "slightly darker" shade in the scenes.
  // Callers write these deltas as perceptual nudges, which is what sRGB HSL is.
  c.getHSL(hsl, THREE.SRGBColorSpace);
  c.setHSL(
    (hsl.h + hueShift + 1) % 1,
    THREE.MathUtils.clamp(hsl.s * satScale, 0, 1),
    THREE.MathUtils.clamp(hsl.l + lightness, 0, 1),
    THREE.SRGBColorSpace
  );
  return c;
}

const backdropProbe = new THREE.Color();

/**
 * Is there headroom to ADD light to this scene's backdrop?
 *
 * Additive blending can only brighten, so an additive glow needs a dark sky to
 * register against — over the whiteboard theme's near-white one it is
 * mathematically incapable of showing up. Effects that read as light gate on
 * this rather than being tuned to one theme and quietly vanishing on the rest.
 */
export function isDarkBackdrop(theme) {
  const source = theme?.skyHorizonColor ?? theme?.background;
  if (!source) return false;
  try {
    backdropProbe.set(source);
  } catch {
    return false;
  }
  // Rec. 709 luma; 0.5 sits comfortably clear of both palette families.
  return backdropProbe.r * 0.2126 + backdropProbe.g * 0.7152 + backdropProbe.b * 0.0722 < 0.5;
}

/** Sample a polyline (array of [x,y,z] points) at t in [0,1], piecewise-linear. */
export function samplePolyline(points, t) {
  const segments = points.length - 1;
  const clamped = t <= 0 ? 0 : t >= 1 ? 0.999999 : t;
  const ft = clamped * segments;
  const i = Math.floor(ft);
  const f = ft - i;
  const a = points[i];
  const b = points[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** Map a link's semantic `kind` to its line colour, pulse colour, and whether a
 *  travelling flow pulse animates. Undefined kind keeps the default (line + pulse). */
export function resolveLinkAppearance(kind, theme) {
  const baseColor = theme.linkColor ?? '#64748b';
  const glow = theme.binaryGlowColor ?? baseColor;
  if (kind === 'flow') return { lineColor: glow, pulseColor: glow, showPulse: true };
  if (kind === 'ownership') {
    const accent = theme.treeAccentColor ?? glow;
    return { lineColor: accent, pulseColor: accent, showPulse: false };
  }
  if (kind === 'dependency') return { lineColor: baseColor, pulseColor: glow, showPulse: false };
  return { lineColor: baseColor, pulseColor: glow, showPulse: true };
}

let radialSpriteTexture = null;

/**
 * Lazy singleton: a soft radial white→transparent sprite used (tinted) for star
 * halos, cluster cores, and dust motes so additive glows render round instead
 * of as bare square planes. Returns null without a DOM (tests/SSR) — callers
 * fall back to an untextured material.
 */
export function getRadialSpriteTexture() {
  if (radialSpriteTexture) return radialSpriteTexture;
  if (typeof document === 'undefined') return null;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  radialSpriteTexture = new THREE.CanvasTexture(canvas);
  return radialSpriteTexture;
}
