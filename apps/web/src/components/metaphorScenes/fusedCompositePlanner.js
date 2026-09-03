import { hash01, hash01Salted } from '../../utils/seededHash.js';
import { getCompositeCapability, getCompositePrimitive } from './compositePrimitiveRegistry.js';

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/**
 * How far a site's name clears the tallest landmark planted on it. A node's own
 * name sits 0.9 above its top, so this has to exceed that or the two names
 * arrive in the same square of screen and the declutter pass drops one of them —
 * which, since a site outranks a node on importance, would be the tower's.
 */
const SITE_LABEL_CREST_CLEARANCE = 1.5;
/** How far out along the shoulder a site's name stands, as a fraction of its radius. */
const SITE_LABEL_REACH = 0.68;
const METRIC_RANGE_BY_KIND = Object.freeze({
  archipelago: [0.5, 20],
  city: [0.5, 100],
  layercake: [0.2, 10],
  galaxy: [0.1, 20],
  tree: [0.1, 20],
  terrain: [-10, 20],
  orrery: [0.1, 10],
  river: [0.1, 20],
  garden: [0.1, 10],
  machine: [0.1, 10],
  bridge: [0.1, 10],
  cycle: [0.1, 10],
  subway: [0.1, 20],
  iceberg: [0.1, 20]
});

const AFFINITY_FIELDS = Object.freeze(['district', 'chain', 'bed', 'axle', 'label', 'id']);

/**
 * The height of the fused world's own surface between the islands — the water
 * (or plaza) disc `WorldGround` draws in `fusedCompositePrimitives.jsx`, which
 * imports this constant so the two cannot drift apart. Sites stand at `y = 0`
 * and rise by their own `height`, so this is the floor everything else is
 * measured from.
 */
export const FUSED_SEA_LEVEL_Y = -0.22;

/**
 * How far a channel's centre-line rides above whatever is underneath it. Shared
 * by the stations (`routePoint`) and by the surface samples between them, so a
 * route keeps one constant clearance for its whole length.
 */
const CHANNEL_RIDE = 0.16;

/**
 * Spacing of the surface samples inserted along a leg, in world units, and the
 * cap on how many one leg may add. Sites are 1.8–4.6 units across, so ~1.15
 * puts three or four samples inside a strait — enough for the dip to read —
 * while the cap keeps a long leg across an empty ocean from turning into a
 * hundred collinear control points the tube then has to tessellate through.
 */
