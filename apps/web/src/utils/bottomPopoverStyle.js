/** Viewport-safe fixed positioning for bottom-row popovers anchored to a trigger. */

const DEFAULT_GAP_PX = 7;
const DEFAULT_SAFE_INSET_PX = 8;
const DEFAULT_MAX_WIDTH_PX = 280;
const DEFAULT_MIN_WIDTH_PX = 200;

/**
 * @param {DOMRect} anchorRect
 * @param {{
 *   gapPx?: number;
 *   safeInsetPx?: number;
 *   maxWidthPx?: number;
 *   minWidthPx?: number;
 * }} [options]
 * @returns {import('react').CSSProperties}
 */
export function computeBottomLeftPopoverStyle(anchorRect, options = {}) {
  const gapPx = options.gapPx ?? DEFAULT_GAP_PX;
  const safeInsetPx = options.safeInsetPx ?? DEFAULT_SAFE_INSET_PX;
  const maxWidthPx = options.maxWidthPx ?? DEFAULT_MAX_WIDTH_PX;
  const minWidthPx = options.minWidthPx ?? DEFAULT_MIN_WIDTH_PX;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxWidth = Math.min(maxWidthPx, viewportWidth - safeInsetPx * 2);
  const minWidth = Math.min(minWidthPx, maxWidth);
  let left = anchorRect.left;
  left = Math.max(safeInsetPx, Math.min(left, viewportWidth - minWidth - safeInsetPx));
  const width = Math.min(maxWidth, viewportWidth - left - safeInsetPx);
  const bottom = Math.max(safeInsetPx, viewportHeight - anchorRect.top + gapPx);
  const maxHeight = Math.max(120, anchorRect.top - gapPx - safeInsetPx);

  return {
    position: 'fixed',
    top: 'auto',
    left,
    width,
    minWidth: Math.min(minWidth, width),
    maxWidth: width,
    bottom,
    maxHeight,
    boxSizing: 'border-box',
    overflowX: 'hidden',
    overflowY: 'auto',
    overscrollBehavior: 'contain'
  };
}
