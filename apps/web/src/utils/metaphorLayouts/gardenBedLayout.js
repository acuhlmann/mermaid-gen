import { gridPosition } from './gridPosition.js';

/**
 * Pack portfolio items into named garden beds. The mature/impact encodings do
 * not affect placement, so lifecycle changes animate vertically without
 * shuffling the whole composition.
 *
 * @param {Array<Record<string, unknown>>} items
 */
export function gardenBedLayout(items) {
  const groups = new Map();
  for (const item of items) {
    const name =
      typeof item.bed === 'string' && item.bed.trim() ? item.bed.trim() : 'Shared garden';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(item);
  }

  const entries = [...groups.entries()];
  const positions = new Map();
  const beds = [];
  entries.forEach(([name, group], bedIndex) => {
    const center = gridPosition(bedIndex, entries.length, 4.7, 0.4);
    const localCols = Math.max(1, Math.ceil(Math.sqrt(group.length)));
    const localRows = Math.ceil(group.length / localCols);
    const localSpacing = 2.15;
    const size = [
      Math.max(3.1, (localCols - 1) * localSpacing + 2.4),
      Math.max(3.1, (localRows - 1) * localSpacing + 2.4)
    ];
    group.forEach((item, itemIndex) => {
      if (Array.isArray(item.position) && item.position.length === 3) {
        positions.set(item.id, [...item.position]);
        return;
      }
      const local = gridPosition(itemIndex, group.length, 1.55, 0.6);
      positions.set(item.id, [center[0] + local[0], 0, center[2] + local[2]]);
    });
    beds.push({ name, center, size });
  });

  let radius = 0;
  for (const bed of beds) {
    radius = Math.max(
      radius,
      Math.hypot(
        Math.abs(bed.center[0]) + bed.size[0] / 2,
        Math.abs(bed.center[2]) + bed.size[1] / 2
      )
    );
  }
  for (const [x, , z] of positions.values()) radius = Math.max(radius, Math.hypot(x, z) + 1.2);

  return {
    positions,
    beds,
    bounds: { width: radius * 2, depth: radius * 2, radius }
  };
}
