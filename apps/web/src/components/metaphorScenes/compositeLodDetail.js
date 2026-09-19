/**
 * What each LOD tier of a fused composite is allowed to drop.
 *
 * **`low` is a detail budget, not a content budget.** Every other thing the
 * tier turns off is finish — shore foam, pollen, birds, flow motes, the tower's
 * glow, a tier of terrace — and dropping it costs the viewer nothing they were
 * told to look for. The affinity groups were on the same list and are not the
 * same thing: the shared grouping noun is the one statement a fused world
 * exists to make, the only claim in the scene that spans layers. A world drew
 * it at `medium` and silently drew nothing at `low`, so the composite's whole
 * point was a function of its item count.
 *
 * Measured over 1,460 planned worlds (three shipped fixtures plus every ordered
 * pair of base kinds at 2–12 items a layer): 1,279 carry at least one affinity
 * group and **465 of them — 36.4% — drew zero territories**. 113 of those are
 * under the `itemCount > 18` bar, i.e. they reached `low` on cost alone.
 *
 * The loop is tighter than that, and it is the part worth remembering: the
 * planner adds `groups.length` to `estimatedCost`, so on the ledger's own
 * 6-tree + 6-city world the third shared noun takes the cost from 93 to 96,
 * crosses the 95 bar, and the gate then removes all three territories. **The
 * grouping paid for its own deletion.** The cost term is not wrong — three
 * discs do cost three discs — so the fix is here rather than there: the gate no
 * longer has a tier that deletes meaning, and the loop has nothing to close on.
 *
 * What `low` drops instead is chosen by measurement, not by area — and re-
 * measured 2026-09-19 (#729) through `resolveMetaphorSceneTheme`, the same
 * rewrite the renderer applies, over all four themes, the ten atmosphere kinds
 * and both surfaces (`waterColor` for an island world, `groundColor` for a
 * plaza), 320 cells, perceived luma against the surface each ring is
 * composited onto:
 *
 * | layer            | Δluma range       | mean   | share of the territory's fragments |
 * | ---------------- | ----------------- | ------ | ---------------------------------- |
 * | interior wash    | 0.00102 – 0.11275 | 0.0270 | ~52%                               |
 * | identity band    | 0.00027 – 0.16603 | 0.0492 | ~42%                               |
 * | boundary rim     | 0.02014 – 0.46074 | 0.1619 | ~6%                                |
 *
 * Weakest per-fragment signal for the largest share of the plate: wash, on
 * average half the band's delta and a sixth of the rim's. Its weakest painted
 * cell — `arcade` over an ocean, group 3 — carries Δluma 0.00102 where the
 * band is 0.00818 and the rim 0.06928, a factor of 68. The ordering is not
 * uniform: 47 of the 320 cells invert it (11 where the band is not strictly
 * above the wash — all on water, all near-zero deltas; 36 where the rim sits
 * below a strong wash — the lighter themes over ground). Every one is
 * enumerated by name in `metaphorGroupIdentity.test.js`, so a new inversion
 * fails rather than eats a tolerance. None of them changes the choice: the
 * rim is the only layer that marks WHERE a group ends, the band is half of
 * what the eye reads as the group's colour, and 28 of the 320 cells already
 * carry a band under 0.01 of visible difference — on those surfaces the
 * territory stands on the rim and the placard, which is the other half of why
 * neither may ever be a budget item.
 *
 * The band, the rim and the placard are content. Nothing in this table may
 * turn them off: `affinityGroupLayers` refuses a tier detail that lost one
 * (#728), and `metaphorGroupIdentity.test.js` sweeps every tier.
 */

/** Every tier `resolveLod` can return, in cost order. */
export const COMPOSITE_LOD_TIERS = Object.freeze(['high', 'medium', 'low']);

const FULL = Object.freeze({
  band: true,
  rim: true,
  placard: true,
  wash: true,
  bulb: true,
  segments: 48
});

const LEAN = Object.freeze({
  band: true,
  rim: true,
  placard: true,
  wash: false,
  bulb: false,
  segments: 24
});

/**
 * How much of an affinity territory this tier draws.
 *
 * `band`, `rim` and `placard` are the group's statement and are true at every
 * tier by contract. `wash` (the interior fill disc), `bulb` (the placard's
 * emissive marker) and `segments` are finish.
 */
export function affinityGroupDetail(lod) {
  return lod === 'low' ? LEAN : FULL;
}

/**
 * Which FINISH layers a tier may toggle for one territory: `wash`, `bulb`,
 * `segments` — nothing else. `band`, `rim` and the placard are content (see the
 * docblock), the render site draws them unconditionally, and they are absent
 * from this result so no JSX can branch on them again (#728).
 *
 * The validation is the point. `Boolean(detail?.band)` defaulted a lost content
 * key to `false` — which turned #715's silent blank from a possible tier
 * mistake into a possible typo anywhere upstream. A `detail` that lost a
 * content key is not a world with a thin band; it is a broken table, and it
 * throws in the test run that broke it.
 *
 * @param {{ band: true, rim: true, placard: true, wash: boolean, bulb: boolean, segments: number }} detail
 */
export function affinityGroupLayers(detail) {
  const broken =
    !detail ||
    detail.band !== true ||
    detail.rim !== true ||
    detail.placard !== true ||
    typeof detail.wash !== 'boolean' ||
    typeof detail.bulb !== 'boolean' ||
    typeof detail.segments !== 'number';
  if (broken) {
    throw new Error(
      'affinityGroupLayers: a tier detail must carry band/rim/placard as `true` and wash/bulb as ' +
        'booleans — content layers are not a budget item (#715/#728; see compositeLodDetail.js)'
    );
  }
  return { wash: detail.wash, bulb: detail.bulb, segments: detail.segments };
}
