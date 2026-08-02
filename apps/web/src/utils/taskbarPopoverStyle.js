/** Fixed positioning for taskbar-anchored office comms popovers on phone. */

const DEFAULT_GAP_PX = 8;
const DEFAULT_SAFE_INSET_PX = 8;

/**
 * @param {{ left: number, top: number, width: number, height: number }} anchorRect
 * @param {{
 *   gapPx?: number;
 *   safeInsetPx?: number;
 *   maxWidthPx?: number;
 *   minWidthPx?: number;
 * }} [options]
 * @returns {import('react').CSSProperties}
 */
export function computeTaskbarPopoverStyle(anchorRect, options = {}) {
  const gapPx = options.gapPx ?? DEFAULT_GAP_PX;
  const safeInsetPx = options.safeInsetPx ?? DEFAULT_SAFE_INSET_PX;
  const maxWidthPx = options.maxWidthPx ?? 360;
  const minWidthPx = options.minWidthPx ?? 240;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxWidth = Math.min(maxWidthPx, viewportWidth - safeInsetPx * 2);
  const minWidth = Math.min(minWidthPx, maxWidth);
  const width = Math.min(maxWidth, viewportWidth - safeInsetPx * 2);

  const anchorCenterX = anchorRect.left + anchorRect.width / 2;
  let left = anchorCenterX - width / 2;
  left = Math.max(safeInsetPx, Math.min(left, viewportWidth - width - safeInsetPx));

  const bottom = Math.max(safeInsetPx, viewportHeight - anchorRect.top + gapPx);
  const maxHeight = Math.max(120, anchorRect.top - gapPx - safeInsetPx - 48);

  return {
    position: 'fixed',
    top: 'auto',
    left,
    width,
    minWidth: Math.min(minWidth, width),
    maxWidth: width,
    bottom,
    maxHeight,
    height: 'auto',
    boxSizing: 'border-box',
    overflowX: 'hidden',
    overflowY: 'auto',
    overscrollBehavior: 'contain'
  };
}
