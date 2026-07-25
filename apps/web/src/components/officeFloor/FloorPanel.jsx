/**
 * A panel pinned to a tile, at constant on-screen size.
 *
 * Owns the same counter-scale trick as `FloorBubble`: inside the scaled stage a
 * 0.78 rem line is ~6 px on a phone, so the panel scales by the inverse of the
 * stage scale and stays the same physical size however far the room is zoomed
 * out. That is what lets the floor put its asks *where the thing is happening*
 * — at the coffee machine, between two combatants, in front of the meeting
 * table — instead of in a corner of the screen divorced from the people it is
 * about.
 *
 * `lift` is how far above the anchor tile the panel floats. Set pieces want the
 * default (clear of two standing figures); the meeting hangs its chrome just
 * *below* its anchor (a small negative lift) because the room in front of it is
 * full of heads.
 */

import { projectIso } from '../../utils/officeFloorPlan.js';

/** Above the zone-signage layer (9000) and above the speech bubbles (9600). */
const PANEL_Z = 9700;

/**
 * @param {{
 *   tile: { x: number, y: number },
 *   scale?: number,
 *   lift?: number,
 *   testId?: string,
 *   children?: import('react').ReactNode
 * }} props
 */
export function FloorPanel({ tile, scale = 1, lift = 132, testId, children }) {
  const { left, top } = projectIso(tile.x, tile.y);
  return (
    <div className="office-floor-panel-anchor" style={{ left, top, zIndex: PANEL_Z }}>
      <div
        className="office-floor-panel"
        style={{ '--floor-inverse-scale': 1 / (scale || 1), '--floor-panel-lift': `${lift}px` }}
        data-testid={testId}
      >
        {children}
      </div>
    </div>
  );
}

export default FloorPanel;
