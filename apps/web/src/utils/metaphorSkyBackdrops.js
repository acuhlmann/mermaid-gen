/**
 * Which sky each metaphor kind is drawn against.
 *
 * This was a chain of eleven ternaries inside `MetaphorRenderer`'s JSX, and it
 * went stale in exactly the way `DAYLIGHT_LOCKED_KINDS` did before it became a
 * table: **`terrain` was on none of the branches.** The one kind whose whole
 * subject is a landscape therefore rendered against the raw
 * `<color attach="background">` clear colour while `TerrainScene`'s own haze
 * faded toward `skyHorizonColor` — a different colour on every preset, and
 * 0.788–0.790 `nearBlack` on the three dark ones — so the mountains stood on a
 * flat void that the horizon band was visibly fading into.
 *
 * A list of kinds written as control flow cannot be asserted; written as a
 * table it is one test — every kind in `METAPHOR_BASE_KINDS` has a backdrop.
 * That is the only reason this module exists, and it is why the map is keyed by
 * kind rather than by component: the components live with their scenes, and
 * `MetaphorRenderer` binds an id to one of them.
 *
 * A value is a **backdrop id**, not a kind, because two pairs share a sky and
 * the sharing is a deliberate statement rather than an accident:
 * `layercake` takes the city's calm gradient so the cake does not float against
 * a void, and `orrery` takes the galaxy's deep space — the same star-field
 * vocabulary telling a different spatial story.
 */

/**
 * Kind → backdrop id. Frozen so a caller cannot register a sky at runtime; the
 * point of the table is that the set is knowable statically.
 */
export const SKY_BACKDROP_BY_KIND = Object.freeze({
  city: 'city',
  layercake: 'city',
  galaxy: 'space',
  orrery: 'space',
  tree: 'tree',
  river: 'river',
  garden: 'garden',
  archipelago: 'archipelago',
  machine: 'machine',
  bridge: 'bridge',
  cycle: 'cycle',
  subway: 'subway',
  iceberg: 'iceberg',
  terrain: 'terrain'
});

/** Every distinct backdrop a renderer must be able to mount. */
export const SKY_BACKDROP_IDS = Object.freeze([...new Set(Object.values(SKY_BACKDROP_BY_KIND))]);

/**
 * The backdrop for a kind.
 *
 * Takes the kind whose sky is painted — for a composite that is the dominant
 * layer's kind (`resolveCompositeAtmosphere`), never `'composite'`, which is
 * why `'composite'` is deliberately absent from the table above rather than
 * mapped to something.
 *
 * @param {string | null | undefined} kind
 * @returns {string | null} backdrop id, or null when the kind paints no sky
 */
export function resolveSkyBackdrop(kind) {
  if (!kind) return null;
  return SKY_BACKDROP_BY_KIND[kind] ?? null;
}
