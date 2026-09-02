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
import {
  subwayNetworkLayout,
  subwayRouteSign
} from '../src/utils/metaphorLayouts/subwayNetworkLayout.js';
import { machineGearLayout } from '../src/utils/metaphorLayouts/machineGearLayout.js';

const distanceXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

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
    for (const line of layout.lines) {
      expect(Math.abs(line.sign[0])).toBeLessThanOrEqual(reach(0) + 1e-9);
      expect(Math.abs(line.sign[2])).toBeLessThanOrEqual(reach(2) + 1e-9);
    }
  });

  it('writes each route name beside its own track, not past its terminus', () => {
    const layout = subwayNetworkLayout(items);
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
