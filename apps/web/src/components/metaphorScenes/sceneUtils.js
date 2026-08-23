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

/** WCAG relative luminance of an sRGB colour, 0 (black) → 1 (white). */
function relativeLuminance(color) {
  const channel = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const rgb = { r: 0, g: 0, b: 0 };
  new THREE.Color(color).getRGB(rgb, THREE.SRGBColorSpace);
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** Contrast ratio between two colours, 1 (identical) → 21 (black on white). */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Below this, ink and its halo are the same colour to anyone actually reading. */
const MIN_INK_CONTRAST = 3.4;
/** Darkening step; ~10 rounds spans the full range without a solve. */
const INK_STEP = 0.06;

/**
 * `ink` darkened or lightened until it is legible against `halo`.
 *
 * A scene-coloured label is how a subway route, a district or a chain keeps its
 * identity in its own name — but the identity colour is chosen to look right as
 * a 3D SURFACE, where it is lit, shaded and seen against the ground. As text it
 * is seen against nothing but its own outline, and the two are frequently the
 * same brightness: measured on the subway, the pale yellow "SIGNUP" and pale
 * blue "BUY" terminus placards came out at contrast 1.16 and 1.35 against the
 * light halo they were drawn with — the route names, which are the one thing a
 * transit map exists to publish, were invisible on a phone.
 *
 * Nudging lightness rather than substituting a neutral is what keeps the point:
 * a darkened yellow still reads as the yellow line. The walk runs away from the
 * halo (down when the halo is light, up when it is dark), so a theme flip needs
 * no second rule, and it stops at the first step that clears — the least change
 * that makes the name readable.
 */
export function ensureReadableInk(ink, halo, minRatio = MIN_INK_CONTRAST) {
  if (!ink || !halo) return ink;
  if (contrastRatio(ink, halo) >= minRatio) return ink;
  const direction = relativeLuminance(halo) > 0.45 ? -1 : 1;
  let candidate = new THREE.Color(ink);
  for (let step = 0; step < 12; step += 1) {
    candidate = shiftColor(candidate, { lightness: direction * INK_STEP });
    if (contrastRatio(candidate, halo) >= minRatio) break;
  }
  return `#${candidate.getHexString(THREE.SRGBColorSpace)}`;
}

/**
 * How far a receded colour travels toward the horizon, and how much saturation
 * survives the trip. Tuned so a receded body still reads as a body — it keeps
 * its silhouette, its shading and its material — while nothing about it
 * competes for attention with the layer standing in front of it.
 */
const RECEDE_TOWARD_HORIZON = 0.62;
const RECEDE_SAT_SCALE = 0.22;

/** Every theme value that is a colour, and therefore recedes. */
function isColorString(value) {
  return typeof value === 'string' && value.startsWith('#');
}

/**
 * Push one colour toward `horizon` and drain most of its saturation — aerial
 * perspective, the way distance actually desaturates a landscape.
 *
 * The saturation is pulled toward *the horizon's own* saturation rather than
 * scaled toward grey, which is what makes the operation monotone: a colour
 * already sitting on the horizon comes back unchanged. Scaling toward grey
 * instead desaturates the horizon away from itself, so the sky colours in a
 * receded theme drifted — small, but it means "recede" could move a colour
 * further from the thing it is receding into, which is not a recession.
 *
 * The final mix runs in three's working (linear) space, the right space for
 * blending two lights; the saturation goes through `shiftColor`, which forces
 * sRGB HSL for the reason that function documents at length. Doing the
 * saturation in linear space instead is how "slightly duller" becomes black.
 */
export function recedeColor(input, horizon, amount = RECEDE_TOWARD_HORIZON) {
  const horizonColor = new THREE.Color(horizon);
  const horizonHsl = { h: 0, s: 0, l: 0 };
  horizonColor.getHSL(horizonHsl, THREE.SRGBColorSpace);
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(input).getHSL(hsl, THREE.SRGBColorSpace);
  const saturation = THREE.MathUtils.lerp(hsl.s, horizonHsl.s, 1 - RECEDE_SAT_SCALE);
  const faded = new THREE.Color().setHSL(hsl.h, saturation, hsl.l, THREE.SRGBColorSpace);
  return faded.lerp(horizonColor, THREE.MathUtils.clamp(amount, 0, 1));
}

/**
 * A copy of `theme` with every colour receded toward the scene's own horizon.
 *
 * Substituting the theme is what lets a layer recede without a single primitive
 * learning about focus: every body in the fused world already derives its
 * colours from `theme.*`, so handing a muted theme to the muted layers is the
 * whole mechanism. Non-colour entries (intensities, light positions, the
 * hemisphere triple) pass through untouched — a receded layer is lit by the
 * same lights as the rest of the world, because it is standing in it.
 *
 * The horizon defaults to the theme's own sky, so this reads correctly on the
 * pale whiteboard preset and on noir without a per-theme table.
 */
export function recedeTheme(theme, amount = RECEDE_TOWARD_HORIZON) {
  if (!theme || typeof theme !== 'object') return theme;
  const horizon = theme.skyHorizonColor ?? theme.background ?? '#94a3b8';
  const muted = { ...theme };
  for (const [key, value] of Object.entries(theme)) {
    if (isColorString(value)) {
      muted[key] = `#${recedeColor(value, horizon, amount).getHexString()}`;
      continue;
    }
    if (Array.isArray(value) && value.length > 0 && value.every(isColorString)) {
      muted[key] = value.map((entry) => `#${recedeColor(entry, horizon, amount).getHexString()}`);
    }
  }
  return muted;
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

/** Vertical fraction at which the IBL gradient horizon band sits. */
const IBL_HORIZON = 0.5;

/**
 * Equirectangular gradient for image-based lighting: `top` at the zenith,
 * `horizon` across the middle, `ground` at the nadir. Returns a texture the
 * caller owns and must dispose.
 */
export function buildGradientEquirect(top, horizon, ground) {
  const width = 16;
  const height = 64;
  const data = new Uint8Array(width * height * 4);
  const topColor = new THREE.Color(top);
  const horizonColor = new THREE.Color(horizon);
  const groundColor = new THREE.Color(ground);
  const mixed = new THREE.Color();

  for (let y = 0; y < height; y += 1) {
    const v = 1 - y / (height - 1);
    if (v >= IBL_HORIZON) {
      mixed.copy(horizonColor).lerp(topColor, (v - IBL_HORIZON) / (1 - IBL_HORIZON));
    } else {
      mixed.copy(groundColor).lerp(horizonColor, v / IBL_HORIZON);
    }
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      data[i] = Math.round(mixed.r * 255);
      data[i + 1] = Math.round(mixed.g * 255);
      data[i + 2] = Math.round(mixed.b * 255);
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
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
