/**
 * Hit-testing for a scene's LINKS, and the pinned link a tap leaves behind.
 *
 * Items have been tappable since selection shipped; relations never were. That
 * left `renameCityEdge`/`deleteCityEdge` and the four flat-kind equivalents
 * registered on their adapters, covered by tests, and unreachable from the UI —
 * the only producer of a `kind: 'edge'` descriptor was the SVG resolver in
 * `DiagramCanvas.jsx`, and a Three.js scene never goes near it (#495).
 *
 * ## Why a screen-space test rather than a raycast
 *
 * The obvious move is an invisible fat tube along each route, raycast with the
 * pointer. It cannot be made to work here, and the reason is the same one that
 * put every other size in this renderer into CSS pixels (fog band, AO radius,
 * accent caption, item labels — see `metaphorScreenScale.js`): a tube's radius
 * is a WORLD size, these scenes run from a 14-unit layercake to a 60-unit
 * bridge, and a tap target has to be about 24 CSS px wide on a phone whichever
 * of those is on screen. A radius that gives a city link a thumb-sized target
 * swallows two neighbouring towers on a layercake.
 *
 * Projecting the route's own polyline and measuring point-to-segment distance
 * in pixels gives the tolerance directly in the unit it is specified in, uses
 * the live camera so it cannot disagree with what was drawn, and is a pure
 * function of numbers — which is what makes it testable without a WebGL
 * context.
 *
 * ## Why a link never steals an item's tap
 *
 * The whole test runs from the canvas's `onPointerMissed`, which R3F raises
 * only when nothing with a handler was hit AND the release landed within 2px of
 * the press. Items are wrapped in `HoverableItem`, which handles and stops
 * pointer events, so an item under the finger consumes the tap before this
 * module is ever consulted — the "a link wins only when no item was hit" rule
 * from #495 is structural here, not a comparison this module has to make.
 */
import { createContext, useContext, useSyncExternalStore } from 'react';
import * as THREE from 'three';

/**
 * Tap tolerance in CSS pixels. A link core is 2.2px wide (`LINK_CORE_PX`) and
 * its casing 6px, so the drawn line is nowhere near a touch target; this is the
 * radius around the polyline that counts as "on it". 20px is inside the 24px
 * minimum-target guidance while staying under half the smallest gap between two
 * parallel city links at phone width, which is what stops the picker becoming a
 * coin toss between neighbours.
 */
export const LINK_PICK_TOLERANCE_PX = 20;

/**
 * The kinds whose adapters actually implement `renameEdge`/`deleteEdge` against
 * a free `links[]` — city plus the four `canLink` flat kinds. Tree, garden, and
 * the flat kinds registered with `canLink: false` return `not-graph` from those
 * mutators on purpose, because their relations are implied by structure rather
 * than authored: `docs/canvas-graph-edit.md` is explicit that those stubs must
 * not be "fixed". Offering a rename on one would be a menu entry whose only
 * outcome is an error toast.
 *
 * Composite is the awkward one and is deliberately excluded: its adapter ships
 * LIVE mutators (`renameCompositeEdge` performs a real `renameLinkedEdge` on a
 * layer's items) and `CompositeScene` renders pickable `MetaphorLinks`, but the
 * renderer's store-gate closes on `metaphor: 'composite'`, so the mutators stay
 * unreachable (#495's shape, one kind over). Whether that is exclusion-by-
 * design or an unfinished enable — and what a composite link rename even means
 * across a layer delegate — is #557's open judgement, not this list's; the
 * pending ledger in `metaphorLinkPick.test.js` carries it until then.
 *
 * `metaphorLinkPick.test.js` holds this list against the live adapters, so a
 * kind that gains link editing fails the test until it is added here (or
 * explicitly pended with a reason).
 */
export const LINK_EDITABLE_METAPHORS = Object.freeze([
  'city',
  'layercake',
  'galaxy',
  'machine',
  'terrain'
]);

/** @param {string | null | undefined} metaphor */
export function metaphorKindHasEditableLinks(metaphor) {
  return typeof metaphor === 'string' && LINK_EDITABLE_METAPHORS.includes(metaphor);
}

/**
 * Identity of a link, for toggling and for React keys. The PAIR is the
 * identity — `connectCityNodes` refuses a duplicate pair and
 * `findLinkedEdge`/`renameLinkedEdge` resolve on `{from, to}` alone — so there
 * is deliberately no synthetic edge id to invent or keep in sync.
 *
 * @param {string} from
 * @param {string} to
 */
export function linkPickKey(from, to) {
  return `${from}→${to}`;
}

