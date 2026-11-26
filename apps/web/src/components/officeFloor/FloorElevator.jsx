/**
 * The elevator doors, set into the north-west wall (`features/building/`).
 *
 * Wall art drawn the way the Night Shift kanban is: laid out in a flat local
 * frame (u across, v down) and mapped onto the wall by one SVG matrix, so the
 * doors sit in the wall's own plane rather than floating in front of it. Not a
 * `FLOOR_PROPS` row for the same reason the board is not one — a prop row is
 * an obstacle, a sight-line blocker and a standable-tile veto, and a door in a
 * wall is none of those.
 *
 * The same component hangs on every floor, because it is the same shaft. It
 * reads the building store itself and draws what the car is doing: doors open
 * while you are inside choosing, shut while it moves, an arrow above them
 * while it is going somewhere. Pressing it is `callElevator` and nothing else;
 * the floor you are on answers the call by walking you over.
 */

import { useState, useSyncExternalStore } from 'react';
import { BUILDING_COPY } from '../../features/building/buildingCopy.js';
import { floorButtonLabel, rideDirection } from '../../features/building/officeBuilding.js';
import {
  callElevator,
  getBuildingSnapshot,
  subscribeBuilding
} from '../../features/building/officeBuildingStore.js';
import {
  FLOOR_ELEVATOR,
  STAGE_H,
  STAGE_W,
  TILE_H,
  TILE_W,
  wallPoint
} from '../../utils/officeFloorPlan.js';
import '../../features/building/Building.css';

const SLOPE = -TILE_H / TILE_W;

/** The indicator box above the doors, in stage pixels above the door head. */
const INDICATOR_GAP = 5;
const INDICATOR_H = 17;

/** Door frame + indicator, in the wall's local frame. */
function elevatorFrame() {
  const { axis, t0, t1, h } = FLOOR_ELEVATOR;
  const top = h + INDICATOR_GAP + INDICATOR_H;
  // Read left to right, the doors start at the far end of the wall (t1).
  const origin = wallPoint(axis, t1, top);
  const width = (t1 - t0) * (TILE_W / 2);
  const corners = [
    origin,
    wallPoint(axis, t0, top),
    wallPoint(axis, t0, 0),
    wallPoint(axis, t1, 0)
  ];
  const left = Math.min(...corners.map((p) => p.left));
  const right = Math.max(...corners.map((p) => p.left));
  const boxTop = Math.min(...corners.map((p) => p.top));
  const bottom = Math.max(...corners.map((p) => p.top));
  const clip = `polygon(${corners
    .map((p) => `${(p.left - left).toFixed(1)}px ${(p.top - boxTop).toFixed(1)}px`)
    .join(', ')})`;
  return {
    origin,
    width,
    doorTop: top - h,
    height: top,
    box: { left, top: boxTop, width: right - left, height: bottom - boxTop, clip }
  };
}

/**
 * Whether the doors on *this* floor stand open: you are inside choosing, or
 * the car has just arrived here and is letting you out.
 *
 * @param {import('../../features/building/officeBuildingStore.js').BuildingSnapshot} building
 */
function doorsOpenHere(building) {
  if (building.doorsOpen) return true;
  return building.ride?.phase === 'opening';
}

/**
 * @param {import('../../features/building/officeBuildingStore.js').BuildingSnapshot} building
 * @returns {string} what the indicator reads: the floor, or the way the car is going
 */
function indicatorText(building) {
  const { ride, floor } = building;
  if (ride && ride.phase !== 'opening') {
    return rideDirection(ride.from, ride.to) === 'up' ? '▲' : '▼';
  }
  return floorButtonLabel(floor);
}

/** The car is already answering somebody — you, since there is only you. */
function isBusy(building) {
  return Boolean(building.ride || building.call || building.doorsOpen);
}

/** @param {string} id */
function floorName(id) {
  return BUILDING_COPY.floors[id] ?? id;
}

/**
 * @param {{ interactive?: boolean }} props During the arrival ceremony, or from
 *   a glass-room chair, the doors are scenery.
 */
