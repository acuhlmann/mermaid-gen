/**
 * The owner's God window data (ADR-0019 §10), as an external store.
 *
 * A store rather than hook-local `useState` for the same reason `state/uxSignalsClient.js` is one: the
 * pane subscribes through `useSyncExternalStore`, so the mount effect drives this module and React
 * re-renders from the subscription — never from a `setState` called inside an effect body. That shape is
 * also what carries the real fix: the in-flight request is owned here, so a refresh that lands while an
 * older read is still pending cannot overwrite the newer answer.
 *
 * Both requests are `no-store` and same-origin. The endpoint answers with money and autonomy, and a
 * cached read of either would be a lie about the present.
 */
import { API_BASE_URL } from '../../state/diagramSession.js';

export const GOD_STATUS_PATH = '/api/god/status';
export const GOD_UNLOCK_PATH = '/api/god/unlock';

export const GOD_ACCESS = {
  LOADING: 'loading',
  OK: 'ok',
  UNAUTHORIZED: 'unauthorized',
  UNCONFIGURED: 'unconfigured',
  /** The window is configured and the owner is in — but the branch itself could not be read. */
  UNREADABLE: 'unreadable',
  UNREACHABLE: 'unreachable'
};

function freshState() {
  return { access: GOD_ACCESS.LOADING, view: null };
}

const state = freshState();
/** Cached so `useSyncExternalStore` sees a stable identity between loads. */
let snapshot = { ...state };
const listeners = new Set();

function commit(patch) {
  Object.assign(state, patch);
  snapshot = { ...state };
  for (const fn of listeners) fn();
}

export function subscribeGodWindow(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getGodWindowSnapshot() {
  return snapshot;
}

function statusUrl() {
  return `${API_BASE_URL}${GOD_STATUS_PATH}`;
}

/** @returns the JSON body, or null when there is no readable one. */
async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

let inFlight = null;

/**
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<string>} the resulting `GOD_ACCESS` value
 */
export async function loadGodStatus({ fetchImpl = fetch } = {}) {
  inFlight?.abort();
  const controller = new AbortController();
  inFlight = controller;
  commit({ access: GOD_ACCESS.LOADING });

  let res;
  try {
    res = await fetchImpl(statusUrl(), {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal
    });
  } catch {
    // A superseded or torn-down request is not an outage. Only a live one reports the server as gone.
    if (controller.signal.aborted) return snapshot.access;
    return settle(GOD_ACCESS.UNREACHABLE, null);
  }
  if (controller.signal.aborted || inFlight !== controller) return snapshot.access;

  return classify(res);
}

/**
 * The status code is the contract, not the message text — with one exception, the 503 below.
 */
async function classify(res) {
  if (res.status === 401) return settle(GOD_ACCESS.UNAUTHORIZED, null);
  if (res.status === 503) {
    // Two different 503s share this code. The gate's carries `{ error }` and means "no owner token is
    // configured"; the status router's carries a view with `source: 'none'` and means the branch could
    // not be read while the window itself is fine. Sending the owner to rotate a credential when the
    // real problem is a GitHub read — or the reverse — is the whole cost of collapsing them.
    const body = await readJson(res);
    if (body && body.source === 'none') return settle(GOD_ACCESS.UNREADABLE, body);
    return settle(GOD_ACCESS.UNCONFIGURED, null);
  }
  const view = await readJson(res);
  if (!res.ok || !view) return settle(GOD_ACCESS.UNREACHABLE, null);
  return settle(GOD_ACCESS.OK, view);
}

function settle(access, view) {
  commit({ access, view });
  return access;
}

/**
 * Exchange the owner token for the scoped cookie. The cookie is HttpOnly and path-scoped to `/api/god`,
 * so the token is never held in component state after this returns and the pane cannot leak it onward.
 *
 * @param {string} token
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{ ok: boolean, message: string|null }>}
 */
export async function unlockGodWindow(token, { fetchImpl = fetch } = {}) {
  let res;
  try {
    res = await fetchImpl(`${API_BASE_URL}${GOD_UNLOCK_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({ token })
    });
  } catch {
    return { ok: false, message: null };
  }
  if (res.ok) return { ok: true, message: null };
  const body = await readJson(res);
  return { ok: false, message: body?.error ?? null };
}

/** Drop the last read and its subscribers' view of it — used by tests and by any future sign-out. */
export function resetGodWindow() {
  inFlight?.abort();
  inFlight = null;
  Object.assign(state, freshState());
  snapshot = { ...state };
  for (const fn of listeners) fn();
}
