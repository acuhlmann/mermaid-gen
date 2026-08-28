import { hash01Salted } from '../seededHash.js';
import { gridPosition } from './gridPosition.js';

function massValue(item) {
  const raw = typeof item.mass === 'number' && Number.isFinite(item.mass) ? item.mass : 4;
  return Math.max(0.5, Math.min(20, raw));
}

function reliefValue(item) {
  const raw = typeof item.relief === 'number' && Number.isFinite(item.relief) ? item.relief : 0.45;
  return Math.max(0, Math.min(1, raw));
}

/** Island radius from domain mass — sqrt keeps giants from eating the ocean. */
export function islandRadiusForMass(mass) {
  return 0.85 + Math.sqrt(Math.max(0.5, mass)) * 0.72;
}

/**
 * World-Y of an island's summit — the point its own name and glyph stand over.
 *
 * Exported because three places need the same number and had three copies of the
 * expression: the island body, the accent/link anchor map, and (since the chain
 * placard learned to stand above its group) the layout's own chain plan. A chain
 * name computed from a stale copy floats through the islands it names, which
 * reads as a depth bug rather than as a drifted constant.
 */
export function islandCrestY(island) {
  const height = Number.isFinite(island?.height) ? island.height : 0;
  const relief = Number.isFinite(island?.relief) ? island.relief : 0;
  return height * (0.36 + relief * 0.2);
}

/** Gap between an island's summit and its own floating name. */
export const ISLAND_LABEL_CLEARANCE = 1.45;

/**
 * How far along its shoulder a chain's name stands, as a fraction of the chain's
 * radius — the fused planner's `SITE_LABEL_REACH` by another name, and for the
 * same reason: a territory's name drawn dead centre lands on the very members it
 * is naming, and the declutter pass then drops the members. Measured on a
 * 390x844 phone, a lift with no shoulder at all cost three island names to buy
 * three chain names, which is not a trade worth making.
 *
 * Small on purpose. The islands already reach the frame edge (the fit leaves
 * them only `ANNOTATION_GUTTER_PX`), so a shoulder at the fused planner's 0.68
 * walked FULFIL off the left of the same phone.
 */
const CHAIN_LABEL_REACH = 0.32;

/**
 * Clearance between the highest island NAME in a chain and the chain's own.
 *
 * The placard used to sit at `center[2] - radius * 0.85` — the far edge of the
 * chain from the default (+x, +y, +z) view, so it was drawn behind the chain's
 * own islands and depth-tested away. That is the bug the city districts and the
 * garden beds were fixed for by moving to the NEAR edge, and the chain is the
 * one case that move does not fix: chain circles overlap and their centres
 * cluster near the world centre, so `± radius` on any single axis lands the name
 * on open water nowhere near its islands (measured at 717x512: near-edge put
 * DISCOVER in the bottom-left corner and BUY off-canvas entirely).
 *
 * The answer is the one `assignSiteLabelPlacement` reached for a fused site —
 * go UP. "Above the tallest island in this chain" is a fact about the chain
 * rather than about the camera, so a plan can state it; a bearing toward one
 * side of the group is not, because an island is about as wide as a shoulder is
 * long and which side clears it depends on where the viewer is standing.
 *
 * Lifting a label costs the camera fit nothing — text is pruned from it by
 * material (see collectFramePoints) — but it is not free on a portrait screen,
 * where the fit is width-bound and the lift is what carries a placard off the
 * top. Measured on the three fixtures at 390x844 / 717x512 / 1440x900, this
 * number is a ridge rather than a floor: at **2.4** the phone bought one more
 * island name and the foldable cover paid two placards, FULFIL dimmed under the
 * reading strip and BUY faded out entirely.
 */
const CHAIN_LABEL_CREST_CLEARANCE = 1.15;

/**
 * The shoulder a chain's name stands on — pointing AWAY from the tallest island
 * in the chain, which is the one label the lift cannot clear.
 *
 * The lift is measured from that island's crest, so the placard lands directly
 * over that island's own name; and if that island is also the scene's accented
 * one, both labels are pinned and neither yields, so they render on top of each
 * other. Measured on the commerce fixture at 390x844: "BUY" over "Payments"
 * came out as `BÙYments`. Leaning out from the WORLD centre — the fused
 * planner's rule — does not fix it, because the tallest island of an outer
 * chain tends to be its outermost one, so outward is straight at it.
 *
 * Falls back to outward-from-the-world for a chain sitting on its own tallest
 * island's mark, and to a near diagonal at the origin.
 */
function chainLabelOffset(center, radius, awayFrom) {
  const reach = radius * CHAIN_LABEL_REACH;
  const lean = (x, z) => {
    const length = Math.hypot(x, z);
    return length > 0.01 ? [(x / length) * reach, 0, (z / length) * reach] : null;
  };
  return (
    (awayFrom && lean(center[0] - awayFrom[0], center[2] - awayFrom[2])) ??
    lean(center[0], center[2]) ?? [reach * Math.SQRT1_2, 0, reach * Math.SQRT1_2]
  );
}

