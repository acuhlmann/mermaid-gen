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
 * Clearance between a terminus platform's rim and its route's name sign, used
 * **only by the fallback** in `terminusSign` below — a route with one stop, or
 * with every stop on one platform, has no station-free stretch to be named on.
 * Ordinary routes are named by `subwayRouteSign` on a gap of their own track and
 * never read this number: measured over four multi-line fixtures, 8 of 9 line
 * names came from the gap path, at 1.19–9.43 from their own terminus and no
 * closer than 1.19 to any platform rim.
 *
 * "Never leaves the paper" is a claim about the **plate**, and it holds:
 * `bounds.radius` reserves `platformRadius + 0.9` past the furthest station, so
 * every sign the gap path places is inside the reserve. #460 read this sentence
 * as contradicting the reach clamp below, which was fair — the two are about
 * different containers. The plate is bigger than the fit, because `SubwayScene`
 * puts the plate in `FRAME_IGNORE_DATA` and the camera frames the stations: a
 * sign can be comfortably on the paper and still off the edge of what a viewer
 * sees. Both statements are true; only one of them has a clamp behind it.
 */
const ROUTE_SIGN_STANDOFF = 0.9;

/**
 * How far a route name stands off its own centreline, across the direction of
 * travel. Comfortably under `LANE_GAP / 2` so a name is never closer to the
 * neighbouring route's track than to its own.
 */
const ROUTE_SIGN_LATERAL = 1.5;

/**
 * Clearance a candidate sign position must keep from every platform rim in the
 * network — its own route's and everybody else's.
 */
const ROUTE_SIGN_CLEARANCE = 0.9;

/**
 * How far apart two route names want to be. Larger than the platform clearance
 * because a route name is uppercase and letter-spaced, so it is the widest
 * label on the map, and because both are pinned: where they meet, neither
 * yields and one line's name is printed through another's.
 */
const ROUTE_SIGN_PAIR_GAP = 3.4;

/**
 * The room a candidate is credited with when there are no platforms to measure
 * against. Any finite value above `ROUTE_SIGN_CLEARANCE` does the job — every
 * candidate gets the same one, so the crowding penalty and the near-edge
 * tie-break are what separate them. It exists only so the score stays a
 * comparable number; see `platformClearance`.
 */
const ROUTE_SIGN_OPEN_FIELD = ROUTE_SIGN_CLEARANCE + 1;

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
 * A route name written past its terminus, along the direction of travel. Only
 * the fallback now — a route with one stop, or with every stop on one platform,
 * has no station-free stretch to be named on.
 */
function terminusSign(stops, radiusOf, reachX, reachZ) {
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
  //
  // #460 measured this collapsing the standoff to 0.000 and asked whether the
  // clamp is a bug or correct-by-design. **The `x` half is correct-by-design and
  // the `z` half was the bug** — and the reason the two look alike is that a
  // clamp is usually one decision. `x` is the axis a route actually escapes
  // along: its terminus IS its furthest stop in the direction of travel, so an
  // unbounded `x` puts the name past the frame, and the clamped fallback already
  // sits at |ndcX| 0.845 on a 390x844 phone. `z` is depth under the orbit camera
  // rather than screen height, so a lateral sign is nowhere near the edge; the
  // real damage was the box being **degenerate** there. A single-lane network
  // has no sideways extent at all, which is why the bound is floored where it is
  // computed rather than loosened here.
  //
  // Two things this clamp still cannot do, and both are pinned: it cannot put a
  // fallback sign inside its own rim (any admissible box contains the terminus
  // platform's rim plus its radius, so #460's 0.000 was measured against a box
  // this layout cannot emit), and the `owed` repayment below only earns its keep
  // when `x` bites while `z` has room — with both clamped, `min(reachZ, max(
  // reachZ, …))` is `reachZ` and the two-axis corner genuinely costs clearance
  // (0.33 of the 0.9). See `metaphorGroupPlacards.test.js`.
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

/**
 * Every position a route's name could stand at, in order.
 *
 * One stroke per gap of the route, offset to either side of it, at three points
 * along the stroke rather than only its midpoint. Split out of
 * `subwayRouteSign` so that enumerating the options and judging them are
 * different jobs: this answers "where could it go", the caller answers "where
 * should it go", and the reach rejection stays with the caller because it is the
 * only one that knows the network's extent.
 *
 * The offset is perpendicular to the direction of travel, so a slanted segment
 * is named beside its own stroke rather than through it.
 *
 * @param {Array<{ position: [number, number, number] }>} stops
 * @returns {Generator<[number, number, number]>}
 */
function* routeSignCandidates(stops) {
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [ax, , az] = stops[i].position;
    const [bx, , bz] = stops[i + 1].position;
    const span = Math.hypot(bx - ax, bz - az);
    if (span <= 1e-3) continue;
    const nx = -(bz - az) / span;
    const nz = (bx - ax) / span;
    // Three stations along the gap, not just its midpoint: a four-stop route
    // offers six placements otherwise, which is not enough choice for the score
    // in `subwayRouteSign` to find a corner nothing else wants.
    for (const t of [0.5, 0.36, 0.64]) {
      const mx = ax + (bx - ax) * t;
      const mz = az + (bz - az) * t;
      for (const side of [1, -1]) {
        yield [mx + nx * ROUTE_SIGN_LATERAL * side, 0, mz + nz * ROUTE_SIGN_LATERAL * side];
      }
    }
  }
}

