/**
 * The props you can walk up to and use (docs/office-isometric-mode.md § 5
 * slice 9).
 *
 * This is ADR-0011 **rule 2** — "diegesis duplicates, never replaces" — given
 * its first worked example on the floor. The rule's own illustration is the
 * coffee machine, and that is exactly what the one row with a `verb` does: the
 * machine pours the same coffee break the desk dock's labelled *Get coffee*
 * pours, through the same `getCoffee` verb. Walking over to it is a **bonus**
 * path to a function that keeps its conventional control; it is not a second
 * way of doing anything, and it is certainly not the only way.
 *
 * The other three produce nothing at all, which is the honest default rather
 * than an unfinished state. A printer that jams is a joke, not a feature: the
 * Sign-off rule (ADR-0010) says the office generates no artifacts, so a prop
 * whose whole contribution is a line about itself is the most this floor is
 * allowed to offer without the human asking for something. Peeking (slice 6)
 * set the same precedent — a look is a handful of rectangles and a line is a
 * line.
 *
 * Copy is not here. It lives with the rest of the office's voice in
 * `officeCast.js` (`officeChromeCopy().floor.props.items`), keyed by `kind`,
 * the way `floor.peek.looks` is keyed by look — so a locale bundle can localize
 * a prop without touching this table.
 */

/**
 * @typedef {{ kind: string, verb: 'coffee' | null, hands: string | null }} FloorPropUse
 *   `kind` matches a `FLOOR_PROPS` entry in `officeFloorPlan.js`; `verb` names
 *   the existing desk verb this prop duplicates, or `null` when using it
 *   produces nothing but the line. `hands` is what somebody walks away from it
 *   holding — one of `FLOOR_HOLDS` (`officeFloorActivity.js`) or `null`.
 *
 *   `verb` and `hands` are deliberately separate. `verb` is what using the prop
 *   *does to the session* (ADR-0011 rule 2 — it duplicates a desk verb); `hands`
 *   is only what the errand looks like from across the room. The whiteboard
 *   proves they are not the same field: it has neither, while the printer has a
 *   `hands` and no `verb` at all.
 */

/**
 * Which props answer to a click, in no particular order — the room decides
 * where you stand for each one (`propTileFor`), and a prop nobody can reach
 * simply never offers itself.
 *
 * Everything else on the floor stays scenery. That is deliberate: a room where
 * four things are usable teaches you to try things, and a room where thirty
 * things say "nothing happens" teaches you to stop.
 *
 * The `hands` column is not a content decision somebody made up — each value is
 * forced by what `HeldItem` already draws. Its `coffee` is documented as "what
 * the machine hands you" and its `mug` as "the one you keep at your desk, as
 * opposed to the one the machine gave you", so the machine can only hand over a
 * `coffee`, and the printer can only hand over `papers`. Nothing is invented,
 * and no fifth drawing is needed. The whiteboard hands over nothing because you
 * cannot carry a whiteboard, which is the honest answer rather than a gap.
 *
 * @type {FloorPropUse[]}
 */
export const FLOOR_PROP_USES = [
  // Rule 2's own example. The floor's only prop that does something.
  { kind: 'coffeeMachine', verb: 'coffee', hands: 'coffee' },
  // No standable mark today (§ 6 rule 21), so nobody ever walks up to it — the
  // row still declares a hand so that giving it a mark is a geometry change and
  // not also a content one.
  { kind: 'waterCooler', verb: null, hands: null },
  { kind: 'printer', verb: null, hands: 'papers' },
  { kind: 'whiteboard', verb: null, hands: null }
];

/**
 * What using this prop does, or `null` if it is scenery.
 *
 * @param {string} kind
 * @returns {FloorPropUse | null}
 */
export function propUseFor(kind) {
  return FLOOR_PROP_USES.find((use) => use.kind === kind) ?? null;
}

/**
 * Is this prop one you can walk up to and use?
 *
 * @param {string} kind
 * @returns {boolean}
 */
export function isUsableProp(kind) {
  return propUseFor(kind) !== null;
}

/**
 * What somebody walks away from this prop holding, or `null` for the ones you
 * cannot take anything from.
 *
 * Its own accessor rather than a `propUseFor(kind)?.hands` at the call site,
 * because the caller (`useFloorWander`) is deciding what a colleague remembers
 * about a trip and should not also have to know that an unknown prop kind reads
 * back as `undefined` rather than `null` — `FLOOR_HOLDS` has no `undefined` in
 * it, and `HeldItem` draws nothing for either, so the difference is invisible
 * right up until something compares it.
 *
 * @param {string} kind
 * @returns {string | null}
 */
export function propHandsFor(kind) {
  return propUseFor(kind)?.hands ?? null;
}

export default FLOOR_PROP_USES;
