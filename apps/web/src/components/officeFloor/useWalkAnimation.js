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

import { useEffect, useLayoutEffect, useState } from 'react';
import { projectIso } from '../../utils/officeFloorPlan.js';

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
 * @param {{ current: HTMLElement | null }} ref element positioned at the stage origin
 * @param {Array<{x: number, y: number}>} path
 * @param {{ walkKey: string, onArrive?: () => void, enabled?: boolean }} options
 *   `walkKey` identifies one walk; changing it restarts the sequence.
 * @returns {{ tile: {x: number, y: number}, arrived: boolean }} current leg
 *   destination, for depth ordering.
 */
export function useWalkAnimation(ref, path, { walkKey, onArrive, enabled = true }) {
  const start = path[0] ?? { x: 0, y: 0 };
  const [tile, setTile] = useState(start);
  const [arrived, setArrived] = useState(false);

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
        const animation = el.animate(
          [{ transform: transformFor(from) }, { transform: transformFor(to) }],
          {
            duration: legDuration(from, to),
            easing: leg === 1 ? 'ease-in' : 'ease-out',
            fill: 'forwards'
          }
        );
        try {
          await animation.finished;
        } catch {
          return; // cancelled mid-walk (unmount)
        }
      }
      settle();
    };

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- (reason: one walk per walkKey; re-running on every render would restart the animation)
  }, [walkKey, enabled]);

  return { tile, arrived };
}
