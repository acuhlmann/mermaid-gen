/**
 * Floor B1, the Machine Room — the second floor of the building, and the first
 * one that is not the open plan (`features/building/`).
 *
 * The night crew live here as racks: one per scheduled routine, lit by what it
 * did last night. It is the same derivation the kanban upstairs draws its
 * notes from (`nightShiftCards`), so the board and the lights can never
 * disagree — and pressing a rack walks you over to read it, with a button
 * that opens the board itself.
 *
 * A floor of its own, drawn on a stage of its own. Nothing here reads the open
 * plan's seats, peeks or commutes, because nobody else comes down: the cast
 * carries on upstairs, and anything that happens there while you are away
 * happens without you. That is why this component owns its own small idea of
 * where you are (`walk`) rather than borrowing `useFloorPresence`, whose
 * every consumer is about the cast.
 *
 * Records nothing and triggers nothing (ADR-0010 consequence #4): reading a
 * rack is looking at something, and the racks themselves are a build-time
 * snapshot of the ledgers.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import FloorElevator from './FloorElevator.jsx';
import FloorFigure from './FloorFigure.jsx';
import { MACHINE_ROOM_PROP_ART, MachineRoomShell, RackArt } from './machineRoomArt.jsx';
import { liveTileOf, useWalkAnimation } from './useWalkAnimation.js';
import { BUILDING_COPY } from '../../features/building/buildingCopy.js';
import {
  MACHINE_ROOM_ELEVATOR_TILE,
  MACHINE_ROOM_PROPS,
  MACHINE_ROOM_RACKS,
  machineRoomPath,
  nearestStandable,
  propFrontTile,
  rackFrontTile
} from '../../features/building/machineRoomPlan.js';
import {
  closeElevatorDoors,
  getBuildingSnapshot,
  openElevatorDoors,
  setBuildingReading,
  subscribeBuilding
} from '../../features/building/officeBuildingStore.js';
import { nightShiftCards } from '../../features/nightShift/nightShiftBoard.js';
import { getNightShiftManifest } from '../../features/nightShift/nightShiftManifest.js';
import {
  PROP_VIEW,
  PROP_VIEW_BOX,
  STAGE_H,
  STAGE_W,
  YOU_SEAT_ID,
  depthOf,
  projectIso,
  unprojectIso
} from '../../utils/officeFloorPlan.js';
import '../../features/building/Building.css';

/** @typedef {{ x: number, y: number }} Tile */
/** @typedef {{ kind: 'rack' | 'prop' | 'elevator', id: string } | null} WalkTarget */

function sameTile(a, b) {
  return Boolean(a && b && a.x === b.x && a.y === b.y);
}

function placeAt(x, y) {
  const { left, top } = projectIso(x, y);
  return { left: left + PROP_VIEW.minX, top: top + PROP_VIEW.minY, zIndex: depthOf(x, y) };
}

function tilePoints(tile) {
  return [
    projectIso(tile.x - 0.5, tile.y - 0.5),
    projectIso(tile.x + 0.5, tile.y - 0.5),
    projectIso(tile.x + 0.5, tile.y + 0.5),
    projectIso(tile.x - 0.5, tile.y + 0.5)
  ]
    .map((p) => `${p.left.toFixed(1)},${p.top.toFixed(1)}`)
    .join(' ');
}

/**
 * Where you are on this floor, and why you walked there. Arrival is the only
 * thing that makes a target count — a rack does not open its card while you
 * are still walking to it, for the reason `speakingId` gives upstairs.
 *
 * @param {{ current: HTMLElement | null }} ref
 */
function useMachineRoomWalk(ref) {
  const [walk, setWalk] = useState(() => ({
    from: MACHINE_ROOM_ELEVATOR_TILE,
    to: MACHINE_ROOM_ELEVATOR_TILE,
    key: 0,
    arrived: true,
    /** @type {WalkTarget} */
    target: null
  }));

  const walkTo = useCallback(
    (/** @type {Tile} */ tile, /** @type {WalkTarget} */ target = null) => {
      setWalk((current) => {
        // Carry on from where an interrupted walk actually got to, not from
        // where it began — the same reason upstairs reads `liveTileOf`.
        const here = nearestStandable(liveTileOf(ref.current) ?? current.to) ?? current.to;
        return { from: here, to: tile, key: current.key + 1, arrived: false, target };
      });
    },
    [ref]
  );

  const arrive = useCallback(() => {
    setWalk((current) => (current.arrived ? current : { ...current, arrived: true }));
  }, []);

  return { walk, walkTo, arrive };
}

