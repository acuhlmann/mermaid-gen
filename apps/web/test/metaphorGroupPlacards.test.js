/**
 * A group's name never goes where its own members stand.
 *
 * The rule is old — city districts, garden beds, fused affinity rings and the
 * archipelago chain were each fixed for it in turn — but it was enforced only
 * by whoever last looked at a screenshot, so two kinds still broke it: the
 * subway wrote each route's name at `curve.getPoint(1)`, which is its own
 * terminus platform, and the machine wrote each axle's name at
 * `-axle.radius * 0.78`, which is both the far edge and INSIDE the bed.
 *
 * Both placards are `pinned`, so neither yields to the station or gear name it
 * lands on: measured on a 390x844 phone, the subway drew 3 of 6 station names
 * and the machine 1 of 5 gear names. These are the geometric invariants that
 * keep them apart, checked where the geometry is decided rather than where it
 * is drawn.
 *
 * The subway's first answer — stand the sign PAST the terminus, along the
 * direction of travel — cleared the rim in plan view and did not survive the
 * declutter pass: across three fixtures x three viewports, 7 of 24 terminus
 * names were still not drawn, and hiding the signs brought back exactly those
 * 7. Clearing a platform is necessary and not sufficient; the sign has to be
 * somewhere no station name is, which on a lane diagram is the track between
 * two stops.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  subwayNetworkLayout,
  subwayRouteSign
} from '../src/utils/metaphorLayouts/subwayNetworkLayout.js';
import {
  frameDirectionForAspect,
  solveFrameFit
} from '../src/components/metaphorScenes/sceneFraming.js';
import { machineGearLayout } from '../src/utils/metaphorLayouts/machineGearLayout.js';

const distanceXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** The three viewports `apps/web/.claude/skills/verify/` captures at. */
const PHONE_COVER_DESKTOP = [
  ['phone 390x844', 390 / 844],
  ['cover 717x512', 717 / 512],
  ['desktop 1440x900', 1440 / 900]
];

/**
 * Platform rims in the subway's own drawing space: `TRACK_Y` 0.34, and the
 * scene scales a platform circle by [radius, 1, radius * 0.62].
 */
function stationRimPoints(layout) {
  const points = [];
  for (const station of layout.stations) {
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          station.position[0] + Math.cos(angle) * station.platformRadius,
          0.34,
          station.position[2] + Math.sin(angle) * station.platformRadius * 0.62
        )
      );
    }
  }
  return points;
}

/**
 * Where a world point lands in NDC under the fit `solveFrameFit` just chose,
 * reproducing the projection the framing code itself uses (`ndcExtent`).
 */
function ndcOfPoint(point, fit, aspect) {
  const dir = frameDirectionForAspect(aspect);
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir);
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
  right.normalize();
  const up = new THREE.Vector3().crossVectors(dir, right).normalize();
  const tanV = Math.tan(THREE.MathUtils.degToRad(45) / 2);
  const tanH = tanV * Math.max(0.2, aspect);
  const local = point.clone().sub(fit.center);
  const depth = Math.max(0.01, fit.distance - local.dot(dir));
  return {
    x: local.dot(right) / (depth * tanH),
    y: local.dot(up) / (depth * tanV)
  };
}

/**
 * Distance from a point to the nearest segment of a route, in plan.
 *
 * This is how a test tells the two route-sign placements apart: the gap path
 * sits a fixed lateral offset off its own stroke, the terminus fallback sits on
 * it.
 */
function distToOwnTrack(point, stops) {
  let best = Infinity;
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [ax, , az] = stops[i].position;
    const [bx, , bz] = stops[i + 1].position;
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    if (len2 < 1e-9) continue;
    const t = Math.max(0, Math.min(1, ((point[0] - ax) * dx + (point[2] - az) * dz) / len2));
    best = Math.min(best, Math.hypot(point[0] - (ax + t * dx), point[2] - (az + t * dz)));
  }
  return best;
}

/**
 * Two routes sharing two interchanges — the shape that broke the earlier
 * straight-chord model, and the densest ordinary network this suite can name.
 */
