import { gridPosition } from './gridPosition.js';

const DEFAULT_DISTRICT = 'core';
const DISTRICT_GAP = 4;

function districtKey(item) {
  const raw = item.district;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : DEFAULT_DISTRICT;
}

function patchSpan(count, maxFootprint, gap = 1.2) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / cols);
  const spacing = maxFootprint + gap;
  return {
    width: Math.max(spacing, (cols - 1) * spacing + maxFootprint),
    depth: Math.max(spacing, (rows - 1) * spacing + maxFootprint)
  };
}

/**
 * Layout city items grouped by district on the XZ plane.
 *
 * Districts are packed into a grid growing along +X/+Z, then the whole
 * composition is recentred so its footprint midpoint sits at the world origin —
 * that's what lets the circular footing (drawn at the origin) frame the city
 * instead of the city drifting to one edge of it. `bounds.radius` is the
 * half-diagonal of the recentred footprint, used to size that footing.
 *
 * @returns {{ positions: Map<string, [number, number, number]>, districts: Array<{ name: string, center: [number, number, number], size: [number, number] }>, districtIndexOf: Map<string, number>, bounds: { width: number, depth: number, radius: number } }}
 */
export function cityDistrictLayout(items) {
  /** @type {Map<string, typeof items>} */
  const groups = new Map();
  for (const item of items) {
    const key = districtKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const districtNames = [...groups.keys()];
  const districtCount = districtNames.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(districtCount)));

  /** @type {Map<string, [number, number, number]>} */
  const positions = new Map();
  /** @type {Array<{ name: string, center: [number, number, number], size: [number, number] }>} */
  const districts = [];

  let patchIndex = 0;
  let rowMaxDepth = 0;
  let cursorX = 0;
  let cursorZ = 0;

  for (const name of districtNames) {
    const group = groups.get(name);
    const maxFootprint = Math.max(0.5, ...group.map((i) => i.footprint ?? 2));
    const span = patchSpan(group.length, maxFootprint);
    const col = patchIndex % cols;

    if (col === 0 && patchIndex > 0) {
      cursorZ += rowMaxDepth + DISTRICT_GAP;
      cursorX = 0;
      rowMaxDepth = 0;
    }

    const patchCenterX = cursorX + span.width / 2;
    const patchCenterZ = cursorZ + span.depth / 2;

    group.forEach((item, idx) => {
      if (Array.isArray(item.position) && item.position.length === 3) {
        positions.set(item.id, [...item.position]);
        return;
      }
      const local = gridPosition(idx, group.length, maxFootprint);
      positions.set(item.id, [patchCenterX + local[0], local[1], patchCenterZ + local[2]]);
    });

    districts.push({
      name,
      center: [patchCenterX, 0, patchCenterZ],
      size: [span.width + 1, span.depth + 1]
    });

    cursorX += span.width + DISTRICT_GAP;
    rowMaxDepth = Math.max(rowMaxDepth, span.depth);
    patchIndex += 1;
  }

  // Recentre the whole composition on the world origin. Footprint bounds come
  // from the district patches (they bound their buildings) plus any explicitly
  // positioned items, which opt out of the grid and could sit outside a patch.
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const d of districts) {
    minX = Math.min(minX, d.center[0] - d.size[0] / 2);
    maxX = Math.max(maxX, d.center[0] + d.size[0] / 2);
    minZ = Math.min(minZ, d.center[2] - d.size[1] / 2);
    maxZ = Math.max(maxZ, d.center[2] + d.size[1] / 2);
  }
  for (const [x, , z] of positions.values()) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  if (!Number.isFinite(minX)) {
    minX = maxX = minZ = maxZ = 0;
  }

  const offsetX = (minX + maxX) / 2;
  const offsetZ = (minZ + maxZ) / 2;
  for (const [id, pos] of positions) {
    positions.set(id, [pos[0] - offsetX, pos[1], pos[2] - offsetZ]);
  }
  for (const d of districts) {
    d.center = [d.center[0] - offsetX, d.center[1], d.center[2] - offsetZ];
  }

  const width = Math.max(0, maxX - minX);
  const depth = Math.max(0, maxZ - minZ);
  const radius = Math.hypot(width, depth) / 2;

  // Which district slot each building belongs to. The scene needs this to give
  // a tower its neighbourhood's colour (see `groupIdentity.js`), and it is
  // returned from here rather than re-derived at the use site so the tint and
  // the patch a tower stands on can never disagree about what `districtKey`
  // means — an item with no `district` falls into the same default bucket as
  // its patch does.
  /** @type {Map<string, number>} */
  const districtIndexOf = new Map();
  const slotOfName = new Map(districtNames.map((name, idx) => [name, idx]));
  for (const item of items) {
    districtIndexOf.set(item.id, slotOfName.get(districtKey(item)) ?? 0);
  }

  return { positions, districts, districtIndexOf, bounds: { width, depth, radius } };
}
