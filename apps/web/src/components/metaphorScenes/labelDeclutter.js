/**
 * Screen-space label declutter for metaphor scenes.
 *
 * Labels are billboarded 3D text, so density in the DSL becomes density on
 * screen: a 30-node tree grove or a 40-star galaxy paints its names into one
 * unreadable smear, and the scene stops carrying the topic it was built to
 * carry. Rather than dropping labels in the layout (which would hide content
 * the author asked for), every label registers here and one throttled pass
 * decides which ones survive the camera the viewer is actually using.
 *
 * The rules, in the order they matter:
 *
 *   1. Rank by importance, then by nearness. Importance is the label's own
 *      claim on the scene (the tallest tower, the brightest star, the shallowest
 *      node in a tree); nearness breaks ties so the front reads first.
 *   2. Walk the ranking and keep a label only when its screen box clears every
 *      label already kept.
 *   3. `pinned` labels — group names, the emphasised item — never lose a
 *      CONTEST. They are the scene's thesis; hiding one to save a leaf label
 *      inverts the point of the pass.
 *   4. In a composite, every layer's FIRST surviving name is walked before any
 *      layer's second, so a canvas too small for every name still names every
 *      grammar rather than spending all its room on one.
 *   5. A label the viewer cannot read whole yields anyway, and this is the one
 *      test pinning does not simply win — it buys a laxer bar, not an
 *      exemption, because a name nobody can see is not in the contest. Two ways
 *      it happens, both worse than the label being absent: the canvas edge
 *      CLIPS it ("Partner Gateway" came out as "Partner Gatew" on a 390px
 *      phone, which reads as a rendering fault), and a persistent panel COVERS
 *      it while it goes on holding its box against every label that would have
 *      fitted.
 *
 * Resolved visibility is eased over ~0.18 s rather than switched, so orbiting a
 * dense scene reads as labels surfacing and receding rather than as flicker.
 * Both the pass and the easing run from a single `useFrame` in the renderer and
 * write through refs, so decluttering costs no React re-render — the same
 * reason the hover store lives outside React.
 */
import * as THREE from 'three';

/** Milliseconds between declutter passes; labels move only as fast as the camera. */
const PASS_INTERVAL_MS = 110;
/** Beyond this rank the ranking has already chosen; the tail is simply hidden. */
const MAX_PAIRWISE = 240;
/** Screen gap demanded between two kept labels, in NDC-y units. */
const GUTTER = 0.008;
/** Seconds for a label to fade fully in or out. */
const FADE_SECONDS = 0.18;
/**
 * Share of a label that must be inside the CANVAS for it to be drawn.
 *
 * Effectively "not clipped at all", and that is the point: a clipped word is a
 * defect rather than a degraded reading, so there is no interesting middle
 * ground to leave room for. It was 0.9 first, and 0.9 is not close enough —
 * measured on a 390px phone, "Fulfillment" hung 6px off the right edge and
 * scored 0.94, so the fused composite still rendered "Fulfillmen" while the
 * rule that exists to stop exactly that reported everything fine.
 */
const MIN_ON_CANVAS = 0.97;
/**
 * Share of a label a panel may cover before the label yields.
 *
 * Not as tight as the canvas rule, because a label plate is wider than its
 * glyphs (`ItemLabel` pads it by 0.9 of the type size on each side), so a small
 * overlap costs padding rather than letters. It cannot be as loose as a half,
 * though, which is where this started: at 0.5 the panel edge runs down the
 * middle of the word, and on a 717x512 foldable cover the fused composite still
 * showed "Payments API" and "Fulfillment" each cut in half by a panel — the
 * exact defect the rule exists to remove, passing it.
 */
const MAX_COVERED = 0.3;

