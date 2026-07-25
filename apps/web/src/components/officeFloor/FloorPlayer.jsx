/**
 * You, on your feet, walking somewhere.
 *
 * `OfficeFloor` draws you *seated* at your desk even while you are standing on
 * the floor — it is your screen you stood up from, and an empty chair reads as
 * having left the building. The two moments where you are visibly in the room
 * instead are the arrival ceremony (slice 3) and desk peeking (slice 6); both
 * vacate the `you` seat and render this actor at a target tile.
 *
 * Extracted from `FloorArrival`'s `ArrivalPlayer` when the second caller
 * arrived. Motion is the shared `useWalkAnimation`, so a peek walk and a
 * first-day walk are the same walk.
 */

import { useRef } from 'react';
import FloorFigure from './FloorFigure.jsx';
import { useWalkAnimation } from './useWalkAnimation.js';
import { YOU_SEAT_ID, depthOf, walkPathBetween } from '../../utils/officeFloorPlan.js';

/**
 * @param {{
 *   from: { x: number, y: number },
 *   to?: { x: number, y: number } | null,
 *   walking?: boolean,
 *   walkKey: string,
 *   onArrive?: () => void,
 *   testId?: string,
 *   children?: import('react').ReactNode
 * }} props `children` ride above the figure inside its anchor (a speech
 *   bubble); changing `walkKey` starts a new walk.
 */
export function FloorPlayer({
  from,
  to = null,
  walking = false,
  walkKey,
  onArrive,
  testId,
  children
}) {
  const ref = useRef(null);
  const path = walking && to ? walkPathBetween(from, to, YOU_SEAT_ID) : [from];

  const { tile, arrived } = useWalkAnimation(ref, path, { walkKey, onArrive });

  return (
    <div
      ref={ref}
      className="office-floor-walker"
      data-testid={testId}
      /* +6 so you are never buried by the desk you just walked past. */
      style={{ zIndex: depthOf(tile.x, tile.y) + 6 }}
    >
      <div className="office-floor-walker-anchor">
        {children}
        <FloorFigure id={YOU_SEAT_ID} accent="var(--accent)" isYou walking={walking && !arrived} />
      </div>
    </div>
  );
}

export default FloorPlayer;