/**
 * The floor's click surface: a point on the stage to the nearest standable
 * tile. Sits under every rack and prop, like `FloorRoam` upstairs.
 *
 * @param {{ scale: number, onWalkTo: (tile: Tile) => void }} props
 */
function MachineRoomRoam({ scale, onWalkTo }) {
  const [hover, setHover] = useState(null);
  const tileFrom = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const point = unprojectIso(
      (event.clientX - rect.left) / (scale || 1),
      (event.clientY - rect.top) / (scale || 1)
    );
    return nearestStandable(point);
  };
  return (
    <div
      className="office-floor-roam"
      data-testid="machine-room-roam"
      style={{ width: STAGE_W, height: STAGE_H }}
      aria-hidden="true"
      onClick={(event) => {
        const tile = tileFrom(event);
        if (tile) onWalkTo(tile);
      }}
      onPointerMove={(event) => {
        const tile = tileFrom(event);
        setHover((current) => (sameTile(current, tile) ? current : tile));
      }}
      onPointerLeave={() => setHover(null)}
    >
      {hover ? (
        <svg
          className="office-floor-roam-marker"
          width={STAGE_W}
          height={STAGE_H}
          viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
          aria-hidden="true"
          focusable="false"
        >
          <polygon points={tilePoints(hover)} />
        </svg>
      ) : null}
    </div>
  );
}

/**
 * Answer a call made on this floor: walk to the doors, or open them if you are
 * already stood there — and open them, with a ding, when you arrive.
 *
 * @param {import('../../features/building/officeBuildingStore.js').BuildingSnapshot} building
 * @param {{ to: Tile, arrived: boolean, target: WalkTarget }} walk
 * @param {(tile: Tile, target?: WalkTarget) => void} walkTo
 * @param {((cue: string) => void) | undefined} onFloorCue
 */
function useMachineRoomCall(building, walk, walkTo, onFloorCue) {
  const answered = useRef(0);
  const call = building.floor === 'basement' ? building.call : null;
  useEffect(() => {
    if (!call || answered.current === call.key) return;
    answered.current = call.key;
    if (walk.arrived && sameTile(walk.to, MACHINE_ROOM_ELEVATOR_TILE)) {
      openElevatorDoors();
      return;
    }
    walkTo(MACHINE_ROOM_ELEVATOR_TILE, { kind: 'elevator', id: 'elevator' });
  }, [call, walk.arrived, walk.to, walkTo]);

  useEffect(() => {
    if (!call || !walk.arrived || walk.target?.kind !== 'elevator') return;
    openElevatorDoors();
    onFloorCue?.('elevator');
  }, [call, walk.arrived, walk.target, onFloorCue]);
}

/**
 * One piece of furniture you can walk up to: a button wrapping its art, with
 * the open plan's usable-prop hit rules (only painted pixels take the click).
 *
 * @param {{ x: number, y: number, active: boolean, label: string, testId: string, interactive: boolean, column?: string, onPress: () => void, children: import('react').ReactNode, extraClass?: string }} props
 */
function RoomPiece({
  x,
  y,
  active,
  label,
  testId,
  interactive,
  column,
  onPress,
  children,
  extraClass = ''
}) {
  return (
    <button
      type="button"
      className={`office-floor-prop office-floor-prop--usable${extraClass}${active ? ' is-active' : ''}`}
      style={placeAt(x, y)}
      data-testid={testId}
      data-column={column}
      aria-label={label}
      title={label}
      disabled={!interactive}
      onClick={onPress}
    >
      <svg
        className="office-floor-prop-art"
        viewBox={PROP_VIEW_BOX}
        width={PROP_VIEW.w}
        height={PROP_VIEW.h}
        aria-hidden="true"
        focusable="false"
      >
        {children}
      </svg>
    </button>
  );
}

/**
 * The racks and the rest of the room's furniture.
 *
 * @param {{ cards: Map<string, any>, reading: WalkTarget, interactive: boolean, go: (to: Tile | null, target?: WalkTarget) => void }} props
 */
