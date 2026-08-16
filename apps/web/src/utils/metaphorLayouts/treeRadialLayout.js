import { hash01Salted } from '../seededHash.js';

const LEVEL_HEIGHT = 3.2;
const BASE_RADIUS = 4.2;
const RADIUS_DEPTH_FACTOR = 1.4;
// Canopy margin past the outermost branch tip: a leaf cluster is drawn around
// its node, so the tree's silhouette reaches further than its last position.
const CANOPY_MARGIN = 2.2;
// Clear air between neighbouring crowns. Below this, two groves' foliage reads
// as one continuous blob and their labels contest the same pixels.
const GROVE_GAP = 2.6;
// Roots sit at trunk-top height so the renderer can draw a visible trunk below
// them (at y=0 the trunk segment would have zero length and never render).
const TRUNK_HEIGHT = 3.0;
const EXPLICIT_KINDS = new Set(['trunk', 'branch', 'leaf']);

/**
 * How far a root's own subtree spreads. Children fan out at
 * `BASE_RADIUS + depth·RADIUS_DEPTH_FACTOR` from their parent, so a deep tree
 * is a wide tree — which is exactly what the old fixed `GROVE_SPACING = 8`
 * ignored. A 3-level tree spans ~9.8 units, so two of them 8 apart had their
 * crowns growing through each other.
 */
function subtreeExtent(rootId, childrenOf) {
  let extent = 0;
  const walk = (id, depth, reach) => {
    extent = Math.max(extent, reach);
    const children = childrenOf.get(id) ?? [];
    if (!children.length) return;
    const step = BASE_RADIUS + depth * RADIUS_DEPTH_FACTOR;
    for (const child of children) walk(child.id, depth + 1, reach + step);
  };
  walk(rootId, 0, 0);
  return extent + CANOPY_MARGIN;
}

/**
 * Place the trunks of a multi-root grove on a clearing ring, giving each root an
 * arc proportional to its own crown so a big hierarchy and a two-node one both
 * get the room they need. Ring radius comes from the total circumference the
 * crowns require, so the grove grows outward rather than growing denser.
 *
 * Exported for tests: the invariant is that no two roots land closer than the
 * sum of their extents.
 *
 * @param {Array<{ id: string, extent: number }>} roots
 * @returns {Map<string, { angle: number, ringRadius: number }>}
 */
export function groveRingPlacement(roots) {
  const placement = new Map();
  if (roots.length <= 1) {
    if (roots.length === 1) placement.set(roots[0].id, { angle: 0, ringRadius: 0 });
    return placement;
  }
  const spans = roots.map((root) => 2 * root.extent + GROVE_GAP);
  const totalSpan = spans.reduce((sum, span) => sum + span, 0);
  const widest = Math.max(...roots.map((root) => root.extent));
  // Two trees on a ring sit diametrically opposite, so the ring only needs half
  // the separation their crowns demand.
  const ringRadius = Math.max(totalSpan / (2 * Math.PI), widest + GROVE_GAP / 2);
  let accumulated = 0;
  roots.forEach((root, index) => {
    const angle = ((accumulated + spans[index] / 2) / totalSpan) * Math.PI * 2;
    accumulated += spans[index];
    placement.set(root.id, { angle, ringRadius });
  });
  return placement;
}

/**
 * Layout tree items by radial branching from each root.
 * Items reference parents by id; orphans/cycles must have been cleared by the
 * sanitizer. Roots are lifted to TRUNK_HEIGHT; children fan out inside their
 * parent's angular wedge with small deterministic (id-hashed) angle/radius/
 * height jitter so the crown reads organic rather than mechanical.
 *
 * @returns {{
 *   positions: Map<string, [number, number, number]>,
 *   nodeInfo: Map<string, { kind: 'trunk'|'branch'|'leaf', depth: number, parentId: string | null, weight: number }>,
 *   roots: string[],
 *   bounds: { radius: number }
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
    const derivedKind = depth === 0 ? 'trunk' : children.length === 0 ? 'leaf' : 'branch';
    // Honor an author-declared kind (drives foliage/labels); fall back to the
    // structural one.
    const kind = EXPLICIT_KINDS.has(node.kind) ? node.kind : derivedKind;
    const weight =
      typeof node.weight === 'number' && Number.isFinite(node.weight) ? node.weight : 3;
    nodeInfo.set(node.id, { kind, depth, parentId, weight });

    if (children.length === 0) return;

    const wedge = endAngle - startAngle;
    const childWedge = wedge / children.length;
    const childRadius = BASE_RADIUS + depth * RADIUS_DEPTH_FACTOR;
    const childY = position[1] + LEVEL_HEIGHT;

    children.forEach((child, idx) => {
      const center =
        startAngle +
        (idx + 0.5) * childWedge +
        (hash01Salted(child.id, 'tree-angle') - 0.5) * childWedge * 0.3;
      const radius = childRadius * (0.86 + hash01Salted(child.id, 'tree-radius') * 0.28);
      const liftedY = childY + (hash01Salted(child.id, 'tree-lift') - 0.5) * 0.6;
      const autoPos = [
        position[0] + Math.cos(center) * radius,
        liftedY,
        position[2] + Math.sin(center) * radius
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

  // A forest of roots used to stand in a straight east–west row, which read as a
  // line-up rather than a stand of trees; phyllotaxis fixed that but packed every
  // trunk at the same fixed spacing regardless of how wide its own crown grew, so
  // a deep hierarchy's foliage grew straight through its neighbour's. The ring
  // below gives each root an arc sized to its own subtree; the id-hashed jitter
  // that survives keeps two groves of the same shape from looking identical.
  const placement = groveRingPlacement(
    roots.map((root) => ({ id: root.id, extent: subtreeExtent(root.id, childrenOf) }))
  );

  roots.forEach((root) => {
    const seat = placement.get(root.id);
    const angle = (seat?.angle ?? 0) + (hash01Salted(root.id, 'grove-spin') - 0.5) * 0.22;
    const radius = (seat?.ringRadius ?? 0) * (0.96 + hash01Salted(root.id, 'grove-radius') * 0.08);
    const autoPos =
      rootCount === 1
        ? [0, TRUNK_HEIGHT, 0]
        : [Math.cos(angle) * radius, TRUNK_HEIGHT, Math.sin(angle) * radius];
    const rootPos =
      Array.isArray(root.position) && root.position.length === 3
        ? [root.position[0], root.position[1], root.position[2]]
        : autoPos;
    place(root, rootPos, 0, null, -Math.PI, Math.PI);
  });

  let boundsRadius = 0;
  for (const pos of positions.values()) {
    boundsRadius = Math.max(boundsRadius, Math.hypot(pos[0], pos[2]));
  }

  return {
    positions,
    nodeInfo,
    roots: roots.map((r) => r.id),
    bounds: { radius: boundsRadius }
  };
}
