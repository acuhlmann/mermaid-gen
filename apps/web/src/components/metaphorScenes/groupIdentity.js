/**
 * Colour identity for a scene's **categorical grouping axis** — the city's
 * `district`, the garden's `bed`, the fused world's affinity group.
 *
 * These axes are declared in the legend, so the scene is promising the viewer
 * that grouping is one of the things it draws. It was not drawing it. Measured
 * on the whiteboard theme: every city tower is `theme.buildingColor` regardless
 * of district, and the only thing separating one neighbourhood from the next is
 * a ground patch drawn from `districtPalette` — four shades of the *same* blue
 * (`#dbeafe → #60a5fa`) at 0.4 opacity over a grey plate. So a three-district
 * city rendered as one colour, and the axis existed only as a placard standing
 * on the ground. The fused composite had it worse: its affinity rings paint the
 * same four blues at 0.1/0.2 opacity onto an ocean.
 *
 * That matters most on a phone, which is the case this is written for. A group
 * placard is a label like any other, so on a small canvas the declutter pass
 * drops it — the 390×844 baseline showed `EDGE` reduced to `GE` behind its own
 * towers and `CATALOG` gone entirely. A tint is not a label: it cannot be
 * decluttered, it costs no screen space, and it survives at any distance. It is
 * the one channel a categorical axis can hold onto when the canvas runs out.
 *
 * Two rules keep it from becoming noise.
 *
 * **Nudge the scene's own colour; never substitute a palette entry.** This is
 * the idiom `ensureReadableInk` and `recedeTheme` already use here. The ladder
 * below moves HUE and leaves lightness almost alone, so a tinted tower is the
 * same tone as an untinted one — the skyline stays one material family, label
 * contrast against a wall is unchanged, and no theme needs a second palette
 * authored for it. Substituting `clusterPalette` entries instead was tried on
 * paper and is worse in a way that is easy to miss: the palette's four hues are
 * not evenly spread (190° and 155° sit close together), so two districts of a
 * four-district city come out nearly the same colour — which is exactly the
 * failure being fixed.
 *
 * **Group 0 is the identity.** The first group keeps the theme's colour
 * unchanged, so an ungrouped scene — one district, or none — renders exactly as
 * it did before, and only a scene that actually *has* the axis pays for it.
 *
 * The ladder is offsets in hue *turns*, ordered so that any prefix of it is
 * still well spread: taking the first three gives 0 / +108° / −79°, and the
 * full eight are never closer than 0.08 turns (29°) apart. A ninth group cycles
 * and repeats the first — the same wraparound `resolveClusterColor` has always
 * had, and a nine-district city has bigger problems than colour reuse.
 *
 * Where a body ALREADY carries a colour encoding, the group takes the ground
 * under it instead. The garden is the standing example: a plant's colour is its
 * `health`, so tinting the plant would put two encodings in one channel and the
 * bed's edging carries the group instead.
 */
import * as THREE from 'three';
import { srgbLuma } from '../../utils/metaphorDaylightSurfaces.js';
import { resolveDistrictColor } from '../../utils/metaphorThemePresets.js';
import { shiftColor } from './sceneUtils.js';

/** Hue offsets in turns. Index 0 is 0 by contract — see the header. */
const HUE_LADDER = [0, 0.3, -0.22, 0.14, -0.38, 0.46, -0.1, 0.22];

/**
 * A whisper of value separation on top of the hue, so two groups still differ
 * for a viewer who cannot tell the hues apart. Kept under an eighth: lightness
 * is what the label outline contrast is bought with, and `ensureReadableInk` is
 * not consulted for a mesh.
 *
 * Every entry is a LIFT, never a darkening, and that is not symmetry for its
 * own sake. Darkening a saturated colour is the fastest way to make it look
 * more saturated: the first pass ran this ladder both ways and the district
 * that came out worst was the one that had barely moved in hue at all, because
 * `-0.08` turned the theme's own blue into an indigo that read as the loudest
 * thing in the picture. Groups are meant to differ by hue and to look like the
 * same material; lifting keeps them chalkier as they travel, which is the
 * direction that stays calm.
 */
const LIGHT_LADDER = [0, 0.035, 0.075, 0.02, 0.095, 0.05, 0.11, 0.06];

/**
 * Saturation every tinted group gives up regardless of how far it moved. A
 * group that has left the theme's own hue is a variation on it, and a variation
 * that is as loud as the original competes with it.
 */
const SAT_FLOOR_PULL = 0.22;

/** Extra saturation a fully-travelled hue gives up. See `tintByGroup`. */
const SAT_DECAY = 0.34;

/** The hue distance, in turns, at which `SAT_DECAY` is fully spent. */
const SAT_DECAY_FULL = 0.25;

