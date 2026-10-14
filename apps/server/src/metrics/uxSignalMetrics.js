import { UxSignalSchema } from '@archislop/shared';
import { isMetricsEnabled, resolveBuildStamp } from './agentTurnMetrics.js';

const METRIC_TAG = 'ux_signal';

/**
 * Usage signals ride the same switch as agent-turn metrics, plus their own kill switch:
 * `UX_SIGNALS=0` stops them without touching `agent_turn` lines (ADR-0019).
 *
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
export function isUxSignalsEnabled(env = process.env) {
  if (!isMetricsEnabled(env)) return false;
  const raw = env?.UX_SIGNALS;
  if (raw == null) return true;
  const s = String(raw).trim().toLowerCase();
  return !(s === '0' || s === 'false' || s === 'no' || s === 'off');
}

/**
 * Write one content-free `ux_signal` line to stdout (Cloud Logging). The signal is re-validated
 * against the shared schema here, so no caller — route, funnel or test — can widen what reaches
 * the log: an invalid signal is dropped, never repaired.
 *
 *   { tag: 'ux_signal', ts, sha, rev, kind, ...enum/int/boolean fields }
 *
 * @param {unknown} signal
 * @param {{ env?: NodeJS.ProcessEnv | Record<string, string | undefined>, sink?: (line: string) => void }} [opts]
 */
export function recordUxSignal(signal, opts = {}) {
  const env = opts.env ?? process.env;
  if (!isUxSignalsEnabled(env)) return null;
  const parsed = UxSignalSchema.safeParse(signal);
  if (!parsed.success) return null;

  const record = {
    tag: METRIC_TAG,
    ts: new Date().toISOString(),
    ...resolveBuildStamp(env),
    ...parsed.data
  };
  const sink = opts.sink ?? ((s) => process.stdout.write(`${s}\n`));
  try {
    sink(JSON.stringify(record));
  } catch {
    // Telemetry must never break a request path.
  }
  return record;
}