/**
 * Pack peer domains as islands in an ocean. Items group into named chains
 * (regions / bounded-context families); within a chain they orbit a local
 * centre so related islands read as a visible archipelago cluster.
 *
 * @param {Array<Record<string, unknown>>} items
 * @returns {{
 *   islands: Array<{
 *     id: string,
 *     position: [number, number, number],
 *     radius: number,
 *     height: number,
 *     relief: number,
 *     chain: string,
 *     chainIndex: number
 *   }>,
 *   chains: Array<{
 *     name: string,
 *     center: [number, number, number],
 *     radius: number,
 *     namedByMember: boolean,
 *     labelOffset: [number, number, number],
 *     labelLift: number
 *   }>,
 *   positions: Map<string, [number, number, number]>,
 *   bounds: { radius: number }
 * }}
 */
export function archipelagoLayout(items) {
  const valid = items.filter((item) => item && typeof item.id === 'string');
  const groups = new Map();
  for (const item of valid) {
    const name =
      typeof item.chain === 'string' && item.chain.trim() ? item.chain.trim() : 'Open sea';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(item);
  }

  const entries = [...groups.entries()];
  const chainSpacing = 7.4;
  const islands = [];
  const chains = [];
  const positions = new Map();

  entries.forEach(([name, group], chainIndex) => {
    const chainCenter = gridPosition(chainIndex, entries.length, chainSpacing, 0.55);
    let localRadius = 0;
    group.forEach((item, itemIndex) => {
      const mass = massValue(item);
      const relief = reliefValue(item);
      const radius = islandRadiusForMass(mass);
      const height = 0.55 + relief * 2.4 + Math.sqrt(mass) * 0.18;
      let pos;
      if (Array.isArray(item.position) && item.position.length === 3) {
        pos = [item.position[0], 0, item.position[2]];
      } else {
        const local = gridPosition(itemIndex, group.length, Math.max(2.8, radius * 1.55), 0.7);
        // Jitter keeps mechanical grids from looking like a parking lot.
        const jx = (hash01Salted(item.id, 'isle-jx') - 0.5) * radius * 0.35;
        const jz = (hash01Salted(item.id, 'isle-jz') - 0.5) * radius * 0.35;
        pos = [chainCenter[0] + local[0] + jx, 0, chainCenter[2] + local[2] + jz];
      }
      localRadius = Math.max(
        localRadius,
        Math.hypot(pos[0] - chainCenter[0], pos[2] - chainCenter[2]) + radius
      );
      islands.push({
        id: item.id,
        position: pos,
        radius,
        height,
        relief,
        chain: name,
        chainIndex
      });
      positions.set(item.id, pos);
    });
    chains.push({
      name,
      center: [chainCenter[0], 0, chainCenter[2]],
      radius: Math.max(2.4, localRadius + 0.6),
      // A territory named after one of its own members gets no placard: the
      // group and the island then name the same thing, and drawing both puts
      // one word twice within a few pixels. The fused planner's rule, ported.
      namedByMember: group.some(
        (item) =>
          typeof item.label === 'string' &&
          item.label.trim().toLowerCase() === name.trim().toLowerCase()
      )
    });
  });

  // Recentre the whole composition on the origin for framing.
  let cx = 0;
  let cz = 0;
  for (const isle of islands) {
    cx += isle.position[0];
    cz += isle.position[2];
  }
  if (islands.length > 0) {
    cx /= islands.length;
    cz /= islands.length;
  }
  for (const isle of islands) {
    isle.position[0] -= cx;
    isle.position[2] -= cz;
    positions.set(isle.id, [...isle.position]);
  }
  for (const chain of chains) {
    chain.center[0] -= cx;
    chain.center[2] -= cz;
  }

  // The chain's own name stands above the highest name in its group, leaning off
  // the island that name belongs to. Solved after the recentring above, or the
  // shoulder is measured from an origin the composition no longer sits on.
  const tallestByChain = new Map();
  for (const isle of islands) {
    const seen = tallestByChain.get(isle.chain);
    if (seen === undefined || islandCrestY(isle) > islandCrestY(seen)) {
      tallestByChain.set(isle.chain, isle);
    }
  }
  for (const chain of chains) {
    const tallest = tallestByChain.get(chain.name);
    chain.labelOffset = chainLabelOffset(chain.center, chain.radius, tallest?.position);
    chain.labelLift = tallest
      ? islandCrestY(tallest) + ISLAND_LABEL_CLEARANCE + CHAIN_LABEL_CREST_CLEARANCE
      : CHAIN_LABEL_CREST_CLEARANCE;
  }

  let radius = 6;
  for (const isle of islands) {
    radius = Math.max(radius, Math.hypot(isle.position[0], isle.position[2]) + isle.radius + 1.1);
  }

  return {
    islands,
    chains,
    positions,
    bounds: { radius }
  };
}
