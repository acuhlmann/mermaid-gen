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
 *   3. `pinned` labels — group names, the emphasised item — never lose. They are
 *      the scene's thesis; hiding one to save a leaf label inverts the point.
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
 * @typedef {object} LabelEntry
 * @property {import('three').Object3D | null} object — billboard, for its world position
 * @property {number} importance — higher wins contested space
 * @property {boolean} pinned — never hidden
 * @property {number} width — label width in world units
 * @property {number} height — label height in world units
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

    /** Re-rank (throttled) and ease every label toward its target. */
    update(camera, viewport, now, delta) {
      if (now - lastPass >= PASS_INTERVAL_MS) {
        lastPass = now;
        resolveLabels([...entries], camera, viewport);
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
 */
export function resolveLabels(entries, camera, viewport) {
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
    // World units → NDC. `fov` is vertical, so height converts directly and
    // width divides out the viewport aspect.
    const perUnit = 1 / Math.max(0.001, depth * Math.tan((camera.fov * Math.PI) / 360));
    projected.push({
      entry,
      x: scratch.x,
      y: scratch.y,
      halfW: (entry.width * perUnit) / 2 / aspect,
      halfH: (entry.height * perUnit) / 2,
      depth
    });
  }

  projected.sort((a, b) => {
    if (a.entry.pinned !== b.entry.pinned) return a.entry.pinned ? -1 : 1;
    if (b.entry.importance !== a.entry.importance) {
      return b.entry.importance - a.entry.importance;
    }
    return a.depth - b.depth;
  });

  const kept = [];
  for (let i = 0; i < projected.length; i += 1) {
    const candidate = projected[i];
    if (candidate.entry.pinned) {
      candidate.entry.target = 1;
      kept.push(candidate);
      continue;
    }
    let blocked = i >= MAX_PAIRWISE;
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
  }
}