const CHANNEL_SAMPLE_SPACING = 1.15;
const CHANNEL_MAX_SAMPLES = 10;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function finite(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function metricValue(item, kind, metric) {
  const [min, max] = METRIC_RANGE_BY_KIND[kind] ?? [0, 10];
  const fallback = min + (max - min) * 0.45;
  const raw = metric ? finite(item?.[metric], fallback) : fallback;
  return {
    raw,
    normalized: clamp((raw - min) / Math.max(0.0001, max - min), 0, 1)
  };
}

function sourceSignature(dsl) {
  return JSON.stringify({
    seed: dsl.seed ?? 0,
    layers: (dsl.layers ?? []).map((layer) => ({
      id: layer.id,
      as: layer.as,
      items: (layer.items ?? []).map((item) => item)
    })),
    links: dsl.links ?? []
  });
}

function seeded(worldKey, input, salt) {
  return hash01Salted(`${worldKey}:${String(input)}`, salt);
}

function resolveTopology(worldKey, novelty) {
  if (novelty < 0.24) return 'ring';
  const candidates = novelty > 0.72 ? ['spiral', 'constellation', 'braid'] : ['ring', 'spiral'];
  return candidates[Math.floor(seeded(worldKey, 'topology', 'pick') * candidates.length)];
}

function sitePosition({ index, count, radius, topology, novelty, worldKey }) {
  const phase = seeded(worldKey, 'sites', 'phase') * TAU;
  const jitter = (seeded(worldKey, index, 'site-jitter') - 0.5) * novelty;
  if (topology === 'constellation') {
    const angle = phase + index * GOLDEN_ANGLE + jitter * 0.6;
    const r = radius * (0.24 + 0.58 * seeded(worldKey, index, 'site-radius'));
    return [Math.cos(angle) * r, 0, Math.sin(angle) * r];
  }
  if (topology === 'braid') {
    const t = count === 1 ? 0.5 : index / (count - 1);
    const x = (t - 0.5) * radius * 1.6;
    const z = Math.sin(t * Math.PI * 2 + phase) * radius * (0.28 + novelty * 0.16);
    return [x, 0, z];
  }
  if (topology === 'spiral') {
    const t = (index + 1) / Math.max(2, count);
    const angle = phase + index * GOLDEN_ANGLE + jitter * 0.45;
    const r = radius * (0.22 + t * 0.58);
    return [Math.cos(angle) * r, 0, Math.sin(angle) * r];
  }
  const angle = phase + (index / Math.max(1, count)) * TAU + jitter * 0.45;
  const r = radius * (0.48 + seeded(worldKey, index, 'ring-radius') * novelty * 0.12);
  return [Math.cos(angle) * r, 0, Math.sin(angle) * r];
}

function explicitPosition(item, fallback) {
  if (!Array.isArray(item?.position) || item.position.length !== 3) return fallback;
  return [
    clamp(finite(item.position[0], fallback[0]), -24, 24) * 0.72,
    clamp(finite(item.position[1], fallback[1]), -4, 12),
    clamp(finite(item.position[2], fallback[2]), -24, 24) * 0.72
  ];
}

function normalizeAffinityToken(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed
    .replace(/[-_/]+/g, ' ')
    .replace(/\b(domain|service|api|layer|station)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokens used to bind landmarks/paths to substrate sites by shared nouns. */
export function affinityTokens(item) {
  const tokens = new Set();
  if (!item || typeof item !== 'object') return tokens;
  for (const field of AFFINITY_FIELDS) {
    const normalized = normalizeAffinityToken(item[field]);
    if (!normalized) continue;
    tokens.add(normalized);
    for (const part of normalized.split(' ')) {
      if (part.length > 2) tokens.add(part);
    }
  }
  return tokens;
}

function affinityOverlap(a, b) {
  let score = 0;
  for (const token of a) {
    if (b.has(token)) score += token.includes(' ') ? 3 : 1;
  }
  return score;
}

function makeMotion(worldKey, id, style, novelty) {
  const styleBoost =
    style === 'orbit' ? 1.15 : style === 'flow' ? 1.25 : style === 'pulse' ? 1.05 : 1;
  return {
    style,
    phase: seeded(worldKey, id, 'motion-phase') * TAU,
    speed: (0.45 + seeded(worldKey, id, 'motion-speed') * (0.45 + novelty * 0.55)) * styleBoost,
    amplitude: 0.035 + novelty * (0.08 + seeded(worldKey, id, 'motion-amp') * 0.12)
  };
}

function makePresentation(item, kind) {
  return {
    lighting: typeof item?.lighting === 'string' ? item.lighting : null,
    condition: typeof item?.condition === 'string' ? item.condition : null,
    health: typeof item?.health === 'string' ? item.health : null,
    hazard: clamp(finite(item?.hazard, 0), 0, 1),
    maturity: clamp(finite(item?.maturity, kind === 'garden' ? 0.5 : 0.55), 0, 1),
    cracks: clamp(finite(item?.cracks, 0), 0, 1),
    tilt: clamp(finite(item?.tilt, 0), 0, 15),
    relief: clamp(finite(item?.relief, 0.5), 0, 1),
    torque: clamp(finite(item?.torque, 0), 0, 1),
    friction: clamp(finite(item?.friction, 0), 0, 1),
    peril: clamp(finite(item?.peril, 0), 0, 1),
    affinity: [...affinityTokens(item)]
  };
}

/** Island/platform radius a substrate entry claims. Shared with the world sizing. */
function siteRadiusFor(item) {
  if (!item) return 2.5;
  return clamp(
    1.9 + Math.sqrt(Math.max(0.5, metricValue(item, 'archipelago', 'mass').raw)) * 0.48,
    1.8,
    4.6
  );
}

/**
 * How big the fused world is.
 *
 * This used to be `8.5 + √itemCount · 2.15`, which sized the ocean from the
 * *item* count while the sites that fill it come from the *substrate* count.
 * A three-island composite carrying nine items got a radius-15 world, its
 * islands landed on a ring at 0.48·15 ≈ 7, and the result was three specks in
 * an empty sea — the single worst-looking scene in the set.
 *
 * The ring instead has to be long enough to seat the islands that go on it, so
 * we derive it from their circumference: N sites of radius r need
 * `2πR ≥ Σ(2r + gap)`. `sitePosition` then places on `0.48·worldRadius` for the
 * ring topology, so that factor is divided back out here.
 */
export function resolveWorldRadius(substrateEntries, itemCount) {
  const sites =
    substrateEntries.length > 0
      ? substrateEntries.map((entry) => siteRadiusFor(entry.item))
      : new Array(clamp(Math.ceil(Math.sqrt(Math.max(1, itemCount))) + 1, 3, 7)).fill(2.5);
  const gap = 1.5;
  const circumference = sites.reduce((sum, radius) => sum + 2 * radius + gap, 0);
  const ringRadius = Math.max(
    circumference / (2 * Math.PI),
    // Two sites sit opposite each other, so the ring only needs to separate them.
    Math.max(...sites) + gap
  );
  const RING_PLACEMENT_FACTOR = 0.48;
  return clamp(ringRadius / RING_PLACEMENT_FACTOR, 7, 26);
}

/**
 * The four topologies place sites at very different radial fractions —
 * `ring` at 0.48·R, `constellation` anywhere in 0.24–0.82·R, `spiral` in
 * 0.22–0.80·R. The ground disc is then sized to whatever they happened to
 * reach, so a spiral or constellation world drew a big ocean whose islands
 * occupied its middle 45% and a ring world filled it. Rescaling every site so
 * the outermost one lands on the canonical ring keeps each topology's *shape*
 * (which is what novelty is for) while making the world's fill consistent.
 */
function normalizeSiteSpread(positions, targetRadius) {
  let reach = 0;
  for (const [x, , z] of positions) reach = Math.max(reach, Math.hypot(x, z));
  if (reach < 0.001) return positions;
  const scale = targetRadius / reach;
  return positions.map(([x, y, z]) => [x * scale, y, z * scale]);
}

function makeSites({ substrateEntries, itemCount, worldRadius, topology, novelty, worldKey }) {
  const siteCount =
    substrateEntries.length > 0
      ? substrateEntries.length
      : clamp(Math.ceil(Math.sqrt(Math.max(1, itemCount))) + 1, 3, 7);

  const basePositions = normalizeSiteSpread(
    Array.from({ length: siteCount }, (_, index) =>
      sitePosition({ index, count: siteCount, radius: worldRadius, topology, novelty, worldKey })
    ),
    // `resolveWorldRadius` sizes the world by dividing the ring it needs by this
    // same factor, so multiplying it back recovers that ring.
    worldRadius * 0.48
  );

  const sites = [];
  for (let index = 0; index < siteCount; index += 1) {
    const entry = substrateEntries[index];
    const item = entry?.item;
    const position = explicitPosition(item, basePositions[index]);
    const radius = entry ? siteRadiusFor(item) : 2.5;
    const height = entry
      ? 0.45 + clamp(finite(item.relief, 0.45), 0, 1) * 1.15
      : 0.38 + seeded(worldKey, index, 'auto-site-height') * 0.34;
    const id = entry ? `site:${item.id}` : `site:auto-${index}`;
    const anchor = [position[0], position[1] + height, position[2]];
    sites.push({
      id,
      item: item ?? null,
      // A site's slot on the shared grouping ladder (`groupIdentity.js`). A
      // fused world's substrate IS its grouping axis — one island per domain —
      // and every island drew `theme.treeLeafColor` over `theme.treeSoilColor`,
      // so on the commerce composite the three domains merged into one brown
      // landmass and the layer key's "Archipelago · 3" was the only place in
      // the picture that said there were three of anything.
      groupIndex: index,
      layerId: entry?.layer.id ?? null,
      kind: entry?.layer.as ?? 'generated',
      primitive: entry ? 'island' : 'platform',
      position,
      radius,
      height,
      anchor,
      affinity: [...affinityTokens(item)],
      presentation: makePresentation(item, 'archipelago'),
      motion: makeMotion(worldKey, id, entry ? 'sway' : 'pulse', novelty),
      estimatedCost: getCompositePrimitive(entry ? 'island' : 'platform').estimatedCost
    });
  }
  return sites;
}

function buildLinkNeighbors(dsl, layers) {
  const neighbors = new Map();
  const add = (from, to) => {
    if (!from || !to) return;
    if (!neighbors.has(from)) neighbors.set(from, new Set());
    if (!neighbors.has(to)) neighbors.set(to, new Set());
    neighbors.get(from).add(to);
    neighbors.get(to).add(from);
  };
  for (const link of dsl.links ?? []) add(link.from, link.to);
  for (const layer of layers) {
    for (const item of layer.items ?? []) {
      if (typeof item.parent === 'string') add(item.id, item.parent);
      if (typeof item.moon === 'string') add(item.id, item.moon);
      if (typeof item.binary === 'string') add(item.id, item.binary);
    }
  }
  return neighbors;
}

function chooseSiteIndex({ item, sites, nodeIndex, layerIndex, worldKey, linkNeighbors }) {
  const itemTokens = affinityTokens(item);
  const linked = linkNeighbors.get(item.id) ?? new Set();
  let bestIndex = 0;
  let bestScore = -Infinity;
  for (let index = 0; index < sites.length; index += 1) {
    const site = sites[index];
    const siteTokens = affinityTokens(site.item);
    let score = affinityOverlap(itemTokens, siteTokens) * 10;
    if (site.item?.id && linked.has(site.item.id)) score += 8;
    // Mild seeded tie-break so equal-affinity items still spread across sites.
    score += seeded(worldKey, `${item.id}:${site.id}`, 'site-tie') * 0.4;
    score -= Math.abs(((nodeIndex + layerIndex) % Math.max(1, sites.length)) - index) * 0.05;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  if (bestScore < 0.5) {
    return (
      (nodeIndex +
        layerIndex +
        Math.floor(seeded(worldKey, item.id, 'site-choice') * Math.max(1, sites.length))) %
      Math.max(1, sites.length)
    );
  }
  return bestIndex;
}

function nodePosition({ item, nodeIndex, layerIndex, site, capability, worldKey, novelty }) {
  const angle =
    seeded(worldKey, `${item.id}:${layerIndex}`, 'node-angle') * TAU + nodeIndex * GOLDEN_ANGLE;
  const isOrbit = capability.role === 'accent';
  const distance = isOrbit
    ? site.radius + 1.4 + seeded(worldKey, item.id, 'orbit-radius') * (1.2 + novelty)
    : site.radius * (0.12 + seeded(worldKey, item.id, 'node-radius') * 0.42);
  const y = site.anchor[1] + (isOrbit ? 1.6 + seeded(worldKey, item.id, 'orbit-y') * 2.2 : 0);
  return explicitPosition(item, [
    site.position[0] + Math.cos(angle) * distance,
    y,
    site.position[2] + Math.sin(angle) * distance
  ]);
}

function nodeDimensions(item, kind, normalized) {
  if (kind === 'city') {
    return {
      radius: clamp(0.48 + Math.sqrt(Math.max(0.5, finite(item.footprint, 2))) * 0.22, 0.5, 1.5),
      height: 2 + normalized * 5.3
    };
  }
  if (kind === 'iceberg')
    return { radius: 0.85 + normalized * 1.15, height: 1.1 + normalized * 3.1 };
  if (kind === 'machine')
    return { radius: 0.55 + normalized * 0.85, height: 0.45 + normalized * 0.55 };
  if (kind === 'terrain') return { radius: 1.1 + normalized * 1.5, height: 0.7 + normalized * 3 };
  if (kind === 'layercake') {
    const cracks = clamp(finite(item.cracks, 0), 0, 1);
    return {
      radius: 1 + normalized * 1.15,
      height: 0.8 + normalized * 2.5,
      tilt: clamp(finite(item.tilt, 0), 0, 15),
      cracks
    };
  }
  if (kind === 'tree') return { radius: 0.8 + normalized * 0.8, height: 2 + normalized * 3 };
  if (kind === 'garden') {
    const maturity = clamp(finite(item.maturity, 0.5), 0, 1);
    return {
      radius: 0.65 + normalized * 0.7,
      height: (0.9 + normalized * 2.6) * (0.35 + maturity * 0.65)
    };
  }
  if (kind === 'galaxy' || kind === 'orrery') {
    return { radius: 0.42 + normalized * 0.8, height: 0.42 + normalized * 0.8 };
  }
  return { radius: 0.7 + normalized * 0.7, height: 1.5 + normalized * 3 };
}

function resolveNodeMotionStyle(capability, novelty, worldKey, itemId) {
  const base =
    capability.role === 'field' ? 'pulse' : getCompositePrimitive(capability.primitive).motionStyle;
  if (novelty < 0.78) return base;
  // High novelty occasionally remixes motion for accents/landmarks only.
  if (capability.role !== 'accent' && capability.role !== 'landmark') return base;
  const remix = ['pulse', 'sway', 'orbit'];
  return remix[Math.floor(seeded(worldKey, itemId, 'motion-remix') * remix.length)];
}

function makeNodes({ layers, sites, novelty, worldKey, anchors, linkNeighbors }) {
  const entries = layers.flatMap((layer, layerIndex) => {
    const capability = getCompositeCapability(layer.as);
    if (capability.role === 'substrate' || capability.role === 'path') return [];
    return (layer.items ?? []).map((item, itemIndex) => ({
      layer,
      layerIndex,
      item,
      itemIndex,
      capability
    }));
  });

  const nodes = entries.map((entry, nodeIndex) => {
    const { item, layer, layerIndex, capability } = entry;
    const siteIndex = chooseSiteIndex({
      item,
      sites,
      nodeIndex,
      layerIndex,
      worldKey,
      linkNeighbors
    });
    const site = sites[siteIndex];
    const metric = metricValue(item, layer.as, capability.metric);
    const dimensions = nodeDimensions(item, layer.as, metric.normalized);
    const { radius, height } = dimensions;
    const position = nodePosition({
      item,
      nodeIndex,
      layerIndex,
      site,
      capability,
      worldKey,
      novelty
    });
    const anchor = [
      position[0],
      position[1] + (capability.role === 'accent' ? 0 : height),
      position[2]
    ];
    const labelDx = position[0] - site.position[0];
    const labelDz = position[2] - site.position[2];
    const rawDistance = Math.hypot(labelDx, labelDz);
    // On a fused world, a landmark sits close to its site's centre and its own
    // name used to be nudged 0.58 world units outward from there. On phone that
    // put every same-island name in one 60px cluster (measured on the toaster:
    // "Chrome Throne", "Forgiveness Lever" and "Was It My Fault?" all landed
    // inside a 45-pixel square, and the declutter dropped two of them). Pushing
    // the label past the site's own SHOULDER instead — a fraction of the site
    // radius — gives each name its own arc around the island; a scene with one
    // landmark ends up with the label roughly at the shoreline, and two
    // landmarks 90° apart land ~2r apart, so the pair no longer contests one
    // screen slot. A landmark whose position sits AT the site centre (nodes at
    // (0,0) relative — the 0.12 lower bound in `nodePosition`) is walked around
    // the perimeter by node index instead of collapsing to the origin. Both
    // constants are floored at 0.85 so a tiny site still moves its label a
    // useful distance rather than parking it on the node.
    const outwardReach = Math.max(0.85, (site.radius ?? 1) * 0.6);
    let bearingX;
    let bearingZ;
    if (rawDistance > 0.05) {
      bearingX = labelDx / rawDistance;
      bearingZ = labelDz / rawDistance;
    } else {
      // Same GOLDEN_ANGLE the planner uses elsewhere to spread same-site items.
      const bearing = nodeIndex * GOLDEN_ANGLE + layerIndex * (TAU / 5);
      bearingX = Math.cos(bearing);
      bearingZ = Math.sin(bearing);
    }
    const motionStyle = resolveNodeMotionStyle(capability, novelty, worldKey, item.id);
    anchors.set(item.id, anchor);
    return {
      id: item.id,
      item,
      layerId: layer.id,
      kind: layer.as,
      role: capability.role,
      primitive: capability.primitive,
      position,
      anchor,
      attachedTo: site.id,
      affinityBound: affinityOverlap(affinityTokens(item), affinityTokens(site.item)) > 0,
      labelOffset: [bearingX * outwardReach, 0, bearingZ * outwardReach],
      radius,
      height,
      tilt: dimensions.tilt ?? 0,
      cracks: dimensions.cracks ?? 0,
      metric,
      presentation: makePresentation(item, layer.as),
      motion: makeMotion(worldKey, item.id, motionStyle, novelty),
      estimatedCost: getCompositePrimitive(capability.primitive).estimatedCost
    };
  });
  return nodes;
}

/**
 * Sequence field for a path layer. A river orders by `stage`, a bridge by
 * `span` along the crossing — sorting a bridge by `stage` (which it never sets)
 * left every pylon at 0 and the crossing came out in authoring order.
 */
function pathOrderValue(item, kind) {
  if (kind === 'bridge') return finite(item.span, 0);
  if (kind === 'subway') return finite(item.stop, 0);
  return finite(item.stage, 0);
}

function orderedPathItems(layer) {
  return [...(layer.items ?? [])].sort(
    (a, b) => pathOrderValue(a, layer.as) - pathOrderValue(b, layer.as)
  );
}

/**
 * The height of the world's own surface under `(x, z)`: the tallest site whose
 * disc covers the point, and sea level where no site does.
 *
 * A site is modelled as a dome — smoothstep from its rim to its crest, rather
 * than a cylinder or a cone. Both alternatives were tried. A cylinder puts a
 * vertical wall at the shoreline, which a route crossing it turns into a step;
 * a cone (or the `sqrt` hemispheroid) has its steepest slope exactly AT the
 * rim, which is where a channel spends most of its samples, so the same kink
 * arrives one sample later. Smoothstep is flat at both ends, so a route walks
 * up the beach and over the crest without a corner anywhere.
 *
 * @param {number} x
 * @param {number} z
 * @param {Array<{position: number[], radius: number, height: number}>} sites
 * @returns {number}
 */
export function fusedSurfaceHeightAt(x, z, sites) {
  let height = FUSED_SEA_LEVEL_Y;
  for (const site of sites ?? []) {
    const reach = finite(site?.radius, 0);
    if (!(reach > 0)) continue;
    const distance = Math.hypot(x - site.position[0], z - site.position[2]);
    if (distance >= reach) continue;
    const t = 1 - distance / reach;
    const dome = t * t * (3 - 2 * t);
    const top = finite(site.position?.[1], 0) + finite(site.height, 0);
    height = Math.max(height, FUSED_SEA_LEVEL_Y + (top - FUSED_SEA_LEVEL_Y) * dome);
  }
  return height;
}

/**
 * Where a station stands on its site.
 *
 * Its height comes from `fusedSurfaceHeightAt` rather than from the site's
 * crest: a station is placed part-way out from the centre, and pinning it to
 * the crest left every waypoint hovering above the ground it is supposed to
 * stand on — most visibly on the outer stations, whose markers floated a full
 * channel-width over the beach.
 */
function routePoint(site, sites, { worldKey, id, index, isCrossing }) {
  const angle = seeded(worldKey, id, 'path-offset-angle') * TAU;
  const distance = Math.min(site.radius * 0.52, 0.75 + index * 0.06);
  const x = site.position[0] + Math.cos(angle) * distance;
  const z = site.position[2] + Math.sin(angle) * distance;
  // A bridge's pylons carry a deck between the crests; everything else stands
  // on the ground where it stands.
  const y = isCrossing ? site.anchor[1] : fusedSurfaceHeightAt(x, z, sites);
  return [x, y + CHANNEL_RIDE, z];
}

/**
 * Re-solve a route's control points against the world it crosses.
 *
 * A path's stations sit on top of the sites they bind to, and the spline used
 * to interpolate straight from one island's crest to the next — so between two
 * islands the channel held island-top height over open water, and over any
 * third island in the way it held a height that had nothing to do with that
 * island. Rendered, that is a pipe laid across the map rather than a route
 * through the world: measured on the festival composite, the crowd journey ran
 * 1.1–1.4 units clear of the sea for two thirds of its length.
 *
 * The stations themselves do not move — they are what the labels, glyphs,
 * markers and hover anchors are placed from — so this only inserts samples
 * BETWEEN them, plus re-solves the two tangent tails (which are spline
 * scaffolding and not anybody's anchor).
 *
 * A bridge is deliberately exempt: a crossing's whole thesis is the gap it
 * spans, and a bridge that follows the seabed is not a bridge.
 *
 * @param {number[][]} controls — `[tail, ...stations, tail]`
 * @param {Array<{position: number[], radius: number, height: number}>} sites
 * @returns {number[][]}
 */
function routeAlongSurface(controls, sites) {
  if (controls.length < 2 || !sites?.length) return controls;
  const onSurface = (point) => [
    point[0],
    fusedSurfaceHeightAt(point[0], point[2], sites) + CHANNEL_RIDE,
    point[2]
  ];
  // First and last are the tangent tails; every station keeps its own height.
  const anchored = controls.map((point, index) =>
    index === 0 || index === controls.length - 1 ? onSurface(point) : point
  );
  const routed = [];
  for (let index = 0; index < anchored.length - 1; index += 1) {
    const from = anchored[index];
    const to = anchored[index + 1];
    routed.push(from);
    const span = Math.hypot(to[0] - from[0], to[2] - from[2]);
    const steps = clamp(Math.round(span / CHANNEL_SAMPLE_SPACING), 0, CHANNEL_MAX_SAMPLES);
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps;
      routed.push(onSurface([from[0] + (to[0] - from[0]) * t, 0, from[2] + (to[2] - from[2]) * t]));
    }
  }
  routed.push(anchored.at(-1));
  return routed;
}

function pathEnd(point, neighbor, distance) {
  const dx = point[0] - neighbor[0];
  const dz = point[2] - neighbor[2];
  const length = Math.hypot(dx, dz) || 1;
  return [point[0] + (dx / length) * distance, point[1], point[2] + (dz / length) * distance];
}

function choosePathSiteIndex({
  item,
  sites,
  index,
  layerIndex,
  rotation,
  worldKey,
  linkNeighbors
}) {
  const itemTokens = affinityTokens(item);
  const linked = linkNeighbors.get(item.id) ?? new Set();
  let bestIndex = (index + rotation + layerIndex) % Math.max(1, sites.length);
  let bestScore = -Infinity;
  for (let siteIndex = 0; siteIndex < sites.length; siteIndex += 1) {
    const site = sites[siteIndex];
    let score = affinityOverlap(itemTokens, affinityTokens(site.item)) * 10;
    if (site.item?.id && linked.has(site.item.id)) score += 8;
    // Prefer progressing along the ring so the river still reads as a journey.
    score -= Math.abs(siteIndex - ((index + rotation + layerIndex) % sites.length)) * 0.35;
    score += seeded(worldKey, `${item.id}:${site.id}`, 'path-site') * 0.2;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = siteIndex;
    }
  }
  return bestIndex;
}

function makePaths({ layers, sites, novelty, worldKey, anchors, linkNeighbors, motionIntensity }) {
  return layers.flatMap((layer, layerIndex) => {
    const capability = getCompositeCapability(layer.as);
    if (capability.role !== 'path') return [];
    const items = orderedPathItems(layer);
    if (items.length === 0) return [];
    // A river's channel widens with `flow`; a bridge's deck widens with the
    // `load` it carries. Reading `flow` on a bridge just returned the fallback
    // for every pylon, so every crossing came out the same width. Resolved up
    // here because it is also the magnitude a station's NAME is ranked by.
    const widthField = layer.as === 'bridge' ? 'load' : layer.as === 'subway' ? 'traffic' : 'flow';
    const isCrossing = layer.as === 'bridge';
    const rotation = Math.floor(seeded(worldKey, layer.id, 'path-site-rotation') * sites.length);
    const stations = items.map((item, index) => {
      const siteIndex = choosePathSiteIndex({
        item,
        sites,
        index,
        layerIndex,
        rotation,
        worldKey,
        linkNeighbors
      });
      const site = sites[siteIndex];
      const point = routePoint(site, sites, { worldKey, id: item.id, index, isCrossing });
      const anchor = [point[0], point[1] + 0.9, point[2]];
      const labelDx = point[0] - site.position[0];
      const labelDz = point[2] - site.position[2];
      const labelDistance = Math.hypot(labelDx, labelDz) || 1;
      anchors.set(item.id, anchor);
      return {
        id: item.id,
        item,
        point,
        anchor,
        attachedTo: site.id,
        affinityBound: affinityOverlap(affinityTokens(item), affinityTokens(site.item)) > 0,
        labelOffset: [(labelDx / labelDistance) * 0.72, 0, (labelDz / labelDistance) * 0.72],
        labelMagnitude: finite(item[widthField], 5),
        presentation: makePresentation(item, 'river'),
        motion: makeMotion(worldKey, item.id, 'flow', novelty)
      };
    });
    let controls = stations.map((station) => station.point);
    if (controls.length === 1) {
      const [point] = controls;
      const tangentAngle = seeded(worldKey, layer.id, 'single-path-angle') * TAU;
      const dx = Math.cos(tangentAngle) * 4;
      const dz = Math.sin(tangentAngle) * 4;
      controls = [
        [point[0] - dx, point[1], point[2] - dz],
        point,
        [point[0] + dx, point[1], point[2] + dz]
      ];
    } else {
      // Short tails: these are only there to give the spline a sane tangent at
      // each end. At 3.2 units they shot the river well past the outermost
      // island, and since the ground disc is sized to reach whatever the path
      // reaches, every composite paid for that overshoot in empty water.
      controls = [
        pathEnd(controls[0], controls[1], 1.2),
        ...controls,
        pathEnd(controls.at(-1), controls.at(-2), 1.2)
      ];
    }
    // A crossing flies; everything else is a route through the world. See
    // `routeAlongSurface`.
    const points = isCrossing ? controls : routeAlongSurface(controls, sites);
    const averageFlow =
      items.reduce((sum, item) => sum + finite(item[widthField], 5), 0) / Math.max(1, items.length);
    const averageHazard =
      items.reduce((sum, item) => sum + clamp(finite(item.hazard, 0), 0, 1), 0) /
      Math.max(1, items.length);
    return [
      {
        id: layer.id,
        layerId: layer.id,
        kind: layer.as,
        points,
        stations,
        width: clamp(
          0.16 + Math.sqrt(Math.max(0.1, averageFlow)) * 0.055 * (0.85 + motionIntensity * 0.3),
          0.2,
          0.48
        ),
        hazard: averageHazard,
        flow: averageFlow,
        moteSpeed: 0.04 + averageFlow * 0.004 + motionIntensity * 0.03,
        motion: makeMotion(worldKey, layer.id, 'flow', novelty),
        estimatedCost: getCompositePrimitive('waypoint').estimatedCost * stations.length + 8
      }
    ];
  });
}

function inferredRelationships(layers) {
  const links = [];
  for (const layer of layers) {
    for (const item of layer.items ?? []) {
      const target =
        typeof item.parent === 'string'
          ? item.parent
          : typeof item.moon === 'string'
            ? item.moon
            : typeof item.binary === 'string'
              ? item.binary
              : null;
      if (target) {
        links.push({
          from: target,
          to: item.id,
          kind: item.parent ? 'ownership' : 'dependency',
          inferred: true
        });
      }
    }
  }
  return links;
}

function makeLinks(dsl, layers, anchors) {
  const candidates = [...(dsl.links ?? []), ...inferredRelationships(layers)];
  const seen = new Set();
  return candidates.flatMap((link) => {
    const from = anchors.get(link.from);
    const to = anchors.get(link.to);
    const key = `${link.from}->${link.to}`;
    if (!from || !to || seen.has(key)) return [];
    seen.add(key);
    return [{ ...link, fromAnchor: from, toAnchor: to }];
  });
}

function makeConnectors(nodes, anchors) {
  return nodes.flatMap((node) => {
    if (node.kind !== 'tree' || typeof node.item?.parent !== 'string') return [];
    const from = anchors.get(node.item.parent);
    const to = node.anchor;
    if (!from || !to) return [];
    return [
      {
        id: `connector:${node.item.parent}->${node.id}`,
        from: node.item.parent,
        to: node.id,
        fromAnchor: from,
        toAnchor: to,
        kind: 'connector'
      }
    ];
  });
}

function makeGroups(sites, nodes) {
  const buckets = new Map();
  const ensure = (key) => {
    if (!buckets.has(key)) {
      buckets.set(key, {
        id: `group:${key}`,
        label: key,
        // The token is lowercased and stripped of filler words so that
        // "Checkout domain" and "checkout" bind to one another; that is right
        // for MATCHING and wrong for DISPLAY. The scene is required to preserve
        // the user's nouns, so the first raw value that produced this key is
        // kept alongside it and is what the floor placard shows.
        display: null,
        positions: [],
        memberIds: new Set()
      });
    }
    return buckets.get(key);
  };

  const groupKeysFor = (item) => {
    const keys = new Map();
    for (const field of ['chain', 'district', 'bed', 'label']) {
      const raw = item?.[field];
      const key = normalizeAffinityToken(raw);
      if (key && !keys.has(key)) {
        keys.set(key, { raw: typeof raw === 'string' ? raw.trim() : null, field });
      }
    }
    return keys;
  };

  const addMember = (item, position, top = 0, ownLabelNamesIt = false) => {
    if (!item?.id) return;
    for (const [key, { raw, field }] of groupKeysFor(item)) {
      const group = ensure(key);
      if (!group.display && raw) group.display = raw;
      // A territory whose name IS a substrate item's own name is already
      // labelled — the island carries it. Drawing the placard too puts the same
      // word twice within a few pixels, which reads as a rendering fault.
      if (ownLabelNamesIt && field === 'label') group.namedByMember = true;
      // The tallest thing standing in the territory, so the placard can stand
      // ON the ground the group covers instead of inside it — see below.
      group.surfaceY = Math.max(group.surfaceY ?? 0, top);
      if (group.memberIds.has(item.id)) continue;
      group.memberIds.add(item.id);
      group.positions.push(position);
    }
  };

  for (const site of sites) {
    if (!site.item) continue;
    addMember(site.item, site.position, (site.position?.[1] ?? 0) + (site.height ?? 0), true);
  }
  for (const node of nodes) {
    addMember(node.item, node.position, node.position?.[1] ?? 0);
  }

  return [...buckets.values()]
    .filter((group) => group.memberIds.size >= 2)
    .map((group, colorIndex) => {
      const center = group.positions.reduce(
        (acc, position) => [acc[0] + position[0], acc[1] + position[1], acc[2] + position[2]],
        [0, 0, 0]
      );
      const count = group.positions.length;
      const midpoint = [center[0] / count, 0.02, center[2] / count];
      let radius = 2.2;
      for (const position of group.positions) {
        radius = Math.max(
          radius,
          Math.hypot(position[0] - midpoint[0], position[2] - midpoint[2]) + 1.4
        );
      }
      return {
        id: group.id,
        label: group.label,
        display: group.display ?? group.label,
        // Assigned by ORDINAL, and after the `memberIds.size >= 2` filter, so
        // that N surviving groups always get N different colours. It used to be
        // `Math.floor(seeded(worldKey, key, 'group-color') * 8)` — a uniform
        // draw over eight slots, which for a three-group world collides about a
        // third of the time (1 − 7/8 · 6/8) and for a five-group world more than
        // half. A collision does not look like a bug: two territories simply
        // agree, which is the one thing the shared grouping noun is there to
        // deny. Seeding buys nothing here — the groups are already in a stable
        // declaration order, and there is no second world to stay distinct from.
        colorIndex,
        center: midpoint,
        radius: clamp(radius, 2.4, 9),
        // Where the group's name has to stand to be seen. A shared noun with an
        // island in it draws its floor ring on the OCEAN, which the island then
        // sits on top of — placard included. Measured on the commerce
        // composite, "Checkout" and "Fulfilment" were both buried inside the
        // island they name, which is exactly the one thing a fused world asks
        // the author to align across layers.
        surfaceY: clamp(group.surfaceY ?? 0, 0, 12),
        namedByMember: group.namedByMember === true,
        memberIds: [...group.memberIds]
      };
    });
}

function resolveLod(estimatedCost, itemCount) {
  if (estimatedCost > 95 || itemCount > 18) return 'low';
  if (estimatedCost > 58 || itemCount > 12) return 'medium';
  return 'high';
}

/**
 * Pick sky/theme family from fused layer roles so mixed worlds do not inherit
 * only layers[0] (e.g. city sky over an ocean substrate).
 */
export function resolveCompositeAtmosphere(dsl) {
  const layers = Array.isArray(dsl?.layers) ? dsl.layers : [];
  const kinds = layers.map((layer) => layer.as);
  const roles = new Set(kinds.map((kind) => getCompositeCapability(kind).role));
  if (roles.has('substrate') || kinds.includes('archipelago')) return 'archipelago';
  if (roles.has('path') || kinds.includes('river')) return 'river';
  if (kinds.includes('garden')) return 'garden';
  if (kinds.includes('galaxy') || kinds.includes('orrery')) return 'galaxy';
  if (kinds.includes('machine')) return 'machine';
  if (kinds.includes('tree')) return 'tree';
  if (kinds.includes('layercake')) return 'layercake';
  if (kinds.includes('city')) return 'city';
  if (kinds.includes('terrain')) return 'terrain';
  return kinds[0] ?? 'city';
}

/**
 * Where a substrate's own name stands: OUT onto the shoulder facing away from
 * the middle of the world, and UP clear of whatever is planted on it.
 *
 * An island's label used to sit dead centre, which is precisely where the
 * towers, gears and beds attached to that island are planted: on the commerce
 * composite "Checkout" and "Fulfilment" both rendered as three clipped letters
 * behind their own tower. Two nearer-looking lateral answers both fail. A fixed
 * near corner only changes which islands lose, because attachment offsets are
 * seeded. Pointing away from the attached landmarks fails too — "away" in world
 * space is often "behind" in screen space, so the label lands on the far side of
 * the tower and is occluded anyway. Outward from the world centre is the one
 * lateral direction that is reliably clear: whatever else a fused world
 * contains, the space outside its outermost sites is open ground or open water.
 * A site sitting at the origin has no outward, so it keeps a near corner.
 *
 * The shoulder alone was not enough, and the reason is that no LATERAL answer
 * can be: a tower is roughly as wide as the shoulder is long, and the direction
 * that clears it depends on where the viewer is standing, which a plan cannot
 * know. Measured on the three composite fixtures across a phone, a foldable
 * cover and a desktop — 148 labels, ray-tested against the scene from the
 * camera — the shoulder left four names buried behind geometry and only 71
 * fully legible. Going UP instead is the answer a plan CAN give, because "above
 * the tallest thing standing on this island" is a fact about the island rather
 * than about the camera: same 148 labels, 80 legible and none buried, with no
 * viewport losing ground. A camera-facing shoulder resolved per frame was also
 * measured and came out worse than this (74 legible) — it walks a back island's
 * name into the tower of the island in FRONT of it.
 *
 * Nothing here changes the camera fit: labels are pruned from it by material
 * (see collectFramePoints), so lifting one costs the subject no room.
 */
function assignSiteLabelPlacement(sites, nodes) {
  const crest = collectAttachedCrests(nodes);
  for (const site of sites) {
    site.labelOffset = resolveSiteLabelOffset(site);
    const top = crest.get(site.id);
    site.labelLift =
      top === undefined ? 0 : Math.max(0, top - bodyTopY(site) + SITE_LABEL_CREST_CLEARANCE);
  }
}

/** World-Y of the top of a placed body: whatever it stands on, plus its height. */
function bodyTopY(body) {
  return (body.position?.[1] ?? 0) + (body.height ?? 0);
}

/**
 * The highest thing standing on each substrate, keyed by site id. A node with
 * no `attachedTo` is planted on the ground rather than on a site, so it is
 * nobody's crest and no name has to clear it.
 */
function collectAttachedCrests(nodes) {
  const crest = new Map();
  for (const node of nodes) {
    if (!node?.attachedTo) continue;
    const top = bodyTopY(node);
    const seen = crest.get(node.attachedTo);
    if (seen === undefined || top > seen) crest.set(node.attachedTo, top);
  }
  return crest;
}

/**
 * The shoulder a site's own name stands on — see the block above
 * `assignSiteLabelPlacement` for why it points OUT from the middle of the
 * world. Exported because a site the planner itself lays out is never at the
 * origin, so the near-corner fallback has no other way to be tested.
 */
export function resolveSiteLabelOffset(site) {
  const x = site.position?.[0] ?? 0;
  const z = site.position?.[2] ?? 0;
  const length = Math.hypot(x, z);
  const reach = site.radius * SITE_LABEL_REACH;
  if (length > 0.01) return [(x / length) * reach, 0, (z / length) * reach];
  return [reach * Math.SQRT1_2, 0, reach * Math.SQRT1_2];
}

/**
 * Importance the declutter pass ranks a fused label by, from its standing
 * inside its OWN layer.
 *
 * Every layer's first name ties at the base, every layer's second name ties one
 * step below it, and so on — so when a canvas cannot hold every name, what it
 * drops is the weakest member of each grammar rather than every member of one.
 *
 * The step is small against the base so the whole ladder stays clear of the
 * link captions and other unranked labels at 0: a footnote written on a line
 * should yield to a name, however far down its layer that name sits.
 */
const FUSED_LABEL_BASE = 100;
const FUSED_LABEL_STEP = 1;

/**
 * The substrate's own ladder, clear above the one the landmarks stand on.
 *
 * A site is the territory its landmarks are planted in, and its name is the
 * noun the layer key, the affinity groups and half the links are phrased in.
 * `SITE_LABEL_CREST_CLEARANCE` is placed on the stated understanding that "a
 * site outranks a node on importance" — which was not true as shipped: at
 * `radius * 3` against a node's `height + radius`, any tower over about 12
 * units outranked the island it stands on, the same not-one-scale mistake in a
 * second place. The gap is wide enough that no plausible layer closes it.
 *
 * Folding the substrate into the shared round-robin instead was measured and is
 * worse: on the festival composite at 390x844 it traded two island names for one
 * tower and one stage, six named things where the separate ladder names seven.
 */
const FUSED_SITE_LABEL_BASE = 140;

/** @param {number} rank — 0-based position on the interleaved ladder @returns {number} */
export function fusedLabelImportance(rank) {
  const safe = Number.isFinite(rank) && rank > 0 ? rank : 0;
  return FUSED_LABEL_BASE - safe * FUSED_LABEL_STEP;
}

/** As above, for a substrate site's own name. */
export function fusedSiteLabelImportance(rank) {
  const safe = Number.isFinite(rank) && rank > 0 ? rank : 0;
  return FUSED_SITE_LABEL_BASE - safe * FUSED_LABEL_STEP;
}

/**
 * Rank a fused world's names by taking one layer at a time, in turn.
 *
 * A composite draws several grammars at once, and until this ran it ranked
 * their names against each other by WORLD SIZE — `height + radius` for a node,
 * and nothing at all for a path station, which fell to the default 0 and so tied
 * with the link captions at the very bottom. Those numbers are not one scale: a
 * city tower is tall because towers are tall, not because it matters more than
 * the stage of the river beside it. Measured on the three composite fixtures,
 * the journey layer — the one the scene exists to tell — came out at 1 named
 * stage of 4 on a phone, and the toaster's river was silent altogether.
 *
 * Losing a name from each layer costs detail. Losing every name from one layer
 * deletes a grammar the layer key still lists, and leaves the viewer anonymous
 * shapes with no way to learn what they are.
 *
 * So the ladder is drained round-robin: every layer's first name outranks every
 * layer's second, in the order the author declared the layers. Ranks are
 * DISTINCT for the same reason — an earlier attempt gave each layer's head the
 * same importance and let the pass break the tie, which it does by nearness, and
 * nearness knows nothing about layers: the toaster's two-tower city lost both
 * its names on all three viewports. Within a layer the order is that layer's own
 * metric, so its head items are still the ones that survive.
 *
 * The substrate keeps a ladder of its own, above this one — see
 * `FUSED_SITE_LABEL_BASE` for why, and for what folding it in here measured.
 */
function assignLabelRanks(layers, sites, nodes, paths) {
  const substrate = new Map();
  for (const site of sites) {
    // A site with no item is bare ground — a platform, drawn with no name.
    if (!site?.layerId || !site.item) continue;
    if (!substrate.has(site.layerId)) substrate.set(site.layerId, []);
    substrate.get(site.layerId).push(site);
  }
  for (const group of substrate.values()) {
    group
      .sort((a, b) => (b.radius ?? 0) - (a.radius ?? 0))
      .forEach((site, rank) => {
        site.labelRank = rank;
      });
  }

  // Landmarks and journey stations share one ladder: they are the same rung of
  // the scene — a thing standing in a territory — whatever grammar drew them.
  const queues = new Map();
  const queueFor = (layerId) => {
    if (!queues.has(layerId)) queues.set(layerId, []);
    return queues.get(layerId);
  };
  for (const layer of layers) queueFor(layer.id);
  for (const node of nodes) {
    queueFor(node.layerId).push({ body: node, magnitude: node.metric?.normalized ?? 0 });
  }
  for (const path of paths) {
    for (const station of path.stations) {
      queueFor(path.layerId).push({ body: station, magnitude: station.labelMagnitude ?? 0 });
    }
  }
  for (const queue of queues.values()) queue.sort((a, b) => b.magnitude - a.magnitude);

  const order = [...queues.keys()];
  let rank = 0;
  for (let round = 0; ; round += 1) {
    let placed = false;
    for (const layerId of order) {
      const queue = queues.get(layerId);
      if (round >= queue.length) continue;
      queue[round].body.labelRank = rank;
      rank += 1;
      placed = true;
    }
    if (!placed) break;
  }
}

function resolveGroundRadius(sites, nodes, paths) {
  let extent = 0;
  for (const site of sites) {
    extent = Math.max(extent, Math.hypot(site.position[0], site.position[2]) + site.radius);
  }
  for (const node of nodes) {
    extent = Math.max(extent, Math.hypot(node.position[0], node.position[2]) + node.radius);
  }
  for (const path of paths) {
    for (const point of path.points) {
      extent = Math.max(extent, Math.hypot(point[0], point[2]) + path.width);
    }
  }
  return Math.max(6, extent + 0.9);
}

/**
 * Produce a deterministic, finite internal render plan from any valid 1–4 layer
 * Composite v2 document. The plan is deliberately not an interchange format.
 */
export function planFusedCompositeWorld(dsl) {
  const layers = Array.isArray(dsl.layers) ? dsl.layers : [];
  const novelty = clamp(finite(dsl.novelty, 0.55), 0, 1);
  const motionIntensity = clamp(finite(dsl.motionIntensity, 0.65), 0, 1);
  const worldKey = sourceSignature(dsl);
  const itemCount = layers.reduce((sum, layer) => sum + (layer.items?.length ?? 0), 0);
  const topology = resolveTopology(worldKey, novelty);
  const substrateEntries = layers.flatMap((layer) =>
    getCompositeCapability(layer.as).role === 'substrate'
      ? (layer.items ?? []).map((item) => ({ layer, item }))
      : []
  );
  const worldRadius = resolveWorldRadius(substrateEntries, itemCount);
  const linkNeighbors = buildLinkNeighbors(dsl, layers);
  const anchors = new Map();
  const sites = makeSites({
    substrateEntries,
    itemCount,
    worldRadius,
    topology,
    novelty,
    worldKey
  });
  for (const site of sites) {
    if (site.item?.id) anchors.set(site.item.id, site.anchor);
  }
  const nodes = makeNodes({ layers, sites, novelty, worldKey, anchors, linkNeighbors });
  const paths = makePaths({
    layers,
    sites,
    novelty,
    worldKey,
    anchors,
    linkNeighbors,
    motionIntensity
  });
  assignSiteLabelPlacement(sites, nodes);
  assignLabelRanks(layers, sites, nodes, paths);
  const links = makeLinks(dsl, layers, anchors);
  const connectors = makeConnectors(nodes, anchors);
  const groups = makeGroups(sites, nodes);
  const groundRadius = resolveGroundRadius(sites, nodes, paths);
  const estimatedCost =
    sites.reduce((sum, item) => sum + item.estimatedCost, 0) +
    nodes.reduce((sum, item) => sum + item.estimatedCost, 0) +
    paths.reduce((sum, item) => sum + item.estimatedCost, 0) +
    links.length * 2 +
    connectors.length +
    groups.length;
  const lod = resolveLod(estimatedCost, itemCount);
  const atmosphere = resolveCompositeAtmosphere(dsl);

  return {
    version: 2,
    seed: dsl.seed ?? 0,
    signature: hash01(worldKey).toString(36).slice(2),
    topology,
    novelty,
    motionIntensity,
    worldRadius,
    groundRadius,
    sites,
    nodes,
    paths,
    links,
    connectors,
    groups,
    anchors,
    estimatedCost,
    lod,
    atmosphere
  };
}

/** Pure motion resolver used by the R3F scene and reduced-motion tests. */
export function resolveCompositeMotionTransform(motion, time, intensity, animated = true) {
  const safeIntensity = clamp(finite(intensity, 0), 0, 1);
  const t = animated ? finite(time, 0) : 0;
  const wave = Math.sin(t * finite(motion?.speed, 1) + finite(motion?.phase, 0));
  const amplitude = finite(motion?.amplitude, 0) * safeIntensity;
  if (motion?.style === 'orbit') {
    const angle = t * finite(motion?.speed, 1) + finite(motion?.phase, 0);
    return {
      offset: [
        Math.cos(angle) * amplitude * 2.6,
        wave * amplitude * 0.4,
        Math.sin(angle) * amplitude * 2.6
      ],
      rotation: [0, angle * 0.22, 0],
      scale: 1
    };
  }
  if (motion?.style === 'sway') {
    return {
      offset: [0, Math.abs(wave) * amplitude * 0.18, 0],
      rotation: [wave * amplitude * 0.35, 0, wave * amplitude],
      scale: 1
    };
  }
  if (motion?.style === 'pulse') {
    return {
      offset: [0, wave * amplitude * 0.16, 0],
      rotation: [0, 0, 0],
      scale: 1 + wave * amplitude * 0.24
    };
  }
  if (motion?.style === 'flow') {
    const drift = t * finite(motion?.speed, 1) * 0.35 + finite(motion?.phase, 0);
    return {
      offset: [
        Math.sin(drift) * amplitude * 1.4,
        Math.abs(Math.sin(drift * 1.3)) * amplitude * 0.55,
        Math.cos(drift * 0.85) * amplitude * 0.9
      ],
      rotation: [0, Math.sin(drift) * amplitude * 0.8, wave * amplitude * 0.25],
      scale: 1 + Math.abs(wave) * amplitude * 0.08
    };
  }
  return {
    offset: [0, wave * amplitude * 0.12, 0],
    rotation: [0, 0, 0],
    scale: 1
  };
}
