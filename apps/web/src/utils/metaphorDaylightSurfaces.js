/**
 * The other half of an atmosphere lock: the surfaces that atmosphere lights.
 *
 * Two directions live here, because they are the same bisection with the
 * comparison flipped — `raiseSurfacesForDaylight` (a FLOOR, for a kind on
 * `DAYLIGHT_LOCKED_KINDS`) and `dimSurfacesForSpace` (a CEILING, for a kind on
 * `SPACE_LOCKED_KINDS`). Both walk a surface toward the scene's own sky horizon
 * and stop the moment it clears the bar, so both return a colour already on the
 * right side of it byte-identical.
 *
 * `DAYLIGHT_LOCKED_KINDS` fixed the atmosphere — a kind that paints its own sky
 * now takes the light, the environment map and the bloom threshold with it. It
 * does not touch the palette the world's **ground and bodies** are drawn from,
 * and for a base river / garden / tree that costs nothing, because those scenes
 * read the colours the lock already rewrites (`treeMeadowColor`, `waterColor`,
 * `gardenSoilColor`). A **fused composite** is the case where it costs
 * everything: a fused world draws every grammar's primitives, so a tree- or
 * river-dominant composite renders its ground disc from `theme.groundColor` and
 * its towers from `theme.buildingColor` — neither of which any lock touches.
 * On noir that is `#020617`, a colour the domain file already records as one no
 * amount of light can rescue. Measured on the tree composite at 1440x900: a
 * daylight sky over a floor that came back near-black, which reads as broken
 * lighting rather than as a night theme.
 *
 * The fix is a **floor, not a substitution**, and that distinction is what
 * keeps it safe:
 *
 * - A surface that already clears the floor is returned **byte-identical**, so
 *   whiteboard is untouched on every lock, and so is every colour on every
 *   theme that was never the problem. The change can only ever move a surface
 *   that would have rendered as a hole.
 * - It is **idempotent** by construction, for the same reason — no
 *   `treeNatureLocked`-style guard is needed even though `TreeScene` and
 *   `TreeSky` go on resolving the theme they were handed.
 * - The reference it walks toward is the scene's **own sky horizon**, not a
 *   neutral grey. That is the rule `SoaringBirds` and `recedeTheme` already
 *   follow — aerial perspective, a surface taking its colour from the sky
 *   actually painted — and it is why the four themes stay apart afterwards
 *   instead of converging on one grey (noir `#3e4a4f`, arcade `#454662`,
 *   blueprint `#3a4a59` under the river lock).
 *
 * Applied from `resolveMetaphorSceneTheme` immediately after a lock fires and
 * **before** the mood blend: a mood re-tints the atmosphere only, so the sky it
 * would hand back is not the sky the scene paints. Living there rather than
 * inside each resolver is deliberate — the tree bug was an omission from a list,
 * and a kind added to `DAYLIGHT_LOCKED_KINDS` tomorrow gets this for free.
 */
import * as THREE from 'three';

/**
 * Perceived lightness a surface must reach before a daylight sky can plausibly
 * be lighting it. Below this a body renders as a silhouette whatever the key
 * light does, because PBR multiplies albedo by irradiance.
 *
 * Deliberately **not** `sceneUtils.relativeLuminance`, which is the WCAG
 * (gamma-decoded, linear) quantity: that one answers "can type be read on
 * this", and its bar is a ratio between two colours. The question here is
 * "does this surface read as unlit", which is a question about perceived
 * lightness — so the weights go on the sRGB channel values directly.
 */
export const DAYLIGHT_SURFACE_MIN_LUMA = 0.28;

/**
 * The theme keys that name a **surface** — something the sky lights — as
 * opposed to ink, a light source, or a grouping palette.
 *
 * Three families are deliberately absent. Label colours and outlines are type,
 * and the locks already set them. Emissive keys (`windowEmissiveColor`,
 * `starColor`, `binaryGlowColor`, `cycleLampColor`) are light sources, and a
 * dark theme's are bright already. And the ordinal palettes (`districtPalette`,
 * `clusterPalette`, `archipelagoGreenPalette`) are grouping encodings — the
 * domain rule for those is that a group's colour is never substituted, because
 * two territories agreeing is the one thing a shared grouping noun exists to
 * deny.
 */
export const DAYLIGHT_SURFACE_KEYS = Object.freeze([
  // The fused world's floor, the city footing, the cycle plaza, the subway
  // plate — and the single largest offender in every capture.
  'groundColor',
  'buildingColor',
  'buildingRoofColor',
  'slabColor',
  'machinePlateColor',
  'machineRimColor',
  'terrainBaseColor',
  'terrainHighColor',
  'waterColor'
]);

