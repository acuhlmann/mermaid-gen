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
  garden: [0.1, 10]
});

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

function makeMotion(worldKey, id, style, novelty) {
  return {
    style,
    phase: seeded(worldKey, id, 'motion-phase') * TAU,
    speed: 0.45 + seeded(worldKey, id, 'motion-speed') * (0.45 + novelty * 0.55),
    amplitude: 0.035 + novelty * (0.08 + seeded(worldKey, id, 'motion-amp') * 0.12)
  };
}

function makeSites({ substrateEntries, itemCount, worldRadius, topology, novelty, worldKey }) {
  const siteCount =
    substrateEntries.length > 0
      ? substrateEntries.length
      : clamp(Math.ceil(Math.sqrt(Math.max(1, itemCount))) + 1, 3, 7);
  const sites = [];
  for (let index = 0; index < siteCount; index += 1) {
    const entry = substrateEntries[index];
    const item = entry?.item;
    const metric = metricValue(item, 'archipelago', 'mass');
    const basePosition = sitePosition({
      index,
      count: siteCount,
      radius: worldRadius,
      topology,
      novelty,
      worldKey
    });
    const position = explicitPosition(item, basePosition);
    const radius = entry ? 1.9 + Math.sqrt(Math.max(0.5, metric.raw)) * 0.48 : 2.5;
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
      radius: clamp(radius, 1.8, 4.6),
      height,
      anchor,
      motion: makeMotion(worldKey, id, entry ? 'sway' : 'pulse', novelty),
      estimatedCost: getCompositePrimitive(entry ? 'island' : 'platform').estimatedCost
    });
  }
  return sites;
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
  if (kind === 'layercake')
    return { radius: 1 + normalized * 1.15, height: 0.8 + normalized * 2.5 };
  if (kind === 'tree') return { radius: 0.8 + normalized * 0.8, height: 2 + normalized * 3 };
  if (kind === 'garden') return { radius: 0.65 + normalized * 0.7, height: 1.4 + normalized * 2.6 };
  if (kind === 'galaxy' || kind === 'orrery') {
    return { radius: 0.42 + normalized * 0.8, height: 0.42 + normalized * 0.8 };
  }
  return { radius: 0.7 + normalized * 0.7, height: 1.5 + normalized * 3 };
}

function makeNodes({ layers, sites, novelty, worldKey, anchors }) {
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
    const siteIndex =
      (nodeIndex +
        layerIndex +
        Math.floor(seeded(worldKey, item.id, 'site-choice') * Math.max(1, sites.length))) %
      Math.max(1, sites.length);
    const site = sites[siteIndex];
    const metric = metricValue(item, layer.as, capability.metric);
    const { radius, height } = nodeDimensions(item, layer.as, metric.normalized);
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
      labelOffset: [(labelDx / labelDistance) * 0.58, 0, (labelDz / labelDistance) * 0.58],
      radius,
      height,
      metric,
      motion: makeMotion(
        worldKey,
        item.id,
        capability.role === 'field'
          ? 'pulse'
          : getCompositePrimitive(capability.primitive).motionStyle,
        novelty
      ),
      estimatedCost: getCompositePrimitive(capability.primitive).estimatedCost
    };
  });
  return nodes;
}

function orderedPathItems(layer) {
  return [...(layer.items ?? [])].sort((a, b) => finite(a.stage, 0) - finite(b.stage, 0));
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

function makePaths({ layers, sites, novelty, worldKey, anchors }) {
  return layers.flatMap((layer, layerIndex) => {
    const capability = getCompositeCapability(layer.as);
    if (capability.role !== 'path') return [];
    const items = orderedPathItems(layer);
    if (items.length === 0) return [];
    const rotation = Math.floor(seeded(worldKey, layer.id, 'path-site-rotation') * sites.length);
    const stations = items.map((item, index) => {
      const site = sites[(index + rotation + layerIndex) % sites.length];
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
        labelOffset: [(labelDx / labelDistance) * 0.72, 0, (labelDz / labelDistance) * 0.72],
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
      controls = [
        pathEnd(controls[0], controls[1], 3.2),
        ...controls,
        pathEnd(controls.at(-1), controls.at(-2), 3.2)
      ];
    }
    const averageFlow =
      items.reduce((sum, item) => sum + finite(item.flow, 5), 0) / Math.max(1, items.length);
    return [
      {
        id: layer.id,
        layerId: layer.id,
        kind: layer.as,
        points: controls,
        stations,
        width: clamp(0.16 + Math.sqrt(Math.max(0.1, averageFlow)) * 0.055, 0.2, 0.42),
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
  return Math.max(7, extent + 1.4);
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
  const worldRadius = clamp(8.5 + Math.sqrt(Math.max(1, itemCount)) * 2.15, 10, 23);
  const topology = resolveTopology(worldKey, novelty);
  const substrateEntries = layers.flatMap((layer) =>
    getCompositeCapability(layer.as).role === 'substrate'
      ? (layer.items ?? []).map((item) => ({ layer, item }))
      : []
  );
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
  const nodes = makeNodes({ layers, sites, novelty, worldKey, anchors });
  const paths = makePaths({ layers, sites, novelty, worldKey, anchors });
  const links = makeLinks(dsl, layers, anchors);
  const groundRadius = resolveGroundRadius(sites, nodes, paths);
  const estimatedCost =
    sites.reduce((sum, item) => sum + item.estimatedCost, 0) +
    nodes.reduce((sum, item) => sum + item.estimatedCost, 0) +
    paths.reduce((sum, item) => sum + item.estimatedCost, 0) +
    links.length * 2;

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
    anchors,
    estimatedCost
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
        Math.cos(angle) * amplitude * 2.2,
        wave * amplitude * 0.35,
        Math.sin(angle) * amplitude * 2.2
      ],
      rotation: [0, angle * 0.18, 0],
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
  return {
    offset: [0, wave * amplitude * 0.12, 0],
    rotation: [0, 0, 0],
    scale: 1
  };
}
