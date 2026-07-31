/**
 * The scaled stage: the room, then every prop and person positioned by
 * `projectIso` and ordered by `depthOf`. Extracted from OfficeFloor so the view
 * component stays about *view* concerns (scale, chrome, selection) and this one
 * is purely "put the office on the stage".
 */

import FloorProps from './FloorProps.jsx';
import FloorRoam from './FloorRoam.jsx';
import FloorRoom, { FloorZoneLabels } from './FloorRoom.jsx';
import FloorSeat from './FloorSeat.jsx';
import FloorWalker from './FloorWalker.jsx';
import {
  FLOOR_SEATS,
  STAGE_H,
  STAGE_W,
  YOU_SEAT_ID,
  seatFor
} from '../../utils/officeFloorPlan.js';
import { officeSenderInfo } from '../../utils/officeCast.js';
import { deskWorkFor } from '../../utils/officeDeskWork.js';

/**
 * Display fields for one seat. The player is in no cast bank, so their row
 * comes from the floor copy instead.
 */
function seatDisplay(seat, copy) {
  if (seat.id === YOU_SEAT_ID) {
    return { name: copy.youName, title: copy.youTitle, accent: 'var(--accent)', isYou: true };
  }
  const sender = officeSenderInfo(seat.id);
  return {
    name: sender?.name ?? seat.id,
    title: sender?.title ?? '',
    accent: sender?.accentColor ?? 'var(--accent)',
    isYou: false
  };
}

/**
 * @param {{
 *   scale: number,
 *   copy: Record<string, any>,
 *   selectedId: string | null,
 *   onSelect: (id: string) => void,
 *   onActivate?: ((id: string) => void) | null,
 *   walker?: { id: string, colleagueId: string } | null,
 *   walkerDeparting?: boolean,
 *   walkerHideBody?: boolean,
 *   onWalkerAdopt?: (prompt: string, colleagueId: string) => void,
 *   onWalkerDismiss?: (id: string) => void,
 *   onWalkerDeparted?: () => void,
 *   onStep?: (tile: { x: number, y: number }, isYou?: boolean) => void,
 *   vacantIds?: string[],
 *   onCallIds?: string[],
 *   interactive?: boolean,
 *   onWalkTo?: ((tile: { x: number, y: number }) => void) | null,
 *   roamOrigin?: { x: number, y: number } | null,
 *   onUseProp?: ((kind: string) => void) | null,
 *   activePropKind?: string | null,
 *   children?: import('react').ReactNode
 * }} props `children` are extra actors placed in stage coordinates (the
 *   arrival ceremony puts you and its spotlight there). Passing `onWalkTo`
 *   makes the floor itself walkable (slice 7); passing `onUseProp` makes its
 *   furniture usable (slice 9).
 */
export function FloorStage({
  scale,
  copy,
  selectedId,
  onSelect,
  onActivate = null,
  walker = null,
  walkerDeparting = false,
  walkerHideBody = false,
  onWalkerAdopt,
  onWalkerDismiss,
  onWalkerDeparted,
  onStep,
  vacantIds = [],
  onCallIds = [],
  interactive = true,
  speakingId = null,
  onWalkTo = null,
  roamOrigin = null,
  onUseProp = null,
  activePropKind = null,
  children
}) {
  return (
    <div className="office-floor-stage" style={{ width: STAGE_W * scale, height: STAGE_H * scale }}>
      <div
        className="office-floor-stage-inner"
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}
        role="group"
        aria-label={copy.stageAria}
      >
        <FloorRoom youTile={seatFor(YOU_SEAT_ID)} />

        {/* Under everything that paints (lowest prop depth is 20), so people
            keep their clicks and only bare floor reaches it. During the
            arrival ceremony the room is scenery, not a place you may wander. */}
        {interactive && onWalkTo ? (
          <FloorRoam scale={scale} origin={roamOrigin} onWalkTo={onWalkTo} />
        ) : null}

        <FloorProps
          copy={copy}
          interactive={interactive}
          onUseProp={onUseProp}
          activeKind={activePropKind}
        />

        {FLOOR_SEATS.map((seat, index) => (
          <FloorSeat
            key={seat.id}
            seat={seat}
            {...seatDisplay(seat, copy)}
            selected={selectedId === seat.id}
            idleIndex={index}
            // Whoever is up and about is drawn as their own actor instead — two
            // of them at once would give the game away. Their desk stays put.
            vacant={(walker && seat.id === walker.colleagueId) || vacantIds.includes(seat.id)}
            interactive={interactive}
            speaking={speakingId === seat.id}
            accessoryOverride={onCallIds.includes(seat.id) ? 'headset' : null}
            look={deskWorkFor(seat.id)?.look}
            onSelect={onSelect}
            onActivate={onActivate}
          />
        ))}

        {walker ? (
          <FloorWalker
            key={walker.id}
            walkBy={walker}
            departing={walkerDeparting}
            scale={scale}
            hideBody={walkerHideBody}
            onAdopt={onWalkerAdopt}
            onDismiss={onWalkerDismiss}
            onDeparted={onWalkerDeparted}
            onStep={onStep}
          />
        ) : null}

        {children}

        <FloorZoneLabels zoneLabels={copy.zones ?? {}} />
      </div>
    </div>
  );
}

export default FloorStage;