/**
 * The same question for a PINNED label, at a much higher bar.
 *
 * Pinning says "this name has no second copy" — a group placard is the only
 * thing naming its territory, and the accented item's own label is the name of
 * the thesis — so it must not yield for a corner or a third. But it is not a
 * licence to draw text nobody can read: the accented item is usually the
 * tallest thing in the scene, its label sits above it, and on a foldable cover
 * that puts it inside the reading strip. Measured there, "Payments API" was 87%
 * behind the strip and drawn anyway; the panel is translucent, so the result
 * read as a rendering glitch rather than as a label. Past this bar the pin,
 * stem and ring still say which item it is, the strip states the thesis, and
 * the guided read still names it — and one orbit brings the label back.
 *
 * It was 0.7 first, which is the bar for being almost entirely buried, and that
 * left the case this exists for still on screen: a name lying ACROSS a panel's
 * edge is roughly half covered by construction, and half a word is the thing
 * that reads as a defect.
 */
const MAX_COVERED_PINNED = 0.45;

/**
 * The canvas-clip bar for a pinned label, relaxed for the same reason.
 *
 * A composite's affinity placards are placed OUTWARD from the world centre
 * (`assignSiteLabelOffsets` — the only reliably open ground is outside the
 * outermost sites), which puts them within a few pixels of the frame edge by
 * construction. At the non-pinned bar every group name in a fused world would
 * disappear, which is the thing a composite exists to say.
 */
const MIN_ON_CANVAS_PINNED = 0.7;

/** NDC rectangle covering the whole canvas. */
const FULL_WINDOW = Object.freeze({ xMin: -1, xMax: 1, yMin: -1, yMax: 1 });

/** No chrome — a shared empty list, so the common case allocates nothing. */
const NO_RECTS = Object.freeze([]);

/** Area of the intersection of a label's box with an NDC rectangle. */
function overlapArea(box, rect) {
  const width = Math.max(
    0,
    Math.min(box.x + box.halfW, rect.xMax) - Math.max(box.x - box.halfW, rect.xMin)
  );
  const height = Math.max(
    0,
    Math.min(box.y + box.halfH, rect.yMax) - Math.max(box.y - box.halfH, rect.yMin)
  );
  return width * height;
}

/**
 * Fraction of a label's screen box that lies inside `rect`.
 *
 * @param {{x: number, y: number, halfW: number, halfH: number}} box — NDC
 * @param {{xMin: number, xMax: number, yMin: number, yMax: number}} rect
 * @returns {number} 0–1
 */
export function insideFraction(box, rect) {
  const area = 4 * box.halfW * box.halfH;
  if (!(area > 0)) return 1;
  return overlapArea(box, rect) / area;
}

/**
 * Fraction of a label's box covered by the panels, taking the LARGEST single
 * panel rather than the sum.
 *
 * The sum double-counts, and it double-counts precisely where the panels
 * overlap — which on this app is every phone screen, because the composer band
 * and the OS taskbar sit one on top of the other. Two panels that between them
 * clip a corner would then read as covering the whole label. The largest single
 * cover is the honest question anyway: "is this word behind something".
 *
 * @param {{x: number, y: number, halfW: number, halfH: number}} box — NDC
 * @param {Array<{xMin: number, xMax: number, yMin: number, yMax: number}>} rects
 * @returns {number} 0–1
 */
export function coveredFraction(box, rects) {
  const area = 4 * box.halfW * box.halfH;
  if (!(area > 0) || !rects?.length) return 0;
  let worst = 0;
  for (const rect of rects) {
    const covered = overlapArea(box, rect) / area;
    if (covered > worst) worst = covered;
  }
  return worst;
}

