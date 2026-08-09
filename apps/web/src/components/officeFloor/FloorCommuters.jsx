/**
 * People on their way to a moment, and on their way back from one
 * (§ 5 slice 17).
 *
 * The quietest actors on the floor after the wanderer, and for the same reason:
 * a commuter says nothing, carries no card, and is announced nowhere. Slice 11
 * settled that ambient traffic has nothing to say, and somebody walking back
 * from a coffee break is ambient traffic — the *break* was the event, and it has
 * already been narrated by the surface that owned it.
 *
 * Fourth caller of `useWalkAnimation`, after `FloorWalker`, `FloorPlayer` and
 * `FloorWanderer`. `FloorWanderer`'s header calls a fourth "the moment to
 * collapse them"; this one deliberately does **not** collapse them yet, because
 * the four differ in what they wrap the shared ten lines around (a bubble with
 * actions, a ref the camera follows, a person button, and — here — nothing at
 * all), and the honest shared part is smaller than the wrapper that would hide
 * it. § 8 carries the debt with the count now at four.
 */

import { useRef } from 'react';
import FloorFigure from './FloorFigure.jsx';
import { useWalkAnimation } from './useWalkAnimation.js';
import { depthOf, walkPathBetween } from '../../utils/officeFloorPlan.js';
import { officeSenderInfo } from '../../utils/officeCast.js';
import { floorActivityFor } from '../../utils/officeFloorActivity.js';

/**
 * @param {{
 *   commute: import('../../utils/officeFloorCommute.js').Commute,
 *   onArrive: (id: string) => void,
 *   onStep?: (tile: { x: number, y: number }, isYou?: boolean) => void
 * }} props
 */
function FloorCommuter({ commute, onArrive, onStep }) {
  const ref = useRef(null);
  const { id, from, to, phase, hands, trip } = commute;
  const path = walkPathBetween(from, to, id);

  const { tile, arrived } = useWalkAnimation(ref, path, {
    /* `trip` is in the key, not just the phase: a walk that is turned round
       mid-stride is a *new* walk from the same person between the same two
       tiles, and a key that did not change would resume the old one. */
    walkKey: `commute:${id}:${trip}`,
    onArrive: () => onArrive(id),
    onLeg: onStep ? (legTile) => onStep(legTile, false) : undefined
  });

  const sender = officeSenderInfo(id);

  return (
    <div
      ref={ref}
      className="office-floor-walker"
      data-testid="office-floor-commuter"
      data-commuter={id}
      data-commute-phase={phase}
      /* +5 like every other travelling figure, so they pass in front of the
         desks they walk past rather than through them. */
      style={{ zIndex: depthOf(tile.x, tile.y) + 5 }}
    >
      <div className="office-floor-walker-anchor">
        <FloorFigure
          id={id}
          accent={sender?.accentColor ?? 'var(--accent)'}
          /*
           * The hand is the whole reason a walk home reads as *coming back from
           * something* rather than as pacing — the finding slice 11's wanderer
           * errand already paid for. It only applies on the way back: you walk
           * to the machine empty-handed.
           */
          activity={floorActivityFor(id, {
            moving: true,
            carrying: phase === 'home' ? hands : null
          })}
          walking={!arrived}
        />
      </div>
    </div>
  );
}

/**
 * @param {{
 *   commuters: import('../../utils/officeFloorCommute.js').Commute[],
 *   onArrive: (id: string) => void,
 *   onStep?: (tile: { x: number, y: number }, isYou?: boolean) => void
 * }} props
 */
export function FloorCommuters({ commuters, onArrive, onStep }) {
  if (!commuters?.length) return null;
  return (
    <>
      {commuters.map((commute) => (
        <FloorCommuter key={commute.id} commute={commute} onArrive={onArrive} onStep={onStep} />
      ))}
    </>
  );
}

export default FloorCommuters;
