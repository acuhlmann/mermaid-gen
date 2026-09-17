/**
 * Where the accent callout's pin head has to stand so the viewer can see it.
 *
 * The callout is the one thing in the renderer that says "this item is the
 * thesis", and since it was sized for the reader (`accentRodScale.js`) it is
 * also the one piece of scene furniture whose height is a SCREEN constant:
 * roughly 80 px of stem plus a 22 px head. The camera fit, meanwhile, reserves
 * `ANNOTATION_HEADROOM_PX` — 26 px, one item label — above the subject, and the
 * rod carries `FRAME_IGNORE_DATA` so it contributes nothing to the fit itself.
 * Those two numbers do not meet: a callout on an item at the top of the subject
 * stands about 80 px into whatever is above the subject, and on a phone or a
 * foldable cover what is above the subject is a panel.
 *
 * So the marker gets drawn behind the app's own chrome. The caption already
 * yields there (`yieldWhenUnreadable`) and the accented item's own name yields
 * at `MAX_COVERED_PINNED`, but the stem and the pin are geometry: they know
 * nothing about the panels and are simply painted under them. Measured on a
 * 717x512 cover, a marker under the reading rail left **4 px of amber** on
 * screen — which is not a degraded marker, it is a missing one.
 *
 * A leader line's answer to this is to lean, and that is what this module
 * solves for. It is deliberately NOT the two alternatives:
 *
 * - **Not a bigger headroom reservation.** Since the rod is screen-constant its
 *   height could honestly be reserved without the feedback loop that made
 *   #593 take the rod out of the fit (a WORLD-sized marker grows when the camera
 *   retreats, which pushes the camera further; a pixel constant does not). But
 *   the bill lands on every accented scene: 102 px of a 512 px cover is 20% of
 *   the height, clamped by `MAX_HEADROOM` to 10%, against a collision that a
 *   16-kind sweep at three viewports finds in a minority of cells. A global tax
 *   to fix a local collision is the wrong trade, and the sweep is what says so.
 * - **Not a shorter stem.** `STEM_TARGET_HEIGHT_PX` exists because a rod that
 *   ran to 168 px went off the top of the canvas; shortening it to duck a panel
 *   re-creates the defect its own file records, the marker drawn inside the
 *   tower it marks.
 *
 * Two properties make the lean safe to ship, and both are the point of keeping
 * it pure:
 *
 * 1. **Zero when the marker is clear.** No panels, or a head no panel covers
 *    past `COVER_BAR`, returns exactly `{x: 0, y: 0}` — so every cell that
 *    reads today renders byte-identically, which is what makes the change
 *    measurable at all.
 * 2. **Solved from the UNLEANED tip every frame**, never from where the lean
 *    last put it. A dodge computed from its own output oscillates: clear of the
 *    panel means no lean means back under the panel. This is a pure function of
 *    the base geometry and the panel rects.
 *
 * Units are NDC throughout — x and y in −1…1, y UP — the same vocabulary
 * `labelDeclutter.js` decides a label's fate in, whose `coveredFraction` this
 * reuses so the marker and the names are answering one question.
 */
import { coveredFraction } from './labelDeclutter.js';

/** No chrome — a shared empty list, so the common case allocates nothing. */
const NO_RECTS = Object.freeze([]);

/** The answer when there is nothing to dodge. Frozen so callers cannot bank it. */
const NO_LEAN = Object.freeze({ x: 0, y: 0 });

/**
 * Share of the pin head a panel may cover before the callout leans.
 *
 * Much tighter than the label bars next door (`MAX_COVERED` 0.3,
 * `MAX_COVERED_PINNED` 0.45) and deliberately so. A word is padded — a plate is
 * wider than its glyphs, so a small overlap costs padding rather than letters —
 * whereas the pin head is a 22 px symbol with no padding at all, and a symbol
 * with a corner behind a card reads as a rendering fault rather than as a
 * marker. It is not zero, because the head carries an emissive bloom whose
 * outermost pixels touching a panel edge is not worth moving the whole rod for.
 */
const COVER_BAR = 0.12;

/**
 * Clear air demanded past a panel edge, as a share of the head's own
 * half-extent on the axis it moves along.
 *
 * Scale-free on purpose: an NDC constant would be a different number of pixels
 * on every canvas, which is the trap this whole directory keeps paying for.
 */
const EXIT_CLEARANCE = 0.45;

/**
 * What a downward exit costs relative to a sideways one of the same length.
 *
 * Moving the head DOWN spends the standoff the stem exists to create — it walks
 * the marker back toward the roofs, spires and rooftop glyphs that a city
 * stacks above its own anchor, which is the defect `MetaphorAccents.jsx`
 * records as the reason the marker became a pin at all. Sideways costs nothing
 * of the sort. So down is available, and it is the second choice at equal
 * distance.
 */
const DOWN_PENALTY = 1.4;

/**
 * How much of the cover a capped, non-clearing lean must buy to be worth
 * taking. A rod that leans and is still behind the panel has spent the
 * marker's one unambiguous property — that it stands straight up out of its
 * item — for nothing.
 */
const PARTIAL_GAIN = 0.15;

/** The head's screen box, as `coveredFraction` and `insideFraction` want it. */
function headBox(x, y, half) {
  return { x, y, halfW: half.w, halfH: half.h };
}

