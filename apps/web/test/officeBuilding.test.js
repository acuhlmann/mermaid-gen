import { afterEach, describe, expect, it } from 'vitest';
import {
  BUILDING_FLOORS,
  elevatorButtonsFor,
  rideDirection
} from '../src/features/building/officeBuilding.js';
import {
  advanceElevatorRide,
  callElevator,
  closeElevatorDoors,
  getBuildingSnapshot,
  isElevatorCardShown,
  openElevatorDoors,
  resetBuildingForTests,
  returnToHomeFloor,
  rideElevatorTo
} from '../src/features/building/officeBuildingStore.js';
import {
  MACHINE_ROOM_ELEVATOR_TILE,
  MACHINE_ROOM_PROPS,
  MACHINE_ROOM_RACKS,
  isMachineRoomStandable,
  machineRoomPath,
  propFrontTile,
  rackFrontTile
} from '../src/features/building/machineRoomPlan.js';
import { NIGHT_SHIFT_CREW } from '../src/utils/nightShiftLedger.js';
import {
  ELEVATOR_TILE,
  FLOOR_ELEVATOR,
  FLOOR_NIGHT_SHIFT_BOARD,
  FLOOR_WALL_CLOCK,
  WALL_H,
  YOU_SEAT_ID,
  isStandableTile,
  pathCrossesGlass,
  seatFor,
  walkPathBetween
} from '../src/utils/officeFloorPlan.js';
import { isSummoned } from '../src/components/officeFloor/useFloorBuilding.js';

afterEach(() => resetBuildingForTests());

describe('the elevator panel', () => {
  it('lists every floor top first, with where you are marked', () => {
    const buttons = elevatorButtonsFor({ current: 'office', level: 1 });
    expect(buttons.map((b) => b.button)).toEqual(['4', '3', 'B1']);
    expect(buttons.find((b) => b.id === 'office').state).toBe('current');
    expect(buttons.find((b) => b.id === 'basement').state).toBe('go');
  });

  it('locks leadership below Chief Slopitect Officer, and is still fitting it out above', () => {
    const below = elevatorButtonsFor({ current: 'office', level: 9 });
    expect(below.find((b) => b.id === 'leadership')).toMatchObject({
      state: 'locked',
      minLevel: 10
    });
    const at = elevatorButtonsFor({ current: 'office', level: 10 });
    expect(at.find((b) => b.id === 'leadership').state).toBe('fitOut');
  });

  it('knows which way the car is going', () => {
    expect(rideDirection('office', 'basement')).toBe('down');
    expect(rideDirection('basement', 'office')).toBe('up');
    expect(rideDirection('office', 'office')).toBeNull();
    expect(rideDirection('office', 'roof')).toBeNull();
  });

  it('has exactly one floor that is home', () => {
    expect(BUILDING_FLOORS.filter((f) => f.id === 'office')).toHaveLength(1);
  });
});

describe('the elevator store', () => {
  it('goes call → doors → ride → new floor, one beat at a time', () => {
    callElevator();
    expect(getBuildingSnapshot().call).toMatchObject({ floor: 'office' });
    expect(isElevatorCardShown()).toBe(true);

    openElevatorDoors();
    expect(getBuildingSnapshot()).toMatchObject({ call: null, doorsOpen: true });

    expect(rideElevatorTo('basement')).toBe(true);
    expect(getBuildingSnapshot().ride).toMatchObject({
      from: 'office',
      to: 'basement',
      phase: 'closing'
    });

    advanceElevatorRide();
    expect(getBuildingSnapshot()).toMatchObject({ floor: 'office', ride: { phase: 'moving' } });
    advanceElevatorRide();
    // The floor changes behind closed doors, before they open.
    expect(getBuildingSnapshot()).toMatchObject({ floor: 'basement', ride: { phase: 'opening' } });
    advanceElevatorRide();
    expect(getBuildingSnapshot()).toMatchObject({
      floor: 'basement',
      ride: null,
      doorsOpen: false
    });
    // Standing in the Machine Room is itself a reason for the card.
    expect(isElevatorCardShown()).toBe(true);
  });

  it('refuses a ride nobody could have asked for', () => {
    expect(rideElevatorTo('basement')).toBe(false); // doors shut
    callElevator();
    openElevatorDoors();
    expect(rideElevatorTo('office')).toBe(false); // already here
    expect(rideElevatorTo('roof')).toBe(false); // no such floor
    expect(getBuildingSnapshot().ride).toBeNull();
  });

  it('ignores the call button while the car is busy', () => {
    callElevator();
    openElevatorDoors();
    rideElevatorTo('basement');
    const before = getBuildingSnapshot();
    callElevator();
    expect(getBuildingSnapshot()).toBe(before);
  });

  it('lets the car go when you close the doors', () => {
    callElevator();
    closeElevatorDoors();
    expect(getBuildingSnapshot()).toMatchObject({ call: null, doorsOpen: false });
    expect(isElevatorCardShown()).toBe(false);
  });

  it('comes straight home without a ride, and is a no-op when already home', () => {
    callElevator();
    openElevatorDoors();
    rideElevatorTo('basement');
    advanceElevatorRide();
    advanceElevatorRide();
    returnToHomeFloor();
    expect(getBuildingSnapshot()).toMatchObject({
      floor: 'office',
      call: null,
      doorsOpen: false,
      ride: null
    });
    const home = getBuildingSnapshot();
    returnToHomeFloor();
    expect(getBuildingSnapshot()).toBe(home);
  });
});

