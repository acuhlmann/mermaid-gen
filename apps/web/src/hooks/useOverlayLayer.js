import { useEffect, useSyncExternalStore } from 'react';
import {
  OVERLAY_GROUP,
  getOverlayZIndex,
  registerOverlay,
  subscribe
} from '../state/overlayStack.js';

export { OVERLAY_GROUP };

/**
 * Assign a dynamic z-index while an overlay is open. Later opens within the
 * same group stack above earlier ones; higher groups stay above lower groups.
 *
 * @param {string} id Stable overlay id.
 * @param {boolean} open Whether the overlay is visible.
 * @param {keyof typeof OVERLAY_GROUP} [group='anchored']
 * @returns {number | undefined} z-index to apply inline, or undefined when closed.
 */
export function useOverlayLayer(id, open, group = 'anchored') {
  useEffect(() => {
    if (!open || !id) return undefined;
    return registerOverlay(id, group);
  }, [id, open, group]);

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