/** Is the whole head inside the canvas after this move? */
function onCanvas(x, y, half) {
  return Math.abs(x) + half.w <= 1 && Math.abs(y) + half.h <= 1;
}

/**
 * The four ways out of one rect, each as the offset that clears its edge.
 *
 * Ordered right, left, down, up only for determinism; the pick below is by
 * cost. `up` is included because a top-anchored band is not always the panel in
 * the way — a bottom-right layer key is dodged upward, and a rod that grows a
 * little taller is exactly what a leader line does.
 */
function exitsFrom(rect, tip, half) {
  const gx = half.w * EXIT_CLEARANCE;
  const gy = half.h * EXIT_CLEARANCE;
  return [
    { x: rect.xMax + half.w + gx - tip.x, y: 0, penalty: 1 },
    { x: rect.xMin - half.w - gx - tip.x, y: 0, penalty: 1 },
    { x: 0, y: rect.yMin - half.h - gy - tip.y, penalty: DOWN_PENALTY },
    { x: 0, y: rect.yMax + half.h + gy - tip.y, penalty: 1 }
  ];
}

/** Clamp one candidate to the lean cap, keeping its direction. */
function capped(candidate, maxLean) {
  return {
    ...candidate,
    x: Math.max(-maxLean.x, Math.min(maxLean.x, candidate.x)),
    y: Math.max(-maxLean.y, Math.min(maxLean.y, candidate.y))
  };
}

function distance(candidate) {
  return Math.hypot(candidate.x, candidate.y);
}

/**
 * The offset that takes the pin head out from behind the panels, in NDC.
 *
 * @param {object} args
 * @param {{x: number, y: number}} args.tip — the UNLEANED pin head centre, NDC
 * @param {{w: number, h: number}} args.half — the head's NDC half-extents
 * @param {Array<{xMin: number, xMax: number, yMin: number, yMax: number}>} [args.rects]
 *   — persistent panels over the canvas, from `measureChromeRects`
 * @param {{x: number, y: number}} args.maxLean — how far the head may travel on
 *   each axis, NDC. The caller derives it from the tilt the rod may take (see
 *   `MAX_LEAN_DEGREES` in `MetaphorAccents.jsx`), because that is a claim about
 *   the rod's geometry rather than about the screen.
 * @returns {{x: number, y: number}} NDC offset, y up. `{0, 0}` when the marker
 *   is already readable, which is the common case.
 */
export function accentRodLean({ tip, half, rects = NO_RECTS, maxLean }) {
  if (!measurable({ half, rects, maxLean })) return NO_LEAN;
  const covered = coveredFraction(headBox(tip.x, tip.y, half), rects);
  if (covered <= COVER_BAR) return NO_LEAN;
  const rect = worstPanel(tip, half, rects);
  if (!rect) return NO_LEAN;
  const exit = chooseExit({ tip, half, rects, maxLean, covered, rect });
  return exit ? { x: exit.x, y: exit.y } : NO_LEAN;
}

/**
 * Is there anything to solve? A zero-size head is the first frame, before the
 * canvas has been measured — leaning on that answer would fling the rod.
 */
function measurable({ half, rects, maxLean }) {
  if (!rects?.length) return false;
  if (!(half?.w > 0) || !(half?.h > 0)) return false;
  return maxLean?.x > 0 || maxLean?.y > 0;
}

/**
 * The panel to escape: the one covering the most of the head, for the reason
 * `coveredFraction` takes the largest single panel rather than the sum. The
 * escape is still checked against ALL of them, so exiting one and landing in
 * another is rejected below.
 */
function worstPanel(tip, half, rects) {
  let pick = null;
  let worst = 0;
  for (const rect of rects) {
    const fraction = coveredFraction(headBox(tip.x, tip.y, half), [rect]);
    if (fraction > worst) {
      worst = fraction;
      pick = rect;
    }
  }
  return pick;
}

/** The cheapest exit that clears the panels, else the best partial relief. */
function chooseExit({ tip, half, rects, maxLean, covered, rect }) {
  let best = null;
  let fallback = null;
  for (const raw of exitsFrom(rect, tip, half)) {
    const verdict = judgeExit({ raw, tip, half, rects, maxLean, covered });
    if (!verdict) continue;
    if (verdict.clears) {
      if (!best || verdict.cost < best.cost) best = verdict;
    } else if (!fallback || verdict.after < fallback.after) {
      fallback = verdict;
    }
  }
  return best ?? fallback;
}

/**
 * What one exit is worth: `null` when it is not worth taking at all, otherwise
 * the move, whether it clears the panels, and what it costs.
 */
function judgeExit({ raw, tip, half, rects, maxLean, covered }) {
  const fits = Math.abs(raw.x) <= maxLean.x && Math.abs(raw.y) <= maxLean.y;
  const move = fits ? raw : capped(raw, maxLean);
  const x = tip.x + move.x;
  const y = tip.y + move.y;
  if (!onCanvas(x, y, half)) return null;
  const after = coveredFraction(headBox(x, y, half), rects);
  const verdict = { x: move.x, y: move.y, after, cost: distance(move) * move.penalty };
  if (fits && after <= COVER_BAR) return { ...verdict, clears: true };
  // A capped move that does not clear the panel is only worth taking if it buys
  // a real share of the cover back.
  if (covered - after < PARTIAL_GAIN) return null;
  return { ...verdict, clears: false };
}
