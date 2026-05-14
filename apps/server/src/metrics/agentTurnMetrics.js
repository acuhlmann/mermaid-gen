const METRIC_TAG = 'agent_turn';

function readBoolean(env, key) {
  const raw = env?.[key];
  if (raw == null) return false;
  const s = String(raw).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function safeNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(value);
}

function sanitizeShortString(value, max = 120) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * Emits a single structured JSON line per completed agent turn so before/after benchmarks
 * are comparable across phases. Disabled by default; opt in by setting MERMAID_METRICS=1.
 *
 * Shape stays stable so log shippers can index on it:
 *   { tag, ts, mode, model, profile, durationMs, accepted, validator,
 *     repairAttempts, sanitizerHits, errorClass }
 *
 * @param {{
 *   mode?: string,
 *   model?: string,
 *   profile?: string,
 *   durationMs?: number,
 *   accepted?: boolean,
 *   validator?: string | null,
 *   repairAttempts?: number,
 *   sanitizerHits?: number,
 *   errorClass?: string | null
 * }} sample
 * @param {{ env?: NodeJS.ProcessEnv, sink?: (line: string) => void }} [opts]
 */
export function recordAgentTurn(sample, opts = {}) {
  const env = opts.env ?? process.env;
  if (!readBoolean(env, 'MERMAID_METRICS')) return null;

  const record = {
    tag: METRIC_TAG,
    ts: new Date().toISOString(),
    mode: sanitizeShortString(sample.mode) ?? 'unknown',
    model: sanitizeShortString(sample.model) ?? null,
    profile: sanitizeShortString(sample.profile) ?? null,
    durationMs: safeNumber(sample.durationMs),
    accepted: typeof sample.accepted === 'boolean' ? sample.accepted : null,
    validator: sanitizeShortString(sample.validator),
    repairAttempts: safeNumber(sample.repairAttempts) ?? 0,
    sanitizerHits: safeNumber(sample.sanitizerHits) ?? 0,
    errorClass: sanitizeShortString(sample.errorClass)
  };

  const line = JSON.stringify(record);
  const sink = opts.sink ?? ((s) => process.stdout.write(`${s}\n`));
  try {
    sink(line);
  } catch {
    // Telemetry must never break a request path.
  }
  return record;
}

/**
 * Coarse-bucket the validator error so dashboards group similar failures.
 * @param {string | null | undefined} error
 */
export function classifyAgentTurnError(error) {
  if (!error) return null;
  const text = String(error).toLowerCase();
  if (text.includes('missing known diagram type')) return 'missing-diagram-type';
  if (text.includes('parser rejected')) return 'parser-rejected';
  if (text.includes('validation failed')) return 'validation-failed';
  if (text.includes('did not apply') || text.includes('no patch')) return 'no-patch';
  return 'other';
}
