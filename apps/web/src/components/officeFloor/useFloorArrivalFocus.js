/**
 * Zoomed-in follow-cam for the Day One floor walk.
 *
 * Same trick as the directed camera (`useFloorCamera`): bump past fit-to-
 * viewport so there is something to pan on desktop, then scroll the focus
 * tile into the middle. Deliberately not a free camera — the stage still
 * owns scale.
 */

import { useEffect, useMemo } from 'react';
import { prefersReducedMotion } from './useWalkAnimation.js';
import { projectIso } from '../../utils/officeFloorPlan.js';
import { MAX_SCALE } from '../../hooks/useStageScale.js';

const ARRIVAL_FOCUS_BOOST = 1.55;

/**
 * @param {{ current: HTMLElement | null }} viewportRef
 * @param {{ x: number, y: number } | null} focusTile
 * @param {number} fitScale
 * @param {boolean} active
 * @returns {number}
 */
export function useFloorArrivalFocus(viewportRef, focusTile, fitScale, active) {
  const focusScale = useMemo(() => {
    if (!active) return fitScale;
    return Math.min(MAX_SCALE + 0.45, Math.max(fitScale, fitScale * ARRIVAL_FOCUS_BOOST));
  }, [active, fitScale]);

  const focusX = focusTile?.x ?? null;
  const focusY = focusTile?.y ?? null;

  useEffect(() => {
    if (!active || focusX === null || focusY === null) return undefined;
    const viewport = viewportRef.current;
    if (!viewport || typeof viewport.scrollTo !== 'function') return undefined;

    const { left, top } = projectIso(focusX, focusY);
    const frame = window.requestAnimationFrame(() => {
      const stage = viewport.querySelector('.office-floor-stage');
      viewport.scrollTo({
        left: (stage?.offsetLeft ?? 0) + left * focusScale - viewport.clientWidth / 2,
        top: (stage?.offsetTop ?? 0) + top * focusScale - viewport.clientHeight / 2,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth'
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [viewportRef, active, focusScale, focusX, focusY]);

  return focusScale;
}

export default useFloorArrivalFocus;
