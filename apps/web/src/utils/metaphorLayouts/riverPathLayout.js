import { hash01Salted } from '../seededHash.js';

const SAMPLES = 140;

function flowValue(item) {
  const raw = typeof item.flow === 'number' && Number.isFinite(item.flow) ? item.flow : 5;
  return Math.max(0.1, Math.min(20, raw));
}

function stageValue(item, index) {
  const raw = typeof item.stage === 'number' && Number.isFinite(item.stage) ? item.stage : 0;
  // Tiny index epsilon keeps ties in authoring order under a stable sort.
  return raw + index * 1e-6;
}

/** Channel half-width for a given flow volume. */
export function riverWidthForFlow(flow) {
  return 0.8 + Math.sqrt(Math.max(0.1, flow)) * 0.85;
}

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/**
 * Layout river stations along a winding serpentine, source → mouth, ordered by
 * `stage`. Returns a smoothed centreline sampled with per-sample channel width
 * (interpolated from each station's `flow`), station anchor points on
 * alternating banks, and the overall extent for framing.
 *
 * @returns {{
 *   samples: Array<{ x: number, z: number, width: number, t: number }>,
 *   stations: Array<{
 *     id: string,
 *     index: number,
 *     point: [number, number, number],
 *     bank: [number, number, number],
 *     side: 1 | -1,
 *     tangent: [number, number]
 *   }>,
 *   positions: Map<string, [number, number, number]>,
 *   bounds: { halfExtent: number }
 * }}
 */
export function riverPathLayout(items) {
  const valid = items.filter((item) => item && typeof item.id === 'string');
  const ordered = valid
    .map((item, index) => ({ item, key: stageValue(item, index) }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.item);

  const count = ordered.length;
  if (count === 0) {
    return { samples: [], stations: [], positions: new Map(), bounds: { halfExtent: 10 } };
  }

  const halfExtent = Math.max(9, Math.min(26, 5 + count * 2.1));
  const amplitude = halfExtent * 0.3;

  // Control points: an upstream spring lead-in, one point per station, and a
  // widening run-out toward the mouth.
  const controls = [];
  const stationControlIndex = [];
  const firstWidth = riverWidthForFlow(flowValue(ordered[0]));
  // Soft lead-in (not a needle point) — abrupt width collapse at the source
  // flipped ribbon normals and produced flicker against the spring stones.
  // Keep lead-in width close to the first station so the trimmed ribbon still
  // meets the spring pool without a kink.
  controls.push({
    x: -halfExtent - 3.5,
    z: (hash01Salted('river', 'lead-z') - 0.5) * amplitude * 0.6,
    width: firstWidth * 0.92
  });
  controls.push({
    x: -halfExtent - 1.6,
    z: (hash01Salted('river', 'lead2-z') - 0.5) * amplitude * 0.45,
    width: firstWidth * 0.96
  });
  ordered.forEach((item, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1);
    let x = -halfExtent + t * halfExtent * 2;
    let z =
      Math.sin(t * Math.PI * 2.1 + hash01Salted('river', 'phase') * Math.PI) * amplitude +
      (hash01Salted(item.id, 'river-z') - 0.5) * amplitude * 0.35;
    if (Array.isArray(item.position) && item.position.length === 3) {
      x = item.position[0];
      z = item.position[2];
    }
    stationControlIndex.push(controls.length);
    controls.push({ x, z, width: riverWidthForFlow(flowValue(item)) });
  });
  const last = controls[controls.length - 1];
  // Intermediate flare sample keeps the mouth widen gradual (no hard kink).
  controls.push({
    x: halfExtent + 1.6,
    z: last.z * 0.72,
    width: last.width * 1.25
  });
  controls.push({
    x: halfExtent + 4,
    z: last.z * 0.5,
    // The mouth flares into a delta so the story has a visible destination.
    width: last.width * 1.55
  });

  // Catmull-Rom through the controls (endpoints duplicated for clamped ends).
  const padded = [controls[0], ...controls, controls[controls.length - 1]];
  const segments = padded.length - 3;
  const samples = [];
  for (let s = 0; s <= SAMPLES; s += 1) {
    const global = (s / SAMPLES) * segments;
    const seg = Math.min(segments - 1, Math.floor(global));
    const t = global - seg;
    const [p0, p1, p2, p3] = [padded[seg], padded[seg + 1], padded[seg + 2], padded[seg + 3]];
    samples.push({
      x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
      z: catmullRom(p0.z, p1.z, p2.z, p3.z, t),
      width: catmullRom(p0.width, p1.width, p2.width, p3.width, t),
      t: s / SAMPLES
    });
  }

  const stations = [];
  const positions = new Map();
  ordered.forEach((item, i) => {
    const ctrl = controls[stationControlIndex[i]];
    // Tangent from the neighbouring controls, for bank-side placement.
    const prev = controls[stationControlIndex[i] - 1] ?? ctrl;
    const next = controls[stationControlIndex[i] + 1] ?? ctrl;
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    const tangent = [dx / len, dz / len];
    const side = i % 2 === 0 ? 1 : -1;
    const offset = ctrl.width + 1.15;
    const bank = [ctrl.x - tangent[1] * offset * side, 0, ctrl.z + tangent[0] * offset * side];
    const point = [ctrl.x, 0, ctrl.z];
    stations.push({ id: item.id, index: i, point, bank, side, tangent });
    positions.set(item.id, bank);
  });

  return { samples, stations, positions, bounds: { halfExtent: halfExtent + 5 } };
}