/** Rec. 709 weights over the **sRGB** channel values → perceived lightness. */
export function srgbLuma(hex) {
  const rgb = { r: 0, g: 0, b: 0 };
  new THREE.Color(hex).getRGB(rgb, THREE.SRGBColorSpace);
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

function blendHex(base, tint, amount) {
  const out = new THREE.Color(base);
  out.lerp(new THREE.Color(tint), amount);
  return `#${out.getHexString()}`;
}

/**
 * Walk `hex` toward `sky` by exactly as much as it takes to clear the floor,
 * and no further.
 *
 * Bisected rather than solved: the lerp runs in three's linear working space
 * while the bar is in sRGB, so the relationship is not linear in `t`. Fourteen
 * halvings put `t` inside 1/16384, which is far finer than a hex step, and this
 * runs once per theme resolve behind a `useMemo`.
 */
function raiseToDaylight(hex, sky) {
  if (srgbLuma(hex) >= DAYLIGHT_SURFACE_MIN_LUMA) return hex;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 14; step += 1) {
    const mid = (low + high) / 2;
    if (srgbLuma(blendHex(hex, sky, mid)) < DAYLIGHT_SURFACE_MIN_LUMA) low = mid;
    else high = mid;
  }
  return blendHex(hex, sky, high);
}

/**
 * Raise every too-dark surface on a daylight-locked theme to something its own
 * sky could be lighting. Returns the theme unchanged — the same object — when
 * nothing needed raising, which is the whiteboard case on every lock.
 *
 * @param {Record<string, unknown>} theme a theme a daylight lock has already resolved
 * @returns {Record<string, unknown>}
 */
export function raiseSurfacesForDaylight(theme) {
  const sky = theme?.skyHorizonColor ?? theme?.background;
  if (!theme || typeof sky !== 'string') return theme;
  let raised = null;
  for (const key of DAYLIGHT_SURFACE_KEYS) {
    const value = theme[key];
    if (typeof value !== 'string' || !value.startsWith('#')) continue;
    const next = raiseToDaylight(value, sky);
    if (next === value) continue;
    raised ??= { ...theme };
    raised[key] = next;
  }
  return raised ?? theme;
}

/**
 * Perceived lightness a surface may reach before a deep-space sky stops being a
 * plausible explanation for it.
 *
 * The mirror of `DAYLIGHT_SURFACE_MIN_LUMA`, and it moves exactly one preset:
 * `groundColor` is 0.79 on whiteboard against 0.03 noir / 0.05 arcade / 0.11
 * blueprint, so every dark theme is provably byte-identical and the bar has a
 * wide margin on both sides rather than sitting between two live values.
 */
export const SPACE_SURFACE_MAX_LUMA = 0.35;

/**
 * The keys a space ceiling may touch — and this list is **much shorter than the
 * daylight floor's on purpose**, which is the finding worth keeping.
 *
 * The floor's argument generalises to every surface: a near-black albedo cannot
 * be lit, whatever the sky. The ceiling's does not. A BODY that is bright in
 * deep space is a perfectly good picture — it is lit from within, or it is a
 * pale material catching a key light — and blueprint's towers (`buildingColor`
 * 0.85, roof 0.91, slab 0.94) are the whole blueprint idea; dimming them would
 * delete a theme to fix a frame. A **ground plane** is the case where no such
 * reading exists: it is flat albedo whose only light in an outdoor scene is the
 * sky above it, it fills most of the canvas on a fused world, and in space
 * there is no sky lighting it. Measured on a galaxy-dominant composite at
 * 1440x900, whiteboard's `#c2cad8` disc reads as a daylight plaza cut out and
 * pasted onto a starfield — the exact inverse of the noir tree composite's
 * "daylight sky over a hole" that the floor above exists to fix.
 */
export const SPACE_SURFACE_KEYS = Object.freeze(['groundColor']);

/** The mirror of `raiseToDaylight`: walk `hex` toward `sky` until it is UNDER the bar. */
function dimToSpace(hex, sky) {
  if (srgbLuma(hex) <= SPACE_SURFACE_MAX_LUMA) return hex;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 14; step += 1) {
    const mid = (low + high) / 2;
    if (srgbLuma(blendHex(hex, sky, mid)) > SPACE_SURFACE_MAX_LUMA) low = mid;
    else high = mid;
  }
  return blendHex(hex, sky, high);
}

/**
 * Bring a space-locked theme's ground under a lightness deep space could
 * account for. Returns the same object when nothing needed dimming, which is
 * every dark theme.
 *
 * Only a **composite** whose dominant layer is `galaxy`/`orrery` can show this:
 * a base galaxy or orrery draws no ground at all. That is the same shape as the
 * floor, whose only visible case is a fused composite — for the same reason, and
 * it is why both live here rather than inside a scene.
 *
 * @param {Record<string, unknown>} theme a theme the space lock has already resolved
 * @returns {Record<string, unknown>}
 */
export function dimSurfacesForSpace(theme) {
  const sky = theme?.skyHorizonColor ?? theme?.background;
  if (!theme || typeof sky !== 'string') return theme;
  let dimmed = null;
  for (const key of SPACE_SURFACE_KEYS) {
    const value = theme[key];
    if (typeof value !== 'string' || !value.startsWith('#')) continue;
    const next = dimToSpace(value, sky);
    if (next === value) continue;
    dimmed ??= { ...theme };
    dimmed[key] = next;
  }
  return dimmed ?? theme;
}
