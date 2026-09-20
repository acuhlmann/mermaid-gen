import type { MetaphorBaseKind } from './metaphorSchema.js';

/**
 * One numeric item field, with the range the sanitizer rescues it into.
 *
 * `min`/`max` are the SCHEMA's own bounds, not a taste judgement —
 * `metaphorSanitizer.test.ts` sweeps every row against `metaphorSchema.ts` and
 * fails when a bound drifts, when the schema grows a numeric field this table
 * does not carry, or when this table carries a field the schema does not have.
 * (The sweep would rather live in a `metaphorNumericFields.test.ts` of its own;
 * a new `packages/shared/test/metaphor*.test.ts` cannot be added without a row
 * in `METAPHOR_BLAST_TESTS`, which is outside this automation's budget — see
 * the ledger's `metaphor-suite-blast-list`.) That sweep is the point of the
 * table: the ladder
 * it replaced was 238 lines of inline `if (kind === …)` blocks, and the four
 * fields missing from it (`city.height`, `city.footprint`, `galaxy.magnitude`,
 * `layercake.thickness`) could not be named by any test.
 */
export interface MetaphorNumericField {
  readonly field: string;
  /**
   * Rescue floor. On a `positive` field the schema only requires `> 0`, so
   * this is the smallest value worth rendering rather than a schema bound.
   */
  readonly min: number;
  readonly max: number;
  /** The schema is `.positive()`: 0 is refused, so `min` is a floor we choose. */
  readonly positive?: boolean;
}

/**
 * Every numeric field on every base kind's item schema. Composite layers route
 * through the same table via their `as` kind, so a layer's items are rescued
 * exactly as a base document's are.
 */
export const METAPHOR_NUMERIC_FIELDS: Record<MetaphorBaseKind, readonly MetaphorNumericField[]> = {
  city: [
    { field: 'height', min: 0.1, max: 100, positive: true },
    { field: 'footprint', min: 0.1, max: 20, positive: true }
  ],
  layercake: [
    { field: 'thickness', min: 0.1, max: 10, positive: true },
    { field: 'cracks', min: 0, max: 1 },
    { field: 'tilt', min: 0, max: 15 }
  ],
  galaxy: [{ field: 'magnitude', min: 0.1, max: 20, positive: true }],
  tree: [{ field: 'weight', min: 0.1, max: 20, positive: true }],
  terrain: [
    { field: 'elevation', min: -10, max: 20 },
    { field: 'intensity', min: 0.1, max: 10, positive: true }
  ],
  orrery: [
    { field: 'orbit', min: 0, max: 12 },
    { field: 'size', min: 0.1, max: 10, positive: true }
  ],
  river: [
    { field: 'stage', min: 0, max: 100 },
    { field: 'flow', min: 0.1, max: 20, positive: true },
    { field: 'hazard', min: 0, max: 1 }
  ],
  garden: [
    { field: 'maturity', min: 0, max: 1 },
    { field: 'impact', min: 0.1, max: 10, positive: true }
  ],
  archipelago: [
    { field: 'mass', min: 0.5, max: 20, positive: true },
    { field: 'relief', min: 0, max: 1 }
  ],
  machine: [
    { field: 'size', min: 0.1, max: 10, positive: true },
    { field: 'speed', min: 0, max: 10 },
    { field: 'torque', min: 0, max: 1 }
  ],
  bridge: [
    { field: 'span', min: 0, max: 100 },
    { field: 'load', min: 0.1, max: 10, positive: true },
    { field: 'strain', min: 0, max: 1 }
  ],
  cycle: [
    { field: 'phase', min: 0, max: 100 },
    { field: 'size', min: 0.1, max: 10, positive: true },
    { field: 'friction', min: 0, max: 1 }
  ],
  subway: [
    { field: 'stop', min: 0, max: 100 },
    { field: 'traffic', min: 0.1, max: 20, positive: true }
  ],
  iceberg: [
    { field: 'depth', min: -1, max: 1 },
    { field: 'mass', min: 0.1, max: 20, positive: true },
    { field: 'peril', min: 0, max: 1 }
  ]
};

/**
 * One number, optionally wrapped in the decoration a model reaches for when it
 * forgets the field is numeric: `"8"`, `" 8.5 "`, `"-0.6"`, `"$1,200"`,
 * `"80%"`, `"12 kg"`, `"~3"`.
 *
 * Deliberately NOT a "find the first number" parser. A string carrying a
 * second number — `"1-2"`, `"3 of 5"`, `"50/100"` — is a range or a ratio, and
 * silently taking one end of it is fabrication; those stay strings so the Zod
 * error names the field and the fixer ladder sees what the model actually
 * wrote.
 *
 * **Every `\s*` here is anchored by a character that must follow it**, which is
 * not a style choice. Written the obvious way — `[~≈]?\s*[$€£¥]?\s*` — the two
 * runs are separated by an OPTIONAL character, so a string of spaces can be
 * split between them in as many ways as it is long and the engine tries all of
 * them before failing: measured on `"~" + " ".repeat(n) + "!"`, 8.7 ms at
 * n=2,000 rising cleanly with the square to 553 ms at n=16,000 (CodeQL
 * flagged it as polynomial ReDoS on this file's first push, and the input is
 * model-authored JSON). Putting each `\s*` inside a group whose other member
 * is mandatory removes the ambiguity: the same inputs run in 0.1 ms flat.
 * CodeQL is the sensor for this — a timing assertion in the suite would be a
 * flake under load.
 */
const NUMERIC_TEXT =
  /^(?:[~≈]\s*)?(?:[$€£¥]\s*)?([+-]?(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?)(?:\s*(%|[a-zA-Z]{1,4}))?$/;

export interface ParsedNumericText {
  readonly value: number;
  /** The string carried a trailing `%`. */
  readonly percent: boolean;
}

/** Parse a model's numeric string, or `null` when it is not one number. */
export function parseNumericText(raw: unknown): ParsedNumericText | null {
  if (typeof raw !== 'string') return null;
  const match = NUMERIC_TEXT.exec(raw.trim());
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(value)) return null;
  return { value, percent: match[2] === '%' };
}

/**
 * Resolve a raw item field value to a number inside `[min, max]`.
 *
 * Returns `null` when the value is not rescuable (a non-numeric string, an
 * object, `null`) — the caller leaves it alone so the schema reports it.
 *
 * `"80%"` means 0.8 on a field whose ceiling is 1 and 80 on one whose ceiling
 * is not: the 0–1 fields (`maturity`, `cracks`, `hazard`, `relief`, `torque`,
 * `strain`, `peril`, `friction`, `depth`) are exactly the normalized ones, so
 * the ceiling IS the test for whether a percent sign is meaningful.
 */
export function rescueNumericValue(
  raw: unknown,
  bound: MetaphorNumericField
): { value: number; coerced: boolean } | null {
  let value: number;
  let coerced = false;

  if (typeof raw === 'number') {
    if (Number.isNaN(raw)) return null;
    value = raw;
  } else {
    const parsed = parseNumericText(raw);
    if (!parsed) return null;
    coerced = true;
    value = parsed.percent && bound.max <= 1 ? parsed.value / 100 : parsed.value;
  }

  const clamped = Math.max(bound.min, Math.min(bound.max, value));
  // `Math.min`/`Math.max` already fold ±Infinity onto the bound.
  return { value: clamped, coerced };
}
