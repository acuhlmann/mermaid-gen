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
import FloorWallClock from './FloorWallClock.jsx';
import {
  FLOOR_SEATS,
  STAGE_H,
  STAGE_W,
  YOU_SEAT_ID,
  isWithinNameChipRange,
  seatFor
} from '../../utils/officeFloorPlan.js';
import { officeSenderInfo } from '../../utils/officeCast.js';
import { deskWorkFor } from '../../utils/officeDeskWork.js';
import { floorActivityFor } from '../../utils/officeFloorActivity.js';

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
 * Whether one seat's name chip lights up (slice 15). Proximity is who is near
 * *you* — never your own seat, since you follow yourself around the room and
 * a self-chip would light up wherever you wandered.
 */
function nearbySeat(youTile, seat) {
  return seat.id !== YOU_SEAT_ID && isWithinNameChipRange(youTile, seat);
}

/**
 * What the occupant of one chair is visibly doing.
 *
 * Two of the three inputs are **yours and nobody else's**: the Headphones
 * posture is a preference, and a coffee is a set piece you are in. A colleague
 * in a coffee break is being drawn by whatever claimed them (§ 6 rule 5), so
 * their cup arrives from there rather than from here.
 */
function seatActivity(seatId, { onCallIds, headphones, youHolding, dayPhase }) {
  const isYou = seatId === YOU_SEAT_ID;
  return floorActivityFor(seatId, {
    onCall: onCallIds.includes(seatId),
    headphones: isYou && headphones,
    coffee: isYou && youHolding === 'coffee',
    // The one input here that is nobody's in particular: the hour belongs to
    // the room, so every chair gets the same one (slice 20).
    dayPhase
  });
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
 *   headphones?: boolean,
 *   youHolding?: string | null,
 *   interactive?: boolean,
 *   onWalkTo?: ((tile: { x: number, y: number }) => void) | null,
 *   roamOrigin?: { x: number, y: number } | null,
 *   youTile?: { x: number, y: number } | null,
 *   onUseProp?: ((kind: string) => void) | null,
 *   activePropKind?: string | null,
 *   board?: import('../../utils/officeFloorBoard.js').BoardState | null,
 *   children?: import('react').ReactNode
 * }} props `children` are extra actors placed in stage coordinates (the
 *   arrival ceremony puts you and its spotlight there). Passing `onWalkTo`
 *   makes the floor itself walkable (slice 7); passing `onUseProp` makes its
 *   furniture usable (slice 9). `youTile` is where you are standing, so a
 *   seat within a tile of you can light its name chip (slice 15).
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
  // No defaults, for the reason `FloorActors` records: `seatActivity` treats
  // both as falsy-or-not, so `= false` / `= null` would buy nothing but a
  // branch each against a complexity budget this component is already over.
  headphones,
  youHolding,
  onWalkTo = null,
  roamOrigin = null,
  youTile,
  onUseProp = null,
  activePropKind = null,
  // No default, same reason as `headphones` above: it is read for truthiness by
  // three surfaces that each already handle its absence.
  board,
  // Ditto — `floorActivityFor` defaults it to null itself.
  dayPhase,
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

        {/* The wall clock hangs on the wall the room SVG just drew — right
            after it, so everything walkable paints over it. It reads the
            instant the day-phase dial reads, so the hands and the light can
            never disagree (slice 25). */}
        <FloorWallClock />

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
          board={board}
        />

        {FLOOR_SEATS.map((seat, index) => (
          <FloorSeat
            key={seat.id}
            seat={seat}
            {...seatDisplay(seat, copy)}
            selected={selectedId === seat.id}
            // Slice 15: the room shows you who is near — a chip lights up
            // within a tile of wherever you are standing, hit box untouched.
            nearby={nearbySeat(youTile, seat)}
            idleIndex={index}
            // Whoever is up and about is drawn as their own actor instead — two
            // of them at once would give the game away. Their desk stays put.
            vacant={(walker && seat.id === walker.colleagueId) || vacantIds.includes(seat.id)}
            interactive={interactive}
            speaking={speakingId === seat.id}
            onCall={onCallIds.includes(seat.id)}
            activity={seatActivity(seat.id, { onCallIds, headphones, youHolding, dayPhase })}
            look={deskWorkFor(seat.id)?.look}
            board={board}
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
