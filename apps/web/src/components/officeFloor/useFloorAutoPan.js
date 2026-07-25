/**
 * Keeping wherever you are walking to on screen (binding rule 3).
 *
 * Not a camera, and deliberately so: on desktop the whole room fits the
 * viewport and this does nothing at all. It only engages once the stage is
 * clamped at `MIN_SCALE` on a narrow phone and the viewport genuinely pans, in
 * which case a walk can finish off-screen — you tap a tile and nothing appears
 * to happen. Slice 6 found that with a peek; free roam can do it from anywhere.
 */

import { useEffect } from 'react';
import { prefersReducedMotion } from './useWalkAnimation.js';
import { projectIso } from '../../utils/officeFloorPlan.js';

/**
 * @param {{ current: HTMLElement | null }} viewportRef
 * @param {{ phase: string, to: { x: number, y: number } } | null} presence
 * @param {number} scale
 */
export function useFloorAutoPan(viewportRef, presence, scale) {
  /*
   * Primitive deps: `presence.to` is a fresh object every render, so depending
   * on it directly would re-pan continuously and fight the user's own scroll.
   */
  const toX = presence?.phase === 'walking' ? presence.to.x : null;
  const toY = presence?.phase === 'walking' ? presence.to.y : null;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (toX === null || toY === null) return;
    if (!viewport || typeof viewport.scrollTo !== 'function') return;
    // Nothing to pan when the whole room already fits — which is the desktop
    // case, and the reason this is a mobile affordance rather than a camera.
    if (
      viewport.scrollWidth <= viewport.clientWidth &&
      viewport.scrollHeight <= viewport.clientHeight
    ) {
      return;
    }
    const stage = viewport.querySelector('.office-floor-stage');
    const { left, top } = projectIso(toX, toY);
    viewport.scrollTo({
      left: (stage?.offsetLeft ?? 0) + left * scale - viewport.clientWidth / 2,
      top: (stage?.offsetTop ?? 0) + top * scale - viewport.clientHeight / 2,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth'
    });
  }, [viewportRef, toX, toY, scale]);
}

export default useFloorAutoPan;
