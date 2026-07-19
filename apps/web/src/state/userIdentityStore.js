/**
 * The user's display name — the handle the office cast uses whenever it
 * addresses "you" (Linda's welcome email, Chad's IM, the orientation greeting,
 * the `{userName}` slot in every canned line). Same hand-rolled
 * useSyncExternalStore pub/sub as officeMomentStore.js, so the name badge on
 * the Day One card and the orientation tour re-render the instant the new hire
 * renames themselves — no prop drilling, no context.
 *
 * Stored raw and possibly empty (officeAmbienceStorage); `resolveUserName`
 * supplies the funny default so a nameless new hire is never actually nameless.
 */

import { readUserName, writeUserName } from '../utils/officeAmbienceStorage.js';

/**
 * The handle the office uses before the new hire fills in their name badge.
 * Deliberately the sort of thing an onboarding buddy would call you on day one
 * when they've forgotten your name — see docs/office-parody.md.
 */
export const DEFAULT_USER_NAME = 'Newbie';

/** Lazy cache of the stored name so getSnapshot returns a stable reference. */
let name = null;
const listeners = new Set();

function current() {
  if (name === null) name = readUserName();
  return name;
}

function emit() {
  for (const fn of listeners) {
    try {
      fn();
    } catch (err) {
      console.warn('userIdentityStore: listener threw:', err?.message ?? err);
    }
  }
}

/**
 * useSyncExternalStore subscribe — fires whenever the name changes. Returns the
 * unsubscribe cleanup.
 *
 * @param {() => void} listener
 * @returns {() => void}
 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The raw stored name (may be ''). Stable across renders until `setUserName`
 * changes it — safe as a useSyncExternalStore snapshot.
 *
 * @returns {string}
 */
export function getStoredUserName() {
  return current();
}

/**
 * The name to actually address the user by: their chosen name, or the funny
 * default when the badge is still blank. This is what feeds `{userName}` slots.
 *
 * @returns {string}
 */
export function resolveUserName() {
  return current().trim() || DEFAULT_USER_NAME;
}

/**
 * Persist a new display name and notify subscribers. Normalization (trim + cap)
 * lives in writeUserName, so we read the canonical value back and only emit on
 * a real change.
 *
 * @param {string} next
 */
export function setUserName(next) {
  const previous = current();
  writeUserName(next);
  const stored = readUserName();
  if (stored === previous) return;
  name = stored;
  emit();
}

/** Test seam — drop the in-memory cache + listeners (storage cleared by test). */
export function _resetUserIdentityForTests() {
  name = null;
  listeners.clear();
}
