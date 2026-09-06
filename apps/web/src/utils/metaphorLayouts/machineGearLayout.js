import { hash01Salted } from '../seededHash.js';
import { gridPosition } from './gridPosition.js';

function sizeValue(item) {
  const raw = typeof item.size === 'number' && Number.isFinite(item.size) ? item.size : 3;
  return Math.max(0.1, Math.min(10, raw));
}

function speedValue(item) {
  const raw = typeof item.speed === 'number' && Number.isFinite(item.speed) ? item.speed : 3;
  return Math.max(0, Math.min(10, raw));
}

function torqueValue(item) {
  const raw = typeof item.torque === 'number' && Number.isFinite(item.torque) ? item.torque : 0;
  return Math.max(0, Math.min(1, raw));
}

/** Visible gear radius from importance — sqrt keeps titans from crushing the plate. */
export function gearRadiusForSize(size) {
  return 0.55 + Math.sqrt(Math.max(0.1, size)) * 0.55;
}

/** Clearance between an axle bed's outermost gear and the bed's name placard. */
const AXLE_PLACARD_STANDOFF = 0.42;
/** Placard height: above the plinth, below where the gears carry their own names. */
const AXLE_PLACARD_Y = 0.36;

/**
 * Which bed a part belongs to. A missing, blank or non-string `axle` shares the
 * default drive rather than becoming a bed of its own.
 */
function axleNameFor(item) {
  return typeof item.axle === 'string' && item.axle.trim() ? item.axle.trim() : 'Main drive';
}

/**
 * One part's gear record, positioned on its bed.
 *
 * Lifted out of `machineGearLayout`'s inner loop because the two decisions made
 * here — an authored position versus a generated one, and whether `mesh` names a
 * real partner — are per-part policy, while the loop around them only accumulates
 * the bed's radius.
 *
 * @param {any} item
 * @param {{ itemIndex: number, groupLength: number, axleCenter: [number, number, number], axleName: string, axleIndex: number }} placement
 */
function buildGear(item, { itemIndex, groupLength, axleCenter, axleName, axleIndex }) {
  const radius = gearRadiusForSize(sizeValue(item));
  /** @type {[number, number, number]} */
  let position;
  if (Array.isArray(item.position) && item.position.length === 3) {
    position = [item.position[0], 0.35, item.position[2]];
  } else {
    const local = gridPosition(itemIndex, groupLength, Math.max(2.4, radius * 1.7), 0.65);
    // A small deterministic scatter, so a bed of four identical parts does not
    // read as one part drawn four times.
    const jx = (hash01Salted(item.id, 'gear-jx') - 0.5) * radius * 0.25;
    const jz = (hash01Salted(item.id, 'gear-jz') - 0.5) * radius * 0.25;
    position = [axleCenter[0] + local[0] + jx, 0.35, axleCenter[2] + local[2] + jz];
  }
  // A part cannot mesh with itself, and a blank `mesh` is simply uncoupled.
  const mesh =
    typeof item.mesh === 'string' && item.mesh.trim() && item.mesh.trim() !== item.id
      ? item.mesh.trim()
      : null;
  return {
    id: item.id,
    position,
    radius,
    speed: speedValue(item),
    torque: torqueValue(item),
    axle: axleName,
    axleIndex,
    mesh,
    spinSign: /** @type {1 | -1} */ (itemIndex % 2 === 0 ? 1 : -1)
  };
}

/**
 * Pull mesh partners into contact so coupling is legible without exact tooth
 * math, and make a meshed pair counter-rotate.
 *
 * Runs AFTER placement because it moves gears: the bed's own radius and placard
 * are measured from where the gears ended up, not where they were generated.
 * Mutates in place for the same reason the original loop did — `gears` and
 * `byId` hold the same objects, and `positions` is re-published for the pair.
 *
 * @param {ReturnType<typeof buildGear>[]} gears
 * @param {Map<string, ReturnType<typeof buildGear>>} byId
 * @param {Map<string, [number, number, number]>} positions
 */
