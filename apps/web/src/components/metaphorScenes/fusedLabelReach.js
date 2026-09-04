/**
 * How much of the gap to the nearest other landmark a name may spend reaching
 * away from its own.
 *
 * Half the gap is the break-even point: a name pushed straight at its
 * neighbour is then exactly as far from that landmark as from the one it
 * names, and "whose name is this?" has no answer. Sitting under half leaves the
 * question decided rather than tied, and 0.45 is far enough under that the
 * winner survives the perspective the scene is actually read in.
 */
const NEIGHBOUR_SHARE = 0.45;

/**
 * Keep every name nearer the body it names than any other.
 *
 * `makeNodes` pushes a name out past its site's shoulder — `site.radius * 0.6`
 * — so two landmarks on one island stop contesting a single screen slot
 * (#519). That reach is sized from the SITE and knows nothing about the next
 * island, so two landmarks on adjacent sites are each walked into the water
 * between them. On the shipped festival composite `artist-check-in`'s name
 * landed 2.10 world units from artist-check-in and 0.68 from shuttle-control,
 * and shuttle-control's own name 1.90 from itself and 1.57 from
 * artist-check-in: both names read as the wrong landmark's, which is the
 * failure the shoulder push exists to prevent, moved one island over.
 *
 * So the reach is capped against the gap to the nearest other landmark. It is a
 * cap and not a replacement, because the shoulder push is right wherever there
 * is room for it. Measured across the three shipped composites: three of ten
 * names are untouched, the seven the cap trims keep 0.83-2.22 units of reach
 * (against the 0.58 fixed nudge #519 replaced), and the two that read as the
 * wrong landmark now read as their own. A lone landmark has no neighbour to be
 * confused with and keeps its shoreline placement.
 *
 * A node's `anchor` shares its x/z with its `position`, so the distance from a
 * name to its own landmark is exactly the length of `labelOffset` — which is
 * why the cap can be applied to the offset without re-deriving anything.
 *
 * The same shape holds one grammar over, which is why the body's own point is a
 * parameter rather than a field read. A path station pushes its name a flat
 * 0.72 along the bearing from its SITE's centre out to the station, so two
 * stations at nearly the same angle from that centre are pushed along nearly
 * the same line and the near one collects the far one's name. Measured on the
 * shipped `composite-sentient-toaster-memory-palace.json` fixture:
 * `bread-enters` and `coil-hesitates` sit 0.18 apart on `recollection-loop`,
 * and `bread-enters`'s name landed 0.720 from its own station and 0.701 from
 * `coil-hesitates`. Stations carry `point`, not `position`, and are compared
 * only against the other stations of their own path — that is the confusion the
 * bearing actually produces, and the one this run could measure.
 *
 * Mutates and returns `bodies`.
 *
 * @param {Array<{labelOffset: number[]}>} bodies
 * @param {(body: object) => number[]} [positionOf] — the body's own world point
 */
export function clampLabelReach(bodies, positionOf = (body) => body.position) {
  for (const node of bodies) {
    const offset = node?.labelOffset;
    if (!Array.isArray(offset)) continue;
    const reach = Math.hypot(offset[0], offset[2]);
    if (!(reach > 0)) continue;

    const here = positionOf(node);
    let nearest = Infinity;
    for (const other of bodies) {
      if (other === node) continue;
      const there = positionOf(other);
      const gap = Math.hypot(there[0] - here[0], there[2] - here[2]);
      if (gap < nearest) nearest = gap;
    }
    // The only body in the world: nothing to be mistaken for.
    if (!Number.isFinite(nearest)) continue;

    const limit = nearest * NEIGHBOUR_SHARE;
    if (reach <= limit) continue;
    const scale = limit / reach;
    node.labelOffset = [offset[0] * scale, 0, offset[2] * scale];
  }
  return bodies;
}
