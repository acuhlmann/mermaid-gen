import { hash01Salted } from '../seededHash.js';

function spanValue(item) {
  const raw = typeof item.span === 'number' && Number.isFinite(item.span) ? item.span : 0;
  return Math.max(0, Math.min(100, raw));
}

function loadValue(item) {
  const raw = typeof item.load === 'number' && Number.isFinite(item.load) ? item.load : 3;
  return Math.max(0.1, Math.min(10, raw));
}

function strainValue(item) {
  const raw = typeof item.strain === 'number' && Number.isFinite(item.strain) ? item.strain : 0;
  return Math.max(0, Math.min(1, raw));
}

/** Visible tower height above the deck — sqrt keeps giants from dwarfing the span. */
export function bridgeTowerHeightForLoad(load) {
  return 1.7 + Math.sqrt(Math.max(0.1, load)) * 1.2;
}

export const BRIDGE_DECK_Y = 1.15;
export const BRIDGE_CHASM_FLOOR_Y = -3.6;

/**
 * Lay out a suspension bridge across a chasm along the X axis. Items are tower
 * pylons ordered by `span` (0 = near shore, 100 = far shore); `load` sets tower
 * height, `side` groups towers by the shore/system they serve (used for tint),
 * and `strain` dips the deck locally and cracks the tower. The deck and the
 * main cables are pre-sampled polylines so the scene only draws them.
 *
 * @param {Array<Record<string, unknown>>} items
 * @returns {{
 *   towers: Array<{
 *     id: string,
 *     position: [number, number, number],
 *     topY: number,
 *     height: number,
 *     load: number,
 *     side: string,
 *     sideIndex: number,
 *     strain: number
 *   }>,
 *   sides: Array<{ name: string, index: number }>,
 *   deckSamples: Array<{ x: number, y: number }>,
 *   cableSpans: Array<Array<[number, number, number]>>,
 *   spanLength: number,
 *   bounds: { radius: number }
 * }}
 */
export function bridgeSpanLayout(items) {
  const valid = items.filter((item) => item && typeof item.id === 'string');
  const sorted = [...valid].sort(
    (a, b) => spanValue(a) - spanValue(b) || hash01Salted(a.id, 'bridge-tie') - 0.5
  );

  const sideNames = [];
  const sideIndexByName = new Map();
  for (const item of sorted) {
    const name = typeof item.side === 'string' && item.side.trim() ? item.side.trim() : '';
    if (name && !sideIndexByName.has(name)) {
      sideIndexByName.set(name, sideNames.length);
      sideNames.push(name);
    }
  }

  const spanLength = Math.max(16, Math.min(30, 12 + sorted.length * 2.2));
  const half = spanLength / 2;

  const towers = sorted.map((item) => {
    const span = spanValue(item);
    const load = loadValue(item);
    const sideName = typeof item.side === 'string' && item.side.trim() ? item.side.trim() : '';
    const height = bridgeTowerHeightForLoad(load);
    const z = (hash01Salted(item.id, 'bridge-z') - 0.5) * 0.16;
    return {
      id: item.id,
      position: [-half + (span / 100) * spanLength, 0, z],
      topY: BRIDGE_DECK_Y + height,
      height,
      load,
      side: sideName,
      sideIndex: sideName ? (sideIndexByName.get(sideName) ?? -1) : -1,
      strain: strainValue(item)
    };
  });

  // Deck: gentle global sag plus a local dip under each strained tower.
  const deckSamples = [];
  const deckSegments = 72;
  for (let i = 0; i <= deckSegments; i += 1) {
    const x = -half + (i / deckSegments) * spanLength;
    const u = (2 * x) / spanLength;
    let y = BRIDGE_DECK_Y - 0.3 * (1 - u * u);
    for (const tower of towers) {
      if (!(tower.strain > 0.05)) continue;
      const sigma = spanLength * 0.07;
      const d = (x - tower.position[0]) / sigma;
      y -= tower.strain * 0.65 * Math.exp(-d * d * 0.5);
    }
    deckSamples.push({ x, y });
  }

  // Main cables: shore anchorage → tower tops → shore anchorage, catenary sag
  // between consecutive nodes.
  const nodes = [
    [-half - 2.2, BRIDGE_DECK_Y + 0.4],
    ...towers.map((tower) => [tower.position[0], tower.topY]),
    [half + 2.2, BRIDGE_DECK_Y + 0.4]
  ];
  const cableSpans = [];
  for (let n = 0; n < nodes.length - 1; n += 1) {
    const [x1, y1] = nodes[n];
    const [x2, y2] = nodes[n + 1];
    const dist = Math.abs(x2 - x1);
    const sag = Math.min(1.4, dist * 0.14);
    const points = [];
    const segments = 14;
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const y = y1 + (y2 - y1) * t - sag * (1 - (2 * t - 1) ** 2);
      points.push([x1 + (x2 - x1) * t, y, 0]);
    }
    cableSpans.push(points);
  }

  let maxX = half + 3.5;
  let maxY = 4;
  for (const tower of towers) maxY = Math.max(maxY, tower.topY + 1.6);

  return {
    towers,
    sides: sideNames.map((name, index) => ({ name, index })),
    deckSamples,
    cableSpans,
    spanLength,
    bounds: { radius: Math.max(maxX, maxY) }
  };
}
