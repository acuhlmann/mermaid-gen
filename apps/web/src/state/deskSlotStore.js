/**
 * Reactive handle for the bottom-row #office-desk-bottom-slot anchor. OfficeLayer
 * portals the desk comms cluster here; the slot is rendered by ArchiSlop below
 * OfficeLayer in the tree, so getElementById lookups can miss the first paint.
 */
let deskSlotEl = null;
const listeners = new Set();

export function getDeskSlotElement() {
  return deskSlotEl;
}

export function setDeskSlotElement(next) {
  if (deskSlotEl === next) return;
  deskSlotEl = next;
  for (const listener of listeners) listener();
}

export function subscribeDeskSlotElement(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearDeskSlotElement(el) {
  if (deskSlotEl === el) setDeskSlotElement(null);
}
