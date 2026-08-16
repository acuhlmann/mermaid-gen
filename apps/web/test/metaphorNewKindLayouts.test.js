import { describe, expect, it } from 'vitest';
import {
  resolveInterchangeGroups,
  subwayNetworkLayout
} from '../src/utils/metaphorLayouts/subwayNetworkLayout.js';
import { icebergLayout } from '../src/utils/metaphorLayouts/icebergLayout.js';
import {
  groveRingPlacement,
  treeRadialLayout
} from '../src/utils/metaphorLayouts/treeRadialLayout.js';
import { gardenBedLayout } from '../src/utils/metaphorLayouts/gardenBedLayout.js';

describe('subwayNetworkLayout', () => {
  const items = [
    { id: 'a1', label: 'Start A', line: 'A', stop: 0, traffic: 10 },
    { id: 'a2', label: 'Auth', line: 'A', stop: 1, traffic: 10, interchange: ['b2'] },
    { id: 'a3', label: 'Pay', line: 'A', stop: 2, traffic: 8, interchange: ['b3'] },
    { id: 'b1', label: 'Start B', line: 'B', stop: 0, traffic: 20 },
    { id: 'b2', label: 'Auth', line: 'B', stop: 1, traffic: 20 },
    { id: 'b3', label: 'Pay', line: 'B', stop: 2, traffic: 12 }
  ];

  it('merges mutually-named stops into one station', () => {
    const groups = resolveInterchangeGroups(items);
    expect(groups.get('a2')).toBe(groups.get('b2'));
    expect(groups.get('a3')).toBe(groups.get('b3'));
    expect(groups.get('a1')).not.toBe(groups.get('b1'));
  });

  it('unions transitively when the author only writes half the pairs', () => {
    const chain = [
      { id: 'x', label: 'X', line: 'A', stop: 0, interchange: ['y'] },
      { id: 'y', label: 'Y', line: 'B', stop: 0, interchange: ['z'] },
      { id: 'z', label: 'Z', line: 'C', stop: 0 }
    ];
    const groups = resolveInterchangeGroups(chain);
    expect(groups.get('x')).toBe(groups.get('z'));
  });

  it('supports two routes sharing TWO stations', () => {
    // The straight-chord model could not: a pair of straight lines crosses
    // exactly once, so both shared stops pinned to the same point and the map
    // collapsed into it. Lanes let routes converge, separate, and converge again.
    const { stations, positions } = subwayNetworkLayout(items);
    const shared = stations.filter((station) => station.lines.length > 1);
    expect(shared).toHaveLength(2);
    const [first, second] = shared.map((station) => positions.get(station.members[0]));
    expect(Math.hypot(first[0] - second[0], first[2] - second[2])).toBeGreaterThan(1);
  });

  it('puts every member of a shared station at the same point', () => {
    const { positions } = subwayNetworkLayout(items);
    expect(positions.get('a2')).toEqual(positions.get('b2'));
  });

  it('keeps each route moving forward', () => {
    const { lines } = subwayNetworkLayout(items);
    for (const line of lines) {
      for (let i = 1; i < line.stops.length; i += 1) {
        expect(line.stops[i].position[0]).toBeGreaterThan(line.stops[i - 1].position[0]);
      }
    }
  });

  it('names one primary per station so an interchange is labelled once', () => {
    const { stations } = subwayNetworkLayout(items);
    for (const station of stations) {
      expect(station.members).toContain(station.primary);
    }
  });
});

describe('icebergLayout', () => {
  const items = [
    { id: 'tip', label: 'Tip', depth: 0.9, mass: 2, berg: 'One' },
    { id: 'mid', label: 'Mid', depth: -0.2, mass: 8, berg: 'One' },
    { id: 'deep', label: 'Deep', depth: -0.9, mass: 14, berg: 'One' },
    { id: 'other', label: 'Other', depth: 0.4, mass: 5, berg: 'Two' }
  ];

  it('puts the waterline at y = 0 and signs depth across it', () => {
    const { positions } = icebergLayout(items);
    expect(positions.get('tip')[1]).toBeGreaterThan(0);
    expect(positions.get('mid')[1]).toBeLessThan(0);
    expect(positions.get('deep')[1]).toBeLessThan(positions.get('mid')[1]);
  });

  it('separates bergs by their own widths', () => {
    const { bergs } = icebergLayout(items);
    expect(bergs).toHaveLength(2);
    const [a, b] = bergs;
    const gap = Math.hypot(a.center[0] - b.center[0], a.center[2] - b.center[2]);
    expect(gap).toBeGreaterThan(a.radius + b.radius);
  });

  it('reports each berg reach above and below the line', () => {
    const berg = icebergLayout(items).bergs.find((entry) => entry.name === 'One');
    expect(berg.above).toBeGreaterThan(0);
    expect(berg.below).toBeLessThan(0);
  });
});

describe('grove and bed spacing', () => {
  it('never seats two trunks closer than their crowns are wide', () => {
    // A fixed grove spacing ignored subtree size, so a deep hierarchy's foliage
    // grew straight through its neighbour's.
    const roots = [
      { id: 'a', extent: 10 },
      { id: 'b', extent: 4 },
      { id: 'c', extent: 7 }
    ];
    const placement = groveRingPlacement(roots);
    const at = (root) => {
      const seat = placement.get(root.id);
      return [Math.cos(seat.angle) * seat.ringRadius, Math.sin(seat.angle) * seat.ringRadius];
    };
    for (let i = 0; i < roots.length; i += 1) {
      for (let k = i + 1; k < roots.length; k += 1) {
        const [ax, az] = at(roots[i]);
        const [bx, bz] = at(roots[k]);
        expect(Math.hypot(ax - bx, az - bz)).toBeGreaterThan(roots[i].extent + roots[k].extent);
      }
    }
  });

  it('spaces a deep tree further out than a shallow one', () => {
    const shallow = treeRadialLayout([
      { id: 'r1', label: 'R1' },
      { id: 'r2', label: 'R2' }
    ]);
    const deep = treeRadialLayout([
      { id: 'r1', label: 'R1' },
      { id: 'c1', label: 'C1', parent: 'r1' },
      { id: 'g1', label: 'G1', parent: 'c1' },
      { id: 'r2', label: 'R2' },
      { id: 'c2', label: 'C2', parent: 'r2' },
      { id: 'g2', label: 'G2', parent: 'c2' }
    ]);
    const spread = (layout) =>
      Math.hypot(
        layout.positions.get('r1')[0] - layout.positions.get('r2')[0],
        layout.positions.get('r1')[2] - layout.positions.get('r2')[2]
      );
    expect(spread(deep)).toBeGreaterThan(spread(shallow));
  });

  it('keeps garden beds from overlapping whatever they hold', () => {
    const items = [];
    for (let i = 0; i < 6; i += 1) items.push({ id: `big${i}`, label: 'B', bed: 'Big' });
    items.push({ id: 'small', label: 'S', bed: 'Small' });
    const { beds } = gardenBedLayout(items);
    const [a, b] = beds;
    const dx = Math.abs(a.center[0] - b.center[0]);
    const dz = Math.abs(a.center[2] - b.center[2]);
    const overlapsX = dx < (a.size[0] + b.size[0]) / 2;
    const overlapsZ = dz < (a.size[1] + b.size[1]) / 2;
    expect(overlapsX && overlapsZ).toBe(false);
  });
});
