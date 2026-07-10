import { hash01Salted } from '../seededHash.js';

// Golden angle (radians) — spreads same-ring planets without mechanical symmetry.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const FIRST_RING_RADIUS = 4.4;
const RING_SPACING = 2.7;

function orbitValue(item) {
  return typeof item.orbit === 'number' && Number.isFinite(item.orbit) ? item.orbit : 3;
}

function hasExplicitPosition(item) {
  return Array.isArray(item?.position) && item.position.length === 3;
}

/**
 * Layout orrery bodies. Items with orbit 0 are suns at the centre (a tiny ring
 * when there are several — a binary core). Remaining non-moon items group into
 * concentric rings by distinct orbit value (ascending), spread around each ring
 * with golden-angle spacing. Moons sit beside their parent planet on a small
 * local orbit. Explicit item.position always wins.
 *
 * @returns {{
 *   positions: Map<string, [number, number, number]>,
 *   rings: Array<{ radius: number, orbit: number, index: number, count: number }>,
 *   sunIds: string[],
 *   moonParent: Map<string, string>,
 *   bounds: { radius: number }
 * }}
 */
function classifyBodies(items) {
  const valid = items.filter((item) => item && typeof item.id === 'string');
  const byId = new Map(valid.map((item) => [item.id, item]));
  const suns = [];
  const moons = [];
  const planets = [];
  for (const item of valid) {
    if (typeof item.moon === 'string' && byId.has(item.moon) && item.moon !== item.id) {
      moons.push(item);
    } else if (orbitValue(item) === 0) {
      suns.push(item);
    } else {
      planets.push(item);
    }
  }
  return { suns, moons, planets };
}

function placeSuns(suns, positions) {
  const sunRing = suns.length > 1 ? 1.7 : 0;
  suns.forEach((sun, idx) => {
    if (hasExplicitPosition(sun)) {
      positions.set(sun.id, [...sun.position]);
      return;
    }
    const angle = (idx / Math.max(1, suns.length)) * Math.PI * 2;
    positions.set(sun.id, [Math.cos(angle) * sunRing, 0, Math.sin(angle) * sunRing]);
  });
}

function placeMoons(moons, positions) {
  /** @type {Map<string, string>} */
  const moonParent = new Map();
  for (const moon of moons) {
    moonParent.set(moon.id, moon.moon);
    if (hasExplicitPosition(moon)) {
      positions.set(moon.id, [...moon.position]);
      continue;
    }
    const parentPos = positions.get(moon.moon) ?? [0, 0, 0];
    const angle = hash01Salted(moon.id, 'moon-angle') * Math.PI * 2;
    const dist = 1.35 + hash01Salted(moon.id, 'moon-dist') * 0.6;
    positions.set(moon.id, [
      parentPos[0] + Math.cos(angle) * dist,
      parentPos[1] + 0.35 + hash01Salted(moon.id, 'moon-y') * 0.3,
      parentPos[2] + Math.sin(angle) * dist
    ]);
  }
  return moonParent;
}

export function orreryOrbitLayout(items) {
  const { suns, moons, planets } = classifyBodies(items);

  /** @type {Map<string, [number, number, number]>} */
  const positions = new Map();
  placeSuns(suns, positions);

  // Distinct orbit values → concentric rings, closest first. Index-based radii
  // keep neighbouring rings readable even when orbit values nearly collide;
  // the raw orbit number still shows in the hover tooltip.
  const ringValues = [...new Set(planets.map((p) => orbitValue(p)))].sort((a, b) => a - b);
  const ringIndexByValue = new Map(ringValues.map((value, idx) => [value, idx]));
  const ringCounts = new Map();
  for (const planet of planets) {
    const value = orbitValue(planet);
    ringCounts.set(value, (ringCounts.get(value) ?? 0) + 1);
  }

  const rings = ringValues.map((value, idx) => ({
    radius: FIRST_RING_RADIUS + idx * RING_SPACING,
    orbit: value,
    index: idx,
    count: ringCounts.get(value) ?? 0
  }));

  const perRingCounter = new Map();
  for (const planet of planets) {
    if (hasExplicitPosition(planet)) {
      positions.set(planet.id, [...planet.position]);
      continue;
    }
    const value = orbitValue(planet);
    const ringIdx = ringIndexByValue.get(value) ?? 0;
    const radius = FIRST_RING_RADIUS + ringIdx * RING_SPACING;
    const slot = perRingCounter.get(value) ?? 0;
    perRingCounter.set(value, slot + 1);
    const spin = hash01Salted(`ring-${value}`, 'orrery-spin') * Math.PI * 2;
    const count = ringCounts.get(value) ?? 1;
    // Even spacing when a ring is crowded; golden-angle drift keeps sparse
    // rings from lining every planet up on one axis.
    const angle = count > 2 ? spin + (slot / count) * Math.PI * 2 : spin + slot * GOLDEN_ANGLE;
    const y = (hash01Salted(planet.id, 'orrery-y') - 0.5) * 0.7;
    positions.set(planet.id, [Math.cos(angle) * radius, y, Math.sin(angle) * radius]);
  }

  const moonParent = placeMoons(moons, positions);

  const outermost = rings.length > 0 ? rings[rings.length - 1].radius : FIRST_RING_RADIUS;
  return {
    positions,
    rings,
    sunIds: suns.map((s) => s.id),
    moonParent,
    bounds: { radius: outermost + 2.2 }
  };
}
