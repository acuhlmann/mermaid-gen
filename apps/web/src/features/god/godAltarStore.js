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

function normalizeDivineEvent(rawKind) {
  if (rawKind === 'pr_filed') {
    return { kind: 'bless', moment: 'pr_filed', major: true };
  }
  if (rawKind === 'bless' || rawKind === 'blessed') {
    return { kind: 'bless', moment: 'blessed', major: true };
  }
  if (rawKind === 'smite' || rawKind === 'smote') {
    return { kind: 'smite', moment: 'smote', major: true };
  }
  return { kind: 'pray', moment: 'pray', major: false };
}

/**
 * Emit a transient divine reaction event when the user actively prays or petitions a PR.
 * @param {'pray' | 'bless' | 'blessed' | 'smite' | 'smote' | 'pr_filed'} kind
 * @param {string} [mood]
 */
export function emitGodAltarEvent(kind, mood = 'amused') {
  eventSeq += 1;
  const normalized = normalizeDivineEvent(kind);
  altarEvent = {
    seq: eventSeq,
    kind: normalized.kind,
    moment: normalized.moment,
    major: normalized.major,
    mood,
    at: Date.now()
  };
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