function resolveMeshedPartners(gears, byId, positions) {
  for (const gear of gears) {
    if (!gear.mesh) continue;
    const partner = byId.get(gear.mesh);
    if (!partner) continue;
    const dx = partner.position[0] - gear.position[0];
    const dz = partner.position[2] - gear.position[2];
    const dist = Math.hypot(dx, dz) || 1;
    const target = gear.radius + partner.radius * 0.92;
    if (dist > target + 0.15) {
      const pull = (dist - target) * 0.55;
      const nx = dx / dist;
      const nz = dz / dist;
      gear.position[0] += nx * pull;
      gear.position[2] += nz * pull;
      partner.position[0] -= nx * pull * 0.35;
      partner.position[2] -= nz * pull * 0.35;
      positions.set(gear.id, [...gear.position]);
      positions.set(partner.id, [...partner.position]);
    }
    // Meshed gears counter-rotate.
    partner.spinSign = /** @type {1 | -1} */ (-gear.spinSign);
  }
}

/**
 * Pack interlocking gears onto a shared machine plate. Items group by `axle`
 * (shared shaft / subsystem); within an axle they orbit a local centre. When
 * `mesh` points at another gear, that pair is nudged into contact so coupling
 * reads spatially.
 *
 * @param {Array<Record<string, unknown>>} items
 * @returns {{
 *   gears: Array<{
 *     id: string,
 *     position: [number, number, number],
 *     radius: number,
 *     speed: number,
 *     torque: number,
 *     axle: string,
 *     axleIndex: number,
 *     mesh: string | null,
 *     spinSign: 1 | -1
 *   }>,
 *   axles: Array<{ name: string, center: [number, number, number], radius: number, placard: [number, number, number] }>,
 *   positions: Map<string, [number, number, number]>,
 *   bounds: { radius: number }
 * }}
 */
export function machineGearLayout(items) {
  const valid = items.filter((item) => item && typeof item.id === 'string');
  const groups = new Map();
  for (const item of valid) {
    const name = axleNameFor(item);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(item);
  }

  const entries = [...groups.entries()];
  const axleSpacing = 7.2;
  const gears = [];
  const axles = [];
  const positions = new Map();
  const byId = new Map();

  entries.forEach(([name, group], axleIndex) => {
    const axleCenter = gridPosition(axleIndex, entries.length, axleSpacing, 0.55);
    let localRadius = 0;
    group.forEach((item, itemIndex) => {
      const gear = buildGear(item, {
        itemIndex,
        groupLength: group.length,
        axleCenter,
        axleName: name,
        axleIndex
      });
      localRadius = Math.max(
        localRadius,
        Math.hypot(gear.position[0] - axleCenter[0], gear.position[2] - axleCenter[2]) + gear.radius
      );
      gears.push(gear);
      byId.set(item.id, gear);
      positions.set(item.id, gear.position);
    });
    axles.push({ name, center: axleCenter, radius: Math.max(2.2, localRadius + 0.6) });
  });

  resolveMeshedPartners(gears, byId, positions);

  // Write each bed's name on its NEAR edge (+z), clear of everything mounted on
  // it. The far edge (-z) draws a group's name behind its own gears from the
  // angle the scene opens at, and the old -0.78 x radius put it INSIDE the bed
  // — the same bug the city districts and the garden beds were both fixed for.
  // Measured from where the gears actually ended up, because the mesh pull
  // above moves them after the bed's own radius was recorded.
  for (const axle of axles) {
    let reach = axle.radius;
    for (const gear of gears) {
      if (gear.axle !== axle.name) continue;
      const offset = Math.hypot(
        gear.position[0] - axle.center[0],
        gear.position[2] - axle.center[2]
      );
      reach = Math.max(reach, offset + gear.radius);
    }
    axle.placard = [axle.center[0], AXLE_PLACARD_Y, axle.center[2] + reach + AXLE_PLACARD_STANDOFF];
  }

  let maxR = 6;
  for (const gear of gears) {
    maxR = Math.max(maxR, Math.hypot(gear.position[0], gear.position[2]) + gear.radius + 1.5);
  }
  for (const axle of axles) {
    maxR = Math.max(maxR, Math.hypot(axle.center[0], axle.center[2]) + axle.radius + 1.2);
    maxR = Math.max(maxR, Math.hypot(axle.placard[0], axle.placard[2]) + 0.6);
  }

  return { gears, axles, positions, bounds: { radius: maxR } };
}