/** @type {import('react').Context<ReturnType<typeof createMetaphorLinkSelectionStore> | null>} */
export const MetaphorLinkSelectionContext = createContext(null);

export function useMetaphorLinkSelection() {
  return useContext(MetaphorLinkSelectionContext);
}

const noopSubscribe = () => () => {};
const nullSnapshot = () => null;

/**
 * The pinned link, or null — including when no store is in context at all,
 * which is the case on every kind whose links are not editable and on the
 * streaming preview. Hook rather than an inline `useSyncExternalStore` in the
 * links layer so the store-absent branch cannot be written as a conditional
 * hook.
 */
export function usePickedLink() {
  const store = useMetaphorLinkSelection();
  return useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store?.get ?? nullSnapshot,
    store?.get ?? nullSnapshot
  );
}

/**
 * Minimal subscribe/get/set store holding the pinned link, or null.
 *
 * Separate from the item selection store rather than a variant of its state:
 * the item store's `toggle` keys on `state.item.id`, its marker measures an
 * item's geometry, and its inspector panel reads the metric vocabulary for an
 * item's metaphor. A link has none of those, and threading a second shape
 * through all three would put a branch in every consumer to serve one of them.
 * The two are made mutually exclusive by their writers instead.
 *
 * State shape: `{ link: { from, to, label }, object } | null`, where `object` is
 * the live link group in the scene — the anchor has to follow it, because a
 * kind that animates (galaxy's drift, machine's rotation) moves the group under
 * a route whose local points never change.
 */