const crossingLines = [
  { id: 'a1', label: 'A1', line: 'Alpha', stop: 0, traffic: 10 },
  { id: 'a2', label: 'A2', line: 'Alpha', stop: 1, traffic: 10, interchange: ['b2'] },
  { id: 'a3', label: 'A3', line: 'Alpha', stop: 2, traffic: 10 },
  { id: 'a4', label: 'A4', line: 'Alpha', stop: 3, traffic: 10, interchange: ['b4'] },
  { id: 'b1', label: 'B1', line: 'Beta', stop: 0, traffic: 8 },
  { id: 'b2', label: 'B2', line: 'Beta', stop: 1, traffic: 8 },
  { id: 'b3', label: 'B3', line: 'Beta', stop: 2, traffic: 8 },
  { id: 'b4', label: 'B4', line: 'Beta', stop: 3, traffic: 8 }
];

/**
 * One route, no `line` field on any item — what `DEFAULT_LINE` assembles, and
 * therefore the shape a model emits when it writes a subway without naming its
 * routes. Every stop shares a `z`, which is what made the old reach box
 * degenerate (#460).
 */
const singleLine = [
  { id: 'a', label: 'A', stop: 0, traffic: 10 },
  { id: 'b', label: 'B', stop: 1, traffic: 9 },
  { id: 'c', label: 'C', stop: 2, traffic: 8 },
  { id: 'd', label: 'D', stop: 3, traffic: 7 },
  { id: 'e', label: 'E', stop: 4, traffic: 6 }
];

/** The worked subway in `apps/server/src/prompts/metaphorSystemPrompt.js`. */
const canonical = [
  { id: 'land', label: 'Landing', line: 'New signup', stop: 0, traffic: 18 },
  {
    id: 'auth-new',
    label: 'Auth',
    line: 'New signup',
    stop: 1,
    traffic: 14,
    interchange: ['auth-ret']
  },
  { id: 'pay-new', label: 'Checkout', line: 'New signup', stop: 2, traffic: 6 },
  { id: 'open', label: 'Open app', line: 'Returning user', stop: 0, traffic: 40 },
  { id: 'auth-ret', label: 'Auth', line: 'Returning user', stop: 1, traffic: 38 },
  { id: 'browse', label: 'Browse', line: 'Returning user', stop: 2, traffic: 31 }
];

