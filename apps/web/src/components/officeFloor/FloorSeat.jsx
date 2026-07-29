/**
 * One occupied tile: chair, occupant, desk — in that paint order, which is
 * what makes somebody read as *sitting at* a desk rather than standing inside
 * one. Standing cast (Gary, who lives at the fridge) skip the furniture.
 *
 * The occupant is a real `<button>`: on the floor, people are the primary
 * interactive elements, and DOM buttons are exactly why ADR-0011 chose DOM over
 * a canvas — focus rings, tooltips, and hit targets come for free.
 */

import FloorPersonButton from './FloorPersonButton.jsx';
import { DeskFurniture } from './isoArt.jsx';
import { PROP_VIEW, PROP_VIEW_BOX, depthOf, projectIso } from '../../utils/officeFloorPlan.js';

const ART_STYLE = {
  left: PROP_VIEW.minX,
  top: PROP_VIEW.minY,
  width: PROP_VIEW.w,
  height: PROP_VIEW.h
};

function SeatArt({ part, you, look }) {
  return (
    <svg
      className="office-floor-seat-art"
      style={ART_STYLE}
      viewBox={PROP_VIEW_BOX}
      width={PROP_VIEW.w}
      height={PROP_VIEW.h}
      aria-hidden="true"
      focusable="false"
    >
      <DeskFurniture part={part} you={you} look={look} />
    </svg>
  );
}

/**
 * @param {{
 *   seat: { id: string, x: number, y: number, desk: boolean },
 *   name: string,
 *   title: string,
 *   accent: string,
 *   isYou?: boolean,
 *   selected?: boolean,
 *   idleIndex?: number,
 *   vacant?: boolean,
 *   interactive?: boolean,
 *   look?: string,
 *   onSelect: (id: string) => void,
 *   onActivate?: ((id: string) => void) | null
 * }} props `look` is what is on their monitor (`officeDeskWork.js`) — always
 *   drawn, for everyone; walking over is only how you get close enough to read it.
 */
export function FloorSeat({
  seat,
  name,
  title,
  accent,
  isYou = false,
  selected = false,
  idleIndex = 0,
  vacant = false,
  interactive = true,
  speaking = false,
  accessoryOverride = null,
  look,
  onSelect,
  onActivate = null
}) {
  const { left, top } = projectIso(seat.x, seat.y);
  const label = title ? `${name} — ${title}` : name;

  return (
    <div
      className="office-floor-seat"
      data-seat={seat.id}
      data-vacant={vacant ? 'true' : undefined}
      style={{ left, top, zIndex: depthOf(seat.x, seat.y) }}
    >
      {seat.desk ? <SeatArt part="chair" you={isYou} /> : null}

      {/* Up and about: the furniture stays, the person doesn't — an empty desk
          is exactly what should be there. Their *button* goes with them rather
          than staying behind on the chair, which is what keeps one person to one
          hit target however many places they can be (slice 12). */}
      {vacant ? null : (
        <FloorPersonButton
          id={seat.id}
          name={name}
          label={label}
          accent={accent}
          seated={seat.desk}
          selected={selected}
          isYou={isYou}
          speaking={speaking}
          idleIndex={idleIndex}
          accessoryOverride={accessoryOverride}
          /* During the arrival ceremony the cast is scenery, not a menu. */
          disabled={!interactive}
          onSelect={onSelect}
          onActivate={onActivate}
        />
      )}

      {seat.desk ? <SeatArt part="desk" you={isYou} look={look} /> : null}
    </div>
  );
}

export default FloorSeat;
