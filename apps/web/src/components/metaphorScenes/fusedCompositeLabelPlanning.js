/**
 * Where fused composite names stand and how the declutter pass ranks them.
 * Pure plan fields (`labelOffset`, `labelLift`, `labelRank`) — consumed by
 * `FusedCompositeScene.jsx` and `fusedCompositePrimitives.jsx`, not by the
 * rest of the planner. Lives outside `fusedCompositePlanner.js`, which is over
 * its max-lines budget (same extraction pattern as `fusedCompositeSceneResolvers.js`).
 */

/**
 * How far a site's name clears the tallest landmark planted on it. A node's own
 * name sits 0.9 above its top, so this has to exceed that or the two names
 * arrive in the same square of screen and the declutter pass drops one of them —
 * which, since a site outranks a node on importance, would be the tower's.
 */
const SITE_LABEL_CREST_CLEARANCE = 1.5;
/** How far out along the shoulder a site's name stands, as a fraction of its radius. */
const SITE_LABEL_REACH = 0.68;

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
export function assignSiteLabelPlacement(sites, nodes) {
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
/** The substrate's own ladder, per layer: biggest ground gets the first name. */
function assignSubstrateRanks(sites) {
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
}

/**
 * One queue per layer, each ordered by its own metric, highest first.
 *
 * Landmarks and journey stations share one ladder: they are the same rung of
 * the scene — a thing standing in a territory — whatever grammar drew them.
 * Every layer gets a queue even when empty, because the interleave below walks
 * layers in this insertion order and a missing key would silently drop a layer
 * out of the rotation rather than just skipping its turn.
 */
function buildLabelQueues(layers, nodes, paths) {
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
  return queues;
}

/**
 * Deal ranks round-robin across the layers rather than draining one at a time.
 * That is the whole point of the pass: a global sort by magnitude lets one
 * dense layer take every surviving name, and the tie-break (nearness) knows
 * nothing about layers.
 */
function interleaveLabelRanks(queues) {
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

export function assignLabelRanks(layers, sites, nodes, paths) {
  assignSubstrateRanks(sites);
  interleaveLabelRanks(buildLabelQueues(layers, nodes, paths));
}
