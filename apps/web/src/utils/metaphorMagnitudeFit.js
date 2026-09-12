/**
 * Fitting a set of magnitudes from one metaphor kind's encoding into another's.
 *
 * Every kind states its topic with a different field over a different domain:
 * a city tower's `height` runs to 100, a layer cake's `thickness` stops at 10,
 * an iceberg's `depth` is signed. Copying a number straight across — which is
 * what the kind switcher used to do — either overflows the target schema (the
 * whole document is then rejected and the switch refuses with no explanation)
 * or saturates at the target's ceiling, which silently flattens four different
 * magnitudes into one and deletes the very ordering the switch exists to carry.
 *
 * The fit below is a set-wide pass, because a magnitude only means anything
 * relative to its siblings — the prompt's own legends say so ("relative service
 * importance from prompt").
 */

/**
 * The domain each kind's magnitude fields accept, as `metaphorSchema.ts`
 * declares them. `primary` is the field the switcher writes the item's main
 * magnitude into; `secondary` is the optional footprint/intensity companion.
 *
 * A kind is absent from `secondary` when it derives that field itself rather
 * than carrying one across: `orrery` inverts its own `orbit` from the primary,
 * and `iceberg` deliberately refuses to guess a `depth` (see `mapItemToKind`).
 *
 * The sweep in `switchMetaphorKind.test.js` pins this table to the schema: an
 * entry wider than the schema allows makes that pair refuse, and the sweep
 * asserts every pair switches.
 */
export const MAGNITUDE_DOMAIN = {
  city: { primary: [0.5, 100], secondary: [0.5, 20] },
  layercake: { primary: [0.2, 10] },
  galaxy: { primary: [0.5, 20] },
  tree: { primary: [0.2, 20] },
  terrain: { primary: [-10, 20], secondary: [0.1, 10] },
  orrery: { primary: [0.5, 10] },
  river: { primary: [0.2, 20] },
  garden: { primary: [0.2, 10] },
  archipelago: { primary: [0.5, 20], secondary: [0, 1] },
  machine: { primary: [0.2, 10], secondary: [0, 10] },
  bridge: { primary: [0.2, 10] },
  cycle: { primary: [0.2, 10] },
  subway: { primary: [0.2, 20] },
  iceberg: { primary: [0.2, 20] }
};

/** Enough resolution to keep neighbouring magnitudes apart, still readable in
 *  the JSON the author edits by hand. */
const PRECISION = 3;

function roundTo(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

/**
 * Fit `values` into `[lo, hi]`, preserving the reading the source document made.
 *
 * Three cases, in order:
 *
 * 1. **Already inside the domain → returned untouched.** This is the load-bearing
 *    guarantee: the fit can only ever move a document that would otherwise have
 *    been rejected or flattened, so a switch that worked before still produces
 *    the same numbers.
 * 2. **Ratio-preserving scale**, when the values are all non-negative and the
 *    target domain is wide enough to hold their dynamic range (`min/max >= lo/hi`).
 *    Every value is multiplied by one factor, so "twice as big" survives the
 *    switch exactly. This is the honest reading of a relative encoding.
 * 3. **Order-preserving affine map** otherwise — the source's range spans the
 *    target's sign boundary (a signed `elevation` going into a positive `height`),
 *    or its dynamic range is wider than the target can express. Ratios cannot
 *    survive either way; the ranking can, and does.
 *
 * @param {number[]} values
 * @param {[number, number]} domain `[lo, hi]`
 * @returns {number[]} one fitted value per input, in input order
 */
export function fitMagnitudes(values, domain) {
  if (!Array.isArray(values) || values.length === 0) return values;
  const [lo, hi] = domain;
  const finite = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
  if (finite.length === 0) return values;

  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (min >= lo && max <= hi) return values;

  const fit =
    min >= 0 && max > 0 && min * (hi / max) >= lo
      ? (value) => value * (hi / max)
      : (value) => lo + ((value - min) / (max - min || 1)) * (hi - lo);

  return values.map((value) =>
    typeof value === 'number' && Number.isFinite(value)
      ? roundTo(clamp(fit(value), lo, hi), PRECISION)
      : value
  );
}

/**
 * Fit a whole item set's primary and secondary magnitudes into `toKind`'s domains.
 *
 * @param {number[]} primaries one primary magnitude per item, in the source kind's unit
 * @param {(number|null)[]} secondaries one secondary magnitude per item, or nulls
 * @param {string} toKind
 */
export function fitMagnitudesForKind(primaries, secondaries, toKind) {
  const domain = MAGNITUDE_DOMAIN[toKind];
  if (!domain) return { primary: primaries, secondary: secondaries };
  return {
    primary: fitMagnitudes(primaries, domain.primary),
    secondary:
      domain.secondary && secondaries.every((value) => typeof value === 'number')
        ? fitMagnitudes(secondaries, domain.secondary)
        : secondaries
  };
}