export function createMetaphorLinkSelectionStore() {
  let state = null;
  let pending = null;
  const listeners = new Set();
  const pendingListeners = new Set();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    get: () => state,
    /**
     * Ask for the link under a canvas point, in page coordinates.
     *
     * The gesture and the answer are deliberately separated: the tap arrives on
     * `<Canvas onPointerMissed>`, which is OUTSIDE R3F's context and so cannot
     * see the camera, while the resolution needs it. Routing the request
     * through the store rather than through a ref the renderer hands down keeps
     * both sides reading their own state — no component writes to another's
     * ref, and there is no mutable box in the render path for
     * `react-hooks/refs` and `react-hooks/immutability` to be right about.
     *
     * Nothing subscribed means nothing happens, which is exactly the behaviour
     * wanted on a kind whose links are not editable.
     *
     * @param {{ clientX: number, clientY: number } | null} point
     */
    requestPick: (point) => {
      pending = point ?? null;
      for (const listener of pendingListeners) listener();
    },
    /** Consume the outstanding request, if any. */
    takePending: () => {
      const point = pending;
      pending = null;
      return point;
    },
    subscribePending: (listener) => {
      pendingListeners.add(listener);
      return () => pendingListeners.delete(listener);
    },
    set: (next) => {
      if (state === next) return;
      state = next ?? null;
      notify();
    },
    clear: () => {
      if (state === null) return;
      state = null;
      notify();
    },
    /** Tapping the pinned link again dismisses it, same contract as an item. */
    toggle: (next) => {
      const currentKey = state?.link ? linkPickKey(state.link.from, state.link.to) : null;
      const nextKey = next?.link ? linkPickKey(next.link.from, next.link.to) : null;
      const same = Boolean(currentKey) && currentKey === nextKey;
      state = same ? null : (next ?? null);
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

/** Key under which `MetaphorLinks` publishes a route for this module to find. */
export const LINK_PICK_USER_DATA = 'archislopLink';

/**
 * Sky-400, the same constant `MetaphorSelectionMarker.jsx` holds across every
 * theme for a picked ITEM. One pick colour for both, deliberately: a viewer who
 * has learned that sky-blue means "this is what the panel and the menu are
 * about" should not have to learn it twice, and holding it out of the palettes
 * is what stops a theme spending it on meaning.
 */
export const LINK_PICK_COLOR = '#38bdf8';

/**
 * How much wider the picked link is drawn. Widths here are CSS pixels
 * (`linkMetricsFor`), so this reads the same on a 14-unit layercake and a
 * 60-unit bridge; 2.2px of core becomes 4.6px, which is a stroke you can see
 * across a phone screen without becoming a ribbon on a desktop.
 */
export const LINK_PICK_WIDTH_SCALE = 2.1;

/**
 * The picked link's casing goes near-opaque. An ordinary casing is translucent
 * so twelve of them do not curtain the scene; the one picked link is the thing
 * the viewer just asked about, and its halo is what carries the read across a
 * tower it crosses.
 */
export const LINK_PICK_CASING_OPACITY = 0.95;

/**
 * Every pickable link currently in the scene, with the object that carries it.
 *
 * Read off the scene graph rather than from a registry the renderer writes:
 * `MetaphorLinks` is rendered by fourteen scene modules and the fused composite,
 * and a registry would need every one of them to unregister on unmount.
 *
 * @param {THREE.Object3D | null | undefined} root
 * @returns {Array<{ object: THREE.Object3D, link: { from: string, to: string, label: string },
 *   points: number[][] }>}
 */
export function collectPickableLinks(root) {
  if (!root) return [];
  const found = [];
  root.traverse((node) => {
    if (!node.visible) return;
    const payload = node.userData?.[LINK_PICK_USER_DATA];
    if (!payload?.link?.from || !payload?.link?.to || !Array.isArray(payload.points)) return;
    found.push({ object: node, link: payload.link, points: payload.points });
  });
  return found;
}

const scratchPoint = new THREE.Vector3();

/**
 * Project one LOCAL route point to CSS pixels within the canvas, or null when it
 * sits behind the camera.
 *
 * The behind-the-camera guard is the whole reason this is not a one-liner:
 * `Vector3.project` divides by `w`, and for a point behind the eye `w` is
 * negative, so the result is a plausible-looking position mirrored through the
 * origin. A city link whose far end has swung behind the viewer would otherwise
 * report a segment crossing the entire canvas, and every tap anywhere near that
 * diagonal would pick it.
 *
 * @param {number[]} point local-space `[x, y, z]`
 * @param {THREE.Matrix4} matrixWorld the link group's world matrix
 * @param {THREE.Camera} camera
 * @param {{ width: number, height: number }} size canvas size in CSS pixels
 * @returns {[number, number] | null}
 */
export function projectLinkPoint(point, matrixWorld, camera, size) {
  scratchPoint.set(point[0], point[1], point[2]).applyMatrix4(matrixWorld);
  scratchPoint.applyMatrix4(camera.matrixWorldInverse);
  // Three's cameras look down local -Z, so anything at z >= 0 is at or behind
  // the eye. A small epsilon keeps a point exactly on the eye plane out too.
  if (scratchPoint.z > -1e-4) return null;
  scratchPoint.applyMatrix4(camera.projectionMatrix);
  return [(scratchPoint.x * 0.5 + 0.5) * size.width, (-scratchPoint.y * 0.5 + 0.5) * size.height];
}

/**
 * Distance in pixels from `(px, py)` to the segment `a`→`b`. Degenerate
 * segments (both endpoints projecting to the same pixel, which an elbow route's
 * vertical leg does when seen end-on) fall back to the point distance rather
 * than dividing by zero.
 *
 * @param {number} px
 * @param {number} py
 * @param {[number, number]} a
 * @param {[number, number]} b
 */
export function distanceToSegmentPx(px, py, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-9) return Math.hypot(px - a[0], py - a[1]);
  let t = ((px - a[0]) * dx + (py - a[1]) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

/**
 * The route nearest a screen point, within tolerance.
 *
 * Pure: `routes` carry screen points already, so this needs no camera and
 * cannot repeat the projection lie `apps/web/.claude/skills/verify/SKILL.md`
 * warns about — a wrong projection shows up as the wrong link highlighted in a
 * screenshot, not as a plausible number.
 *
 * @param {{
 *   routes: Array<{ link: object, screenPoints: Array<[number, number] | null> }>,
 *   x: number,
 *   y: number,
 *   tolerancePx?: number
 * }} args
 * @returns {{ link: object, distancePx: number } | null}
 */
export function pickLinkAtPoint({ routes, x, y, tolerancePx = LINK_PICK_TOLERANCE_PX }) {
  let best = null;
  for (const route of routes ?? []) {
    const nearest = distanceToRoutePx(x, y, route?.screenPoints);
    if (nearest > tolerancePx) continue;
    if (!best || nearest < best.distancePx) best = { link: route.link, distancePx: nearest };
  }
  return best;
}

/**
 * Closest approach in pixels from `(x, y)` to a projected route, or Infinity
 * when it has no drawable segment left — fewer than two points, or every
 * segment with an endpoint behind the camera.
 *
 * @param {number} x
 * @param {number} y
 * @param {Array<[number, number] | null> | undefined} screenPoints
 */
export function distanceToRoutePx(x, y, screenPoints) {
  if (!Array.isArray(screenPoints) || screenPoints.length < 2) return Infinity;
  let nearest = Infinity;
  for (let i = 1; i < screenPoints.length; i += 1) {
    const a = screenPoints[i - 1];
    const b = screenPoints[i];
    if (!a || !b) continue;
    const distance = distanceToSegmentPx(x, y, a, b);
    if (distance < nearest) nearest = distance;
  }
  return nearest;
}
