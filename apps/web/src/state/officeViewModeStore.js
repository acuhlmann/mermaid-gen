/**
 * Which of the office's two renderers is on screen (ADR-0011,
 * docs/office-isometric-mode.md):
 *
 * - `'desk'`  — desktop screen mode: the canvas + chrome you work in.
 * - `'floor'` — isometric mode: the office floor you stand up into.
 *
 * Same hand-rolled useSyncExternalStore pub/sub as officeMomentStore.js. This
 * store holds *only* the mode: office state itself (moments, threads, cadence)
 * stays in its existing stores, because both renderers read the same state —
 * that is the whole point of the two-renderer rule.
 *
 * Deliberately not persisted. A reload puts you back at your desk, which is
 * both the safer default (a broken floor can never trap you) and the truthful
 * one — you did not sleep under the desk. Again.
 */

/** @typedef {'desk' | 'floor'} OfficeViewMode */

/** @type {OfficeViewMode} */
let mode = 'desk';

/** @type {Set<() => void>} */
const listeners = new Set();

function emit() {
  for (const fn of listeners) {
    try {
      fn();
    } catch (err) {
      console.warn('officeViewModeStore: listener threw:', err?.message ?? err);
    }
  }
}

/**
 * @param {() => void} listener
 * @returns {() => void} unsubscribe
 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** @returns {OfficeViewMode} */
export function getOfficeViewMode() {
  return mode;
}

/** @param {OfficeViewMode} next */
function setMode(next) {
  if (mode === next) return;
  mode = next;
  emit();
}

/** Leave your desk for the floor. */
export function standUp() {
  setMode('floor');
}

/** Sit back down at your workstation. */
export function sitDown() {
  setMode('desk');
}

export function toggleOfficeViewMode() {
  setMode(mode === 'floor' ? 'desk' : 'floor');
}

/** @internal Reset between tests. */
export function _resetOfficeViewModeForTests() {
  mode = 'desk';
  listeners.clear();
}