/**
 * Where a route's name is written: **alongside its own track, on the longest
 * station-free stretch of it** — which is where a printed transit map writes a
 * line's name, and the only place on a lane diagram that is empty by
 * construction.
 *
 * It used to stand past the terminus platform, along the direction of travel.
 * That reads right and does not survive contact with the declutter pass: a
 * route sign is `pinned` and a station name is not, so on every capture the
 * sign silently deleted the name of the station it stood next to — measured
 * across three fixtures x three viewports, 7 of 24 terminus names were gone,
 * and hiding the signs brought back exactly those 7 and no others. Standing off
 * the rim in PLAN view is not enough: the sign sits a metre above the plate, so
 * a tilted camera projects it straight back down onto the platform, and the
 * `reachX` clamp below had already eaten most of the along-track standoff
 * anyway (the terminus is the network's furthest station, so the clamp always
 * fires there).
 *
 * A gap midpoint has no such fight. It is at least half a stop-spacing from
 * either neighbour along the track and a lateral offset clear of the
 * centreline, and every candidate is scored against each platform in the
 * network AND against the route names already placed.
 *
 * @param {Array<{ id: string, position: [number, number, number] }>} stops
 * @param {(itemId: string) => number} radiusOf drawn platform radius by item id
 * @param {object} [options]
 * @param {number} [options.reachX] how far the network's own platforms reach along x
 * @param {number} [options.reachZ] how far the network's own platforms reach along z
 * @param {Array<{ position: [number, number, number], platformRadius: number }>} [options.stations]
 *   every platform in the network, so a sign in one lane's gap cannot land on
 *   an interchange that sits between the lanes
 * @param {Array<[number, number, number]>} [options.placed] route names already sited
 * @returns {[number, number, number] | null}
 */
