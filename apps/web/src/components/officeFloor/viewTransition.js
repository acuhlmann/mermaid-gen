/**
 * The stand-up / sit-down view transition (docs/office-isometric-mode.md § 1a).
 *
 * `officeViewModeStore` flips in one tick; the room on screen may not. This
 * hook keeps the floor mounted for one extra beat after the store has already
 * said 'desk', so the sit-down camera move in `OfficeFloor.css` can play out
 * — the store says where you *are*, the phase says what the screen is *doing*.
 *
 * The durations below have twins in the stylesheet (`office-floor-cover-out`
 * and the reduced-motion crossfade). `officeFloorViewTransition.test.js` pins
 * the two to the same numbers — change one, change both.
 */

import { useEffect, useRef, useState } from 'react';

/** The sit-down camera move, full motion. Mirrors `OfficeFloor.css`. */
export const FLOOR_VIEW_EXIT_MS = 380;

/** Reduced motion gets a plain crossfade instead of the camera move. */
export const FLOOR_VIEW_EXIT_REDUCED_MS = 170;

function exitDurationMs() {
  const reduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return reduced ? FLOOR_VIEW_EXIT_REDUCED_MS : FLOOR_VIEW_EXIT_MS;
}

/**
 * @param {'desk' | 'floor'} mode the live `officeViewModeStore` value
 * @returns {'stand-up' | 'sit-down' | 'closed'} what the screen is doing —
 *   `closed` renders nothing at all, the other two map onto
 *   `data-view-phase` on the floor root and drive the CSS choreography.
 */
export function useFloorViewPhase(mode) {
  const [phase, setPhase] = useState(() => (mode === 'floor' ? 'stand-up' : 'closed'));
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    if (mode === 'floor') {
      // A re-stand inside the exit window cancels the close: the camera move
      // restarts from wherever the sink had got to, and the room stays put.
      setPhase('stand-up');
      return undefined;
    }
    if (phaseRef.current === 'closed') return undefined;
    setPhase('sit-down');
    const timer = window.setTimeout(() => setPhase('closed'), exitDurationMs());
    return () => window.clearTimeout(timer);
  }, [mode]);

  return phase;
}
