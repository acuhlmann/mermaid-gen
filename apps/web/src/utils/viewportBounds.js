/** @typedef {{ left: number, top: number, right: number, bottom: number }} ViewportBounds */

const VIEWPORT_MARGIN_PX = 8;

/**
 * Read the visible viewport in layout coordinates (accounts for visualViewport on mobile).
 * @returns {ViewportBounds}
 */
export function readViewportBounds() {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  if (vv) {
    return {
      left: vv.offsetLeft,
      top: vv.offsetTop,
      right: vv.offsetLeft + vv.width,
      bottom: vv.offsetTop + vv.height
    };
  }
  if (typeof window !== 'undefined') {
    return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  }
  return { left: 0, top: 0, right: 0, bottom: 0 };
}

/**
 * @param {number} left
 * @param {number} top
 * @param {{ width: number, height: number }} size
 * @param {ViewportBounds} [viewport]
 * @param {{ bottomReservePx?: number, minVisiblePx?: number }} [options]
 */
export function clampWindowPosition(left, top, size, viewport, options = {}) {
  const vv = viewport ?? readViewportBounds();
  const bottomReservePx = options.bottomReservePx ?? 0;
  const minVisiblePx = options.minVisiblePx ?? 48;
  const bottomLimit = vv.bottom - bottomReservePx;

  const maxLeft = vv.right - minVisiblePx;
  const minLeft = vv.left + minVisiblePx - size.width;
  const maxTop = bottomLimit - minVisiblePx;
  const minTop = vv.top + VIEWPORT_MARGIN_PX;

  return {
    left: Math.max(minLeft, Math.min(maxLeft, left)),
    top: Math.max(minTop, Math.min(maxTop, top))
  };
}

/**
 * Resolve a default window position from a corner or center anchor.
 * @param {'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'center'} corner
 * @param {{ width: number, height: number }} size
 * @param {{ offsetX?: number, offsetY?: number, cascade?: number, bottomReservePx?: number }} [options]
 */
export function defaultWindowPosition(corner, size, options = {}) {
  const vv = readViewportBounds();
  const offsetX = options.offsetX ?? 14;
  const offsetY = options.offsetY ?? 14;
  const cascade = (options.cascade ?? 0) * 28;
  const bottomReservePx = options.bottomReservePx ?? 0;
  const bottomLimit = vv.bottom - bottomReservePx;

  switch (corner) {
    case 'top-left':
      return clampWindowPosition(
        vv.left + offsetX + cascade,
        vv.top + offsetY + cascade,
        size,
        vv,
        options
      );
    case 'top-center':
      return clampWindowPosition(
        vv.left + (vv.right - vv.left - size.width) / 2,
        vv.top + offsetY + cascade,
        size,
        vv,
        options
      );
    case 'center': {
      const usableHeight = Math.max(0, bottomLimit - vv.top);
      return clampWindowPosition(
        vv.left + (vv.right - vv.left - size.width) / 2 + cascade,
        vv.top + (usableHeight - size.height) / 2 + cascade,
        size,
        vv,
        options
      );
    }
    case 'top-right':
      return clampWindowPosition(
        vv.right - offsetX - size.width - cascade,
        vv.top + offsetY + cascade,
        size,
        vv,
        options
      );
    case 'bottom-left':
      return clampWindowPosition(
        vv.left + offsetX + cascade,
        bottomLimit - offsetY - size.height - cascade,
        size,
        vv,
        options
      );
    case 'bottom-right':
    default:
      return clampWindowPosition(
        vv.right - offsetX - size.width - cascade,
        bottomLimit - offsetY - size.height - cascade,
        size,
        vv,
        options
      );
  }
}

/**
 * Parse --mobile-bottom-chrome-est from the document root (falls back to 140px).
 */
export function readMobileBottomChromeReservePx() {
  if (typeof document === 'undefined') return 140;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--mobile-bottom-chrome-est')
    .trim();
  if (!raw) return 140;
  const match = raw.match(/^([\d.]+)rem$/);
  if (match) {
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return Math.round(parseFloat(match[1]) * rootPx);
  }
  const pxMatch = raw.match(/^([\d.]+)px$/);
  if (pxMatch) return Math.round(parseFloat(pxMatch[1]));
  return 140;
}
