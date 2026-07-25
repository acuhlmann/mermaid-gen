/**
 * The scaled stage: the room, then every prop and person positioned by
 * `projectIso` and ordered by `depthOf`. Extracted from OfficeFloor so the view
 * component stays about *view* concerns (scale, chrome, selection) and this one
 * is purely "put the office on the stage".
 */

import FloorRoom, { FloorZoneLabels } from './FloorRoom.jsx';
import FloorSeat from './FloorSeat.jsx';
import FloorWalker from './FloorWalker.jsx';
import { FloorPropArt } from './isoArt.jsx';
import {
  FLOOR_PROPS,
  FLOOR_SEATS,
  PROP_VIEW,
  PROP_VIEW_BOX,
  STAGE_H,
  STAGE_W,
  YOU_SEAT_ID,
  depthOf,
  projectIso,
  seatFor
} from '../../utils/officeFloorPlan.js';
import { officeSenderInfo } from '../../utils/officeCast.js';

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
 *   walker?: { id: string, colleagueId: string } | null,
 *   walkerDeparting?: boolean,
 *   onWalkerAdopt?: (prompt: string, colleagueId: string) => void,
 *   onWalkerDismiss?: (id: string) => void,
 *   onWalkerDeparted?: () => void,
 *   vacantIds?: string[],
 *   interactive?: boolean,
 *   children?: import('react').ReactNode
 * }} props `children` are extra actors placed in stage coordinates (the
 *   arrival ceremony puts you and its spotlight there).
 */
export function FloorStage({
  scale,
  copy,
  selectedId,
  onSelect,
  walker = null,
  walkerDeparting = false,
  onWalkerAdopt,
  onWalkerDismiss,
  onWalkerDeparted,
  vacantIds = [],
  interactive = true,
  speakingId = null,
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

        {FLOOR_PROPS.map((prop, index) => {
          const { left, top } = projectIso(prop.x, prop.y);
          return (
            <svg
              key={`${prop.kind}-${index}`}
              className="office-floor-prop"
              style={{
                left: left + PROP_VIEW.minX,
                top: top + PROP_VIEW.minY,
                zIndex: depthOf(prop.x, prop.y)
              }}
              viewBox={PROP_VIEW_BOX}
              width={PROP_VIEW.w}
              height={PROP_VIEW.h}
              aria-hidden="true"
              focusable="false"
            >
              <FloorPropArt kind={prop.kind} span={prop.span} axis={prop.axis} />
            </svg>
          );
        })}

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
            onSelect={onSelect}
          />
        ))}

        {walker ? (
          <FloorWalker
            key={walker.id}
            walkBy={walker}
            departing={walkerDeparting}
            scale={scale}
            onAdopt={onWalkerAdopt}
            onDismiss={onWalkerDismiss}
            onDeparted={onWalkerDeparted}
          />
        ) : null}

        {children}

        <FloorZoneLabels zoneLabels={copy.zones ?? {}} />
      </div>
    </div>
  );
}

export default FloorStage;
