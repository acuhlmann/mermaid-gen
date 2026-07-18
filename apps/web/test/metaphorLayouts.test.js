import { describe, expect, it } from 'vitest';
import { cityDistrictLayout } from '../src/utils/metaphorLayouts/cityDistrictLayout.js';
import { galaxyClusterLayout } from '../src/utils/metaphorLayouts/galaxyClusterLayout.js';
import {
  layercakeComponentPositions,
  layercakeSlabRadius,
  layercakeStackLayout
} from '../src/utils/metaphorLayouts/layercakeComponentsLayout.js';
import { treeRadialLayout } from '../src/utils/metaphorLayouts/treeRadialLayout.js';
import { gridPosition } from '../src/utils/metaphorLayouts/gridPosition.js';
import { orreryOrbitLayout } from '../src/utils/metaphorLayouts/orreryOrbitLayout.js';
import {
  riverPathLayout,
  riverWidthForFlow
} from '../src/utils/metaphorLayouts/riverPathLayout.js';
import { gardenBedLayout } from '../src/utils/metaphorLayouts/gardenBedLayout.js';
import {
  archipelagoLayout,
  islandRadiusForMass
} from '../src/utils/metaphorLayouts/archipelagoLayout.js';
import {
  gearRadiusForSize,
  machineGearLayout
} from '../src/utils/metaphorLayouts/machineGearLayout.js';

