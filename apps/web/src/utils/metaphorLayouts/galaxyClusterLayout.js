const DEFAULT_CLUSTER = 'main';

function clusterKey(item) {
  const raw = item.cluster;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : DEFAULT_CLUSTER;
}

/**
 * Layout galaxy stars grouped by cluster.
 * @returns {{ positions: Map<string, [number, number, number]>, clusters: Array<{ name: string, center: [number, number, number], index: number }> }}
 */
export function galaxyClusterLayout(items) {
  /** @type {Map<string, typeof items>} */
  const groups = new Map();
  for (const item of items) {
    const key = clusterKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const clusterNames = [...groups.keys()];
  const clusterCount = clusterNames.length;
  const outerRadius = 4 + clusterCount * 2.5;

  /** @type {Map<string, [number, number, number]>} */
  const positions = new Map();
  /** @type {Array<{ name: string, center: [number, number, number], index: number }>} */
  const clusters = [];

  clusterNames.forEach((name, clusterIndex) => {
    const group = groups.get(name);
    const angle = (clusterIndex / Math.max(1, clusterCount)) * Math.PI * 2;
    const centerX = Math.cos(angle) * outerRadius;
    const centerZ = Math.sin(angle) * outerRadius;
    const center = [centerX, 0, centerZ];

    clusters.push({ name, center, index: clusterIndex });

    group.forEach((item, idx) => {
      if (Array.isArray(item.position) && item.position.length === 3) {
        positions.set(item.id, [...item.position]);
        return;
      }
      const starAngle = (idx / Math.max(1, group.length)) * Math.PI * 2;
      const ring = 1 + Math.floor(idx / 8);
      const r = 1.5 * ring + (idx % 3) * 0.4;
      const y = ((idx % 5) - 2) * 0.5;
      positions.set(item.id, [
        centerX + Math.cos(starAngle) * r,
        y,
        centerZ + Math.sin(starAngle) * r
      ]);
    });
  });

  return { positions, clusters };
}
