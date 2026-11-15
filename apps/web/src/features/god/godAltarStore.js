/**
 * External store controlling the in-app ArchiSlop God Altar modal.
 *
 * Kept outside `ArchiSlop.jsx` (like `officeViewModeStore.js`) so Studio, Desk OS menus,
 * and Office entry surfaces can summon the Altar without growing the shell monolith.
 */

let altarOpen = false;
const listeners = new Set();

function notify() {
  for (const fn of listeners) fn();
}

export function getGodAltarOpen() {
  return altarOpen;
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

export function resetGodAltarForTests() {
  altarOpen = false;
  notify();
}
