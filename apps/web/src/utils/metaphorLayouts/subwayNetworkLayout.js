/**
 * Lay out a transit network for the `subway` metaphor.
 *
 * The grammar this exists for is "many named routes crossing at shared
 * stations", which nothing else covered: `river` is one sequence, `tree` is a
 * hierarchy, `galaxy` has no order at all. What makes it a network rather than
 * a bundle of parallel rivers is the interchange — a station two lines both
 * stop at — so the geometry has to make crossings look like crossings.
 *
 * Geometry is a **lane diagram**, the way printed transit maps solve this: one
 * axis is progress along a route, the other separates the routes, and a shared
 * station pulls its lines together into one lane for that stop.
 *
 * Two earlier models both failed on the interchange, which is the only feature
 * that matters here. Radiating each line from a hub means two routes meet only
 * at the hub, so an interchange between two outer stops sat off both rays and
 * each route detoured to collect it. Running each line as a straight chord
 * fixes that for ONE shared station and breaks completely on two: a pair of
 * straight lines crosses exactly once, so a network where two routes share both
 * an Auth stop and a Checkout stop pinned both to the same point and the whole
 * map collapsed into it. Lanes have no such limit — routes can converge, share
 * a stop, separate, and converge again, which is what real networks do.
 */

const DEFAULT_LINE = 'Main line';
/** Distance between consecutive stops along a route. */
const STOP_SPACING = 4.2;
/** Separation between two routes' lanes, across the direction of travel. */
const LANE_GAP = 3.6;

/**
 * Clearance between a terminus platform's rim and its route's name sign. The
 * bounds below already reserve `platformRadius + 0.9` of plate past the
 * furthest station, so a sign inside that margin never leaves the paper.
 */
const ROUTE_SIGN_STANDOFF = 0.9;

/** Platform radius from the traffic passing through a station. */
export function subwayPlatformRadius(traffic) {
  return 0.46 + Math.sqrt(Math.max(0.1, traffic ?? 5)) * 0.15;
}

/**
 * Drawn radius of a station's platform. An interchange is the network's whole
 * claim, so it gets the wider pill. Lives here rather than in the scene so the
 * route sign below and the disc the scene draws cannot disagree about where a
 * platform ends.
 */
export function subwayStationRadius(traffic, isInterchange) {
  return subwayPlatformRadius(traffic) * (isInterchange ? 1.25 : 0.8);
}

/**
 * Where a route's name is written: PAST its last platform, along the direction
 * the route was travelling when it got there — the way a terminus is signed on
 * a real platform, and the way `getPoint(1)` was never going to be.
 *
 * The sign used to sit exactly on the terminus, so every route name was drawn
 * into its own last station's name. A group's name never goes where its own
 * members stand; see `docs/agents/domains/metaphor3d.md`.
 *
 * @param {Array<{ id: string, position: [number, number, number] }>} stops
 * @param {(itemId: string) => number} radiusOf drawn platform radius by item id
 * @param {number} reachX how far the network's own platforms reach along x
 * @param {number} reachZ how far the network's own platforms reach along z
 * @returns {[number, number, number] | null}
 */
