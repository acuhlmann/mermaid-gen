import { describe, expect, it } from 'vitest';
import {
  FLOOR_PROP_USES,
  isUsableProp,
  propHandsFor,
  propUseFor
} from '../src/utils/officeFloorProps.js';
import { propTileFor, usablePropKinds } from '../src/utils/officeFloorMovement.js';
import { FLOOR_HOLDS } from '../src/utils/officeFloorActivity.js';

describe('officeFloorProps table', () => {
  it('lists walk-up props that the room can actually mark', () => {
    expect(FLOOR_PROP_USES.map((row) => row.kind)).toEqual([
      'coffeeMachine',
      'waterCooler',
      'printer',
      'whiteboard'
    ]);
    // Water cooler has no standable mark today (§6 rule 21) — scenery only.
    expect(usablePropKinds()).toEqual(['coffeeMachine', 'printer', 'whiteboard']);
  });

  it('only coffee duplicates a desk verb', () => {
    expect(propUseFor('coffeeMachine')).toEqual({
      kind: 'coffeeMachine',
      verb: 'coffee',
      hands: 'coffee'
    });
    expect(propUseFor('printer')).toEqual({ kind: 'printer', verb: null, hands: 'papers' });
    expect(isUsableProp('coffeeMachine')).toBe(true);
    expect(isUsableProp('serverRack')).toBe(false);
  });

  it('separates what a prop does from what you walk away holding', () => {
    /*
     * The printer is the row that proves these are two columns and not one: it
     * duplicates no desk verb (ADR-0011 rule 2 — it produces nothing) and still
     * puts something in a hand, because walking back with the printout is how
     * the errand reads from across the room. The whiteboard has neither.
     */
    expect(propUseFor('printer')?.verb).toBeNull();
    expect(propHandsFor('printer')).toBe('papers');
    expect(propHandsFor('coffeeMachine')).toBe('coffee');
    expect(propHandsFor('whiteboard')).toBeNull();
  });

  it('only hands over things HeldItem can actually draw', () => {
    // A hand the art has no case for draws nothing at all, which would read as
    // the feature being broken rather than the prop being empty-handed.
    for (const row of FLOOR_PROP_USES) {
      if (row.hands === null) continue;
      expect(FLOOR_HOLDS, `${row.kind} hands over an undrawable item`).toContain(row.hands);
    }
  });

  it('answers for a prop kind that does not exist', () => {
    // `useFloorWander` asks about whatever kind a trip carries; an unknown one
    // must read back as null rather than undefined (FLOOR_HOLDS has neither,
    // but only one of them survives a strict comparison).
    expect(propHandsFor('teleporter')).toBeNull();
  });

  it('derives usable props from the room — unreachable props are not listed', () => {
    for (const kind of usablePropKinds()) {
      expect(propTileFor(kind), `${kind} has no mark`).not.toBeNull();
    }
    // Water cooler is scenery-only today (§6 rule 21) but still "usable" with null verb.
    expect(propTileFor('waterCooler')).toBeNull();
    expect(propUseFor('waterCooler')?.verb).toBeNull();
  });
});
