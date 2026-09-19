/**
 * Where a machine's relation goes: a drive belt, not a wire over the cogs.
 *
 * Every other kind's links are drawn with `arcRoute` — a ballistic hop from
 * the top of one item to the top of the next. On the machine that hop is a
 * straight line between two gear CENTRES, so for an adjacent pair the route
 * has no length that is not over one of the two gear bodies. Measured through
 * the app's own picker on two 4–5 gear fixtures, 390×844: of 80 aim points
 * spread along the eight routes, **12 reached `onPointerMissed`** — and a link
 * is only ever picked there, because `HoverableItem` handles and stops the
 * pointer first (`metaphorLinkPick.js`). Two of the eight routes had no free
 * point at all. That is the "a link wins only when no item was hit" rule
 * working exactly as designed and still leaving the relation untappable.
 *
 * Raising the route is the obvious lever and it is the wrong one: an item's
 * own name plate is a SCREEN-CONSTANT mesh standing directly above it, inside
 * the same `HoverableItem`, so height walks the route out of the gear and into
 * the label — which claims the pointer for the same item.
 *
 * A belt drive answers it with geometry the scene already means. A real belt's
 * span is TANGENT to both pulleys: offset from the line of centres by each
 * wheel's own radius, so it is outside both discs along its whole length, and
 * it ends by wrapping the rim rather than by landing on the hub.
 *
 * Three shapes here, each of which cost a render to learn:
 *
 * - **The belt lies in the WHEELS' plane, not at the anchor height.** The
 *   first version reused the `MetaphorLinks` anchors, which sit at
 *   `radius + 1.2` above each gear because an arc has to leap the scene. Stood
 *   off the rim at that height the belt no longer touched anything: at
 *   1440×900 the spans floated over the bedplate and off its edge, joined to
 *   the gears by nothing the eye could follow. `plane` puts them at mid-tooth,
 *   where a belt is.
 * - **The offsets are world sizes derived from the gear radii**, never a
 *   constant — and from the TOOTH TIPS, not the hub radius, which the teeth
 *   overhang by about 11% (`GearBody`). These scenes run from a 14-unit
 *   layercake to a 60-unit bridge (see `metaphorScreenScale.js`); a fixed
 *   standoff is a wide belt on the small machine and a hairline on the large.
 * - **The span is clamped to the bedplate**, and the clamp spends the
 *   clearance rather than the radius, so it can never pull the belt inside the
 *   wheel it wraps — which would hand the pointer straight back to the gear.
 */
import * as THREE from 'three';

/**
 * How far past the pitch radius the teeth reach. `GearBody` puts each tooth at
 * `radius - 0.15·toothDepth` with a `0.26·radius` box depth and
 * `toothDepth = 0.16·radius`, so the tips land near `1.11·radius`.
 */
export const BELT_TOOTH_REACH = 1.14;

/** Air between the tooth tips and the belt, in world units. */
export const BELT_RIM_CLEARANCE = 0.2;

/** How far around the driven wheel the belt is drawn, in radians. */
export const BELT_WRAP_ARC = 0.85;

/** Samples along the tangent span, and along the wrap. */
const SPAN_SEGMENTS = 20;
const WRAP_SEGMENTS = 6;

/** Slack: the lateral bow at mid-span, capped so a long belt stays taut. */
const BELT_BOW_RATE = 0.04;
const BELT_BOW_MAX = 0.4;

/**
 * Lift at mid-span. Small on purpose — a belt lies in the plane of the wheels
 * it turns, and the only reason it is not zero is that a long span crossing
 * the plate would otherwise run through the gears it passes.
 */
const BELT_LIFT_RATE = 0.035;
const BELT_LIFT_MAX = 0.45;

/** Below this the two gears share an anchor and there is no span to draw. */
const MIN_SPAN = 1e-4;

/**
 * The largest standoff that keeps `center + normal · off` inside `radius`.
 *
 * Solves |c + n·off|² = R² for the positive root. A centre already outside the
 * plate gets 0 rather than a negative offset, which would swing the belt round
 * to the wrong side of the wheel.
 */
function standoffWithinPlate(cx, cz, nx, nz, radius) {
  if (!Number.isFinite(radius)) return Infinity;
  const b = cx * nx + cz * nz;
  const c = cx * cx + cz * cz - radius * radius;
  const disc = b * b - c;
  if (disc <= 0) return 0;
  return Math.max(0, -b + Math.sqrt(disc));
}

