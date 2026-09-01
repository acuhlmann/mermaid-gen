/**
 * A fused route is a journey THROUGH the world, not a pipe laid across it.
 *
 * Before `routeAlongSurface`, a path's spline ran straight from one island's
 * crest to the next, so the channel held island-top height over open water and
 * over any third island in the way. Measured on the three composite fixtures,
 * the mean clearance over the surface underneath was 0.55–0.72 world units
 * (worst 1.69) and 42–86% of each route's length was more than a full channel
 * width clear of the ground — which is what "a blue pipe flying over the map"
 * looks like as a number.
 *
 * These pin the two halves of the rule: the world's own surface is a dome per
 * site over a flat sea, and every route that is not a crossing stays within one
 * channel-width of it. A bridge is deliberately exempt — a crossing's whole
 * thesis is the gap it spans.
 */
import { describe, expect, it } from 'vitest';
import { CatmullRomCurve3, Vector3 } from 'three';
import {
  FUSED_SEA_LEVEL_Y,
  fusedSurfaceHeightAt,
  planFusedCompositeWorld
} from '../src/components/metaphorScenes/fusedCompositePlanner.js';

/** The tension `FusedPath` builds its curve with; the samples must match it. */
const CURVE_TENSION = 0.45;
const SAMPLES = 200;

function itemFor(kind, suffix) {
  const base = { id: `${kind}-${suffix}`, label: `${kind} ${suffix}` };
  if (kind === 'archipelago') return { ...base, mass: 8 + Number(suffix), relief: 0.7 };
  if (kind === 'city') return { ...base, height: 12, footprint: 2.5 };
  if (kind === 'river') return { ...base, stage: Number(suffix) * 30, flow: 9 };
  if (kind === 'subway') return { ...base, stop: Number(suffix), traffic: 9 };
  if (kind === 'bridge') return { ...base, span: Number(suffix), load: 9 };
  return { ...base, mass: 8 };
}

function compositeWith(pathKind, { sites = 3, stations = 4 } = {}) {
  return planFusedCompositeWorld({
    metaphor: 'composite',
    layout: 'fused',
    seed: `routes-${pathKind}`,
    novelty: 0.64,
    motionIntensity: 0.7,
    scene: {},
    layers: [
      {
        id: 'ground',
        as: 'archipelago',
        items: Array.from({ length: sites }, (_, i) => itemFor('archipelago', String(i + 1)))
      },
      {
        id: 'journey',
        as: pathKind,
        items: Array.from({ length: stations }, (_, i) => itemFor(pathKind, String(i + 1)))
      }
    ],
    items: [],
    links: []
  });
}

/** Clearance of the drawn curve over the world surface, sampled along it. */
function clearances(path, sites) {
  const curve = new CatmullRomCurve3(
    path.points.map((point) => new Vector3(point[0], point[1], point[2])),
    false,
    'catmullrom',
    CURVE_TENSION
  );
  const gaps = [];
  for (let i = 0; i <= SAMPLES; i += 1) {
    const point = curve.getPoint(i / SAMPLES);
    gaps.push(point.y - fusedSurfaceHeightAt(point.x, point.z, sites));
  }
  return gaps;
}

describe('fusedSurfaceHeightAt', () => {
  const sites = [{ position: [4, 0, 0], radius: 3, height: 1.2 }];

  it('is sea level where no site stands', () => {
    expect(fusedSurfaceHeightAt(40, 0, sites)).toBe(FUSED_SEA_LEVEL_Y);
    expect(fusedSurfaceHeightAt(4, 0, [])).toBe(FUSED_SEA_LEVEL_Y);
  });

  it('reaches the site crest at its centre and sea level at its rim', () => {
    expect(fusedSurfaceHeightAt(4, 0, sites)).toBeCloseTo(1.2, 5);
    expect(fusedSurfaceHeightAt(7, 0, sites)).toBeCloseTo(FUSED_SEA_LEVEL_Y, 5);
  });

  it('is flat at both ends of the shore, so a route crossing it has no corner', () => {
    // Smoothstep, not a cone or a hemispheroid: both of those put their
    // steepest slope at the rim, which is where a channel spends its samples.
    const near = fusedSurfaceHeightAt(6.97, 0, sites) - FUSED_SEA_LEVEL_Y;
    const inner = fusedSurfaceHeightAt(6.7, 0, sites) - FUSED_SEA_LEVEL_Y;
    expect(near).toBeLessThan(inner * 0.2);
  });

  it('takes the tallest site where two overlap', () => {
    const overlapping = [
      { position: [0, 0, 0], radius: 3, height: 0.5 },
      { position: [2, 0, 0], radius: 3, height: 1.6 }
    ];
    expect(fusedSurfaceHeightAt(1, 0, overlapping)).toBeCloseTo(
      fusedSurfaceHeightAt(1, 0, [overlapping[1]]),
      5
    );
  });
});

describe('fused route elevation', () => {
  for (const kind of ['river', 'subway']) {
    it(`keeps a ${kind} within one channel width of the ground it crosses`, () => {
      const plan = compositeWith(kind);
      expect(plan.paths).toHaveLength(1);
      const [path] = plan.paths;
      const gaps = clearances(path, plan.sites);
      expect(Math.max(...gaps)).toBeLessThan(path.width * 2);
      // Never buried either: a channel under the ground is not a channel.
      expect(Math.min(...gaps)).toBeGreaterThan(-path.width);
    });
  }

  it('leaves a bridge flying — a crossing that follows the seabed is not a bridge', () => {
    const plan = compositeWith('bridge');
    const [path] = plan.paths;
    const gaps = clearances(path, plan.sites);
    expect(Math.max(...gaps)).toBeGreaterThan(path.width * 2);
  });

  it('samples the world between stations without moving any station', () => {
    const plan = compositeWith('river');
    const [path] = plan.paths;
    // Two tangent tails plus the stations, plus the inserted surface samples.
    expect(path.points.length).toBeGreaterThan(path.stations.length + 2);
    for (const station of path.stations) {
      const match = path.points.find(
        (point) =>
          point[0] === station.point[0] &&
          point[1] === station.point[1] &&
          point[2] === station.point[2]
      );
      expect(match, `station ${station.id} is not on its own route`).toBeDefined();
    }
  });

  it('stands a station on the ground rather than on its site crest', () => {
    const plan = compositeWith('river');
    const [path] = plan.paths;
    for (const station of path.stations) {
      const site = plan.sites.find((candidate) => candidate.id === station.attachedTo);
      const surface = fusedSurfaceHeightAt(station.point[0], station.point[2], plan.sites);
      expect(station.point[1] - surface).toBeLessThan(0.25);
      // A station is set out from its site's centre, so anywhere the crest and
      // the ground differ, the crest is the wrong answer.
      expect(station.point[1]).toBeLessThanOrEqual(site.anchor[1] + 0.25);
    }
  });

  it('does not grow the world to hold the extra control points', () => {
    const plan = compositeWith('river');
    for (const path of plan.paths) {
      for (const point of path.points) {
        expect(Math.hypot(point[0], point[2])).toBeLessThanOrEqual(plan.groundRadius);
      }
    }
  });
});
