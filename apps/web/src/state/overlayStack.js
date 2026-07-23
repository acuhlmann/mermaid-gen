/**
 * Lightweight overlay stack for pop-ups, menus, and modals.
 *
 * Each overlay belongs to a group with a fixed base z-index band. Within a group,
 * later opens stack above earlier ones. Higher groups always paint above lower
 * groups (modals above anchored popovers, etc.).
 *
 * Overlays can also carry display metadata (title, kind, who it is from) and a
 * `manageable` flag. Anything manageable shows up in `getOpenOverlays()` — the
 * feed behind the office window bar (a taskbar for the floating office
 * surfaces), so nothing a colleague opens can get buried or lost off-screen.
 */

/** @typedef {'anchored' | 'advisor' | 'officeChrome' | 'modal' | 'officeModal'} OverlayGroupId */

/**
 * @typedef {{
 *   title?: string,
 *   kind?: string,
 *   senderId?: string | null,
 *   manageable?: boolean
 * }} OverlayMeta
 */

/**
 * @typedef {{
 *   id: string,
 *   group: OverlayGroupId,
 *   zIndex: number,
 *   focused: boolean,
 *   manageable: boolean,
 *   title: string,
 *   kind: string,
 *   senderId: string | null
 * }} OpenOverlay
 */

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

/** @type {Map<string, OverlayGroupId>} */
const groupById = new Map();

/** @type {Map<string, OverlayMeta>} */
const metaById = new Map();

/**
 * Stable registration order of currently-open overlays. Unlike the per-group
 * z-stacks, this never reshuffles on focus, so the window bar chips stay put
 * instead of jumping around every time the user clicks one.
 * @type {string[]}
 */
const openOrder = [];

/** @type {string | null} */
let focusedOverlayId = null;

/** @type {OpenOverlay[]} */
let openOverlaysSnapshot = [];

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
      groupById.set(id, groupId);
    });
  }
}

/**
 * Rebuild the cached open-overlays snapshot. Kept as a stable reference between
 * changes so `useSyncExternalStore` consumers don't tear.
 */
function rebuildSnapshot() {
  openOverlaysSnapshot = openOrder.map((id) => {
    const meta = metaById.get(id) ?? {};
    return {
      id,
      group: groupById.get(id) ?? 'officeChrome',
      zIndex: zIndexById.get(id) ?? 0,
      focused: focusedOverlayId === id,
      // Opt-in: only surfaces that explicitly declare `manageable: true`
      // (the office FloatingWindows) show up in the window bar. Raw overlays
      // registered without meta — settings, radial menu, app modals — stay out.
      manageable: meta.manageable === true,
      title: typeof meta.title === 'string' ? meta.title : '',
      kind: typeof meta.kind === 'string' ? meta.kind : '',
      senderId: typeof meta.senderId === 'string' ? meta.senderId : null
    };
  });
}

/**
 * @param {string} id Stable overlay id (unique per surface).
 * @param {OverlayGroupId} group
 * @param {OverlayMeta} [meta]
 * @returns {() => void} unregister
 */
export function registerOverlay(id, group, meta) {
  if (!id || !OVERLAY_GROUP[group]) return () => {};

  for (const [, ids] of stacks) {
    const idx = ids.indexOf(id);
    if (idx !== -1) ids.splice(idx, 1);
  }

  const list = stacks.get(group) ?? [];
  list.push(id);
  stacks.set(group, list);
  if (!openOrder.includes(id)) openOrder.push(id);
  if (meta) metaById.set(id, { ...(metaById.get(id) ?? {}), ...meta });
  recompute();
  rebuildSnapshot();
  notify();

  return () => unregisterOverlay(id);
}

/**
 * Update the display metadata for an already-open overlay without touching its
 * z-order (so refreshing a title never yanks a window to the front).
 * @param {string} id
 * @param {OverlayMeta} meta
 */
export function setOverlayMeta(id, meta) {
  if (!id || !groupById.has(id) || !meta) return;
  const prev = metaById.get(id) ?? {};
  const next = { ...prev, ...meta };
  const unchanged =
    prev.title === next.title &&
    prev.kind === next.kind &&
    prev.senderId === next.senderId &&
    prev.manageable === next.manageable;
  if (unchanged) return;
  metaById.set(id, next);
  rebuildSnapshot();
  notify();
}

/**
 * @param {string} id
 */
export function unregisterOverlay(id) {
  let changed = false;
  for (const [, ids] of stacks) {
    const idx = ids.indexOf(id);
    if (idx !== -1) {
      ids.splice(idx, 1);
      changed = true;
    }
  }
  const orderIdx = openOrder.indexOf(id);
  if (orderIdx !== -1) openOrder.splice(orderIdx, 1);
  if (changed) {
    if (focusedOverlayId === id) focusedOverlayId = null;
    groupById.delete(id);
    metaById.delete(id);
    recompute();
    rebuildSnapshot();
    notify();
  }
}

/**
 * Move an already-registered overlay to the top of its group (click-to-focus).
 * @param {string} id
 */
export function bringOverlayToFront(id) {
  const group = groupById.get(id);
  if (!group) return;
  const list = stacks.get(group) ?? [];
  const idx = list.indexOf(id);
  if (idx === -1) return;
  list.splice(idx, 1);
  list.push(id);
  stacks.set(group, list);
  focusedOverlayId = id;
  recompute();
  rebuildSnapshot();
  notify();
}

/**
 * @param {string} id
 */
export function focusOverlay(id) {
  bringOverlayToFront(id);
}

/** @returns {string | null} */
export function getFocusedOverlayId() {
  return focusedOverlayId;
}

/**
 * @param {string} id
 * @returns {number | undefined}
 */
export function getOverlayZIndex(id) {
  return zIndexById.get(id);
}

/**
 * Ordered snapshot of every open overlay (stable registration order). The
 * reference only changes when the stack changes, so it is safe to pass straight
 * to `useSyncExternalStore`.
 * @returns {OpenOverlay[]}
 */
export function getOpenOverlays() {
  return openOverlaysSnapshot;
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
  groupById.clear();
  metaById.clear();
  openOrder.length = 0;
  focusedOverlayId = null;
  openOverlaysSnapshot = [];
  notify();
}
