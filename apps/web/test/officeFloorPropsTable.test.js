import { describe, expect, it } from 'vitest';
import { FLOOR_PROP_USES, isUsableProp, propUseFor } from '../src/utils/officeFloorProps.js';
import { propTileFor, usablePropKinds } from '../src/utils/officeFloorMovement.js';

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
    expect(propUseFor('coffeeMachine')).toEqual({ kind: 'coffeeMachine', verb: 'coffee' });
    expect(propUseFor('printer')).toEqual({ kind: 'printer', verb: null });
    expect(isUsableProp('coffeeMachine')).toBe(true);
    expect(isUsableProp('serverRack')).toBe(false);
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
