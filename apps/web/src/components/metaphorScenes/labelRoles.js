/**
 * What a scene label NAMES, and how that decides the way it is drawn.
 *
 * A sibling module rather than a table inside MetaphorSceneChrome.jsx, for the
 * same two reasons `accentCaptionFit.js` is one: it is pure and worth pinning in
 * a test, and a component file that also exports plain values loses fast refresh
 * (ADR-0005 sibling-module pattern).
 *
 * Every name in a scene used to be the same white chip, so a district placard, a
 * service and a link caption were indistinguishable — measured on the city, six
 * chips down one diagonal where three were towers, two were districts and one
 * was an edge, and nothing in the picture said which. A scene that encodes four
 * metrics in geometry and then flattens its own vocabulary is harder to read
 * than the list it replaced.
 *
 * The treatments are the cartographic ones, and they cost no new colour:
 *
 * - `item` — a thing. Chip + name, unchanged; this is the scene's subject.
 * - `group` — a territory (district, bed, chain, line, berg, axle, cluster).
 *   Uppercase, letter-spaced, and **no chip**: a region name is written ACROSS
 *   the ground it covers, not stamped on a card standing in it. The chip is
 *   replaced by a heavier outline, which is what keeps it legible over a lit
 *   facade or a bright meadow. Its ink still has to clear its own halo — see
 *   `ensureReadableInk`, which is what the subway's pale route names needed.
 * - `link` — a relation. Smaller, and a fainter chip: an edge caption is a
 *   footnote on a line, and at item weight it competed with the things it joins.
 *
 * Rank is a property of the label, not of the scene, so a scene passes the noun
 * it is naming and never a font size. Only the three exist on purpose — a fourth
 * would have to be a colour or a shape, and this vocabulary is meant to survive
 * four themes, seven moods and a fused world that stacks three kinds at once.
 */

/** @typedef {'item'|'group'|'link'} MetaphorLabelRole */

export const LABEL_ROLES = Object.freeze({
  item: Object.freeze({ plate: 0.58, scale: 1, tracking: 0, upper: false, outline: 0.08 }),
  group: Object.freeze({ plate: 0, scale: 1.04, tracking: 0.17, upper: true, outline: 0.16 }),
  link: Object.freeze({ plate: 0.34, scale: 0.86, tracking: 0.01, upper: false, outline: 0.07 })
});

/** Glyph width relative to the font size, for the declutter pass's box estimate. */
export const GLYPH_ADVANCE = 0.55;

/** Capitals are wider than the mixed-case average that estimate was tuned on. */
export const UPPERCASE_WIDENING = 1.12;

/** Longest label, in ems, before troika wraps it. */
const MAX_LABEL_EM = 16;

/**
 * The style for a role, falling back to `item` for anything unknown — a scene
 * passing a typo gets the old behaviour rather than an invisible label.
 *
 * @param {string} [role]
 */
export function labelRoleStyle(role) {
  return LABEL_ROLES[role] ?? LABEL_ROLES.item;
}

/**
 * The drawn text for a role — the transform is part of the rank, not something
 * a caller uppercases at the call site (one that forgot would look like a
 * translation bug rather than a missing prop).
 *
 * @param {string} text
 * @param {{ upper: boolean }} style
 */
export function labelRoleText(text, style) {
  const raw = typeof text === 'string' ? text : '';
  return style.upper ? raw.toUpperCase() : raw;
}

/** Baseline line height of the drawn text, in ems — troika's default leading. */
export const LINE_EM = 1.35;

/**
 * How far a multi-line label must rise so its FIRST line sits where a one-line
 * label's did, in ems of the drawn font size.
 *
 * troika anchors at the block's middle, so a two-line sign grows half a line
 * down as well as half a line up — and down is where the thing it names is. The
 * subway interchange is the case that forced this: "Ship / Where is it?" hangs
 * over a station with no glyph, at 0.95 world units, and the second line landed
 * on the white platform disc, where the probe scored it buried and the
 * screenshot showed it smeared across the rim. A station sign hangs ABOVE its
 * platform; extra names lengthen it upward.
 *
 * It is an em rather than a world offset because it is applied inside the
 * screen-constant group — a world lift would be undone by the camera the way
 * every other viewer-relative size in this directory already documents.
 *
 * @param {number} lineCount
 */
export function labelStackLiftEm(lineCount) {
  return (Math.max(1, lineCount) - 1) * (LINE_EM / 2);
}

/** Chip padding around the drawn text, in ems: lateral and vertical. */
const PLATE_PAD_X = 0.9;
const PLATE_PAD_Y = 0.22;

/**
 * The label's chip footprint in ems, which the declutter pass turns into a
 * screen box. Estimated from the glyph count because troika only publishes real
 * bounds after an async sync and the pass needs a size the first time it runs,
 * not two frames later.
 *
 * Tracking and capitals both widen the drawn thing, so the estimate has to carry
 * them: without that a group placard claims a box a third narrower than it
 * draws, and then overlaps whatever it was supposed to stand clear of.
 *
 * **A newline is the same trap on the other axis.** A subway interchange writes
 * its members' names as a stacked sign (`subwayNetworkLayout.js` `title`), and
 * troika draws every `\n` as a real line — so a two-line name that reports one
 * line's height claims half the box it draws, and the pass lets a neighbour
 * through into the half it never measured. Width is the LONGEST line, not the
 * whole string: joining the lines end-to-end would have the sign claim a box
 * three names wide and drop everything beside it.
 *
 * @param {string} drawnText — already transformed by `labelRoleText`
 * @param {{ tracking: number, upper: boolean }} style
 * @returns {{ width: number, height: number }} in ems of the drawn font size
 */
export function labelPlateEm(drawnText, style) {
  const advance = GLYPH_ADVANCE * (style.upper ? UPPERCASE_WIDENING : 1) + style.tracking;
  const lines = labelLines(drawnText);
  const longest = lines.reduce((most, line) => Math.max(most, line.length), 0);
  const width = Math.min(MAX_LABEL_EM, longest * advance);
  return { width: width + PLATE_PAD_X, height: LINE_EM * lines.length + PLATE_PAD_Y };
}

/**
 * The drawn lines of a label. One entry for a plain name; one per member for a
 * stacked interchange sign.
 *
 * @param {string} drawnText
 * @returns {string[]}
 */
export function labelLines(drawnText) {
  return typeof drawnText === 'string' && drawnText ? drawnText.split('\n') : [''];
}
