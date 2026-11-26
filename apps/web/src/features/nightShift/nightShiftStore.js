/**
 * Whether the Night Shift window is open, and which face it shows — the
 * standup (a sequence of beats) or the board (the kanban record of it) — plus
 * the one durable fact: which shift you have already caught up on.
 *
 * An external store, like `godAltarStore.js`, so the wall art on the floor, the
 * invite pill and the window host can all reach it without threading props
 * through `OfficeLayer`.
 *
 * **Record, never trigger** (ADR-0010 consequence #4). Nothing here schedules
 * anything: the invite is offered by a render that reads `seenShiftDate`, and it
 * goes away when you answer it. There is no timer, no reminder and no re-offer
 * for a shift you have already seen or skipped.
 */

const SEEN_KEY = 'archislop:night-shift-seen';

/** @type {null | 'standup' | 'board'} */
let view = null;
/** @type {string | null} */
let seenShiftDate = readSeen();
/**
 * When the window last went from closed to open. The window reads its "last
 * night" against this, so one open session keeps one clock and the next
 * opening — tomorrow, say — reads a fresh one.
 * @type {number | null}
 */
let openedAt = null;
let snapshot = { view, seenShiftDate, openedAt };
const listeners = new Set();

function readSeen() {
  try {
    return globalThis.localStorage?.getItem(SEEN_KEY) ?? null;
  } catch {
    return null;
  }
}

/** @param {string} value */
function writeSeen(value) {
  try {
    globalThis.localStorage?.setItem(SEEN_KEY, value);
  } catch {
    /* storage refused — the marker lives for this session only */
  }
}

function notify() {
  snapshot = { view, seenShiftDate, openedAt };
  for (const fn of listeners) fn();
}

/** @returns {{ view: null | 'standup' | 'board', seenShiftDate: string | null, openedAt: number | null }} */
export function getNightShiftSnapshot() {
  return snapshot;
}

/** @param {() => void} listener */
export function subscribeNightShift(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The shift is caught up on — by joining the standup, skipping it, or reading
 * the board. Only ever moves forward.
 *
 * @param {string | null | undefined} shiftDate
 */
export function markNightShiftSeen(shiftDate) {
  if (!shiftDate || (seenShiftDate && seenShiftDate >= shiftDate)) return;
  seenShiftDate = shiftDate;
  writeSeen(shiftDate);
  notify();
}

/** @param {string | null | undefined} shiftDate */
export function openNightShiftStandup(shiftDate) {
  if (view === null) openedAt = Date.now();
  view = 'standup';
  markNightShiftSeen(shiftDate);
  notify();
}

/** @param {string | null | undefined} shiftDate */
export function openNightShiftBoard(shiftDate) {
  if (view === null) openedAt = Date.now();
  view = 'board';
  markNightShiftSeen(shiftDate);
  notify();
}

export function closeNightShift() {
  if (view === null) return;
  view = null;
  notify();
}

export function resetNightShiftForTests() {
  view = null;
  openedAt = null;
  seenShiftDate = readSeen();
  notify();
}