/**
 * @typedef {object} LabelEntry
 * @property {import('three').Object3D | null} object — the drawn box's own group, read for its
 *   world position. Deliberately NOT the `Billboard`: `labelStackLiftEm` lifts a multi-line block
 *   from inside that group, so at any non-zero lift the Billboard's origin is no longer the centre
 *   of what is drawn (`MetaphorSceneChrome.jsx` registers `boxRef`, and troika anchors a stacked
 *   label at the middle of its block).
 * @property {number} importance — higher wins contested space
 * @property {boolean} pinned — never loses a contest for space
 * @property {string | null} [layerKey] — which composite layer this name belongs
 *   to; each distinct key sends its best candidate to the front of the walk
 * @property {boolean} [yieldWhenUnreadable] — pinned, but hides when clipped by
 *   the canvas or covered by a panel; for annotations whose text is on screen
 *   somewhere else anyway
 * @property {number} [width] — label width in world units (world-sized entries)
 * @property {number} [height] — label height in world units (world-sized entries)
 * @property {number} [screenWidthPx] — drawn width in CSS pixels; wins over `width`
 * @property {number} [screenHeightPx] — drawn height in CSS pixels; wins over `height`
 * @property {(opacity: number) => void} apply — receives the eased 0–1 opacity
 * @property {number} target — internal: resolved target opacity
 * @property {number} current — internal: eased opacity
 */

export function createLabelDeclutterStore() {
  /** @type {Set<LabelEntry>} */
  const entries = new Set();
  let lastPass = -Infinity;

  return {
    /** @param {LabelEntry} entry @returns {() => void} unregister */
    register(entry) {
      entry.target = 1;
      entry.current = 1;
      entries.add(entry);
      return () => entries.delete(entry);
    },

    /**
     * Re-rank (throttled) and ease every label toward its target.
     *
     * `chromeRects` are the persistent panels as NDC rectangles over the canvas
     * (see `measureChromeRects`). Omit them and only the canvas edge is
     * respected.
     */
    update(camera, viewport, now, delta, chromeRects = NO_RECTS) {
      if (now - lastPass >= PASS_INTERVAL_MS) {
        lastPass = now;
        resolveLabels([...entries], camera, viewport, chromeRects);
      }
      const step = FADE_SECONDS > 0 ? Math.min(1, delta / FADE_SECONDS) : 1;
      for (const entry of entries) {
        if (entry.current !== entry.target) {
          entry.current += (entry.target - entry.current) * step;
          if (Math.abs(entry.target - entry.current) < 0.01) entry.current = entry.target;
          entry.apply(entry.current);
        }
      }
    },

    get size() {
      return entries.size;
    }
  };
}

const scratch = new THREE.Vector3();

/**
 * Project each label, rank, and write `entry.target`. Exported for tests: the
 * invariants worth pinning are that a pinned label always targets 1, and that
 * two labels sharing a screen box never both do.
 *
 * @param {LabelEntry[]} entries
 * @param {import('three').Camera} camera
 * @param {{ width: number, height: number }} viewport
 * @param {Array<{xMin: number, xMax: number, yMin: number, yMax: number}>} [chromeRects]
 */
