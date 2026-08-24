/**
 * How a relation is drawn, as opposed to where it goes.
 *
 * A metaphor's items say what the topic is made of; its LINKS say how the parts
 * stand to one another, which is most of what "understanding the topic" means.
 * They were the least legible thing in every scene. Three measurements, all on
 * the default whiteboard theme:
 *
 * - A `dependency` link (`linkColor: #64748b` at `linkOpacity: 0.75`) over the
 *   scene's own sky came to **2.56:1 nominal and 1.70:1 as actually rendered** —
 *   a 1 px line is mostly antialiasing, so it never reaches its own colour. The
 *   repo already holds scene TEXT to 3.4:1 through `ensureReadableInk`, so the
 *   relations were drawn a full stop below the bar their own captions clear.
 * - A `flow` link was worse and nobody had noticed, because it is the same pale
 *   yellow the scene glows with: at x=1000 in a 1440×900 city capture its peak
 *   pixel measured **lum 219 against a sky of 218**. One part in 255. It was not
 *   faint, it was **not there**.
 * - **No direction at all.** `from`→`to` is directional in all three link kinds
 *   (a dependency points at what it needs, ownership at what is owned, flow at
 *   where it goes), and only `flow` carried a travelling pulse. "Orders depends
 *   on Payments" and "Payments depends on Orders" rendered identically.
 *
 * The fix is the one the labels already use: **a link carries its own halo.** A
 * casing in the theme's label-outline colour under a core in the link colour is
 * legible against the sky, against a tower it crosses, and on a dark theme, for
 * the same reason a label's plate is — it brings its own contrast instead of
 * being tuned against one backdrop. That is also why nothing here needs to know
 * which sky a given scene painted: galaxy's near-black space and garden's pale
 * blue take the identical treatment.
 *
 * Widths and the arrowhead are in SCREEN pixels, never world units. That trap
 * has been paid for six times in this renderer now (fog band, AO radius, accent
 * caption, tour flight, item labels, and see `metaphorScreenScale.js`): these
 * scenes run from a 14-unit layercake to a 60-unit bridge, so one authored world
 * size is a rope on the small scene and a thread on the large one.
 */
import { ensureReadableInk } from './sceneUtils.js';

/**
 * The bar a link's core must clear against its own casing. Same number as
 * `ensureReadableInk`'s default for text, deliberately: a relation is a claim
 * about the topic exactly as much as a name is, and there is no reason the line
 * should be allowed to be fainter than the word printed on it.
 */
export const MIN_LINK_CONTRAST = 3.4;

/** Core width, CSS pixels, before crowding. */
export const LINK_CORE_PX = 2.2;
/** Casing width, CSS pixels, before crowding. The halo is what buys the read. */
export const LINK_CASING_PX = 6;
/** Arrowhead length, CSS pixels, before crowding. */
export const LINK_ARROW_PX = 13;

/**
 * Opacity floor for the core. A theme may ask for a softer link (noir sits at
 * 0.6) but not for one that gives its contrast back: the whole point of the
 * casing is that the core is allowed to be a definite colour.
 */
export const MIN_LINK_CORE_OPACITY = 0.88;

/** How opaque the halo is over whatever is behind it. */
export const LINK_CASING_OPACITY = 0.7;

/**
 * Crowding. `METAPHOR_MAX_LINKS` is 80 and a scene that authors 80 is a
 * hairball at any width, so the width tapers once a scene is past the count a
 * reader can actually follow — but only to `CROWDED_FLOOR`, never to the
 * hairline this module exists to retire. The taper is on the *scene*, not on
 * the individual link: links thinning at different rates would read as an
 * encoding nobody declared.
 */
const CROWD_FROM = 24;
const CROWD_TO = 80;
const CROWDED_FLOOR = 0.62;

/** Below this a route segment is a rounding artefact, not a direction. */
const MIN_ARROW_SEGMENT = 1e-3;

/** Multiplier applied to every screen size once a scene is link-heavy. */
export function linkCrowding(count) {
  const n = Number.isFinite(count) ? Math.max(0, count) : 0;
  if (n <= CROWD_FROM) return 1;
  const t = Math.min(1, (n - CROWD_FROM) / (CROWD_TO - CROWD_FROM));
  return 1 - (1 - CROWDED_FLOOR) * t;
}

