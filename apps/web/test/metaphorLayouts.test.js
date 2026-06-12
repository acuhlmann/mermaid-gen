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
    const explicit = cityDistrictLayout([{ id: 'x', label: 'X', position: [5, 1, -3], footprint: 2 }]);
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
});
