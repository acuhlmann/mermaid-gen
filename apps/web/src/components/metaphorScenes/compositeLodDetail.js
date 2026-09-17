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
 * What `low` drops instead is chosen by measurement, not by area. Compositing
 * each ring over the surface it is drawn on, across all four themes and both
 * surfaces (`waterColor` for an island world, `groundColor` for a plaza), and
 * reading perceived luma against that surface:
 *
 * | layer            | Δluma avg       | share of the territory's fragments |
 * | ---------------- | --------------- | ---------------------------------- |
 * | interior wash    | 0.0044 – 0.0628 | ~52%                               |
 * | identity band    | 0.0085 – 0.1003 | ~42%                               |
 * | boundary rim     | 0.0763 – 0.4607 | ~6%                                |
 *
 * So the wash covers half the territory for the weakest signal in the set —
 * 0.0044 on noir over water, where the band is 0.0085 and the rim is **0.2989**,
 * a factor of 35. It is the one layer whose removal is close to free, and the
 * one that would have been kept by the obvious "drop the thin hairline" instinct.
 * The rim is the boundary on every dark theme; dropping it would have left the
 * ocean cases with no visible territory at all, which is where they started.
 *
 * The band, the rim and the placard are content. Nothing in this table may turn
 * them off — `metaphorGroupPlacards.test.js` sweeps every tier for exactly that.
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