/**
 * One drive belt.
 *
 * @param {number[]} from — the source anchor, `[x, y, z]`; only x/z are used
 *   when `plane` is given
 * @param {number[]} to — the target anchor
 * @param {{fromRadius?: number, toRadius?: number, plateRadius?: number,
 *   plane?: number}} gearing
 * @returns {{points: number[][], midpoint: number[]}} the same shape
 *   `arcRoute`/`elbowRoute` return, so `MetaphorLinks` needs no branch
 */
export function machineBeltRoute(from, to, gearing = {}) {
  const { fromRadius = 0, toRadius = 0, plateRadius = Infinity, plane = null } = gearing;
  const beltY = plane ?? Math.max(from[1], to[1]);
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const span = Math.hypot(dx, dz);
  if (!(span > MIN_SPAN)) {
    return {
      points: [
        [from[0], beltY, from[2]],
        [to[0], beltY, to[2]]
      ],
      midpoint: [to[0], beltY + 0.35, to[2]]
    };
  }
  const ux = dx / span;
  const uz = dz / span;
  // The belt hangs on the side away from the plate centre: outward is where
  // the bedplate is empty, and it keeps a pair's belt off the axle plinth
  // between them. A span straight through the centre has no outward side, and
  // takes the stable one.
  const midX = (from[0] + to[0]) / 2;
  const midZ = (from[2] + to[2]) / 2;
  let nx = -uz;
  let nz = ux;
  if (midX * nx + midZ * nz < 0) {
    nx = -nx;
    nz = -nz;
  }

  const rimFrom = fromRadius * BELT_TOOTH_REACH;
  const rimTo = toRadius * BELT_TOOTH_REACH;
  // One clearance for both ends, so a span only one end of which would have
  // run off the plate stays parallel rather than skewing.
  const clearance = Math.max(
    0,
    Math.min(
      BELT_RIM_CLEARANCE,
      standoffWithinPlate(from[0], from[2], nx, nz, plateRadius) - rimFrom,
      standoffWithinPlate(to[0], to[2], nx, nz, plateRadius) - rimTo
    )
  );
  const offFrom = rimFrom + clearance;
  const offTo = rimTo + clearance;

  const start = new THREE.Vector3(from[0] + nx * offFrom, beltY, from[2] + nz * offFrom);
  const tangent = new THREE.Vector3(to[0] + nx * offTo, beltY, to[2] + nz * offTo);
  const bow = Math.min(BELT_BOW_MAX, span * BELT_BOW_RATE);
  const lift = Math.min(BELT_LIFT_MAX, span * BELT_LIFT_RATE);
  const handle = span * 0.3;
  const curve = new THREE.CubicBezierCurve3(
    start,
    new THREE.Vector3(
      start.x + ux * handle + nx * bow,
      beltY + lift,
      start.z + uz * handle + nz * bow
    ),
    new THREE.Vector3(
      tangent.x - ux * handle + nx * bow,
      beltY + lift,
      tangent.z - uz * handle + nz * bow
    ),
    tangent
  );
  const points = curve.getPoints(SPAN_SEGMENTS).map((v) => [v.x, v.y, v.z]);

  // The wrap: the belt does not stop at the tangent point, it goes round the
  // wheel it drives. This is also what puts the arrowhead ON the driven gear
  // instead of beside it — `arrowFromRoute` takes its heading from the last
  // segment with length, which here is tangential to the rim.
  if (offTo > MIN_SPAN) {
    const startAngle = Math.atan2(nz, nx);
    // Sweep away from the source, i.e. from the tangent normal toward +u.
    let delta = Math.atan2(uz, ux) - startAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    const dir = delta >= 0 ? 1 : -1;
    for (let i = 1; i <= WRAP_SEGMENTS; i += 1) {
      const a = startAngle + dir * BELT_WRAP_ARC * (i / WRAP_SEGMENTS);
      points.push([to[0] + Math.cos(a) * offTo, beltY, to[2] + Math.sin(a) * offTo]);
    }
  }

  // The caption stays at the height the anchors define, over the belt's own
  // mid-span. Hanging it just above the belt put it down among the gears and
  // the plinths, where the declutter pass — which ranks a link caption last —
  // dropped both of the replication fixture's captions at 717×512.
  const mid = curve.getPoint(0.5);
  return { points, midpoint: [mid.x, Math.max(from[1], to[1]) + 0.35, mid.z] };
}
