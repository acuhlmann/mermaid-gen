/**
 * Content-free usage signals from the browser (ADR-0019) — what ArchiSlop God reads, aggregated,
 * to decide what to fix. Every signal is validated against the shared client union before it is
 * queued, so nothing a user types can ride along: kinds, enums, bounded counts and booleans only.
 *
 * Inert until `installUxSignals()` runs (main.jsx does, once the app mounts), so component tests
 * that never install it record nothing. Writers call `recordUxSignal` from the funnels that
 * already exist — the retry handler, the run hook, the Stop button — rather than observing the
 * app; the two global error listeners installed here are the one deliberate exception, because
 * an uncaught error has no funnel to hook.
 *
 * Delivery: batched `fetch(keepalive)` every 15 s or 20 signals, a beacon on tab hide, and one
 * `session_summary` on pagehide. Capped at 300 signals per page so a runaway loop cannot flood.
 * The "Share anonymous usage" setting turns all of it off, and an empty queue is dropped then.
 */
import {
  UX_SIGNAL_BATCH_MAX,
  UX_SIGNAL_SCHEMA_VERSION,
  UxClientSignalSchema,
  UxFailureClassSchema,
  bucketUxElapsedMs,
  bucketUxSessionMs,
  clampUxCount,
  classifyUxErrorName,
  isConcreteContentType
} from '@archislop/shared';
import { API_BASE_URL } from './diagramSession.js';
import {
  resolveUsageSignalsEnabled,
  writeUsageSignalsPreference
} from '../utils/usageSignalsStorage.js';

export const UX_SIGNALS_PATH = '/api/signals';
export const UX_SIGNAL_FLUSH_INTERVAL_MS = 15_000;
export const UX_SIGNAL_FLUSH_AT = 20;
export const UX_SIGNAL_SESSION_CAP = 300;
export const UX_CLIENT_ERROR_CAP = 20;

const listeners = new Set();

function freshState() {
  return {
    installed: false,
    enabled: /** @type {boolean | null} */ (null),
    queue: /** @type {object[]} */ ([]),
    recorded: 0,
    clientErrors: 0,
    session: { startedAt: 0, runs: 0, accepted: 0, failed: 0, lastRunFailed: false },
    summarySent: false,
    /** contentType → when an agent last produced accepted output, and whether an edit followed. */
    agentAccepted: new Map(),
    env: /** @type {null | { fetchImpl: typeof fetch, sendBeacon: ((url: string, data: Blob) => boolean) | null, now: () => number }} */ (
      null
    ),
    teardown: /** @type {null | (() => void)} */ (null)
  };
}

let state = freshState();

function emit() {
  for (const fn of listeners) {
    try {
      fn();
    } catch (err) {
      console.warn('uxSignalsClient: listener threw:', err?.message ?? err);
    }
  }
}

/** Whether signals are being collected (the Settings toggle reads this). */
export function isUsageSignalsEnabled() {
  if (state.enabled === null) state.enabled = resolveUsageSignalsEnabled();
  return state.enabled;
}