/** How far a body moves along the ladder. Ground plates use more (see below). */
export const GROUP_TINT_BODY = 0.62;

/**
 * A ground patch may take the full ladder: nothing is labelled on top of it and
 * it is the surface that has to read as "this is one neighbourhood" from the
 * far side of the scene.
 */
export const GROUP_TINT_PLATE = 1;

/**
 * For a surface whose material is a real substance with a narrow real hue band
 * — soil, so far. The full ladder walks a warm brown a third of the way round
 * the wheel, and in the garden that lands the second bed on a green that
 * argues with the lawn it is set into. A third of the ladder still separates
 * two beds (khaki against a red clay) and both still look like earth.
 */
export const GROUP_TINT_EARTH = 0.38;

export function groupLadderLength() {
  return HUE_LADDER.length;
}

/**
 * @param {string|THREE.Color} base — the scene's own colour for this surface
 * @param {number} index — 0-based group index; 0 returns `base` untouched
 * @param {number} [strength] — 0 disables, 1 is the full ladder
 * @returns {string} `#rrggbb`
 */
export function tintByGroup(base, index, strength = GROUP_TINT_BODY) {
  const safeBase = base ?? '#888888';
  const slot = Number.isFinite(index) ? Math.max(0, Math.trunc(index)) : 0;
  const step = slot % HUE_LADDER.length;
  if (step === 0 || strength <= 0) {
    return `#${new THREE.Color(safeBase).getHexString(THREE.SRGBColorSpace)}`;
  }
  const hueShift = HUE_LADDER[step] * strength;
  const shifted = shiftColor(safeBase, {
    hueShift,
    lightness: LIGHT_LADDER[step] * strength,
    // Saturation falls as the hue travels, and this is the whole difference
    // between a legible scene and a toy. At full saturation the ladder is
    // correct and unusable: measured on the commerce city, four districts came
    // out primary blue, mint, magenta and indigo — unmistakable, and nothing
    // anyone would put in front of an architecture review. Muting in proportion
    // to the distance travelled keeps the far hues as the dusty, chalked
    // versions of themselves, which is what a set of neighbourhoods should look
    // like: clearly different, obviously the same city.
    satScale:
      1 - strength * (SAT_FLOOR_PULL + SAT_DECAY * Math.min(1, Math.abs(hueShift) / SAT_DECAY_FULL))
  });
  return `#${shifted.getHexString(THREE.SRGBColorSpace)}`;
}

/**
 * The ground plate's base colour, placed against the ground it is drawn on.
 *
 * `tintByGroup` separates groups **from each other**; nothing separated the
 * ladder as a whole from the surface under it, or checked that the ladder had
 * anywhere to go. Both were broken, in opposite directions, and measured:
 *
 * - **The ladder collapses on `whiteboard`.** `districtPalette[0]` there is
 *   `#dbeafe` — sRGB luma 0.91 — and `LIGHT_LADDER` only ever lifts, so groups
 *   2, 4 and 6 all clamp to **`#ffffff`**: pixel-identical. The nearest-pair
 *   distance across the eight-group ladder was **0.000**. A composite (or a
 *   city) with three affinity groups drew two of them in one colour on the
 *   lightest theme, which is the exact failure this module's header says the
 *   tint exists to prevent.
 * - **A lock moves the ground and the plate does not follow.** `groundColor`
 *   is walked by `raiseSurfacesForDaylight` / `dimSurfacesForSpace`;
 *   `districtPalette` is not on either list, deliberately, because those lists
 *   take a *whole palette* and squeezing four shades of one hue collapses
 *   neighbours. But the plate reads only entry **0** and gets its ordinal from
 *   the hue ladder, so there is no neighbour to collapse — and leaving entry 0
 *   behind is what left noir's plate 0.012 of luma from the daylight-raised
 *   ground it sits on (invisible) and whiteboard's 0.562 above the
 *   space-dimmed one (a lit slab cut out and pasted onto a starfield).
 *
 * So the base is **placed**, not substituted: the theme's own hue and the
 * ladder are both kept, and only the lightness moves. Two rules decide where.
 *
 * The whole ladder sits on **one side** of the ground, clear of it by
 * `PLATE_GROUND_SEPARATION`. Above it by preference — a territory is a patch
 * catching whatever light there is — and below it when the ladder's own lift
 * would not fit under `PLATE_LADDER_CEILING`, which is the whiteboard case and
 * the only one. Placing the band rather than the base is what makes this true
 * of every group instead of only group 0, and it is why the direction has to be
 * decided from the ladder's measured lift rather than from a constant.
 *
 * And saturation is **capped, not scaled**: HSL lightness is not a perceptual
 * axis near white, so a colour authored to look pale can carry a high `s` that
 * is invisible at `l` 0.93 and arrives as an azure the moment it is darkened
 * (`#dbeafe` is `s` 0.945). The cap moves `whiteboard` and `arcade` only;
 * `noir` and `blueprint` are returned untouched, which is why an unlocked noir
 * city comes back within one hex step of what it rendered before.
 */
