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
    const name =
      typeof item.axle === 'string' && item.axle.trim() ? item.axle.trim() : 'Main drive';
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
      const size = sizeValue(item);
      const radius = gearRadiusForSize(size);
      let pos;
      if (Array.isArray(item.position) && item.position.length === 3) {
        pos = [item.position[0], 0.35, item.position[2]];
      } else {
        const local = gridPosition(itemIndex, group.length, Math.max(2.4, radius * 1.7), 0.65);
        const jx = (hash01Salted(item.id, 'gear-jx') - 0.5) * radius * 0.25;
        const jz = (hash01Salted(item.id, 'gear-jz') - 0.5) * radius * 0.25;
        pos = [axleCenter[0] + local[0] + jx, 0.35, axleCenter[2] + local[2] + jz];
      }
      localRadius = Math.max(
        localRadius,
        Math.hypot(pos[0] - axleCenter[0], pos[2] - axleCenter[2]) + radius
      );
      const mesh =
        typeof item.mesh === 'string' && item.mesh.trim() && item.mesh.trim() !== item.id
          ? item.mesh.trim()
          : null;
      const gear = {
        id: item.id,
        position: pos,
        radius,
        speed: speedValue(item),
        torque: torqueValue(item),
        axle: name,
        axleIndex,
        mesh,
        spinSign: itemIndex % 2 === 0 ? 1 : -1
      };
      gears.push(gear);
      byId.set(item.id, gear);
      positions.set(item.id, pos);
    });
    axles.push({ name, center: axleCenter, radius: Math.max(2.2, localRadius + 0.6) });
  });

  // Pull mesh partners into contact so coupling is legible without exact tooth math.
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
