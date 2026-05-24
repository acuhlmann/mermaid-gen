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
 * @returns {{ positions: Map<string, [number, number, number]>, districts: Array<{ name: string, center: [number, number, number], size: [number, number] }> }}
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
    const row = Math.floor(patchIndex / cols);

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
      positions.set(item.id, [
        patchCenterX + local[0],
        local[1],
        patchCenterZ + local[2]
      ]);
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

  return { positions, districts };
}