export const PLATE_GROUND_SEPARATION = 0.13;

/** Perceived lightness the plate ladder may not exceed. Above this the hue ladder stops reading. */
export const PLATE_LADDER_CEILING = 0.86;

/** …and the bottom of the same band, for a plate placed below a bright ground. */
export const PLATE_LADDER_FLOOR = 0.06;

/** HSL saturation a plate base may carry before relighting reveals more than the theme showed. */
export const PLATE_BASE_MAX_SAT = 0.7;

function hex(color) {
  return `#${color.getHexString(THREE.SRGBColorSpace)}`;
}

/** Trim a base whose saturation only stayed invisible because it was nearly white. */
function capPlateSaturation(base) {
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(base).getHSL(hsl, THREE.SRGBColorSpace);
  if (hsl.s <= PLATE_BASE_MAX_SAT) return base;
  return hex(shiftColor(base, { satScale: PLATE_BASE_MAX_SAT / hsl.s }));
}

/**
 * Move `base` along HSL lightness — hue and saturation untouched — until its
 * perceived lightness is `target`.
 *
 * Bisected for the reason `raiseToDaylight` is: the bar is in sRGB luma and the
 * lever is HSL lightness, so the relationship is not linear in the delta.
 */
function relightToLuma(base, target) {
  let low = -1;
  let high = 1;
  for (let step = 0; step < 16; step += 1) {
    const mid = (low + high) / 2;
    if (srgbLuma(hex(shiftColor(base, { lightness: mid }))) < target) low = mid;
    else high = mid;
  }
  return hex(shiftColor(base, { lightness: (low + high) / 2 }));
}

/**
 * The luma band the eight-group plate ladder occupies from this base.
 *
 * Both ends are measured, and the low end is why. `LIGHT_LADDER` only ever
 * lifts, so the ladder looks like it can only travel upward — but the lift is
 * in **HSL lightness** while the bar is perceived luma, and a rung that also
 * turns the hue and gives up saturation can land BELOW its base: whiteboard's
 * group 3 sits 0.045 under it. Placing from the base alone put that one rung
 * 0.101 from a space-dimmed ground it was supposed to clear by 0.13.
 */
function ladderLumaBand(base) {
  let low = srgbLuma(base);
  let high = low;
  for (let index = 1; index < HUE_LADDER.length; index += 1) {
    const luma = srgbLuma(tintByGroup(base, index, GROUP_TINT_PLATE));
    low = Math.min(low, luma);
    high = Math.max(high, luma);
  }
  return { low, high };
}

/**
 * The lowest target at which the whole band clears `limit` upward — bisected,
 * because the band's own width moves with where it is standing.
 */
function placeBandAbove(calm, limit) {
  let low = limit;
  let high = 1;
  for (let step = 0; step < 12; step += 1) {
    const mid = (low + high) / 2;
    if (ladderLumaBand(relightToLuma(calm, mid)).low < limit) low = mid;
    else high = mid;
  }
  return relightToLuma(calm, high);
}

/** …and the mirror: the highest target at which the whole band stays under `limit`. */
function placeBandBelow(calm, limit) {
  let low = PLATE_LADDER_FLOOR;
  let high = Math.max(limit, PLATE_LADDER_FLOOR);
  for (let step = 0; step < 12; step += 1) {
    const mid = (low + high) / 2;
    if (ladderLumaBand(relightToLuma(calm, mid)).high > limit) high = mid;
    else low = mid;
  }
  return relightToLuma(calm, low);
}

/**
 * @param {Record<string, unknown>} theme — a **resolved** scene theme; the
 *   ground it reads is the one the locks have already moved.
 * @returns {string} `#rrggbb` — pass to `tintByGroup` as the plate base
 */
export function resolveGroupPlateBase(theme) {
  const authored = resolveDistrictColor(theme ?? {}, 0);
  const ground = theme?.groundColor;
  if (typeof authored !== 'string' || typeof ground !== 'string' || !ground.startsWith('#')) {
    return authored;
  }
  const calm = capPlateSaturation(authored);
  const groundLuma = srgbLuma(ground);
  const above = placeBandAbove(calm, groundLuma + PLATE_GROUND_SEPARATION);
  if (ladderLumaBand(above).high <= PLATE_LADDER_CEILING) return above;
  // No headroom above: stand the band below the ground instead, as high as it
  // will go with every rung still clear. This is `whiteboard` and only
  // `whiteboard` — the one preset whose unlocked ground is already at 0.79.
  return placeBandBelow(calm, groundLuma - PLATE_GROUND_SEPARATION);
}