export function subwayRouteSign(stops, radiusOf, options = {}) {
  const { reachX = Infinity, reachZ = Infinity, stations = [], placed = [] } = options;
  if (!stops.length) return null;

  // A name is not placed by the first candidate that clears a threshold but by
  // the one that clears BY THE MOST. Thresholding traded victims when it was
  // tried: every terminus name came back and three mid-route names went
  // instead, because a candidate that scrapes past the test is still drawn into
  // the neighbour it scraped past. What matters is the smallest clearance a
  // placement leaves anywhere, so that is what is maximised.
  //
  // Distance here is ROUND, and that is a measured choice rather than an
  // oversight. Scoring x separation as worth less than z — on the reasoning
  // that a billboarded word is several times wider than it is tall, so two
  // names side by side overlap where two across the lanes do not — is a better
  // model of the geometry and a worse placement: it cost three station names
  // (65 of 69 legible down to 62) because it pushes signs off the lane axis and
  // into the neighbouring route's stations, which are what actually get hidden.
  const nearest = (sx, sz, px, pz) => Math.hypot(sx - px, sz - pz);

  /**
   * Room to the nearest platform rim. A name inside this is not acceptable.
   *
   * With no platforms to measure against it returns a finite stand-in rather
   * than `Infinity`, and that is the difference between scoring and only
   * appearing to. `score > best.score` is false between two `Infinity`s, so an
   * unbounded `room` silently handed the placement to whichever candidate came
   * first and left the two terms layered on top of it — the crowding penalty
   * and the near-edge tie-break — deciding nothing at all. Measured: a route
   * running along -x was named on the FAR edge, the exact defect the tie-break
   * exists to prevent, and a candidate was chosen directly on top of a name
   * already placed there.
   *
   * `subwayNetworkLayout` always passes the network's own platforms, so this
   * only bites a direct caller of the exported function — which is a test, and
   * a test that reports a green pass on an arbitrary placement is the failure
   * mode this repo's trap checklist is written around. Every candidate scores
   * the same room, so the penalty and the tie-break decide, which is what they
   * are for.
   */
  const platformClearance = ([sx, , sz]) => {
    let worst = Infinity;
    for (const station of stations) {
      const gap =
        nearest(sx, sz, station.position[0], station.position[2]) - station.platformRadius;
      if (gap < worst) worst = gap;
    }
    return Number.isFinite(worst) ? worst : ROUTE_SIGN_OPEN_FIELD;
  };

  // Another route's name matters too — two route signs are both `pinned`, so
  // where they overlap neither yields and the map prints one line name through
  // another. Solving each route on its own put ASSISTED and ENGINEER in the
  // same square metre of an 11-stop network.
  //
  // It is a PENALTY and not a second gate, which is the whole difference
  // between a preference and a starved route. Gating on it dropped a two-stop
  // line back to the terminus fallback in a seven-stop network — every one of
  // its six candidates was rejected for crowding a sign already placed, and the
  // position it fell back to was the one this function exists to stop using.
  const crowding = ([sx, , sz]) => {
    let penalty = 0;
    for (const other of placed) {
      penalty += Math.min(0, nearest(sx, sz, other[0], other[2]) - ROUTE_SIGN_PAIR_GAP) * 0.5;
    }
    return penalty;
  };

  /**
   * The two reasons a candidate is unusable: outside the network's own reach
   * box (which is the framing guard `terminusSign` explains at length), or too
   * close to a platform rim. Named so the loop below reads as "pick the best of
   * what is allowed" rather than as three unrelated tests.
   */
  const admissible = (candidate, room) =>
    Math.abs(candidate[0]) <= reachX &&
    Math.abs(candidate[2]) <= reachZ &&
    room > ROUTE_SIGN_CLEARANCE;

  let best = null;
  for (const candidate of routeSignCandidates(stops)) {
    const room = platformClearance(candidate);
    if (!admissible(candidate, room)) continue;
    let score = room + crowding(candidate);
    // The near edge (+z, toward the default camera) breaks a tie — the same
    // edge the city districts and the garden beds are named on, and the short
    // axis of a lane diagram, which is the free one.
    score += candidate[2] * 1e-3;
    if (!best || score > best.score) best = { candidate, score };
  }
  if (best) return best.candidate;

  return terminusSign(stops, radiusOf, reachX, reachZ);
}