export function resolveLabels(entries, camera, viewport, chromeRects = NO_RECTS) {
  if (!entries.length) return;
  const aspect = viewport.width / Math.max(1, viewport.height);

  const projected = [];
  for (const entry of entries) {
    if (!entry.object) continue;
    entry.object.getWorldPosition(scratch);
    const depth = scratch.distanceTo(camera.position);
    scratch.project(camera);
    // Behind the camera or off-frame: no space to contest, and nothing to show.
    if (scratch.z > 1 || Math.abs(scratch.x) > 1.5 || Math.abs(scratch.y) > 1.35) {
      entry.target = 0;
      continue;
    }
    // A screen-constant label reports the box it is actually drawn at, so it
    // needs no projection: NDC spans 2 across the viewport, so `p` pixels is
    // `p / viewportWidth` of half-width. A world-sized entry still converts —
    // `fov` is vertical, so height converts directly and width divides out the
    // viewport aspect.
    let halfW;
    let halfH;
    if (entry.screenWidthPx > 0 && entry.screenHeightPx > 0) {
      halfW = entry.screenWidthPx / Math.max(1, viewport.width);
      halfH = entry.screenHeightPx / Math.max(1, viewport.height);
    } else {
      const perUnit = 1 / Math.max(0.001, depth * Math.tan((camera.fov * Math.PI) / 360));
      halfW = (entry.width * perUnit) / 2 / aspect;
      halfH = (entry.height * perUnit) / 2;
    }
    projected.push({ entry, x: scratch.x, y: scratch.y, halfW, halfH, depth });
  }

  projected.sort((a, b) => {
    if (a.entry.pinned !== b.entry.pinned) return a.entry.pinned ? -1 : 1;
    if (b.entry.importance !== a.entry.importance) {
      return b.entry.importance - a.entry.importance;
    }
    return a.depth - b.depth;
  });

  const kept = [];

  /**
   * Decide one label and record it if it survives.
   * @returns {boolean} true when the label is drawn
   */
  const settle = (candidate, rank) => {
    // Unreadable is decided before contested, and it is the one test pinning
    // does not simply win: pinning is a claim about which label deserves
    // CONTESTED space, and a label nobody can see is not in the contest. What
    // pinning buys here is a higher bar, not an exemption — plus
    // `yieldWhenUnreadable` for annotations whose text is on screen somewhere
    // else anyway (the accent caption, which the reading strip prints).
    const pinned = candidate.entry.pinned === true && !candidate.entry.yieldWhenUnreadable;
    const unreadable =
      insideFraction(candidate, FULL_WINDOW) < (pinned ? MIN_ON_CANVAS_PINNED : MIN_ON_CANVAS) ||
      coveredFraction(candidate, chromeRects) > (pinned ? MAX_COVERED_PINNED : MAX_COVERED);
    if (candidate.entry.pinned) {
      candidate.entry.target = unreadable ? 0 : 1;
      if (!unreadable) kept.push(candidate);
      return !unreadable;
    }
    let blocked = rank >= MAX_PAIRWISE || unreadable;
    for (let k = 0; !blocked && k < kept.length; k += 1) {
      const other = kept[k];
      if (
        Math.abs(candidate.x - other.x) < candidate.halfW + other.halfW + GUTTER &&
        Math.abs(candidate.y - other.y) < candidate.halfH + other.halfH + GUTTER
      ) {
        blocked = true;
      }
    }
    candidate.entry.target = blocked ? 0 : 1;
    if (!blocked) kept.push(candidate);
    return !blocked;
  };

  // Pinned first, in rank order. They cannot be blocked, so anything walked
  // ahead of one would claim the placard's space and then be drawn over.
  for (let i = 0; i < projected.length; i += 1) {
    if (projected[i].entry.pinned) settle(projected[i], i);
  }

  // Round one — each layer's FIRST surviving name, in rank order.
  //
  // A composite's claim is that several grammars describe one topic, and the
  // layer key goes on listing a layer whether or not the scene still names
  // anything in it. Ranking alone cannot keep that promise even when the
  // planner interleaves the layers: a layer's top pick may be the one the
  // canvas edge clips or a panel covers, and the walk then goes straight on to
  // everyone else's second name. So a layer that has nothing yet keeps getting
  // tried — its second and third names are still round one — until one lands.
  //
  // This is a reordering, not an exemption: a first name still yields when it
  // is unreadable and still loses a contest to another layer's first name.
  // Every label with no layer of its own (a base kind's items, a composite's
  // link captions) simply falls to round two, which is the unchanged walk.
  const later = [];
  const named = new Set();
  for (let i = 0; i < projected.length; i += 1) {
    const candidate = projected[i];
    if (candidate.entry.pinned) continue;
    const layerKey = candidate.entry.layerKey;
    if (!layerKey || named.has(layerKey)) {
      later.push({ candidate, rank: i });
      continue;
    }
    if (settle(candidate, i)) named.add(layerKey);
  }

  // Round two — the rest of the ranking, unchanged.
  for (const { candidate, rank } of later) settle(candidate, rank);
}
