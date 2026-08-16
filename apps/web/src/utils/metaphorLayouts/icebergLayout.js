/**
 * Lay out floating masses for the `iceberg` metaphor.
 *
 * The whole grammar is one signed axis with a hard boundary: `depth` runs −1
 * (deep below the waterline) to +1 (high above it), and y = 0 means "the line
 * between what people see and what actually carries it". No other kind has a
 * semantic zero — terrain's baseline is a free parameter and layercake stacks
 * upward from the ground — which is why hidden cost, unseen effort, and the
 * gap between the demo and the system had nowhere good to live.
 *
 * Blocks group into named `berg`s; each berg is one floating mass placed on a
 * ring, with its own blocks stacked through the waterline in depth order.
 */
import { hash01Salted } from '../seededHash.js';

const DEFAULT_BERG = 'The berg';
/** World height of the tallest peak / deepest keel, per unit of |depth|. */
export const ICEBERG_VERTICAL_SCALE = 5.2;
/** Clear water between neighbouring bergs. */
const BERG_GAP = 2.4;

/** Block half-width from its mass. */
export function icebergBlockRadius(mass) {
  // Deliberately generous relative to ICEBERG_VERTICAL_SCALE: neighbouring
  // blocks have to OVERLAP or a berg reads as a column of separate boulders
  // rather than one fractured mass of ice.
  return 1.05 + Math.sqrt(Math.max(0.1, mass ?? 5)) * 0.5;
}

function depthValue(item) {
  const raw = typeof item.depth === 'number' && Number.isFinite(item.depth) ? item.depth : 0.4;
  return Math.max(-1, Math.min(1, raw));
}

function bergKey(item) {
  const raw = item.berg;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : DEFAULT_BERG;
}

/**
 * @param {Array<Record<string, unknown>>} items
 * @returns {{
 *   positions: Map<string, [number, number, number]>,
 *   bergs: Array<{ name: string, center: [number, number, number], radius: number, above: number, below: number }>,
 *   bounds: { radius: number },
 *   extent: { above: number, below: number }
 * }}
 */
export function icebergLayout(items) {
  const valid = items.filter((item) => item && typeof item.id === 'string');

  /** @type {Map<string, Array<Record<string, unknown>>>} */
  const groups = new Map();
  for (const item of valid) {
    const key = bergKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  // Surface-first ordering: within a berg the visible tip stacks above the
  // waterline and the hidden bulk hangs below it, so reading top to bottom is
  // reading "what you see" to "what holds it up".
  for (const blocks of groups.values()) {
    blocks.sort((a, b) => depthValue(b) - depthValue(a));
  }

  const names = [...groups.keys()];
  // Berg radius is set by its widest block, so a heavy berg claims more water.
  const bergRadii = names.map((name) =>
    groups.get(name).reduce((max, item) => Math.max(max, icebergBlockRadius(item.mass)), 1.4)
  );

  /** @type {Map<string, [number, number, number]>} */
  const positions = new Map();
  const bergs = [];

  const ringRadius =
    names.length <= 1
      ? 0
      : Math.max(
          // Circumference has to seat every berg's full width plus clear water.
          bergRadii.reduce((sum, radius) => sum + 2 * radius + BERG_GAP, 0) / (2 * Math.PI),
          Math.max(...bergRadii) + BERG_GAP / 2
        );

  names.forEach((name, index) => {
    const blocks = groups.get(name);
    const angle =
      (index / Math.max(1, names.length)) * Math.PI * 2 +
      (hash01Salted(name, 'berg-spin') - 0.5) * 0.18;
    const center =
      names.length <= 1
        ? [0, 0, 0]
        : [Math.cos(angle) * ringRadius, 0, Math.sin(angle) * ringRadius];

    let above = 0;
    let below = 0;
    blocks.forEach((item, blockIndex) => {
      const depth = depthValue(item);
      const y = depth * ICEBERG_VERTICAL_SCALE;
      above = Math.max(above, y);
      below = Math.min(below, y);
      if (Array.isArray(item.position) && item.position.length === 3) {
        positions.set(item.id, [...item.position]);
        return;
      }
      // Small deterministic drift so a stack of blocks reads as fractured ice
      // rather than a column of identical boxes.
      const drift = icebergBlockRadius(item.mass) * 0.32;
      positions.set(item.id, [
        center[0] + (hash01Salted(`${item.id}|${blockIndex}`, 'berg-x') - 0.5) * drift,
        y,
        center[2] + (hash01Salted(`${item.id}|${blockIndex}`, 'berg-z') - 0.5) * drift
      ]);
    });

    bergs.push({ name, center, radius: bergRadii[index], above, below });
  });

  let radius = 5;
  for (let i = 0; i < bergs.length; i += 1) {
    radius = Math.max(
      radius,
      Math.hypot(bergs[i].center[0], bergs[i].center[2]) + bergRadii[i] + 1.6
    );
  }

  return {
    positions,
    bergs,
    bounds: { radius },
    extent: {
      above: bergs.reduce((max, berg) => Math.max(max, berg.above), 0),
      below: bergs.reduce((min, berg) => Math.min(min, berg.below), 0)
    }
  };
}
