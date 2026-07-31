/**
 * Walk a positioned element along a tile path.
 *
 * Motion runs on the Web Animations API rather than React state: the browser
 * animates the transform, `finished` sequences the legs, and no frame of a walk
 * costs a re-render. Where `animate` is unavailable (jsdom) or the user asked
 * for stillness, the element is placed at the destination and `onArrive` fires
 * immediately — the beat still happens, it just doesn't travel.
 *
 * Shared by `FloorWalker` (a colleague coming over) and the arrival ceremony
 * (you, walking to your desk for the first time).
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { projectIso, unprojectIso } from '../../utils/officeFloorPlan.js';

/** Walking pace, ms per stage pixel, clamped so no leg drags or teleports. */
const MS_PER_PX = 3.2;
const LEG_MIN_MS = 420;
const LEG_MAX_MS = 2000;

function legDuration(from, to) {
  const px = Math.hypot(to.left - from.left, to.top - from.top);
  return Math.min(LEG_MAX_MS, Math.max(LEG_MIN_MS, px * MS_PER_PX));
}

function transformFor(point) {
  return `translate(${point.left.toFixed(1)}px, ${point.top.toFixed(1)}px)`;
}

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * Where a walker actually is right now, in tiles — read back off the element's
 * animated transform.
 *
 * Only free roam needs this, and it needs it for one reason: a new `walkKey`
 * re-places the element at its new path's *start*, so interrupting a walk with
 * a fresh destination teleports you back to where the old one began unless the
 * caller hands the new walk the position you had reached. Computed style
 * reflects the running animation, which is exactly the number we want.
 *
 * @param {HTMLElement | null | undefined} el
 * @returns {{ x: number, y: number } | null} `null` where there is no engine
 *   (jsdom) or nothing has moved yet — callers fall back to their known tile.
 */
export function liveTileOf(el) {
  if (!el || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
    return null;
  }
  if (typeof DOMMatrixReadOnly !== 'function') return null;
  const { transform } = window.getComputedStyle(el);
  if (!transform || transform === 'none') return null;
  try {
    const matrix = new DOMMatrixReadOnly(transform);
    return unprojectIso(matrix.m41, matrix.m42);
  } catch {
    return null; // a transform we did not write; the caller's known tile is fine
  }
}

/**
 * @param {{ current: HTMLElement | null }} ref element positioned at the stage origin
 * @param {Array<{x: number, y: number}>} path
 * @param {{ walkKey: string, onArrive?: () => void, onLeg?: (tile: {x: number, y: number}, leg: number) => void, enabled?: boolean }} options
 *   `walkKey` identifies one walk; changing it restarts the sequence.
 *
 *   `onLeg` fires as each leg starts, with the tile it is heading for. It exists
 *   so a caller can sound a footstep without this hook knowing what audio is —
 *   the leg loop is the only place in the app that knows how often a foot hits
 *   the floor, and a leg is already clamped to 420–2000 ms, which is a walking
 *   pace rather than an animation detail. Note that the reduced-motion and
 *   no-engine branches below never enter the loop: stillness is silent for free,
 *   with no second preference check.
 * @returns {{ tile: {x: number, y: number}, arrived: boolean }} current leg
 *   destination, for depth ordering.
 */
export function useWalkAnimation(ref, path, { walkKey, onArrive, onLeg, enabled = true }) {
  const start = path[0] ?? { x: 0, y: 0 };
  const [tile, setTile] = useState(start);
  const [arrived, setArrived] = useState(false);
  /* Held in a ref, not a dependency: the walk effect re-runs only on `walkKey`
   * / `enabled`, and a caller that rebuilds this callback each render would
   * otherwise restart the animation mid-stride. Same reasoning `onArrive` is
   * read through the closure the effect already captures. */
  const onLegRef = useRef(onLeg);
  useEffect(() => {
    onLegRef.current = onLeg;
  });

  // Place before first paint so the element never flashes at the stage origin.
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- (reason: resetting to the start of a new walk; the DOM placement below must happen in the same layout pass to avoid a flash)
    setTile(start);
    setArrived(false);
    if (ref.current) ref.current.style.transform = transformFor(projectIso(start.x, start.y));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- (reason: re-place only when the walk changes; `start` is derived from walkKey)
  }, [walkKey]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || path.length === 0) return undefined;
    let cancelled = false;
    let running = null;

    const settle = () => {
      if (cancelled) return;
      setTile(path[path.length - 1]);
      setArrived(true);
      onArrive?.();
    };

    if (typeof el.animate !== 'function' || prefersReducedMotion() || path.length < 2) {
      const last = path[path.length - 1];
      el.style.transform = transformFor(projectIso(last.x, last.y));
      settle();
      return () => {
        cancelled = true;
      };
    }

    const run = async () => {
      for (let leg = 1; leg < path.length; leg += 1) {
        if (cancelled) return;
        const from = projectIso(path[leg - 1].x, path[leg - 1].y);
        const to = projectIso(path[leg].x, path[leg].y);
        // Depth follows the leg's destination, so a walker passing a desk is
        // painted behind or in front of it correctly.
        setTile(path[leg]);
        onLegRef.current?.(path[leg], leg);
        const animation = el.animate(
          [{ transform: transformFor(from) }, { transform: transformFor(to) }],
          {
            duration: legDuration(from, to),
            easing: leg === 1 ? 'ease-in' : 'ease-out',
            fill: 'forwards'
          }
        );
        running = animation;
        try {
          await animation.finished;
        } catch {
          return; // cancelled mid-walk (unmount, or a new destination)
        }
      }
      settle();
    };

    void run();
    return () => {
      cancelled = true;
      /*
       * A `fill: forwards` animation outranks inline style, so an abandoned
       * walk would go on holding the figure at the leg it reached and the next
       * walk would never appear to start. Harmless while walks could not
       * overlap; free roam (slice 7) interrupts them by design.
       */
      running?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- (reason: one walk per walkKey; re-running on every render would restart the animation)
  }, [walkKey, enabled]);

  return { tile, arrived };
}
