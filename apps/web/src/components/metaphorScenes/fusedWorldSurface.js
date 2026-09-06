/**
 * The fused world's own ground: the sea level between the islands, the dome
 * each site sits on, and the solver that lays a channel along that surface.
 *
 * A pure sibling module rather than a block inside `fusedCompositePlanner.js`
 * (ADR-0005, #500): no React, no three.js, no closure over planner state — the
 * functions take `(x, z, sites)` / `(controls, sites)` and nothing else, they
 * were already tested in isolation (`apps/web/test/metaphorFusedRoutes.test.js`),
 * and `fusedCompositePrimitives.jsx` already imported the constant specifically
 * so the `WorldGround` disc and the route solver cannot drift apart. When a
 * slice has three independent consumers and its own test file, the file is the
 * slice's real home.
 */

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function finite(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

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
 * by the stations (the planner's `routePoint`) and by the surface samples
 * between them, so a route keeps one constant clearance for its whole length.
 */
export const CHANNEL_RIDE = 0.16;

/**
 * Spacing of the surface samples inserted along a leg, in world units, and the
 * cap on how many one leg may add. Sites are 1.8–4.6 units across, so ~1.15
 * puts three or four samples inside a strait — enough for the dip to read —
 * while the cap keeps a long leg across an empty ocean from turning into a
 * hundred collinear control points the tube then has to tessellate through.
 */
const CHANNEL_SAMPLE_SPACING = 1.15;
const CHANNEL_MAX_SAMPLES = 10;

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
export function routeAlongSurface(controls, sites) {
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