export function FloorElevator({ interactive = false }) {
  const building = useSyncExternalStore(
    subscribeBuilding,
    getBuildingSnapshot,
    getBuildingSnapshot
  );
  const [lit, setLit] = useState(false);
  const { origin, width, doorTop, height, box } = elevatorFrame();
  const open = doorsOpenHere(building);
  const busy = isBusy(building);
  const leafW = (width - 6) / 2;
  const label = BUILDING_COPY.elevatorAria(floorName(building.floor));

  return (
    <>
      <svg
        className="office-floor-elevator-art"
        width={STAGE_W}
        height={STAGE_H}
        viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
        aria-hidden="true"
        focusable="false"
      >
        <g
          transform={`matrix(1 ${SLOPE} 0 1 ${origin.left} ${origin.top})`}
          data-testid="office-floor-elevator"
          data-open={open ? 'true' : 'false'}
          data-floor={building.floor}
        >
          {/* Indicator: the floor you are on, or the way the car is going. */}
          <rect
            x={width / 2 - 13}
            y={0}
            width="26"
            height={INDICATOR_H - 2}
            rx="2"
            fill="#111827"
            stroke={lit ? '#8ab4ff' : '#4b5563'}
            strokeWidth="1.2"
          />
          <text
            className="office-floor-elevator-indicator"
            x={width / 2}
            y={INDICATOR_H - 5.5}
            textAnchor="middle"
            fontSize="9.5"
            fontWeight="700"
            fill="#fbbf24"
          >
            {indicatorText(building)}
          </text>

          {/* Frame, then the lit car behind the leaves, then the leaves. */}
          <rect
            x="0"
            y={doorTop}
            width={width}
            height={height - doorTop}
            fill="#9aa4b2"
            stroke={lit ? '#8ab4ff' : 'none'}
            strokeWidth="2.5"
          />
          <rect
            x="3"
            y={doorTop + 3}
            width={width - 6}
            height={height - doorTop - 3}
            fill={open ? '#fde68a' : '#374151'}
            className="office-floor-elevator-car"
          />
          <g className={`office-floor-elevator-leaves${open ? ' is-open' : ''}`}>
            <rect
              className="office-floor-elevator-leaf office-floor-elevator-leaf--a"
              x="3"
              y={doorTop + 3}
              width={leafW}
              height={height - doorTop - 3}
              fill="#c3cad5"
              stroke="#7b8596"
              strokeWidth="0.8"
              style={{ transform: `translateX(${open ? -leafW + 3 : 0}px)` }}
            />
            <rect
              className="office-floor-elevator-leaf office-floor-elevator-leaf--b"
              x={3 + leafW}
              y={doorTop + 3}
              width={leafW}
              height={height - doorTop - 3}
              fill="#c3cad5"
              stroke="#7b8596"
              strokeWidth="0.8"
              style={{ transform: `translateX(${open ? leafW - 3 : 0}px)` }}
            />
          </g>
        </g>
      </svg>
      {interactive ? (
        <button
          type="button"
          className="office-floor-elevator-hit"
          style={{
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
            clipPath: box.clip
          }}
          data-testid="office-floor-elevator-call"
          aria-label={label}
          title={label}
          disabled={busy}
          onClick={() => callElevator()}
          onMouseEnter={() => setLit(true)}
          onMouseLeave={() => setLit(false)}
          onFocus={() => setLit(true)}
          onBlur={() => setLit(false)}
        />
      ) : null}
    </>
  );
}

/**
 * The ride itself, over the whole viewport: the view dims as the doors close,
 * holds on the car's indicator while it moves, and lifts as the doors open on
 * the new floor — which has already mounted behind it, so there is no frame
 * where the old floor and the new one are both on screen.
 */
export function FloorElevatorRide() {
  const { ride } = useSyncExternalStore(
    subscribeBuilding,
    getBuildingSnapshot,
    getBuildingSnapshot
  );
  if (!ride) return null;
  const up = rideDirection(ride.from, ride.to) === 'up';
  return (
    <div
      className={`office-floor-elevator-ride is-${ride.phase}`}
      data-testid="office-floor-elevator-ride"
      data-phase={ride.phase}
      aria-hidden="true"
    >
      <div className="office-floor-elevator-ride-panel">
        <span className="office-floor-elevator-ride-arrow">{up ? '▲' : '▼'}</span>
        <span className="office-floor-elevator-ride-floor">{floorButtonLabel(ride.to)}</span>
        <span className="office-floor-elevator-ride-name">{floorName(ride.to)}</span>
      </div>
    </div>
  );
}

export default FloorElevator;
