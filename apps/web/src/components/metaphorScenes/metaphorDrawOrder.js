/**
 * The one draw-order ladder for everything a metaphor scene paints ON TOP of
 * itself — the accent callout and the labels that must survive it.
 *
 * A pure sibling module rather than constants inside a component file, for the
 * reason `labelRoles.js` and `accentCaptionFit.js` are ones (ADR-0005): both
 * `MetaphorAccents.jsx` and `MetaphorSceneChrome.jsx` need these numbers, and
 * each already imports from the other's file, so a constant living in either
 * one would be an import cycle.
 *
 * ## Why an explicit ladder exists at all
 *
 * Almost everything in these scenes is depth-tested and sorts itself. Three
 * things are not, and each is depth-test-free for a reason recorded beside it:
 * the accent stem and pin (a city building stacks a roof, a spire and a glyph
 * above its own anchor, and the marker rendered *inside* the tower it marked),
 * the accent caption (an iceberg in front ate its middle third), and now the
 * accented item's own name.
 *
 * Once three layers all ignore depth, `renderOrder` is the only thing deciding
 * which of them a viewer can read, and it has to be decided in one place. It
 * was not, and the result was measured across six kinds x three viewports: the
 * callout altered 8.2% of the accented item's own name box, more than 1% in 13
 * of the 18 cases and up to 30% on the subway. The picture it makes is a
 * saturated amber rod struck through the middle of the one word the scene most
 * wants read — "Scheduler" on the machine, "Platform" on the tree.
 *
 * ## The rule the numbers encode
 *
 * **A marker never overpaints the name of the thing it marks.** The callout
 * exists to say "read this one", so the item's own label is the last thing
 * drawn — the stem passes *behind* the name, the way a leader line passes
 * behind the caption it leads to on any annotated drawing.
 *
 * That the collision is guaranteed rather than incidental is worth stating,
 * because it is what makes a per-scene fix the wrong shape. Every scene puts an
 * item's label directly above that item, at the same `(x, z)` as its accent
 * anchor. A vertical stem at that `(x, z)` projects to a screen line through
 * the projection of *every* point on it — the label's centre included — under
 * any camera. So no camera angle, no framing change and no anchor tweak can
 * separate them: whenever the label sits inside the stem's height, the stem
 * bisects the name. Only draw order can decide it.
 *
 * ## Draw order is only half of it — see `depthWrite` in MetaphorAccents.jsx
 *
 * The other half does not look like a draw-order problem at all, and it is the
 * one that reads as broken rather than as untidy. The stem and pin were
 * `depthTest: false` with `depthWrite` left at `meshStandardMaterial`'s default
 * of true, so they stamped their own distance into the depth buffer and every
 * depth-tested thing drawn afterwards was **rejected** against a rod that is
 * not supposed to be part of the scene at all. A glyph deleted that way leaves
 * no trace: no amber pixel sits where it was, so a screenshot diff of the
 * marker's colour scores it as untouched. Both halves have to hold, and a
 * probe that measures only one of them will report a fix that is not there.
 */

/**
 * The tap-picked link, drawn depth-free so the answer to "which relation did I
 * tap" is not hidden inside whatever the route passes through — on a city that
 * is most of it, because an elbow route crosses the skyline it spans.
 *
 * Deliberately BELOW the label chip rather than above it. The picked line is a
 * fat depth-free stroke and a link's own caption sits at the route's midpoint,
 * i.e. exactly on the line: ranked above the plate it would paint over the very
 * label whose relation it is confirming, which is the same mistake as the
 * accent stem's, one rung down the ladder.
 */
export const PICKED_LINK_ORDER = 6;

/** Label chip for an ordinary item, group placard or link caption. */
export const LABEL_PLATE_ORDER = 8;

/** Accent stem and the caption's backing plate. */
export const ACCENT_MARKER_ORDER = 30;

/** Accent pin head and the caption's underline rule. */
export const ACCENT_PIN_ORDER = 31;

/** Accent caption copy. */
export const ACCENT_CAPTION_TEXT_ORDER = 32;

/**
 * The accented item's own chip and name, above the entire callout.
 *
 * Depth-test-free as well as last, and the scene's own geometry is what forces
 * that rather than the marker: on the subway fixture the amber route tube ENDS
 * at its terminus station and rises toward the camera, so it stands in front of
 * the very name it terminates at — "Pay" reads as "P y" with the whole callout
 * hidden. Marking an item is a claim that it is the one to read, and the kinds
 * where that claim is worth making are exactly the ones that bury it: a
 * submerged iceberg block, a gear behind a plate rim, a terminus under its own
 * track. Scoped to the accented item, which is one per scene — dropping depth
 * for every name would float a back-row label in front of the tower between it
 * and the camera, the trap `assignSiteLabelPlacement` exists to avoid.
 */
export const ACCENT_ITEM_LABEL_PLATE_ORDER = 34;
export const ACCENT_ITEM_LABEL_ORDER = 35;

/**
 * Chip opacity for an accented item's name, over the role's own value.
 *
 * An ordinary chip is 0.58 so a scene is not a field of cards. That is a bet
 * that what shows through is the scene's own quiet backdrop — and behind this
 * one chip specifically there is now a saturated amber rod, which at 0.58 reads
 * as a bar struck through the word. The one name the scene most wants read is
 * the one that can afford an opaque card.
 */
export const ACCENT_ITEM_LABEL_PLATE_OPACITY = 0.94;
