/**
 * Fit-to-viewport scale for the fixed-size isometric stage.
 *
 * Layout is authored once at `STAGE_W × STAGE_H` and scaled to whatever the
 * device gives us, so no floor geometry depends on the viewport. Below
 * `MIN_SCALE` the room stops shrinking and pans instead (native scroll) —
 * faces stop reading at about half size, and an unreadable-but-complete room
 * is worse than a legible one you move around.
 */

import { useEffect, useState } from 'react';
import { STAGE_H, STAGE_W } from '../utils/officeFloorPlan.js';

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 1.1;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * @param {{ current: HTMLElement | null }} viewportRef
 * @returns {number}
 */
export function useStageScale(viewportRef) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      setScale(clamp(Math.min(width / STAGE_W, height / STAGE_H), MIN_SCALE, MAX_SCALE));
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [viewportRef]);

  return scale;
}