/**
 * The name a shared platform writes above itself.
 *
 * An interchange used to print the name of `members[0]` and nothing else, on the
 * true argument that three stops standing at the same `(x, z)` would otherwise
 * stamp three names into the same pixels. What that argument misses is that the
 * members are not three spellings of one thing: in this grammar each is a
 * different stop on a different route, which the author has *declared* to be the
 * same place — "Checkout" on the order line and "Pack" on the fulfilment line.
 * Suppressing all but one deleted those concepts from the picture entirely: measured
 * across three fixtures at three viewports, 6 of 29 authored names had no `Text` in
 * the scene at all, and hover was the only way to learn they existed. (#534's pre-run
 * diagnosis counted 5 of 26 items; the run's own evidence table is denominated in
 * names, and this comment carries the run's number.)
 *
 * The real network's answer is a compound name — King's Cross St. Pancras — and
 * here it is one stacked sign: the members' names on their own lines, in authored
 * order, drawn as ONE label so the station stays one place to the declutter pass.
 * Repeats collapse, because the canonical example in
 * `apps/server/src/prompts/metaphorSystemPrompt.js` gives both members of its
 * interchange the label "Auth", and a sign reading "Auth / Auth" is worse than
 * the suppression it replaced.
 *
 * @param {string[]} ids — member item ids, in authored order
 * @param {Map<string, Record<string, unknown>>} itemById
 * @returns {string} newline-joined; a single-member station returns its own label
 */
export function subwayStationTitle(ids, itemById) {
  const seen = new Set();
  const names = [];
  for (const id of ids) {
    const raw = itemById.get(id)?.label;
    const label = typeof raw === 'string' ? raw.trim() : '';
    if (!label || seen.has(label)) continue;
    seen.add(label);
    names.push(label);
  }
  return names.join('\n');
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
 *   stations: Array<{ id: string, position: [number, number, number], members: string[], primary: string, title: string, lines: string[], lineIndices: number[], traffic: number, platformRadius: number }>,
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
      // What it draws is the whole platform's compound name, not just its own —
      // see `subwayStationTitle` for why suppressing the rest lost them.
      primary: ids[0],
      title: subwayStationTitle(ids, itemById),
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
  // Floored, and only on this axis. `reachOn(2)` is the network's own extent
  // sideways, and a single-lane network has none: every stop of the only route
  // shares a `z`, so the box is one platform radius tall (0.747 measured) while
  // `ROUTE_SIGN_LATERAL` is 1.5 — which rejects EVERY gap candidate before the
  // score is read and forces the whole file back onto the clamped terminus
  // fallback. That is the default shape: `DEFAULT_LINE` puts every item that
  // omits `line` on one route, so a subway the model wrote without line names
  // cannot use the placement `subwayRouteSign` exists to make. (#460.)
  //
  // The floor is a lateral sign plus the clearance it asks for, and only
  // single-lane networks need it — with two or more lanes, interchanges sit
  // at `LANE_GAP / 2` (1.8) off the centreline, so `reachOn(2)` is already
  // wide enough at default traffic (2.436 > 2.4) and `Math.max` changes
  // nothing. At low traffic reachOn(2) can fall under the floor, and applying
  // it there pushes a sign past the network's own reach box (#587). High-
  // traffic multi-line placements stay byte-identical, which is what keeps
  // #505's rendered measurement valid; only the single-lane shape that was
  // demonstrably broken moves, and `metaphorGroupPlacards.test.js` pins both
  // halves of that claim.
  //
  // `reachX` keeps the raw extent on purpose: escaping along it is the framing
  // failure this clamp was written for. A route's terminus IS its furthest stop
  // along the direction of travel, so an unbounded x puts the name past the
  // frame — measured, the clamped fallback already sits at |ndcX| 0.845 on a
  // 390x844 phone. Depth is the other story: the fit is driven by the wide axis
  // and world `z` falls mostly INTO depth under the orbit camera, so a sign at
  // z = 1.5 measures |ndc| 0.738 / -0.138 at phone, 0.631 at cover and 0.615 at
  // desktop — comfortably inside the frame the stations themselves define.
  const reachZFloor = ROUTE_SIGN_LATERAL + ROUTE_SIGN_CLEARANCE;
  const reachZ = lines.length <= 1 ? Math.max(reachOn(2), reachZFloor) : reachOn(2);
  // Longest route first: it has the most gaps to choose from, so letting it go
  // last would hand the crowded network's only quiet corner to a two-stop line.
  const placedSigns = [];
  for (const line of [...lines].sort((a, b) => b.stops.length - a.stops.length)) {
    line.sign = subwayRouteSign(line.stops, radiusOf, {
      reachX,
      reachZ,
      stations,
      placed: placedSigns
    });
    if (line.sign) placedSigns.push(line.sign);
  }

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
