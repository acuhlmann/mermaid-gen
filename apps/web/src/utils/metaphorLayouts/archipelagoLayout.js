import { hash01Salted } from '../seededHash.js';
import { gridPosition } from './gridPosition.js';

function massValue(item) {
  const raw = typeof item.mass === 'number' && Number.isFinite(item.mass) ? item.mass : 4;
  return Math.max(0.5, Math.min(20, raw));
}

function reliefValue(item) {
  const raw = typeof item.relief === 'number' && Number.isFinite(item.relief) ? item.relief : 0.45;
  return Math.max(0, Math.min(1, raw));
}

/** Island radius from domain mass — sqrt keeps giants from eating the ocean. */
export function islandRadiusForMass(mass) {
  return 0.85 + Math.sqrt(Math.max(0.5, mass)) * 0.72;
}

/**
 * Pack peer domains as islands in an ocean. Items group into named chains
 * (regions / bounded-context families); within a chain they orbit a local
 * centre so related islands read as a visible archipelago cluster.
 *
 * @param {Array<Record<string, unknown>>} items
 * @returns {{
 *   islands: Array<{
 *     id: string,
 *     position: [number, number, number],
 *     radius: number,
 *     height: number,
 *     relief: number,
 *     chain: string,
 *     chainIndex: number
 *   }>,
 *   chains: Array<{ name: string, center: [number, number, number], radius: number }>,
 *   positions: Map<string, [number, number, number]>,
 *   bounds: { radius: number }
 * }}
 */
export function archipelagoLayout(items) {
  const valid = items.filter((item) => item && typeof item.id === 'string');
  const groups = new Map();
  for (const item of valid) {
    const name =
      typeof item.chain === 'string' && item.chain.trim() ? item.chain.trim() : 'Open sea';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(item);
  }

  const entries = [...groups.entries()];
  const chainSpacing = 7.4;
  const islands = [];
  const chains = [];
  const positions = new Map();

  entries.forEach(([name, group], chainIndex) => {
    const chainCenter = gridPosition(chainIndex, entries.length, chainSpacing, 0.55);
    let localRadius = 0;
    group.forEach((item, itemIndex) => {
      const mass = massValue(item);
      const relief = reliefValue(item);
      const radius = islandRadiusForMass(mass);
      const height = 0.55 + relief * 2.4 + Math.sqrt(mass) * 0.18;
      let pos;
      if (Array.isArray(item.position) && item.position.length === 3) {
        pos = [item.position[0], 0, item.position[2]];
      } else {
        const local = gridPosition(itemIndex, group.length, Math.max(2.8, radius * 1.55), 0.7);
        // Jitter keeps mechanical grids from looking like a parking lot.
        const jx = (hash01Salted(item.id, 'isle-jx') - 0.5) * radius * 0.35;
        const jz = (hash01Salted(item.id, 'isle-jz') - 0.5) * radius * 0.35;
        pos = [chainCenter[0] + local[0] + jx, 0, chainCenter[2] + local[2] + jz];
      }
      localRadius = Math.max(
        localRadius,
        Math.hypot(pos[0] - chainCenter[0], pos[2] - chainCenter[2]) + radius
      );
      islands.push({
        id: item.id,
        position: pos,
        radius,
        height,
        relief,
        chain: name,
        chainIndex
      });
      positions.set(item.id, pos);
    });
    chains.push({
      name,
      center: [chainCenter[0], 0, chainCenter[2]],
      radius: Math.max(2.4, localRadius + 0.6)
    });
  });

  // Recentre the whole composition on the origin for framing.
  let cx = 0;
  let cz = 0;
  for (const isle of islands) {
    cx += isle.position[0];
    cz += isle.position[2];
  }
  if (islands.length > 0) {
    cx /= islands.length;
    cz /= islands.length;
  }
  for (const isle of islands) {
    isle.position[0] -= cx;
    isle.position[2] -= cz;
    positions.set(isle.id, [...isle.position]);
  }
  for (const chain of chains) {
    chain.center[0] -= cx;
    chain.center[2] -= cz;
  }

  let radius = 6;
  for (const isle of islands) {
    radius = Math.max(radius, Math.hypot(isle.position[0], isle.position[2]) + isle.radius + 2.2);
  }

  return {
    islands,
    chains,
    positions,
    bounds: { radius }
  };
}
