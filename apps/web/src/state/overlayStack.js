/**
 * Lightweight overlay stack for pop-ups, menus, and modals.
 *
 * Each overlay belongs to a group with a fixed base z-index band. Within a group,
 * later opens stack above earlier ones. Higher groups always paint above lower
 * groups (modals above anchored popovers, etc.).
 */

/** @typedef {'anchored' | 'advisor' | 'officeChrome' | 'modal' | 'officeModal'} OverlayGroupId */

/** @type {Record<OverlayGroupId, { base: number, max: number }>} */
export const OVERLAY_GROUP = {
  /** Bottom-row popovers, desk menus, locale pickers, XP panel, radial popover. */
  anchored: { base: 30, max: 79 },
  /** Portaled advisor speech / thinking bubble. */
  advisor: { base: 80, max: 99 },
  /** Office parody floating panels (inbox, IM ping stack). */
  officeChrome: { base: 205, max: 214 },
  /** App modals: clear confirm, invite, handshake, hotkeys. Above office chrome (210). */
  modal: { base: 215, max: 239 },
  /** Office parody full-screen scenes (meeting, battle, messenger). */
  officeModal: { base: 240, max: 279 }
};

/** @type {Map<OverlayGroupId, string[]>} */
const stacks = new Map(
  Object.keys(OVERLAY_GROUP).map((id) => [/** @type {OverlayGroupId} */ (id), []])
);

/** @type {Map<string, number>} */
const zIndexById = new Map();

/** @type {Set<() => void>} */
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

function recompute() {
  zIndexById.clear();
  for (const [groupId, ids] of stacks) {
    const band = OVERLAY_GROUP[groupId];
    ids.forEach((id, index) => {
      zIndexById.set(id, Math.min(band.base + index, band.max));
    });
  }
}

/**
 * @param {string} id Stable overlay id (unique per surface).
 * @param {OverlayGroupId} group
 * @returns {() => void} unregister
 */
export function registerOverlay(id, group) {
  if (!id || !OVERLAY_GROUP[group]) return () => {};

  for (const [groupId, ids] of stacks) {
    const idx = ids.indexOf(id);
    if (idx !== -1) ids.splice(idx, 1);
  }

  const list = stacks.get(group) ?? [];
  list.push(id);
  stacks.set(group, list);
  recompute();
  notify();

  return () => unregisterOverlay(id);
}

/**
 * @param {string} id
 */
export function unregisterOverlay(id) {
  let changed = false;
  for (const [groupId, ids] of stacks) {
    const idx = ids.indexOf(id);
    if (idx !== -1) {
      ids.splice(idx, 1);
      changed = true;
    }
  }
  if (changed) {
    recompute();
    notify();
  }
}

/**
 * @param {string} id
 * @returns {number | undefined}
 */
export function getOverlayZIndex(id) {
  return zIndexById.get(id);
}

/** @param {() => void} listener */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** @internal Reset between tests. */
export function resetOverlayStackForTests() {
  for (const ids of stacks.values()) ids.length = 0;
  zIndexById.clear();
  notify();
}