/** useSyncExternalStore subscribe for the toggle. */
export function subscribeUsageSignals(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Persist the user's choice; turning signals off also drops anything not yet sent. */
export function setUsageSignalsEnabled(next) {
  const enabled = Boolean(next);
  writeUsageSignalsPreference(enabled);
  if (enabled === isUsageSignalsEnabled()) return;
  state.enabled = enabled;
  if (!enabled) state.queue = [];
  emit();
}

function signalsUrl() {
  return `${API_BASE_URL}${UX_SIGNALS_PATH}`;
}

function send(signals, { beacon }) {
  const body = JSON.stringify({ v: UX_SIGNAL_SCHEMA_VERSION, signals });
  const env = state.env;
  if (!env) return;
  if (beacon && env.sendBeacon) {
    try {
      // text/plain is CORS-safelisted, so the browser sends it on unload without a preflight.
      if (env.sendBeacon(signalsUrl(), new Blob([body], { type: 'text/plain' }))) return;
    } catch {
      // Fall through to fetch.
    }
  }
  try {
    env
      .fetchImpl(signalsUrl(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
        credentials: 'same-origin'
      })
      .catch(() => {});
  } catch {
    // Telemetry never breaks the app.
  }
}

/** Send everything queued. On tab hide/unload pass `{ beacon: true }`. */
export function flushUxSignals({ beacon = false } = {}) {
  while (state.queue.length > 0) {
    send(state.queue.splice(0, UX_SIGNAL_BATCH_MAX), { beacon });
  }
}

/**
 * Queue one client signal. Returns true when it was accepted: installed, enabled, under the cap
 * and valid against the shared schema. Never throws.
 *
 * @param {unknown} signal
 */
export function recordUxSignal(signal) {
  if (!state.installed || !isUsageSignalsEnabled()) return false;
  if (state.recorded >= UX_SIGNAL_SESSION_CAP) return false;
  const parsed = UxClientSignalSchema.safeParse(signal);
  if (!parsed.success) return false;
  state.queue.push(parsed.data);
  state.recorded += 1;
  if (state.queue.length >= UX_SIGNAL_FLUSH_AT) flushUxSignals();
  return true;
}

function now() {
  return state.env?.now() ?? Date.now();
}

/**
 * How an agent run ended — the run hook's one call. Feeds the session summary, records
 * `run_failed` / `run_cancelled`, and marks accepted output so a manual edit right after it can
 * be told apart from ordinary editing.
 *
 * @param {{ contentType: string, profile: string, status: 'done' | 'failed' | 'cancelled', failureClass?: string | null, startedAt: number }} outcome
 */
export function noteRunOutcome({ contentType, profile, status, failureClass, startedAt }) {
  if (!state.installed) return;
  const s = state.session;
  s.runs += 1;
  if (status === 'done') {
    s.accepted += 1;
    s.lastRunFailed = false;
    if (isConcreteContentType(contentType)) {
      state.agentAccepted.set(contentType, { at: now(), consumed: false });
    }
    return;
  }
  if (!isConcreteContentType(contentType)) return;
  if (status === 'failed') {
    s.failed += 1;
    s.lastRunFailed = true;
    const known = UxFailureClassSchema.safeParse(failureClass);
    recordUxSignal({
      kind: 'run_failed',
      contentType,
      failureClass: known.success ? known.data : 'generic',
      profile: profile === 'quality' ? 'quality' : 'fast'
    });
  } else if (status === 'cancelled') {
    recordUxSignal({
      kind: 'run_cancelled',
      contentType,
      after: bucketUxElapsedMs(now() - startedAt)
    });
  }
}

/**
 * One run's outcome recorder for the run hook: `note` keeps the latest ending ('done' | 'failed' |
 * 'cancelled'), `finish` reports it once the run has settled. A run that never noted an ending
 * reports nothing.
 *
 * @param {{ contentType: string, profile: string }} run
 */
export function trackRunOutcome({ contentType, profile }) {
  const startedAt = now();
  /** @type {null | { status: 'done' | 'failed' | 'cancelled', failureClass: string | null }} */
  let outcome = null;
  return {
    note(status, failureClass = null) {
      outcome = { status, failureClass };
    },
    finish() {
      if (outcome) noteRunOutcome({ ...outcome, contentType, profile, startedAt });
    }
  };
}

/**
 * A manual edit in the code editor. Recorded once per accepted agent output, with how soon after
 * that output it came — the "the agent got it nearly right" signal.
 *
 * @param {string} contentType
 */
export function noteManualEdit(contentType) {
  const accepted = state.agentAccepted.get(contentType);
  if (!accepted || accepted.consumed) return;
  accepted.consumed = true;
  recordUxSignal({
    kind: 'manual_edit_after_agent',
    contentType,
    within: bucketUxElapsedMs(now() - accepted.at)
  });
}

/**
 * An uncaught error, as a constructor name only — never its message or stack, which can carry
 * user content. Capped separately so one broken render loop cannot use up the session's budget.
 *
 * @param {'boundary' | 'window' | 'unhandledrejection'} source
 * @param {unknown} error
 */
export function recordClientError(source, error) {
  if (state.clientErrors >= UX_CLIENT_ERROR_CAP) return;
  if (recordUxSignal({ kind: 'client_error', source, errorName: classifyUxErrorName(error) })) {
    state.clientErrors += 1;
  }
}

function sessionSummary() {
  const s = state.session;
  return {
    kind: 'session_summary',
    duration: bucketUxSessionMs(now() - s.startedAt),
    runs: clampUxCount(s.runs),
    accepted: clampUxCount(s.accepted),
    failed: clampUxCount(s.failed),
    lastRunFailed: s.lastRunFailed
  };
}

function defaultBeacon(nav) {
  return typeof nav?.sendBeacon === 'function' ? nav.sendBeacon.bind(nav) : null;
}

/** Transport seams: real fetch/beacon/clock unless a test passes its own. */
function resolveEnv(win, options) {
  return {
    fetchImpl: options.fetchImpl ?? win.fetch.bind(win),
    sendBeacon:
      options.sendBeacon !== undefined ? options.sendBeacon : defaultBeacon(win.navigator),
    now: options.now ?? (() => Date.now())
  };
}

/**
 * Start collecting. Idempotent; returns an uninstall function (used by tests).
 *
 * @param {{ fetchImpl?: typeof fetch, sendBeacon?: ((url: string, data: Blob) => boolean) | null, win?: Window, now?: () => number, intervalMs?: number }} [options]
 */
export function installUxSignals(options = {}) {
  if (state.installed) return state.teardown ?? (() => {});
  const win = options.win ?? (typeof window === 'undefined' ? null : window);
  if (!win) return () => {};
  state.env = resolveEnv(win, options);
  state.installed = true;
  state.session.startedAt = now();

  const onError = (event) => {
    // Same-origin only: extension and cross-origin script errors arrive without a usable filename.
    const filename = typeof event?.filename === 'string' ? event.filename : '';
    if (!filename.startsWith(win.location.origin)) return;
    recordClientError('window', event.error);
  };
  const onRejection = (event) => {
    const reason = event?.reason;
    if (reason && typeof reason === 'object' && reason.name === 'AbortError') return;
    recordClientError('unhandledrejection', reason);
  };
  const onVisibility = () => {
    if (win.document.visibilityState === 'hidden') flushUxSignals({ beacon: true });
  };
  const onPageHide = () => {
    if (!state.summarySent) {
      state.summarySent = true;
      recordUxSignal(sessionSummary());
    }
    flushUxSignals({ beacon: true });
  };
  const timer = win.setInterval(
    () => flushUxSignals(),
    options.intervalMs ?? UX_SIGNAL_FLUSH_INTERVAL_MS
  );

  win.addEventListener('error', onError);
  win.addEventListener('unhandledrejection', onRejection);
  win.addEventListener('pagehide', onPageHide);
  win.document.addEventListener('visibilitychange', onVisibility);

  state.teardown = () => {
    win.clearInterval(timer);
    win.removeEventListener('error', onError);
    win.removeEventListener('unhandledrejection', onRejection);
    win.removeEventListener('pagehide', onPageHide);
    win.document.removeEventListener('visibilitychange', onVisibility);
    state.installed = false;
  };
  return state.teardown;
}

/** Test seam: uninstall and forget everything (storage is cleared by the test). */
export function _resetUxSignalsForTests() {
  state.teardown?.();
  state = freshState();
  listeners.clear();
}
