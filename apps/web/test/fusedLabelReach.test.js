import { describe, expect, it } from 'vitest';

import { clampLabelReach } from '../src/components/metaphorScenes/fusedLabelReach.js';

// The visual rule this module holds is ownership, not distance: after the cap,
// every name must still be nearer to the body it names than to any other
// body. The distance a name keeps is whatever the gap to the nearest
// neighbour allows (0.45 of it) — including distances under the 0.85 reach
// floor `makeNodes` documents. That collapse is a decision, not an oversight;
// #540 laid out both options and this suite pins the one that was made.

const reachOf = (node) => Math.hypot(node.labelOffset[0], node.labelOffset[2]);

function assertOwned(node, others) {
  const own = reachOf(node);
  for (const other of others) {
    const away = Math.hypot(
      other.position[0] - node.position[0] - node.labelOffset[0],
      other.position[2] - node.position[2] - node.labelOffset[2]
    );
    expect(away).toBeGreaterThan(own);
  }
}

describe('clampLabelReach', () => {
  it('caps a name at 0.45 of the gap to its nearest neighbour', () => {
    const bodies = [
      { id: 'far-side', position: [0, 0, 0], labelOffset: [2, 0, 0] },
      { id: 'neighbour', position: [4.2, 0, 0], labelOffset: [0.1, 0, 0.1] }
    ];
    clampLabelReach(bodies);
    // gap 4.2 -> limit 1.89; the 2.10-unit reach of the `artist-check-in`
    // measurement that motivated #530 lands inside it untouched.
    expect(reachOf(bodies[0])).toBeCloseTo(1.89, 10);
  });

  it('leaves a reach already inside the share alone', () => {
    const bodies = [
      { id: 'roomy', position: [0, 0, 0], labelOffset: [1.5, 0, 0] },
      { id: 'neighbour', position: [10, 0, 0], labelOffset: [1.5, 0, 0] }
    ];
    clampLabelReach(bodies);
    expect(reachOf(bodies[0])).toBeCloseTo(1.5, 10);
    expect(reachOf(bodies[1])).toBeCloseTo(1.5, 10);
  });

  it('keeps a lone landmark at full reach — nothing to be mistaken for', () => {
    const bodies = [{ id: 'alone', position: [0, 0, 0], labelOffset: [3, 0, 4] }];
    clampLabelReach(bodies);
    expect(reachOf(bodies[0])).toBeCloseTo(5, 10);
  });

  // #540: the deliberate collapse. `bread-enters` and `coil-hesitates` sit
  // 0.18 apart on `recollection-loop` in the shipped sentient-toaster fixture,
  // and the station bearing walks each name 0.72 out from its own site centre
  // — which is what drags `bread-enters`'s name across `coil-hesitates`. The
  // cap collapses the reach to 0.081, far under the 0.85 landmark floor.
  // Preserving 0.85 there would put both names back in one screen slot —
  // #519's measured failure, and the declutter then drops one of them.
  // Parking a name near its own body is the lesser evil, so the cap is the
  // floor's master. This test pins that subordination: raise the cap above
  // this distance, or make it respect the floor, and it must fail on purpose.
  it('may trim a name below the 0.85 floor when the gap demands it (#540)', () => {
    const bodies = [
      { id: 'near', position: [0, 0, 0], labelOffset: [0.05, 0, 0.718] },
      { id: 'far', position: [0.18, 0, 0], labelOffset: [0.18, 0, 0.718] }
    ];
    clampLabelReach(bodies);
    expect(reachOf(bodies[0])).toBeLessThan(0.85);
    expect(reachOf(bodies[0])).toBeCloseTo(0.18 * 0.45, 10);
    // Ownership survives the collapse — this is the invariant the floor must
    // never be bolted on top of (a naive Math.max(0.85, ...) would break it).
    assertOwned(bodies[0], [bodies[1]]);
    assertOwned(bodies[1], [bodies[0]]);
  });

  it('honours a custom positionOf for stations (point, not position)', () => {
    const stations = [
      { id: 'a', point: [0, 0, 0], labelOffset: [4, 0, 0] },
      { id: 'b', point: [5, 0, 0], labelOffset: [4, 0, 0] }
    ];
    clampLabelReach(stations, (station) => station.point);
    // `position` is undefined here; if the clamp fell back to it, the gaps
    // would be NaN and the cap would not fire.
    expect(reachOf(stations[0])).toBeCloseTo(2.25, 10);
    expect(reachOf(stations[1])).toBeCloseTo(2.25, 10);
  });

  it('skips bodies without an offset or with a zero-length one', () => {
    const bodies = [
      { id: 'no-offset', position: [0, 0, 0] },
      { id: 'parked', position: [0.5, 0, 0], labelOffset: [0, 0, 0] },
      { id: 'normal', position: [5, 0, 0], labelOffset: [4, 0, 0] }
    ];
    expect(() => clampLabelReach(bodies)).not.toThrow();
    expect(bodies[1].labelOffset).toEqual([0, 0, 0]);
    // Nearest neighbour to `normal` is `parked` (gap 4.5), so the cap is real.
    expect(reachOf(bodies[2])).toBeCloseTo(2.025, 10);
  });
});
