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

  it('points a one-stop route outward from the middle of the map', () => {
    const stops = [{ id: 'only', position: [3, 0, 4] }];
    const sign = subwayRouteSign(stops, () => 0.8);
    // No direction of travel to follow, so it heads away from the centre.
    expect(Math.hypot(sign[0], sign[2])).toBeGreaterThan(Math.hypot(3, 4));
    expect(distanceXZ(sign, [3, 0, 4])).toBeCloseTo(1.7, 5);
  });

  it('survives a route whose last two stops share one platform', () => {
    // An interchange puts consecutive stops at the same point; their difference
    // is zero, and normalising it would produce NaN for the whole sign.
    const stops = [
      { id: 'a', position: [0, 0, 0] },
      { id: 'b', position: [4, 0, 0] },
      { id: 'c', position: [4, 0, 0] }
    ];
    const sign = subwayRouteSign(stops, () => 0.8);
    expect(Number.isFinite(sign[0])).toBe(true);
    expect(Number.isFinite(sign[2])).toBe(true);
    expect(distanceXZ(sign, [4, 0, 0])).toBeCloseTo(1.7, 5);
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
