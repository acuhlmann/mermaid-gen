/**
 * The floor's keyboard: an Escape ladder, and the accessible route to the tiles
 * free roam otherwise only offers to a pointer (slice 7).
 *
 * Extracted from `OfficeFloor` when arrow stepping joined the Escape handler —
 * one listener, but two unrelated jobs and enough branching to be worth its own
 * file rather than more lines in the view component.
 *
 * ADR-0011 picked DOM precisely so the floor would not need an accessibility
 * overlay bolted onto a canvas. People are real `<button>`s already; this is
 * what keeps *where you stand* reachable too, since a 1210×800 click surface
 * is not something a keyboard can aim at.
 */

import { useEffect } from 'react';
import { sitDown } from '../../state/officeViewModeStore.js';
import { standableTileAt } from '../../utils/officeFloorMovement.js';

/**
 * The room's own grid, mapped to the arrow keys: `x` runs down-right and `y`
 * down-left, which is also the axis pair every walk route is built from. It
 * reads as diagonal on screen, but stepping along the aisles is what the
 * furniture is arranged for.
 */
const ARROW_STEPS = {
  ArrowRight: { dx: 1, dy: 0 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowUp: { dx: 0, dy: -1 }
};

function isTypingTarget(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}

/**
 * @param {{
 *   presence: { to: { x: number, y: number } } | null,
 *   origin: { x: number, y: number } | null,
 *   goHome: () => void,
 *   walkTo: (tile: { x: number, y: number }) => void
 * }} options
 */
export function useFloorKeyboard({ presence, origin, goHome, walkTo }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTypingTarget(event.target)) return;

      // Escape sits you back down — unless a surface above the floor (Slop
      // Chat, a meeting) already handled it. On your feet it walks you home
      // first: your chair is over there, and standing up from the middle of
      // the room would read as teleporting into it.
      if (event.key === 'Escape') {
        if (presence) {
          goHome();
          return;
        }
        sitDown();
        return;
      }

      const step = ARROW_STEPS[event.key];
      if (!step || !origin) return;
      // No snapping for a step: an arrow key aimed at somewhere unwalkable
      // should do nothing rather than slide you sideways into a tile you did
      // not ask for. Clicking is where forgiveness belongs.
      const next = standableTileAt(
        { x: origin.x + step.dx, y: origin.y + step.dy },
        { from: origin, radius: 0 }
      );
      if (!next) return;
      event.preventDefault();
      walkTo(next);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [presence, goHome, origin, walkTo]);
}

export default useFloorKeyboard;
