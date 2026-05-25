import { gridPosition } from './gridPosition.js';

const GRID_SIZE = 64;
const HALF_EXTENT = 15;
const ITEM_SPREAD = 11;

function resolveBaseline(scene) {
  if (!scene || typeof scene !== 'object' || scene === null) return 0;
  const surface = scene.surface;
  if (!surface || typeof surface !== 'object') return 0;
  return typeof surface.baseline === 'number' ? surface.baseline : 0;
}

function hasExplicitPosition(item) {
  return Array.isArray(item?.position) && item.position.length === 3;
}

function resolvePlots(items) {
  const autoIndex = new Map();
  let autoCount = 0;
  for (const item of items) {
    if (!item || typeof item.id !== 'string') continue;
    if (!hasExplicitPosition(item)) {
      autoIndex.set(item.id, autoCount);
      autoCount += 1;
    }
  }

  const autoScale = autoCount > 0 ? ITEM_SPREAD / (Math.ceil(Math.sqrt(autoCount)) * 1.5) : 1;

  const plots = [];
  for (const item of items) {
    if (!item || typeof item.id !== 'string') continue;
    let x;
    let z;
    if (hasExplicitPosition(item)) {
      x = item.position[0];
      z = item.position[2];
    } else {
      const idx = autoIndex.get(item.id) ?? 0;
      const local = gridPosition(idx, autoCount, 2);
      x = local[0] * autoScale;
      z = local[2] * autoScale;
    }
    const elevation = typeof item.elevation === 'number' ? item.elevation : 3;
    const intensity = typeof item.intensity === 'number' && item.intensity > 0 ? item.intensity : 3;
    plots.push({ id: item.id, x, z, elevation, intensity });
  }
  return plots;
}

function buildVertices(plots, baseline) {
  const vertices = new Float32Array(GRID_SIZE * GRID_SIZE * 3);
  let minHeight = Infinity;
  let maxHeight = -Infinity;

  for (let gz = 0; gz < GRID_SIZE; gz += 1) {
    for (let gx = 0; gx < GRID_SIZE; gx += 1) {
      const x = -HALF_EXTENT + (gx / (GRID_SIZE - 1)) * (2 * HALF_EXTENT);
      const z = -HALF_EXTENT + (gz / (GRID_SIZE - 1)) * (2 * HALF_EXTENT);

      let h = baseline;
      for (const plot of plots) {
        const dx = x - plot.x;
        const dz = z - plot.z;
        const d2 = dx * dx + dz * dz;
        h += plot.elevation * Math.exp(-d2 / (2 * plot.intensity * plot.intensity));
      }

      const vi = (gz * GRID_SIZE + gx) * 3;
      vertices[vi] = x;
      vertices[vi + 1] = h;
      vertices[vi + 2] = z;

      if (h < minHeight) minHeight = h;
      if (h > maxHeight) maxHeight = h;
    }
  }

  const safeMin = Number.isFinite(minHeight) ? minHeight : 0;
  const safeMax = Number.isFinite(maxHeight) ? maxHeight : 0;
  return { vertices, minHeight: safeMin, maxHeight: safeMax };
}

function buildIndices() {
  const indices = new Uint32Array((GRID_SIZE - 1) * (GRID_SIZE - 1) * 6);
  let ii = 0;
  for (let z = 0; z < GRID_SIZE - 1; z += 1) {
    for (let x = 0; x < GRID_SIZE - 1; x += 1) {
      const a = z * GRID_SIZE + x;
      const b = z * GRID_SIZE + x + 1;
      const c = (z + 1) * GRID_SIZE + x;
      const d = (z + 1) * GRID_SIZE + x + 1;
      indices[ii++] = a;
      indices[ii++] = c;
      indices[ii++] = b;
      indices[ii++] = b;
      indices[ii++] = c;
      indices[ii++] = d;
    }
  }
  return indices;
}

function clampGridIndex(value) {
  return Math.max(0, Math.min(GRID_SIZE - 1, Math.round(((value + HALF_EXTENT) / (2 * HALF_EXTENT)) * (GRID_SIZE - 1))));
}

function snapItemPositions(plots, vertices) {
  const itemPositions = new Map();
  for (const plot of plots) {
    const gx = clampGridIndex(plot.x);
    const gz = clampGridIndex(plot.z);
    const vi = (gz * GRID_SIZE + gx) * 3;
    const y = vertices[vi + 1];
    itemPositions.set(plot.id, [plot.x, y, plot.z]);
  }
  return itemPositions;
}

/**
 * Build a Gaussian heightmap for terrain items. Each item contributes a peak
 * (or pit, for negative elevation) at its position with falloff controlled by intensity.
 *
 * @returns {{
 *   vertices: Float32Array,
 *   indices: Uint32Array,
 *   itemPositions: Map<string, [number, number, number]>,
 *   bounds: { minHeight: number, maxHeight: number },
 *   gridSize: number,
 *   halfExtent: number
 * }}
 */
export function terrainHeightmap(items, scene) {
  const baseline = resolveBaseline(scene);
  const plots = resolvePlots(items);
  const { vertices, minHeight, maxHeight } = buildVertices(plots, baseline);
  const indices = buildIndices();
  const itemPositions = snapItemPositions(plots, vertices);

  return {
    vertices,
    indices,
    itemPositions,
    bounds: { minHeight, maxHeight },
    gridSize: GRID_SIZE,
    halfExtent: HALF_EXTENT
  };
}

/**
 * Sample a height value at (x, z) by nearest-cell lookup on the heightmap.
 */
export function sampleTerrainHeight(heightmap, x, z) {
  const { vertices, gridSize, halfExtent } = heightmap;
  const u = (x + halfExtent) / (2 * halfExtent);
  const v = (z + halfExtent) / (2 * halfExtent);
  const gx = Math.max(0, Math.min(gridSize - 1, Math.round(u * (gridSize - 1))));
  const gz = Math.max(0, Math.min(gridSize - 1, Math.round(v * (gridSize - 1))));
  const vi = (gz * gridSize + gx) * 3;
  return vertices[vi + 1];
}

/**
 * Map a height value to a color ramp (low=cool green, mid=amber, high=warm red).
 * Returns [r, g, b] in 0-1.
 */
export function heightColor(height, bounds) {
  const { minHeight, maxHeight } = bounds;
  const range = Math.max(0.001, maxHeight - minHeight);
  const t = Math.max(0, Math.min(1, (height - minHeight) / range));

  if (t < 0.5) {
    const k = t * 2;
    return [0.45 + 0.4 * k, 0.62 + 0.18 * k, 0.45 - 0.3 * k];
  }
  const k = (t - 0.5) * 2;
  return [0.85 + 0.1 * k, 0.55 - 0.3 * k, 0.18 + 0.1 * k];
}