describe('subway route signs stand off their own platforms', () => {
  const items = [
    { id: 'browse', label: 'Browse', line: 'buy', stop: 0, traffic: 18 },
    { id: 'cart', label: 'Cart', line: 'buy', stop: 1, traffic: 12 },
    { id: 'pay', label: 'Pay', line: 'buy', stop: 2, traffic: 9, interchange: ['refund'] },
    { id: 'ship', label: 'Ship', line: 'fulfil', stop: 0, traffic: 8 },
    { id: 'deliver', label: 'Deliver', line: 'fulfil', stop: 1, traffic: 8 },
    { id: 'refund', label: 'Refund', line: 'support', stop: 0, traffic: 3 },
    { id: 'resolve', label: 'Resolve', line: 'support', stop: 1, traffic: 2 }
  ];

  it('never writes a route name on any station of the network', () => {
    const layout = subwayNetworkLayout(items);
    expect(layout.lines).toHaveLength(3);
    for (const line of layout.lines) {
      expect(line.sign).toBeTruthy();
      for (const station of layout.stations) {
        // Clear of the platform's own rim, so the sign cannot be drawn into the
        // station name that sits directly above that rim's centre.
        expect(distanceXZ(line.sign, station.position)).toBeGreaterThan(station.platformRadius);
      }
    }
  });

  it('stays inside the reach of the network it names', () => {
    const layout = subwayNetworkLayout(items);
    const reach = (axis) =>
      Math.max(...layout.stations.map((s) => Math.abs(s.position[axis]) + s.platformRadius));
    // The camera frames the stations — the plate is out of the fit — so a sign
    // past them is drawn off the canvas edge. This is the clamp that stopped
    // FULFIL running off a 390px phone.
    //
    // #460 called this the bug: measured on two fixtures it collapsed the
    // terminus standoff to 0.000, putting a route's name on the very rim it
    // stands off. Both of those numbers predate 7acde774 moving ordinary routes
    // onto their own track, so they described what is now the rarest placement
    // in the file. The sweep below pins what the clamp cannot do; the two cases
    // after it pin that ordinary routes never reach it.
    for (const line of layout.lines) {
      expect(Math.abs(line.sign[0])).toBeLessThanOrEqual(reach(0) + 1e-9);
      expect(Math.abs(line.sign[2])).toBeLessThanOrEqual(reach(2) + 1e-9);
    }
  });

  it('names every multi-stop route on its own track, not on the clamped fallback (#460)', () => {
    const layout = subwayNetworkLayout(items);
    let checked = 0;
    for (const line of layout.lines) {
      if (line.stops.length < 2) continue;
      checked += 1;
      // The gap path places a sign exactly `ROUTE_SIGN_LATERAL` (1.5) off the
      // segment it names. A fallback is generally nearer its own stroke — the
      // single-line case below measures 1.06, and one with no clamp pressure
      // measures ~0 — so this threshold says "not on the track beside a gap",
      // which is the claim that matters here, not an exact identity of the two
      // placements. The exact one is `toBeCloseTo(1.5)`, and only a lateral
      // placement can satisfy it.
      expect(distToOwnTrack(line.sign, line.stops)).toBeGreaterThan(1);
      // Calibration, so the claim above cannot pass by measuring nothing: a
      // point ON the track must score ~0 under the same helper, which is what
      // the fallback placement looks like. Without this, a broken helper would
      // report every sign as clear of its stroke and the sweep would be empty
      // evidence in a new hat.
      expect(distToOwnTrack(line.stops[line.stops.length - 1].position, line.stops)).toBeLessThan(
        1e-6
      );
    }
    expect(checked).toBeGreaterThan(1);
  });

  it('keeps a fallback sign clear of its own rim however the clamp bites (#460)', () => {
    const terminus = { id: 'only', position: [3, 0, 4] };
    const radiusOf = () => 0.8;
    const standoff = 0.9;
    const delivered = (reachX, reachZ) =>
      distanceXZ(subwayRouteSign([terminus], radiusOf, { reachX, reachZ }), terminus.position) -
      radiusOf('only');

    const unclamped = subwayRouteSign([terminus], radiusOf);
    expect(distanceXZ(unclamped, terminus.position)).toBeCloseTo(0.8 + standoff, 5);

    // Only boxes the layout can actually produce. `reachOn` is a max over every
    // station of `|position| + platformRadius`, and the terminus IS one of those
    // stations, so any admissible box already contains the terminus platform's
    // rim plus its radius — reachX >= 3.8 and reachZ >= 4.8 here. Testing an
    // arbitrary 3.1 would be measuring a geometry this file cannot emit, which is
    // how #460's 0.000 came to be read as a collapse onto the rim.
    let worst = Infinity;
    let boxes = 0;
    for (const reachX of [3.8, 3.9, 4.02]) {
      for (const reachZ of [4.8, 5.1, 5.7, 9]) {
        boxes += 1;
        worst = Math.min(worst, delivered(reachX, reachZ));
      }
    }
    expect(boxes).toBe(12);
    // Never onto the rim: the clamp costs clearance and does not erase it.
    expect(worst).toBeGreaterThan(0);
    // And the sweep really did bite — boxes that never clamped would make the
    // line above a tautology about the unclamped 0.9.
    expect(worst).toBeLessThan(standoff);

    // WHERE the recovery earns its keep, which the sweep alone cannot see. When
    // z is clamped too, `min(reachZ, max(reachZ, ...))` is `reachZ` and the
    // along-track spend cannot be repaid: the two-axis corner really does lose
    // clearance (measured 0.33 of 0.9). The recovery only preserves the standoff
    // when x bites and z still has room — so this is the assertion a change to
    // that line has to survive, and it is the one that fails without it.
    const xOnlyClamped = delivered(3.8, 9);
    expect(xOnlyClamped).toBeGreaterThan(0.85);
    expect(xOnlyClamped).toBeCloseTo(standoff, 2);
    expect(delivered(3.8, 4.8)).toBeLessThan(xOnlyClamped);
  });

  it('leaves every route name inside the plate the bounds reserve', () => {
    // The other half of #460's question: the clamp protects the CAMERA framing,
    // while `ROUTE_SIGN_STANDOFF`'s comment promises the plate. Both can hold,
    // and this is the plate half — `bounds.radius` reserves
    // `platformRadius + 0.9` past the furthest station, so a sign the solver
    // places is on the paper even when it is outside what a viewer is shown.
    for (const fixture of [items, crossingLines]) {
      const layout = subwayNetworkLayout(fixture);
      for (const line of layout.lines) {
        expect(Math.hypot(line.sign[0], line.sign[2])).toBeLessThanOrEqual(layout.bounds.radius);
      }
    }
  });

  it('names a single-line network on its own track, not on the clamped fallback (#460)', () => {
    // The shape the clamp used to break completely. `DEFAULT_LINE` puts every
    // item that omits `line` on ONE route, so this is what a model emits when it
    // writes a subway without route names — and every stop of one route shares a
    // `z`, which made the old `reachZ` one platform radius tall (0.747) against
    // a lateral offset of 1.5. Every gap candidate was rejected before it was
    // scored, so the file's whole placement strategy was unreachable and the
    // sign landed on the rim-side of its own terminus instead.
    const layout = subwayNetworkLayout(singleLine);
    expect(layout.lines).toHaveLength(1);
    const [line] = layout.lines;
    expect(line.sign.map((v) => Number(v.toFixed(3)))).toEqual([6.3, 0, 1.5]);
    // Beside its own stroke by the offset the solver asks for, and clear of
    // every platform by more than the clearance it wants.
    expect(distToOwnTrack(line.sign, line.stops)).toBeCloseTo(1.5, 5);
    const nearestRim = Math.min(
      ...layout.stations.map((s) => distanceXZ(line.sign, s.position) - s.platformRadius)
    );
    expect(nearestRim).toBeGreaterThan(0.9);
  });

  it('stays inside the frame the stations themselves define (#460)', () => {
    // #460 asked whether the collapsed sign was merely ugly or actually left the
    // picture, and the honest answer needs the framing math rather than an
    // opinion about it. `SubwayScene` puts the plate in `FRAME_IGNORE_DATA`, so
    // the fit is solved from the station geometry alone — which is exactly what
    // this reproduces, with the renderer's own `solveFrameFit`, and then projects
    // the placed sign the same way `ndcExtent` does. |ndc| <= 1 is on screen.
    //
    // It also settles which axis the clamp is really for: world `z` falls mostly
    // INTO depth under the orbit camera, so a lateral sign is nowhere near the
    // edge, while the terminus escape it guards against is along `x`.
    for (const [label, aspect] of PHONE_COVER_DESKTOP) {
      for (const fixture of [singleLine, items]) {
        const layout = subwayNetworkLayout(fixture);
        const fit = solveFrameFit(
          stationRimPoints(layout),
          frameDirectionForAspect(aspect),
          45,
          aspect,
          {
            margin: 1.1
          }
        );
        expect(fit, `no frame for ${label}`).not.toBeNull();
        for (const line of layout.lines) {
          const ndc = ndcOfPoint(new THREE.Vector3(line.sign[0], 0.9, line.sign[2]), fit, aspect);
          expect(Math.abs(ndc.x), `${label} x overflow`).toBeLessThanOrEqual(1);
          expect(Math.abs(ndc.y), `${label} y overflow`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('leaves every multi-line placement exactly where #505 rendered it (#460)', () => {
    // The floor on `reachZ` must be inert for any network with two lanes, or
    // this PR silently invalidates the rendered measurement that put signs on
    // their tracks in the first place. Interchanges sit `LANE_GAP / 2` (1.8) off
    // the centreline, so a two-line `reachZ` is already 2.436 — above the 2.4
    // floor — and `Math.max` cannot reach it. These coordinates are the
    // pre-change output, captured by reverting the floor and re-running; if one
    // of them moves, the change is no longer the narrow one this file claims.
    const snapshots = {
      suite7: [
        [-2.1, 0, -2.1],
        [-1.176, 0, 1.5],
        [2.106, 0, 3.114]
      ],
      canonical: [
        [2.097, 0, -2.531],
        [2.097, 0, 2.531]
      ],
      crossing: [
        [-4.197, 0, -2.531],
        [-4.197, 0, 2.531]
      ]
    };
    const round3 = (sign) => sign.map((v) => Number(v.toFixed(3)));
    expect(subwayNetworkLayout(items).lines.map((l) => round3(l.sign))).toEqual(snapshots.suite7);
    expect(subwayNetworkLayout(canonical).lines.map((l) => round3(l.sign))).toEqual(
      snapshots.canonical
    );
    expect(subwayNetworkLayout(crossingLines).lines.map((l) => round3(l.sign))).toEqual(
      snapshots.crossing
    );
  });

  it('writes each route name beside its own track, not past its terminus', () => {
    const layout = subwayNetworkLayout(items);
    expect(layout.lines.length).toBeGreaterThan(0);
    for (const line of layout.lines) {
      const stops = line.stops;
      const terminus = stops[stops.length - 1].position;
      const previous = stops[stops.length - 2].position;
      const travel = [terminus[0] - previous[0], terminus[2] - previous[2]];
      const beyond =
        (line.sign[0] - terminus[0]) * travel[0] + (line.sign[2] - terminus[2]) * travel[1];
      // Standing past the terminus is what put a pinned placard next to an
      // unpinned station name; the placard won the declutter pass every time
      // and the terminus name was simply not drawn (7 of 24 measured captures).
      // A route name now sits on a station-free stretch of its own track, which
      // means it is never further along the direction of travel than the last
      // platform is.
      expect(beyond).toBeLessThanOrEqual(0);
    }
  });

  it('keeps two route names apart from each other', () => {
    const layout = subwayNetworkLayout(items);
    // A single-line network makes the nested sweep below empty — it skips every
    // `a === b` pair and asserts nothing. Same companion-assertion gap the
    // sibling commit closed in metaphorFusedRoutes.test.js the same night.
    expect(layout.lines.length).toBeGreaterThan(1);
    // Both are `pinned`, so where they overlap neither yields and one line's
    // name is printed through another's. Solving each route on its own put
    // ASSISTED and ENGINEER in the same square metre of an 11-stop network.
    for (const a of layout.lines) {
      for (const b of layout.lines) {
        if (a === b) continue;
        expect(distanceXZ(a.sign, b.sign)).toBeGreaterThan(2);
      }
    }
  });

  it('points a one-stop route outward from the middle of the map', () => {
    const stops = [{ id: 'only', position: [3, 0, 4] }];
    const sign = subwayRouteSign(stops, () => 0.8);
    // No stretch of track to be named on, so it falls back to standing past the
    // terminus — and with no direction of travel, away from the centre.
    expect(Math.hypot(sign[0], sign[2])).toBeGreaterThan(Math.hypot(3, 4));
    expect(distanceXZ(sign, [3, 0, 4])).toBeCloseTo(1.7, 5);
  });

  it('survives a route whose stops all share one platform', () => {
    // An interchange puts consecutive stops at the same point; their difference
    // is zero, and normalising it would produce NaN for the whole sign. With no
    // gap anywhere on the route there is no stretch to name it on either.
    const stops = [
      { id: 'a', position: [4, 0, 0] },
      { id: 'b', position: [4, 0, 0] },
      { id: 'c', position: [4, 0, 0] }
    ];
    const sign = subwayRouteSign(stops, () => 0.8);
    expect(Number.isFinite(sign[0])).toBe(true);
    expect(Number.isFinite(sign[2])).toBe(true);
    expect(distanceXZ(sign, [4, 0, 0])).toBeCloseTo(1.7, 5);
  });

  it('scores its candidates even when no platforms are supplied', () => {
    // `stations` defaults to [], and an empty scan for the nearest rim used to
    // leave `room` at Infinity. Every candidate then scored Infinity, and
    // `score > best.score` is false between two of those, so the FIRST
    // candidate won and the two mechanisms layered on top of `room` — the
    // crowding penalty against already-placed names, and the near-edge
    // tie-break — decided nothing while appearing to. A caller who omits the
    // platforms gets an arbitrary placement reported as a scored one.
    const stops = [
      { id: 'a', position: [0, 0, 0] },
      { id: 'b', position: [4.2, 0, 0] },
      { id: 'c', position: [8.4, 0, 0] }
    ];
    // The first candidate is the midpoint of the first gap on the +1 side —
    // exactly where this already-placed route name sits.
    const sign = subwayRouteSign(stops, () => 0.636, { placed: [[2.1, 0, 1.5]] });
    expect(distanceXZ(sign, [2.1, 0, 1.5])).toBeGreaterThan(1);
  });

  it('keeps the near-edge tie-break alive when no platforms are supplied', () => {
    // Travel along -x, so the first candidate side lands on the FAR edge. With
    // `room` pinned at Infinity the tie-break could never move it back, and a
    // route name was written behind the network it names — the defect the
    // `candidate[2] * 1e-3` term exists to prevent.
    const stops = [
      { id: 'a', position: [8.4, 0, 0] },
      { id: 'b', position: [4.2, 0, 0] },
      { id: 'c', position: [0, 0, 0] }
    ];
    const sign = subwayRouteSign(stops, () => 0.636);
    expect(sign[2]).toBeGreaterThan(0);
  });

  it('still names a route whose only gap is crowded on both sides', () => {
    // Every candidate can fail the clearance test — a two-stop route boxed in
    // by other lines. The name is still drawn: falling back to the terminus is
    // worse than a gap, and both are better than a route the legend claims and
    // the map never names.
    const stops = [
      { id: 'a', position: [0, 0, 0] },
      { id: 'b', position: [3, 0, 0] }
    ];
    const crowd = Array.from({ length: 12 }, (_, i) => ({
      position: [i * 0.5 - 1, 0, 0],
      platformRadius: 3
    }));
    const sign = subwayRouteSign(stops, () => 0.8, { stations: crowd });
    expect(Number.isFinite(sign[0])).toBe(true);
    expect(Number.isFinite(sign[2])).toBe(true);
  });
});

describe('machine axle placards stand off their own gears', () => {
  const items = [
    { id: 'lint', label: 'Lint', size: 2, speed: 9, axle: 'static' },
    { id: 'types', label: 'Typecheck', size: 3, speed: 6, axle: 'static', mesh: 'lint' },
    { id: 'unit', label: 'Unit tests', size: 5, speed: 4, axle: 'test' },
    { id: 'e2e', label: 'E2E suite', size: 8, speed: 1, axle: 'test', torque: 0.9 },
    { id: 'build', label: 'Build', size: 4, speed: 5, axle: 'ship' }
  ];

  it('puts every placard on the NEAR edge, outside its own gears', () => {
    const layout = machineGearLayout(items);
    expect(layout.axles).toHaveLength(3);
    for (const axle of layout.axles) {
      // Near edge: +z is toward the default camera at (+x, +y, +z). The far
      // edge draws a group's name behind its own machinery.
      expect(axle.placard[2]).toBeGreaterThan(axle.center[2]);
      for (const gear of layout.gears) {
        if (gear.axle !== axle.name) continue;
        expect(distanceXZ(axle.placard, gear.position)).toBeGreaterThan(gear.radius);
      }
    }
  });

  it('clears gears the mesh pull moved after the bed radius was recorded', () => {
    // `mesh` drags partners into contact AFTER each axle's radius is fixed, so
    // a placard measured from `axle.radius` alone can end up under a gear that
    // has since slid outward. Measured from where the gears actually are.
    const layout = machineGearLayout(items);
    const staticAxle = layout.axles.find((axle) => axle.name === 'static');
    const outermost = Math.max(
      ...layout.gears
        .filter((gear) => gear.axle === 'static')
        .map((gear) => distanceXZ(gear.position, staticAxle.center) + gear.radius)
    );
    expect(staticAxle.placard[2] - staticAxle.center[2]).toBeGreaterThan(outermost);
  });

  it('keeps every placard on the plate', () => {
    const layout = machineGearLayout(items);
    for (const axle of layout.axles) {
      expect(Math.hypot(axle.placard[0], axle.placard[2])).toBeLessThanOrEqual(
        layout.bounds.radius
      );
    }
  });
});