describe('metaphorLayouts', () => {
  it('gridPosition centers a single item at origin', () => {
    expect(gridPosition(0, 1, 2)).toEqual([0, 0, 0]);
  });

  it('cityDistrictLayout groups items by district', () => {
    const items = [
      { id: 'a', label: 'A', district: 'north', footprint: 2 },
      { id: 'b', label: 'B', district: 'south', footprint: 2 },
      { id: 'c', label: 'C', district: 'north', footprint: 2 }
    ];
    const { positions, districts } = cityDistrictLayout(items);
    expect(positions.size).toBe(3);
    expect(districts.length).toBe(2);
    expect(districts.map((d) => d.name).sort()).toEqual(['north', 'south']);
    const posA = positions.get('a');
    const posC = positions.get('c');
    expect(posA).toBeTruthy();
    expect(posC).toBeTruthy();
    expect(Math.hypot(posA[0] - posC[0], posA[2] - posC[2])).toBeLessThan(6);
    const posB = positions.get('b');
    expect(Math.hypot(posA[0] - posB[0], posA[2] - posB[2])).toBeGreaterThan(4);
  });

  it('cityDistrictLayout honors explicit position override', () => {
    const explicit = cityDistrictLayout([
      { id: 'x', label: 'X', position: [5, 1, -3], footprint: 2 }
    ]);
    const auto = cityDistrictLayout([{ id: 'x', label: 'X', footprint: 2 }]);
    // Explicit coords opt out of grid placement; the layout still recentres the
    // whole composition on the origin for the circular footing.
    expect(explicit.positions.get('x')).not.toEqual(auto.positions.get('x'));
  });

  it('galaxyClusterLayout separates clusters spatially', () => {
    const items = [
      { id: 's1', label: 'S1', cluster: 'alpha' },
      { id: 's2', label: 'S2', cluster: 'beta' }
    ];
    const { positions, clusters } = galaxyClusterLayout(items);
    expect(clusters.length).toBe(2);
    const p1 = positions.get('s1');
    const p2 = positions.get('s2');
    expect(Math.hypot(p1[0] - p2[0], p1[2] - p2[2])).toBeGreaterThan(5);
  });

  it('galaxyClusterLayout keeps stars inside their cluster disc', () => {
    const items = Array.from({ length: 12 }, (_, i) => ({
      id: `s${i}`,
      label: `S${i}`,
      cluster: i < 6 ? 'alpha' : 'beta'
    }));
    const { positions, clusters } = galaxyClusterLayout(items);
    expect(clusters.map((c) => c.count)).toEqual([6, 6]);
    for (const cluster of clusters) {
      expect(cluster.radius).toBeGreaterThan(0);
    }
    items.forEach((item, i) => {
      const cluster = clusters[i < 6 ? 0 : 1];
      const pos = positions.get(item.id);
      const horizontal = Math.hypot(pos[0] - cluster.center[0], pos[2] - cluster.center[2]);
      expect(horizontal).toBeLessThanOrEqual(cluster.radius + 0.001);
    });
  });

  it('treeRadialLayout lifts roots to trunk height and stacks children above', () => {
    const items = [
      { id: 'root', label: 'Root' },
      { id: 'a', label: 'A', parent: 'root' },
      { id: 'b', label: 'B', parent: 'root' }
    ];
    const { positions, nodeInfo, roots, bounds } = treeRadialLayout(items);
    expect(roots).toEqual(['root']);
    const rootPos = positions.get('root');
    // Roots sit at trunk-top height so the renderer can draw a visible trunk.
    expect(rootPos[1]).toBeGreaterThan(0.5);
    expect(positions.get('a')[1]).toBeGreaterThan(rootPos[1] + 1);
    expect(nodeInfo.get('root').kind).toBe('trunk');
    expect(nodeInfo.get('a').kind).toBe('leaf');
    expect(bounds.radius).toBeGreaterThan(0);
  });

  it('treeRadialLayout scatters a multi-root forest into a grove, not a straight row', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      id: `tree-${i}`,
      label: `Tree ${i}`
    }));
    const { positions } = treeRadialLayout(items);
    const rootZs = items.map((item) => positions.get(item.id)[2]);
    // A straight east–west row would leave every trunk at z≈0; the grove packing
    // must spread them across depth as well as width.
    const zSpread = Math.max(...rootZs) - Math.min(...rootZs);
    expect(zSpread).toBeGreaterThan(4);
    // And no two trunks may land on top of each other.
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const a = positions.get(items[i].id);
        const b = positions.get(items[j].id);
        expect(Math.hypot(a[0] - b[0], a[2] - b[2])).toBeGreaterThan(3);
      }
    }
  });

  it('treeRadialLayout honors explicit position and author kind overrides', () => {
    const items = [
      { id: 'root', label: 'Root', position: [2, 4, -1] },
      { id: 'a', label: 'A', parent: 'root', kind: 'branch' }
    ];
    const { positions, nodeInfo } = treeRadialLayout(items);
    expect(positions.get('root')).toEqual([2, 4, -1]);
    expect(nodeInfo.get('a').kind).toBe('branch');
  });

  it('layercakeStackLayout accumulates Y offsets', () => {
    const items = [
      { id: 'l1', label: 'L1', thickness: 2 },
      { id: 'l2', label: 'L2', thickness: 1 }
    ];
    const { yOffsets } = layercakeStackLayout(items);
    expect(yOffsets.get('l1')).toBe(0);
    expect(yOffsets.get('l2')).toBeCloseTo(2.05, 2);
  });

  it('layercakeSlabRadius grows with thickness and components', () => {
    const thin = layercakeSlabRadius({ thickness: 1, components: [] });
    const thick = layercakeSlabRadius({ thickness: 4, components: ['a', 'b', 'c'] });
    expect(thick).toBeGreaterThan(thin);
  });

  it('layercakeComponentPositions places chips on rim', () => {
    const chips = layercakeComponentPositions(5, ['redis', 'postgres']);
    expect(chips.length).toBe(2);
    expect(chips[0].position[0]).not.toBe(chips[1].position[0]);
  });

  it('orreryOrbitLayout centres suns and rings planets by ascending orbit', () => {
    const items = [
      { id: 'core', label: 'Core', orbit: 0, size: 8 },
      { id: 'near', label: 'Near', orbit: 2, size: 3 },
      { id: 'far', label: 'Far', orbit: 8, size: 3 },
      { id: 'sat', label: 'Sat', orbit: 2, size: 1, moon: 'near' }
    ];
    const { positions, rings, sunIds, moonParent, bounds } = orreryOrbitLayout(items);
    expect(sunIds).toEqual(['core']);
    expect(positions.get('core')).toEqual([0, 0, 0]);
    expect(rings.map((r) => r.orbit)).toEqual([2, 8]);
    expect(rings[1].radius).toBeGreaterThan(rings[0].radius);
    const near = positions.get('near');
    const far = positions.get('far');
    expect(Math.hypot(near[0], near[2])).toBeCloseTo(rings[0].radius, 5);
    expect(Math.hypot(far[0], far[2])).toBeCloseTo(rings[1].radius, 5);
    // The moon stays beside its parent planet.
    expect(moonParent.get('sat')).toBe('near');
    const sat = positions.get('sat');
    expect(Math.hypot(sat[0] - near[0], sat[2] - near[2])).toBeLessThan(2.5);
    expect(bounds.radius).toBeGreaterThan(rings[1].radius);
  });

  it('orreryOrbitLayout survives a scene with no explicit sun', () => {
    const { sunIds, rings } = orreryOrbitLayout([
      { id: 'a', label: 'A', orbit: 3, size: 2 },
      { id: 'b', label: 'B', orbit: 5, size: 2 }
    ]);
    expect(sunIds).toEqual([]);
    expect(rings.length).toBe(2);
  });

  it('riverPathLayout orders stations by stage and widens with flow', () => {
    const items = [
      { id: 'publish', label: 'Publish', stage: 2, flow: 4 },
      { id: 'ingest', label: 'Ingest', stage: 0, flow: 12 },
      { id: 'validate', label: 'Validate', stage: 1, flow: 10 }
    ];
    const { samples, stations, positions } = riverPathLayout(items);
    expect(stations.map((s) => s.id)).toEqual(['ingest', 'validate', 'publish']);
    // Source → mouth runs along +x.
    expect(stations[0].point[0]).toBeLessThan(stations[2].point[0]);
    expect(samples.length).toBeGreaterThan(100);
    expect(positions.size).toBe(3);
    // Station anchors sit on the bank, away from the channel centre.
    const ingest = stations[0];
    const offset = Math.hypot(ingest.bank[0] - ingest.point[0], ingest.bank[2] - ingest.point[2]);
    expect(offset).toBeGreaterThan(riverWidthForFlow(12));
  });

  it('riverPathLayout handles empty and single-station inputs', () => {
    expect(riverPathLayout([]).samples).toEqual([]);
    const single = riverPathLayout([{ id: 'only', label: 'Only', stage: 0, flow: 5 }]);
    expect(single.samples.length).toBeGreaterThan(2);
    expect(single.stations).toHaveLength(1);
  });

  it('gardenBedLayout groups plants into topic beds', () => {
    const items = [
      { id: 'a', label: 'A', bed: 'Growth', maturity: 0.8, impact: 8 },
      { id: 'b', label: 'B', bed: 'Trust', maturity: 0.4, impact: 6 },
      { id: 'c', label: 'C', bed: 'Growth', maturity: 0.2, impact: 3 }
    ];
    const { positions, beds, bounds } = gardenBedLayout(items);
    expect(positions.size).toBe(3);
    expect(beds.map((bed) => bed.name).sort()).toEqual(['Growth', 'Trust']);
    expect(bounds.radius).toBeGreaterThan(0);
    const a = positions.get('a');
    const c = positions.get('c');
    const b = positions.get('b');
    expect(Math.hypot(a[0] - c[0], a[2] - c[2])).toBeLessThan(Math.hypot(a[0] - b[0], a[2] - b[2]));
  });

  it('archipelagoLayout groups islands by chain and sizes by mass', () => {
    const items = [
      { id: 'a', label: 'A', chain: 'Europe', mass: 12, relief: 0.8 },
      { id: 'b', label: 'B', chain: 'Americas', mass: 4, relief: 0.3 },
      { id: 'c', label: 'C', chain: 'Europe', mass: 8, relief: 0.5 }
    ];
    const { islands, chains, positions, bounds } = archipelagoLayout(items);
    expect(positions.size).toBe(3);
    expect(chains.map((c) => c.name).sort()).toEqual(['Americas', 'Europe']);
    expect(bounds.radius).toBeGreaterThan(0);
    const big = islands.find((i) => i.id === 'a');
    const small = islands.find((i) => i.id === 'b');
    expect(big.radius).toBeGreaterThan(small.radius);
    expect(big.radius).toBeCloseTo(islandRadiusForMass(12), 5);
    const a = positions.get('a');
    const c = positions.get('c');
    const b = positions.get('b');
    expect(Math.hypot(a[0] - c[0], a[2] - c[2])).toBeLessThan(Math.hypot(a[0] - b[0], a[2] - b[2]));
  });

  it('machineGearLayout groups by axle, sizes by size, and pulls mesh pairs together', () => {
    const items = [
      { id: 'a', label: 'A', axle: 'Checkout', size: 8, speed: 7, mesh: 'b' },
      { id: 'b', label: 'B', axle: 'Checkout', size: 3, speed: 5 },
      { id: 'c', label: 'C', axle: 'Edge', size: 5, speed: 9, torque: 0.8 }
    ];
    const { gears, axles, positions, bounds } = machineGearLayout(items);
    expect(positions.size).toBe(3);
    expect(axles.map((a) => a.name).sort()).toEqual(['Checkout', 'Edge']);
    expect(bounds.radius).toBeGreaterThan(0);
    const big = gears.find((g) => g.id === 'a');
    const small = gears.find((g) => g.id === 'b');
    expect(big.radius).toBeGreaterThan(small.radius);
    expect(big.radius).toBeCloseTo(gearRadiusForSize(8), 5);
    const a = positions.get('a');
    const b = positions.get('b');
    const c = positions.get('c');
    expect(Math.hypot(a[0] - b[0], a[2] - b[2])).toBeLessThan(Math.hypot(a[0] - c[0], a[2] - c[2]));
    expect(big.spinSign).toBe(-small.spinSign);
  });
});
