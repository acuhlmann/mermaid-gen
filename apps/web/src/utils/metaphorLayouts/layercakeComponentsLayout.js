/**
 * Chip positions on a layer slab rim.
 * @param {number} radius
 * @param {string[]} components
 * @returns {Array<{ label: string, position: [number, number, number], angle: number }>}
 */
export function layercakeComponentPositions(radius, components) {
  const list = Array.isArray(components) ? components.filter(Boolean) : [];
  if (list.length === 0) return [];

  return list.map((label, i) => {
    const angle = (i / list.length) * Math.PI * 2;
    const chipRadius = radius + 0.9;
    return {
      label,
      angle,
      position: [Math.cos(angle) * chipRadius, 0, Math.sin(angle) * chipRadius]
    };
  });
}

/**
 * Stack Y offsets for layercake items.
 * @returns {{ yOffsets: Map<string, number>, stackHeight: number }}
 */
export function layercakeStackLayout(items) {
  /** @type {Map<string, number>} */
  const yOffsets = new Map();
  let y = 0;
  for (const item of items) {
    yOffsets.set(item.id, y);
    y += Math.max(0.2, item.thickness ?? 1) + 0.05;
  }
  return { yOffsets, stackHeight: y };
}

/** Variable slab radius from thickness and component count. */
export function layercakeSlabRadius(item) {
  const thickness = Math.max(0.2, item.thickness ?? 1);
  const componentCount = Array.isArray(item.components) ? item.components.length : 0;
  return Math.min(10, 4 + thickness * 0.4 + componentCount * 0.15);
}
