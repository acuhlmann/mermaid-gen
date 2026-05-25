const LEVEL_HEIGHT = 2.6;
const BASE_RADIUS = 3.2;
const RADIUS_DEPTH_FACTOR = 1.4;
const ROOT_SPACING = 12;

/**
 * Layout tree items by radial branching from each root.
 * Items reference parents by id; orphans/cycles must have been cleared by the sanitizer.
 *
 * @returns {{
 *   positions: Map<string, [number, number, number]>,
 *   nodeInfo: Map<string, { kind: 'trunk'|'branch'|'leaf', depth: number, parentId: string | null, weight: number }>,
 *   roots: string[]
 * }}
 */
export function treeRadialLayout(items) {
  const itemById = new Map();
  for (const item of items) {
    if (item && typeof item.id === 'string') itemById.set(item.id, item);
  }

  const childrenOf = new Map();
  childrenOf.set('__root__', []);
  for (const item of items) {
    if (!item || typeof item.id !== 'string') continue;
    const parent =
      typeof item.parent === 'string' && itemById.has(item.parent) ? item.parent : '__root__';
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent).push(item);
  }

  /** @type {Map<string, [number, number, number]>} */
  const positions = new Map();
  /** @type {Map<string, { kind: 'trunk'|'branch'|'leaf', depth: number, parentId: string | null, weight: number }>} */
  const nodeInfo = new Map();

  const roots = childrenOf.get('__root__') ?? [];
  const rootCount = roots.length;

  function place(node, position, depth, parentId, startAngle, endAngle) {
    positions.set(node.id, position);
    const children = childrenOf.get(node.id) ?? [];
    const kind = depth === 0 ? 'trunk' : children.length === 0 ? 'leaf' : 'branch';
    const weight = typeof node.weight === 'number' && Number.isFinite(node.weight) ? node.weight : 3;
    nodeInfo.set(node.id, { kind, depth, parentId, weight });

    if (children.length === 0) return;

    const wedge = endAngle - startAngle;
    const childWedge = wedge / children.length;
    const childRadius = BASE_RADIUS + depth * RADIUS_DEPTH_FACTOR;
    const childY = position[1] + LEVEL_HEIGHT;

    children.forEach((child, idx) => {
      const center = startAngle + (idx + 0.5) * childWedge;
      const autoPos = [
        position[0] + Math.cos(center) * childRadius,
        childY,
        position[2] + Math.sin(center) * childRadius
      ];
      const childPos =
        Array.isArray(child.position) && child.position.length === 3
          ? [child.position[0], child.position[1], child.position[2]]
          : autoPos;
      place(
        child,
        childPos,
        depth + 1,
        node.id,
        startAngle + idx * childWedge,
        startAngle + (idx + 1) * childWedge
      );
    });
  }

  roots.forEach((root, rootIdx) => {
    const rootX = rootCount === 1 ? 0 : (rootIdx - (rootCount - 1) / 2) * ROOT_SPACING;
    const autoPos = [rootX, 0, 0];
    const rootPos =
      Array.isArray(root.position) && root.position.length === 3
        ? [root.position[0], root.position[1], root.position[2]]
        : autoPos;
    place(root, rootPos, 0, null, -Math.PI, Math.PI);
  });

  return { positions, nodeInfo, roots: roots.map((r) => r.id) };
}