export function subwayRouteSign(stops, radiusOf, reachX = Infinity, reachZ = Infinity) {
  const terminus = stops[stops.length - 1];
  if (!terminus) return null;
  const [tx, , tz] = terminus.position;

  let dx = 0;
  let dz = 0;
  // Walk back until a stop that is not AT the terminus — an interchange can
  // put two consecutive stops on one platform, and their difference is zero.
  for (let i = stops.length - 2; i >= 0; i -= 1) {
    const [px, , pz] = stops[i].position;
    dx = tx - px;
    dz = tz - pz;
    if (Math.hypot(dx, dz) > 1e-3) break;
  }
  let length = Math.hypot(dx, dz);
  if (length < 1e-3) {
    // A one-stop route has no direction of travel, so it heads outward from
    // the middle of the map; at the middle itself, +x is as good as any.
    dx = tx;
    dz = tz;
    length = Math.hypot(dx, dz);
    if (length < 1e-3) {
      dx = 1;
      dz = 0;
      length = 1;
    }
  }
  const standoff = radiusOf(terminus.id) + ROUTE_SIGN_STANDOFF;
  let sx = tx + (dx / length) * standoff;
  let sz = tz + (dz / length) * standoff;

  // A sign may stand off its platform, but never further out than the network
  // itself reaches: the camera frames the stations (the plate is out of the
  // fit), so a sign past them is drawn off the edge — which is how the first
  // version of this clipped FULFIL off a 390px phone. Clamp both axes, then
  // spend whatever the clamp took back on the NEAR edge (+z), the same edge the
  // city districts and the garden beds are named on, and for the same reason.
  const clampedX = Math.min(reachX, Math.max(-reachX, sx));
  const clampedZ = Math.min(reachZ, Math.max(-reachZ, sz));
  if (clampedX !== sx || clampedZ !== sz) {
    sx = clampedX;
    sz = clampedZ;
    const spentX = Math.abs(sx - tx);
    const owed = Math.sqrt(Math.max(0, standoff * standoff - spentX * spentX));
    sz = Math.min(reachZ, Math.max(sz, tz + owed));
  }
  return [sx, 0, sz];
}

function lineKey(item) {
  const raw = item.line;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : DEFAULT_LINE;
}

function stopValue(item) {
  const raw = typeof item.stop === 'number' && Number.isFinite(item.stop) ? item.stop : 0;
  return Math.max(0, Math.min(100, raw));
}

/**
 * Group stops that name each other via `interchange` into shared stations.
 * Union-find over the declared pairs, so `a → b` and `b → c` collapse to one
 * station even when the author only wrote half the pairs.
 *
 * @returns {Map<string, string>} item id → station id (the group's lowest id)
 */
export function resolveInterchangeGroups(items) {
  const parent = new Map();
  for (const item of items) parent.set(item.id, item.id);
  const find = (id) => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root);
    let cursor = id;
    while (parent.get(cursor) !== root) {
      const next = parent.get(cursor);
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  };
  for (const item of items) {
    if (!Array.isArray(item.interchange)) continue;
    for (const other of item.interchange) {
      if (!parent.has(other)) continue;
      const a = find(item.id);
      const b = find(other);
      if (a !== b) parent.set(a < b ? b : a, a < b ? a : b);
    }
  }
  const groups = new Map();
  for (const item of items) groups.set(item.id, find(item.id));
  return groups;
}

/**
 * @param {Array<Record<string, unknown>>} items
 * @returns {{
 *   positions: Map<string, [number, number, number]>,
 *   lines: Array<{ name: string, index: number, stops: Array<{ id: string, position: [number, number, number], traffic: number }>, sign: [number, number, number] | null }>,
 *   stations: Array<{ id: string, position: [number, number, number], members: string[], primary: string, lines: string[], lineIndices: number[], traffic: number, platformRadius: number }>,
 *   stationOf: Map<string, string>,
 *   bounds: { radius: number }
 * }}
 */
