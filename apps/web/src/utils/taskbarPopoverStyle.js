/** Fixed positioning for taskbar-anchored office comms popovers. */

const DEFAULT_GAP_PX = 8;
const DEFAULT_SAFE_INSET_PX = 8;
const FALLBACK_TOP_CHROME_PX = 56;

/**
 * Bottom edge of the logo + desk-os-menubar strip. Popovers may rise to just
 * under that — not into it.
 * @returns {number}
 */
function readTopChromeBottomPx() {
  if (typeof document === 'undefined') return FALLBACK_TOP_CHROME_PX;
  const topShell = document.querySelector('.top-shell');
  const bottom = topShell?.getBoundingClientRect()?.bottom;
  return typeof bottom === 'number' && bottom > 0 ? bottom : FALLBACK_TOP_CHROME_PX;
}

/**
 * @param {{ left: number, top: number, width: number, height: number }} anchorRect
 * @param {{
 *   gapPx?: number;
 *   safeInsetPx?: number;
 *   maxWidthPx?: number;
 *   minWidthPx?: number;
 *   fillHeight?: boolean;
 * }} [options]
 * @returns {import('react').CSSProperties}
 */
export function computeTaskbarPopoverStyle(anchorRect, options = {}) {
  const gapPx = options.gapPx ?? DEFAULT_GAP_PX;
  const safeInsetPx = options.safeInsetPx ?? DEFAULT_SAFE_INSET_PX;
  const maxWidthPx = options.maxWidthPx ?? 360;
  const minWidthPx = options.minWidthPx ?? 240;
  const fillHeight = Boolean(options.fillHeight);

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxWidth = Math.min(maxWidthPx, viewportWidth - safeInsetPx * 2);
  const minWidth = Math.min(minWidthPx, maxWidth);
  const width = Math.min(maxWidth, viewportWidth - safeInsetPx * 2);

  // Grow from the button's left edge so the panel reads as coming from that
  // icon, not from the canvas centre. Slide left only when it would overflow.
  let left = anchorRect.left;
  if (left + width > viewportWidth - safeInsetPx) {
    left = viewportWidth - width - safeInsetPx;
  }
  left = Math.max(safeInsetPx, left);

  const bottom = Math.max(safeInsetPx, viewportHeight - anchorRect.top + gapPx);
  const topChromeBottom = readTopChromeBottomPx();
  const maxHeight = Math.max(160, anchorRect.top - gapPx - topChromeBottom - 4);

  return {
    position: 'fixed',
    top: 'auto',
    left,
    width,
    minWidth: Math.min(minWidth, width),
    maxWidth: width,
    bottom,
    maxHeight,
    height: fillHeight ? maxHeight : 'auto',
    boxSizing: 'border-box',
    overflowX: 'hidden',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    // Transform origin near the launching icon (left edge of the panel ≈ button).
    transformOrigin: 'bottom left'
  };
}
