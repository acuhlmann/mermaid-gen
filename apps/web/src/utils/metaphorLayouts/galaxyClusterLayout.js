import { hash01Salted } from '../seededHash.js';

const DEFAULT_CLUSTER = 'main';
// Golden angle (radians) — phyllotaxis spacing makes each cluster a natural
// spiral disc instead of mechanical concentric rings.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function clusterKey(item) {
  const raw = item.cluster;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : DEFAULT_CLUSTER;
}

/**
 * Layout galaxy stars grouped by cluster. Each cluster is a phyllotaxis star
 * disc — dense at the core, thinning toward the rim, vertically thicker near
 * the centre — centred on a ring around the origin (a single cluster sits at
 * the origin). Cluster centres get a small deterministic Y offset so the scene
 * isn't perfectly planar.
 *
 * @returns {{
 *   positions: Map<string, [number, number, number]>,
 *   clusters: Array<{ name: string, center: [number, number, number], index: number, count: number, radius: number }>
 * }}
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
  const ringRadius = clusterCount === 1 ? 0 : 4 + clusterCount * 2.5;

  /** @type {Map<string, [number, number, number]>} */
  const positions = new Map();
  /** @type {Array<{ name: string, center: [number, number, number], index: number, count: number, radius: number }>} */
  const clusters = [];

  clusterNames.forEach((name, clusterIndex) => {
    const group = groups.get(name);
    const count = group.length;
    // Disc radius grows with membership so big clusters read bigger; generous
    // spacing keeps star halos from mushing together near the core.
    const spread = Math.min(9, 2.4 + Math.sqrt(count) * 1.35);
    const angle = (clusterIndex / Math.max(1, clusterCount)) * Math.PI * 2;
    const centerY = (hash01Salted(name, 'cluster-y') - 0.5) * 2.4;
    const center = [Math.cos(angle) * ringRadius, centerY, Math.sin(angle) * ringRadius];

    clusters.push({ name, center, index: clusterIndex, count, radius: spread });

    const spin = hash01Salted(name, 'cluster-spin') * Math.PI * 2;
    group.forEach((item, idx) => {
      if (Array.isArray(item.position) && item.position.length === 3) {
        positions.set(item.id, [...item.position]);
        return;
      }
      const rim = count === 1 ? 0 : Math.sqrt((idx + 0.55) / count); // 0 = core → 1 = rim
      const r = spread * rim;
      const starAngle = spin + idx * GOLDEN_ANGLE;
      const discThickness = 1.6 * (1 - rim * 0.65);
      const y = center[1] + (hash01Salted(item.id, 'star-y') - 0.5) * discThickness;
      positions.set(item.id, [
        center[0] + Math.cos(starAngle) * r,
        y,
        center[2] + Math.sin(starAngle) * r
      ]);
    });
  });

  return { positions, clusters };
}
