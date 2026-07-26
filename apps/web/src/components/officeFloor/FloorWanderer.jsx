/**
 * A colleague who has got up for a minute (slice 11).
 *
 * The quietest actor on the floor: a figure, a path, and nothing else. No
 * bubble, no card, no click target — an ambient wanderer is scenery that moves,
 * and giving it an affordance would make it a feature (`office-parody.md` § 11).
 * You can still walk up to them where they are stood, because *that* goes
 * through the person card and their own seat, which is where their identity
 * lives.
 *
 * Third caller of `useWalkAnimation`, after `FloorWalker` (a colleague coming
 * to bother you) and `FloorPlayer` (you). The three share about ten lines —
 * a positioned wrapper, a depth, an anchor — and differ in everything they wrap
 * it around, so they stay three files. A fourth would be the moment to collapse
 * them.
 */

import { useRef } from 'react';
import FloorFigure from './FloorFigure.jsx';
import { useWalkAnimation } from './useWalkAnimation.js';
import { depthOf, walkPathBetween } from '../../utils/officeFloorPlan.js';
import { officeSenderInfo } from '../../utils/officeCast.js';

/**
 * @param {{
 *   wanderer: {
 *     seatId: string,
 *     from: { x: number, y: number },
 *     to: { x: number, y: number },
 *     phase: 'out' | 'dwell' | 'home',
 *     leg: number
 *   },
 *   onArrive?: () => void,
 *   elementRef?: { current: HTMLElement | null }
 * }} props `elementRef` lets the hook read where they actually got to when a
 *   trip is turned round mid-stride (`liveTileOf`), exactly as free roam does
 *   for you.
 */
export function FloorWanderer({ wanderer, onArrive, elementRef }) {
  const ownRef = useRef(null);
  const ref = elementRef ?? ownRef;
  const { seatId, from, to, leg } = wanderer;
  const path = walkPathBetween(from, to, seatId);

  const { tile, arrived } = useWalkAnimation(ref, path, {
    walkKey: `wander:${seatId}:${leg}`,
    onArrive
  });

  const sender = officeSenderInfo(seatId);

  return (
    <div
      ref={ref}
      className="office-floor-walker"
      data-testid="office-floor-wanderer"
      data-wanderer={seatId}
      /* +5 like every other travelling figure, so they pass in front of the
         desk they are walking past rather than through it. */
      style={{ zIndex: depthOf(tile.x, tile.y) + 5 }}
    >
      <div className="office-floor-walker-anchor">
        <FloorFigure
          id={seatId}
          accent={sender?.accentColor ?? 'var(--accent)'}
          walking={!arrived}
        />
      </div>
    </div>
  );
}

export default FloorWanderer;