function MachineRoomFurniture({ cards, reading, interactive, go }) {
  return (
    <>
      {MACHINE_ROOM_RACKS.map((rack) => {
        const card = cards.get(rack.id);
        const column = card?.column ?? 'noShow';
        const name = card?.name ?? rack.id;
        return (
          <RoomPiece
            key={rack.id}
            x={rack.x}
            y={rack.y}
            active={reading?.id === rack.id}
            label={BUILDING_COPY.rackAria(name, BUILDING_COPY.rackColumn[column])}
            testId={`machine-room-rack-${rack.id}`}
            interactive={interactive}
            column={column}
            extraClass=" machine-room-rack"
            onPress={() => go(rackFrontTile(rack.id), { kind: 'rack', id: rack.id })}
          >
            <RackArt column={column} emoji={card?.emoji} name={name} />
          </RoomPiece>
        );
      })}
      {MACHINE_ROOM_PROPS.map((prop) => {
        const Art = MACHINE_ROOM_PROP_ART[prop.kind];
        return (
          <RoomPiece
            key={prop.kind}
            x={prop.x}
            y={prop.y}
            active={reading?.id === prop.kind}
            label={BUILDING_COPY.props[prop.kind]}
            testId={`machine-room-prop-${prop.kind}`}
            interactive={interactive}
            onPress={() => go(propFrontTile(prop.kind), { kind: 'prop', id: prop.kind })}
          >
            <Art />
          </RoomPiece>
        );
      })}
    </>
  );
}

/**
 * @param {{
 *   scale: number,
 *   interactive?: boolean,
 *   onFloorCue?: (cue: string, options?: object) => void
 * }} props `interactive` off is the room as scenery — the same switch the open
 *   plan's furniture follows during a glass-room sync.
 */
export function MachineRoom({ scale, interactive = true, onFloorCue }) {
  const building = useSyncExternalStore(
    subscribeBuilding,
    getBuildingSnapshot,
    getBuildingSnapshot
  );
  const playerRef = useRef(null);
  const { walk, walkTo, arrive } = useMachineRoomWalk(playerRef);
  const manifest = getNightShiftManifest();
  const cards = useMemo(() => new Map(nightShiftCards(manifest).map((c) => [c.id, c])), [manifest]);

  const path = useMemo(() => machineRoomPath(walk.from, walk.to), [walk.from, walk.to]);
  const { tile } = useWalkAnimation(playerRef, path, {
    walkKey: `b1-${walk.key}`,
    onArrive: arrive,
    onLeg: () => onFloorCue?.('step', { near: true, surface: 'hard', pan: 0 })
  });

  // Walking anywhere but the doors lets the car go.
  const go = useCallback(
    (/** @type {Tile | null} */ to, /** @type {WalkTarget} */ target = null) => {
      if (!to) return;
      if (target?.kind !== 'elevator') closeElevatorDoors();
      walkTo(to, target);
    },
    [walkTo]
  );

  useMachineRoomCall(building, walk, walkTo, onFloorCue);

  // What you are looking at goes to the card slot, outside this stage, where
  // there is room for its words on every viewport.
  const arrivedAt = walk.arrived && walk.target?.kind !== 'elevator' ? walk.target : null;
  useEffect(() => {
    setBuildingReading(arrivedAt);
  }, [arrivedAt]);
  useEffect(() => () => setBuildingReading(null), []);
  const reading = building.reading;

  return (
    <div
      className="office-floor-stage machine-room-stage"
      data-testid="machine-room"
      style={{ width: STAGE_W * scale, height: STAGE_H * scale }}
    >
      <div
        className="office-floor-stage-inner"
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}
        role="group"
        aria-label={BUILDING_COPY.floors.basement}
      >
        <MachineRoomShell signage={BUILDING_COPY.signage} />
        {interactive ? <MachineRoomRoam scale={scale} onWalkTo={(to) => go(to)} /> : null}
        <FloorElevator interactive={interactive} />

        <MachineRoomFurniture cards={cards} reading={reading} interactive={interactive} go={go} />

        <div
          ref={playerRef}
          className="office-floor-walker"
          data-testid="machine-room-you"
          style={{ zIndex: depthOf(tile.x, tile.y) + 6 }}
        >
          <div className="office-floor-walker-anchor">
            <FloorFigure id={YOU_SEAT_ID} accent="var(--accent)" isYou walking={!walk.arrived} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default MachineRoom;