describe('the elevator on the open plan', () => {
  it('stands on a tile you can reach from your desk without crossing glass', () => {
    expect(isStandableTile(ELEVATOR_TILE)).toBe(true);
    const you = seatFor(YOU_SEAT_ID);
    expect(pathCrossesGlass(walkPathBetween(you, ELEVATOR_TILE, YOU_SEAT_ID))).toBe(false);
  });

  it('fits in the wall and keeps clear of the clock and the kanban', () => {
    expect(FLOOR_ELEVATOR.axis).toBe(FLOOR_WALL_CLOCK.axis);
    // Clock face in tiles along the wall: r px over ~62.6 px per tile.
    const clockHalf = FLOOR_WALL_CLOCK.r / Math.hypot(56, 28);
    expect(FLOOR_ELEVATOR.t1).toBeLessThan(FLOOR_WALL_CLOCK.t - clockHalf);
    expect(FLOOR_ELEVATOR.t1).toBeLessThan(FLOOR_NIGHT_SHIFT_BOARD.t0);
    expect(FLOOR_ELEVATOR.t0).toBeGreaterThan(0);
    // The door, its indicator and their gap fit under the ceiling line.
    expect(FLOOR_ELEVATOR.h + 22).toBeLessThan(WALL_H);
  });

  it('is in front of the doors', () => {
    const middle = -0.5 + (FLOOR_ELEVATOR.t0 + FLOOR_ELEVATOR.t1) / 2;
    expect(Math.abs(ELEVATOR_TILE.y - middle)).toBeLessThan(0.5);
  });
});

describe('the Machine Room plan', () => {
  it('racks every crew member once, in night-ladder order', () => {
    expect(MACHINE_ROOM_RACKS.map((r) => r.id)).toEqual(NIGHT_SHIFT_CREW.map((c) => c.id));
    const tiles = new Set(MACHINE_ROOM_RACKS.map((r) => `${r.x},${r.y}`));
    expect(tiles.size).toBe(MACHINE_ROOM_RACKS.length);
  });

  it('leaves the elevator tile free — it is the same shaft as upstairs', () => {
    expect(MACHINE_ROOM_ELEVATOR_TILE).toEqual(ELEVATOR_TILE);
    expect(isMachineRoomStandable(MACHINE_ROOM_ELEVATOR_TILE)).toBe(true);
  });

  it('lets you walk from the elevator to the front of every rack and prop', () => {
    const marks = [
      ...MACHINE_ROOM_RACKS.map((rack) => rackFrontTile(rack.id)),
      ...MACHINE_ROOM_PROPS.map((prop) => propFrontTile(prop.kind))
    ];
    for (const mark of marks) {
      expect(mark).not.toBeNull();
      const path = machineRoomPath(MACHINE_ROOM_ELEVATOR_TILE, mark);
      expect(path.at(-1)).toEqual(mark);
    }
  });

  it('walks round the racks, never through them', () => {
    const from = MACHINE_ROOM_ELEVATOR_TILE;
    const to = rackFrontTile(MACHINE_ROOM_RACKS.at(-1).id);
    const corners = machineRoomPath(from, to);
    for (let leg = 1; leg < corners.length; leg += 1) {
      const a = corners[leg - 1];
      const b = corners[leg];
      // Each leg is a straight run along one axis…
      expect(a.x === b.x || a.y === b.y).toBe(true);
      // …and every tile on it is floor.
      const steps = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
      for (let i = 0; i <= steps; i += 1) {
        const tile = {
          x: a.x + Math.sign(b.x - a.x) * i,
          y: a.y + Math.sign(b.y - a.y) * i
        };
        expect(isMachineRoomStandable(tile)).toBe(true);
      }
    }
  });

  it('stands still when there is no route, rather than walking through a wall', () => {
    const rack = MACHINE_ROOM_RACKS[0];
    expect(machineRoomPath(MACHINE_ROOM_ELEVATOR_TILE, { x: rack.x, y: rack.y })).toEqual([
      MACHINE_ROOM_ELEVATOR_TILE
    ]);
  });
});

describe('what brings you back upstairs', () => {
  it('is something you agreed to, and nothing else', () => {
    expect(isSummoned({})).toBe(false);
    expect(isSummoned({ coffee: { accepted: false }, battle: { accepted: false } })).toBe(false);
    expect(isSummoned({ physicalMeeting: true })).toBe(true);
    expect(isSummoned({ huddle: { id: 'h' } })).toBe(true);
    expect(isSummoned({ coffee: { accepted: true } })).toBe(true);
    expect(isSummoned({ battle: { accepted: true } })).toBe(true);
  });
});
