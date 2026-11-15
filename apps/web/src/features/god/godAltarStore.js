/**
 * External store controlling the in-app ArchiSlop God Altar modal and transient
 * divine events (prayer / blessing / smite / PR decree) observed by the office floor.
 *
 * Kept outside `ArchiSlop.jsx` (like `officeViewModeStore.js`) so Studio, Desk OS menus,
 * and Office floor surfaces can summon the Altar and react to active user prayers without
 * growing the shell monolith or emitting `uxSignals`.
 */

let altarOpen = false;
let eventSeq = 0;
let altarEvent = null;
const listeners = new Set();

function notify() {
  for (const fn of listeners) fn();
}

export function getGodAltarOpen() {
  return altarOpen;
}

export function getGodAltarEvent() {
  return altarEvent;
}

export function subscribeGodAltar(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openGodAltar() {
  if (altarOpen) return;
  altarOpen = true;
  notify();
}

export function closeGodAltar() {
  if (!altarOpen) return;
  altarOpen = false;
  notify();
}

/**
 * Emit a transient divine reaction event when the user actively prays or petitions a PR.
 * @param {'pray' | 'bless' | 'smite'} kind
 * @param {string} [mood]
 */
export function emitGodAltarEvent(kind, mood = 'amused') {
  eventSeq += 1;
  altarEvent = { seq: eventSeq, kind, mood, at: Date.now() };
  notify();
  return altarEvent;
}

export function clearGodAltarEvent() {
  if (!altarEvent) return;
  altarEvent = null;
  notify();
}

export function resetGodAltarForTests() {
  altarOpen = false;
  altarEvent = null;
  eventSeq = 0;
  notify();
}
