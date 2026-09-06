/**
 * The draw-order ladder for everything a metaphor scene paints ON TOP of
 * itself — the accent callout, the selection ring, the link arrowheads, and the
 * labels that must survive all three.
 *
 * A pure sibling module rather than constants inside a component file, for the
 * reason `labelRoles.js` and `accentCaptionFit.js` are ones (ADR-0005): both
 * `MetaphorAccents.jsx` and `MetaphorSceneChrome.jsx` need these numbers, and
 * each already imports from the other's file, so a constant living in either
 * one would be an import cycle.
 *
 * ## What this ladder is not
 *
 * It orders the **chrome**. Scene geometry stacks itself locally — the river's
 * bed, water, motes and mouth are `renderOrder` 0–4 inside `RiverScene.jsx` and
 * the iceberg's plate is 4 — and those numbers belong with the scene that owns
 * them: one scene's internal depth arrangement is not a rung anything else has
 * to clear, and folding them in here would turn a layout detail into a global
 * contract for no benefit.
 *
 * ## Read this before reasoning about a `renderOrder`
 *
 * `renderOrder` sorts **within** a render list, and three keeps more than one:
 * `WebGLRenderer.renderScene` draws the entire **opaque** list, then the
 * transmissive, then the entire **transparent** one. `renderOrder` is a tiebreak
 * inside each and never a bridge across them, so a number here decides something
 * only against a peer in the same list:
 *
 * - **Opaque** — the scene's own meshes, and the accent stem and pin
 *   (`meshStandardMaterial` with no `transparent`).
 * - **Transparent** — every label, because troika sets
 *   `textMaterial.transparent = true` unconditionally, plus each chip, the
 *   caption's plate and underline, the arrowheads and the selection ring, all of
 *   which say `transparent` explicitly.
 *
 * That split, not `ACCENT_ITEM_LABEL_ORDER`, is why the accented name beat its
 * own stem and pin: an amber rod is opaque and a name is transparent, so the
 * name drew afterwards whatever number the rod carried. What the ladder decides
 * is the name against the **caption** — both transparent, 32 against 34/35 —
 * and the `depthWrite` section at the end is what decides it against the rod.
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
 * Once those three all ignore depth, `renderOrder` is what decides which of the
 * transparent ones a viewer can read, and it has to be decided in one place. It
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
 * bisects the name. Only the draw of the two can decide it — and for the
 * accented name, which list each lands in decides more than either number does.
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
 *
 * Note which half does the work for which label, because the two are not the
 * same story. The **accented** name is depth-test-free anyway, so for it the
 * list split alone gets it on top and `depthWrite` is belt-and-braces. The
 * **unaccented** names are depth-tested, so they were the rod's original
 * victims — and `depthWrite={false}` does not restore that clipping, it
 * inverts it: nothing stamps the rod's distance now, so a chip standing behind
 * the stem passes the depth test and, being transparent, paints *across* the
 * opaque rod. That is a label legible on a card where one used to lose a glyph,
 * which is the better picture — but it is not the same picture, and "this
 * changes nothing for every other label" is false.
 */

/**
 * A link's own casing, first in the list.
 *
 * Negative so it lands under everything else the ladder ranks, including the
 * picked-link highlight: a casing exists to carry its core's contrast against
 * whatever it crosses, so it is the backdrop of the pair, never the subject.
 * It was a bare `-1` spelled at two sites — `MetaphorLinkRoute` and the fused
 * world's own copy of the same route — which is how a ladder stops being one.
 */
export const LINK_CASING_ORDER = -1;

/**
 * The gradient sky, behind everything including the ground.
 *
 * Also `-1`, and deliberately a separate name: this is not a chrome rung that
 * happens to share a number with the casing, it is a different question — what
 * the scene is drawn *on* — and it lives in `GradientSkySphere` for every theme
 * at once. Named so a reader hunting a bare number in the chrome files finds an
 * intent instead of a coincidence.
 */
export const SKY_DOME_ORDER = -1;

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

/**
 * A link's arrowhead and its casing halo — folded in from
 * `MetaphorSceneChrome.jsx`, where they were a local `ARROW_RENDER_ORDER` and
 * an arithmetic `- 1`.
 *
 * An annotation about the scene rather than an object in it, so it ignores
 * depth — the same call `MetaphorAccents` documents at length for the accent
 * pin, and the same trap by the same door: a city building stacks a roof, a
 * spire and a rooftop glyph over its anchor, and the first depth-tested version
 * of this arrow was invisible on EVERY city link, buried inside the spire of the
 * tower it was pointing at. Chasing that with a taller standoff only moves the
 * problem to the next kind.
 *
 * Transparent, so it sits in the labels' list and this is where a reader has to
 * look to know what the arrow clears: above an ordinary chip, below the accent
 * caption, which outranks everything.
 */
export const LINK_ARROW_CASING_ORDER = 19;
export const LINK_ARROW_ORDER = 20;

/** Accent stem and the caption's backing plate. */
export const ACCENT_MARKER_ORDER = 30;

/** Accent pin head and the caption's underline rule. */
export const ACCENT_PIN_ORDER = 31;

/**
 * The picked item's ground ring and its outer halo — folded in from
 * `MetaphorSelectionMarker.jsx`, where they were bare `renderOrder={30}` and
 * `renderOrder={31}`.
 *
 * The numbers are load-bearing and were **not** retuned by the move: both
 * meshes are transparent, so the halo collides with `ACCENT_MARKER_ORDER` and
 * the ring with the caption's underline at `ACCENT_PIN_ORDER`, and a tie inside
 * one transparent list is broken by depth rather than by name. Nudging either
 * value to make the collision read cleanly is a visual change to what sits over
 * what, and this domain verifies those by rendering them.
 */
export const SELECTION_HALO_ORDER = 30;
export const SELECTION_RING_ORDER = 31;

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
