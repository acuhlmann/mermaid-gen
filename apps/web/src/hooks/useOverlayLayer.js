import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  OVERLAY_GROUP,
  bringOverlayToFront,
  getOverlayZIndex,
  registerOverlay,
  setOverlayMeta,
  subscribe
} from '../state/overlayStack.js';

export { OVERLAY_GROUP };

/**
 * Assign a dynamic z-index while an overlay is open. Open / bring-to-front
 * elevate onto a global focus stack so menus and floating windows can cover
 * each other by last focus.
 *
 * Optional `meta` (title, kind, who it is from, whether it is user-manageable)
 * is stored for open-overlay snapshots. Metadata is applied on its own effect
 * so a title refresh never re-registers the overlay and yanks it to the front.
 *
 * @param {string} id Stable overlay id.
 * @param {boolean} open Whether the overlay is visible.
 * @param {keyof typeof OVERLAY_GROUP} [group='anchored']
 * @param {import('../state/overlayStack.js').OverlayMeta} [meta]
 * @returns {number | undefined} z-index to apply inline, or undefined when closed.
 */
export function useOverlayLayer(id, open, group = 'anchored', meta) {
  const title = meta?.title;
  const kind = meta?.kind;
  const senderId = meta?.senderId;
  const manageable = meta?.manageable;

  useEffect(() => {
    if (!open || !id) return undefined;
    return registerOverlay(id, group);
  }, [id, open, group]);

  useEffect(() => {
    if (!open || !id) return;
    setOverlayMeta(id, { title, kind, senderId, manageable });
  }, [id, open, title, kind, senderId, manageable]);

  const zIndex = useSyncExternalStore(
    subscribe,
    () => (open && id ? getOverlayZIndex(id) : undefined),
    () => (open && id ? getOverlayZIndex(id) : undefined)
  );

  return zIndex;
}

/**
 * @param {number | undefined} zIndex
 * @param {import('react').CSSProperties | undefined} [style]
 * @returns {import('react').CSSProperties | undefined}
 */
export function overlayLayerStyle(zIndex, style) {
  if (zIndex == null) return style;
  return style ? { ...style, zIndex } : { zIndex };
}

/**
 * Pointer handlers that elevate an overlay on click / tap (focus-to-front).
 * Merge onto the surface root or header — not onto nested controls.
 *
 * @param {string | undefined} id Overlay id passed to `useOverlayLayer`.
 * @param {boolean} [open=true]
 * @returns {{ onPointerDown?: () => void }}
 */
export function overlayFocusHandlers(id, open = true) {
  if (!open || !id) return {};
  return { onPointerDown: () => bringOverlayToFront(id) };
}

/**
 * Hook form of {@link overlayFocusHandlers} — stable handler for event wiring.
 * @param {string | undefined} id
 * @param {boolean} open
 */
export function useOverlayFocusHandlers(id, open) {
  return useCallback(() => {
    if (open && id) bringOverlayToFront(id);
  }, [id, open]);
}