/**
 * The screen sizes one scene's links are drawn at.
 *
 * @param {number} count — how many links the scene authored
 * @returns {{corePx: number, casingPx: number, arrowPx: number}}
 */
export function linkMetricsFor(count) {
  const scale = linkCrowding(count);
  return {
    corePx: LINK_CORE_PX * scale,
    casingPx: LINK_CASING_PX * scale,
    arrowPx: LINK_ARROW_PX * scale
  };
}

/**
 * The link colour, walked until it is legible against its own casing.
 *
 * Not a precaution: swept over every theme × kind, exactly one pair fails, and
 * it is the one the product draws most. A `flow` link takes the theme's
 * `binaryGlowColor`, and on **whiteboard — the default theme — that is the pale
 * `#fef08a`, measured at 1.16:1**. It comes back `#928001` at 3.95:1, which is
 * still recognisably the scene's yellow: nudging lightness rather than
 * substituting a neutral is what keeps a link's kind readable off its colour.
 * The other fifteen pairs already clear the bar and are returned untouched, so
 * this costs no theme its identity. It is also the guard that stops a future
 * theme — or a receded composite layer, which lerps every colour toward the
 * horizon — from quietly reintroducing the invisible link.
 */
export function linkInk(lineColor, casingColor) {
  if (!lineColor || !casingColor) return lineColor;
  return ensureReadableInk(lineColor, casingColor, MIN_LINK_CONTRAST);
}

/** The core's opacity: whatever the theme asked for, floored at legible. */
export function linkCoreOpacity(themeOpacity) {
  const value = Number.isFinite(themeOpacity) ? themeOpacity : 1;
  return Math.min(1, Math.max(MIN_LINK_CORE_OPACITY, value));
}

/** How much wider a link touching the hovered item is drawn. */
const RELATED_EMPHASIS = 1.5;

/**
 * How one fused-composite link is drawn, given what the viewer is doing.
 *
 * Two states the base scenes have no equivalent of, and both come out the same
 * way: a **muted** link (its layer pressed away in the layer key) and a
 * **dimmed** one (the pointer is on some other item) lose the casing and the
 * arrowhead rather than gaining them. Receding is the whole point of both, and
 * a haloed line is louder, not quieter. Only the resting scene and the links
 * touching the hovered item are drawn at full strength.
 *
 * Extracted rather than inlined because the alternative is four nested ternary
 * ladders in one JSX callback — which is exactly what the complexity warning on
 * this file was already about.
 */
export function fusedLinkPresentation({ related, muted, activeId }) {
  const dimmed = Boolean(activeId) && !related;
  let opacity;
  if (muted) opacity = 0.22;
  else if (dimmed) opacity = 0.18;
  else if (related) opacity = 0.96;
  else opacity = linkCoreOpacity(0.9);
  return {
    dimmed,
    cased: !muted && !dimmed,
    emphasis: related ? RELATED_EMPHASIS : 1,
    opacity
  };
}

/**
 * Where the arrowhead sits and which way it points.
 *
 * The tip lands ON the `to` anchor — the top of the thing the relation points
 * at — and the body trails back along the route, so an arrow reads as "this
 * one" rather than as a floating cone. The direction is taken from the last
 * segment with real length: an elbow route's final leg is a vertical drop and
 * an arc route's is a shallow descent, and both are correct to point along, but
 * a route whose last two points coincide (two items at the same anchor) has no
 * direction to state and gets no arrow rather than an arbitrary one.
 *
 * @param {number[][]} points — the route polyline, `[x, y, z]` per point
 * @returns {{position: number[], direction: number[]} | null}
 */
export function arrowFromRoute(points) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const end = points[points.length - 1];
  if (!Array.isArray(end) || end.length < 3) return null;
  for (let i = points.length - 2; i >= 0; i -= 1) {
    const prev = points[i];
    if (!Array.isArray(prev) || prev.length < 3) continue;
    const dx = end[0] - prev[0];
    const dy = end[1] - prev[1];
    const dz = end[2] - prev[2];
    const length = Math.hypot(dx, dy, dz);
    if (length > MIN_ARROW_SEGMENT) {
      return {
        position: [end[0], end[1], end[2]],
        direction: [dx / length, dy / length, dz / length]
      };
    }
  }
  return null;
}
