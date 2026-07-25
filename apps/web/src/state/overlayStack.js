/**
 * Lightweight overlay stack for pop-ups, menus, and modals.
 *
 * Each overlay still belongs to a group (for metadata / callers), but paint
 * order is a global focus stack: open and bring-to-front assign a
 * monotonically increasing z-index above FOCUS_Z_BASE so desk menus, the
 * ArchiSlop level panel, and floating office windows can cover each other
 * like a real windowing UI — whichever surface was focused last wins.
 *
 * Overlays can also carry display metadata (title, kind, who it is from) and a
 * `manageable` flag for callers that list open surfaces.
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

/** Floor for global focus z — above legacy group band maxima (officeModal ≤ 279). */
export const FOCUS_Z_BASE = 300;

/** @type {Record<OverlayGroupId, { base: number, max: number }>} */
export const OVERLAY_GROUP = {
  /** Bottom-row popovers, desk menus, locale pickers, XP panel, radial popover. */
  anchored: { base: 30, max: 79 },
  /** Portaled advisor speech / thinking bubble. */
  advisor: { base: 80, max: 99 },
  /** Office parody floating panels (inbox, IM ping stack). */
  officeChrome: { base: 205, max: 214 },
  /** App modals: clear confirm, invite, handshake, hotkeys. */
  modal: { base: 215, max: 239 },
  /** Office parody floating windows (meeting picker, messenger, inbox). */
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
 * Stable registration order of currently-open overlays. Unlike the focus
 * z-order, this never reshuffles on focus.
 * @type {string[]}
 */
const openOrder = [];

/** @type {string | null} */
let focusedOverlayId = null;

/** Monotonic counter for global focus elevation. */
let focusSeq = 0;

/** @type {OpenOverlay[]} */
let openOverlaysSnapshot = [];

/** @type {Set<() => void>} */
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

/**
 * Assign the next global focus z to `id` and mark it focused.
 * @param {string} id
 */
function elevateFocus(id) {
  focusSeq += 1;
  zIndexById.set(id, FOCUS_Z_BASE + focusSeq);
  focusedOverlayId = id;
}

/**
 * Rebuild group membership maps; z-index for open overlays comes from focus
 * elevation (elevateFocus), not group bands.
 */
function recomputeGroups() {
  groupById.clear();
  for (const [groupId, ids] of stacks) {
    ids.forEach((id) => {
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
  elevateFocus(id);
  recomputeGroups();
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
    zIndexById.delete(id);
    recomputeGroups();
    rebuildSnapshot();
    notify();
  }
}

/**
 * Move an already-registered overlay to the global front (click-to-focus).
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
  elevateFocus(id);
  recomputeGroups();
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
  focusSeq = 0;
  openOverlaysSnapshot = [];
  notify();
}
