import { hash01, hash01Salted } from '../../utils/seededHash.js';
import { getCompositeCapability, getCompositePrimitive } from './compositePrimitiveRegistry.js';

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
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
    const labelDistance = Math.hypot(labelDx, labelDz) || 1;
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
      labelOffset: [(labelDx / labelDistance) * 0.58, 0, (labelDz / labelDistance) * 0.58],
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

function routePoint(site, worldKey, id, index) {
  const angle = seeded(worldKey, id, 'path-offset-angle') * TAU;
  const distance = Math.min(site.radius * 0.52, 0.75 + index * 0.06);
  return [
    site.position[0] + Math.cos(angle) * distance,
    site.anchor[1] + 0.16,
    site.position[2] + Math.sin(angle) * distance
  ];
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
      const point = routePoint(site, worldKey, item.id, index);
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
    // A river's channel widens with `flow`; a bridge's deck widens with the
    // `load` it carries. Reading `flow` on a bridge just returned the fallback
    // for every pylon, so every crossing came out the same width.
    const widthField = layer.as === 'bridge' ? 'load' : layer.as === 'subway' ? 'traffic' : 'flow';
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
        points: controls,
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

function makeGroups(sites, nodes, worldKey) {
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
        colorIndex: Math.floor(seeded(worldKey, key, 'group-color') * 8),
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
      if (key && !keys.has(key)) keys.set(key, typeof raw === 'string' ? raw.trim() : null);
    }
    return keys;
  };

  const addMember = (item, position) => {
    if (!item?.id) return;
    for (const [key, raw] of groupKeysFor(item)) {
      const group = ensure(key);
      if (!group.display && raw) group.display = raw;
      if (group.memberIds.has(item.id)) continue;
      group.memberIds.add(item.id);
      group.positions.push(position);
    }
  };

  for (const site of sites) {
    if (!site.item) continue;
    addMember(site.item, site.position);
  }
  for (const node of nodes) {
    addMember(node.item, node.position);
  }

  return [...buckets.values()]
    .filter((group) => group.memberIds.size >= 2)
    .map((group) => {
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
        colorIndex: group.colorIndex,
        center: midpoint,
        radius: clamp(radius, 2.4, 9),
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
  const links = makeLinks(dsl, layers, anchors);
  const connectors = makeConnectors(nodes, anchors);
  const groups = makeGroups(sites, nodes, worldKey);
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