export function subwayNetworkLayout(items) {
  const valid = items.filter((item) => item && typeof item.id === 'string');
  const groups = resolveInterchangeGroups(valid);
  const itemById = new Map(valid.map((item) => [item.id, item]));

  /** @type {Map<string, Array<Record<string, unknown>>>} */
  const byLine = new Map();
  for (const item of valid) {
    const key = lineKey(item);
    if (!byLine.has(key)) byLine.set(key, []);
    byLine.get(key).push(item);
  }
  for (const stops of byLine.values()) stops.sort((a, b) => stopValue(a) - stopValue(b));

  const lineNames = [...byLine.keys()];
  const lineCount = lineNames.length;
  const lineIndexByName = new Map(lineNames.map((name, index) => [name, index]));
  const longestLine = Math.max(1, ...lineNames.map((name) => byLine.get(name).length));

  /** @type {Map<string, string[]>} station id → member item ids */
  const members = new Map();
  for (const item of valid) {
    const station = groups.get(item.id);
    if (!members.has(station)) members.set(station, []);
    members.get(station).push(item.id);
  }

  // Progress along the route, normalised so a 3-stop line and an 8-stop line
  // both run the full width and a shared station lands at a comparable place
  // on each.
  /** @type {Map<string, number>} item id → 0…1 progress */
  const progress = new Map();
  for (const [name, stops] of byLine) {
    const last = Math.max(1, stops.length - 1);
    stops.forEach((item, index) => progress.set(item.id, index / last));
    void name;
  }

  const laneZ = (lineIndex) => (lineIndex - (lineCount - 1) / 2) * LANE_GAP;
  const spanX = (longestLine - 1) * STOP_SPACING;

  /** @type {Map<string, [number, number, number]>} station id → position */
  const stationPositions = new Map();
  for (const [station, ids] of members) {
    let sumProgress = 0;
    let sumLane = 0;
    for (const id of ids) {
      sumProgress += progress.get(id) ?? 0;
      sumLane += laneZ(lineIndexByName.get(lineKey(itemById.get(id) ?? {})) ?? 0);
    }
    stationPositions.set(station, [
      (sumProgress / ids.length - 0.5) * spanX,
      0,
      // An interchange sits between the lanes it joins, which is what makes the
      // routes visibly converge on it and separate again afterwards.
      sumLane / ids.length
    ]);
  }

  // Keep each route monotonic: two stations whose averaged progress ties would
  // otherwise overlap, and a route that steps backwards reads as a mistake.
  const MIN_STEP = STOP_SPACING * 0.45;
  for (const [name, stops] of byLine) {
    let previousX = -Infinity;
    for (const item of stops) {
      const station = groups.get(item.id);
      const point = stationPositions.get(station);
      if (!point) continue;
      if (point[0] < previousX + MIN_STEP) point[0] = previousX + MIN_STEP;
      previousX = point[0];
    }
    void name;
  }

  /** @type {Map<string, [number, number, number]>} */
  const positions = new Map();
  for (const item of valid) {
    if (Array.isArray(item.position) && item.position.length === 3) {
      positions.set(item.id, [...item.position]);
      continue;
    }
    const point = stationPositions.get(groups.get(item.id)) ?? [0, 0, 0];
    positions.set(item.id, [...point]);
  }

  const lines = lineNames.map((name, index) => ({
    name,
    index,
    stops: byLine.get(name).map((item) => ({
      id: item.id,
      position: positions.get(item.id) ?? [0, 0, 0],
      traffic: typeof item.traffic === 'number' && Number.isFinite(item.traffic) ? item.traffic : 5
    }))
  }));

  const stations = [...members.entries()].map(([station, ids]) => {
    const stationLines = [...new Set(ids.map((id) => lineKey(itemById.get(id) ?? {})))];
    const traffic = ids.reduce((sum, id) => {
      const raw = itemById.get(id)?.traffic;
      return sum + (typeof raw === 'number' && Number.isFinite(raw) ? raw : 5);
    }, 0);
    return {
      id: station,
      position: positions.get(ids[0]) ?? [0, 0, 0],
      members: ids,
      // Only one member draws the station's name: an interchange is ONE place,
      // and three stops stacked at it printed its name three times over itself.
      primary: ids[0],
      lines: stationLines,
      lineIndices: stationLines.map((name) => lineIndexByName.get(name) ?? 0),
      traffic,
      platformRadius: subwayStationRadius(traffic, stationLines.length > 1)
    };
  });

  const stationOf = new Map(groups);

  const radiusByStation = new Map(stations.map((station) => [station.id, station.platformRadius]));
  const radiusOf = (itemId) => radiusByStation.get(stationOf.get(itemId)) ?? 0.8;
  const reachOn = (axis) =>
    stations.reduce(
      (far, station) => Math.max(far, Math.abs(station.position[axis]) + station.platformRadius),
      0
    );
  const reachX = reachOn(0);
  const reachZ = reachOn(2);
  for (const line of lines) line.sign = subwayRouteSign(line.stops, radiusOf, reachX, reachZ);

  let radius = 4;
  for (const station of stations) {
    radius = Math.max(
      radius,
      Math.hypot(station.position[0], station.position[2]) +
        subwayPlatformRadius(station.traffic) +
        0.9
    );
  }

  return { positions, lines, stations, stationOf, bounds: { radius } };
}
