export const VIEWPORT_SCALE_MIN = 0.2;
export const VIEWPORT_SCALE_MAX = 4;

/**
 * @param {SVGElement | null | undefined} svgEl
 * @returns {{ width: number, height: number } | null}
 */
export function readSvgLayoutSize(svgEl) {
  if (!svgEl) return null;

  const viewBox = svgEl.viewBox?.baseVal;
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height };
  }

  const widthAttr = parseFloat(svgEl.getAttribute('width') ?? '');
  const heightAttr = parseFloat(svgEl.getAttribute('height') ?? '');
  if (
    Number.isFinite(widthAttr) &&
    widthAttr > 0 &&
    Number.isFinite(heightAttr) &&
    heightAttr > 0
  ) {
    return { width: widthAttr, height: heightAttr };
  }

  const rect = svgEl.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    return { width: rect.width, height: rect.height };
  }

  return null;
}

/**
 * @param {HTMLElement | null | undefined} viewportEl
 */
export function readViewportInnerSize(viewportEl) {
  if (!viewportEl) {
    return { width: 0, height: 0 };
  }

  const style = globalThis.getComputedStyle?.(viewportEl);
  if (!style) {
    return { width: viewportEl.clientWidth, height: viewportEl.clientHeight };
  }

  const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  return {
    width: Math.max(1, viewportEl.clientWidth - padX),
    height: Math.max(1, viewportEl.clientHeight - padY)
  };
}

/**
 * Fit diagram content in the viewport without upscaling past 1× (keeps labels sharp).
 *
 * @param {{ svgWidth: number, svgHeight: number, innerWidth: number, innerHeight: number, inset?: number }}
 */
export function computeFitViewport({ svgWidth, svgHeight, innerWidth, innerHeight, inset = 32 }) {
  const availW = Math.max(1, innerWidth - inset * 2);
  const availH = Math.max(1, innerHeight - inset * 2);
  const fitScale = Math.min(availW / svgWidth, availH / svgHeight, 1);
  const scale = Math.min(VIEWPORT_SCALE_MAX, Math.max(VIEWPORT_SCALE_MIN, fitScale));
  const contentW = svgWidth * scale;
  const contentH = svgHeight * scale;
  const insetX = inset + Math.max(0, (availW - contentW) / 2);
  const insetY = inset + Math.max(0, (availH - contentH) / 2);

  return {
    scale,
    x: insetX,
    y: insetY
  };
}

/**
 * Center diagram at 1× zoom inside the viewport padding box.
 */
export function computeCenteredViewport({
  svgWidth,
  svgHeight,
  innerWidth,
  innerHeight,
  inset = 32
}) {
  const availW = Math.max(1, innerWidth - inset * 2);
  const availH = Math.max(1, innerHeight - inset * 2);
  return {
    scale: 1,
    x: inset + Math.max(0, (availW - svgWidth) / 2),
    y: inset + Math.max(0, (availH - svgHeight) / 2)
  };
}

/**
 * @param {HTMLElement | null | undefined} viewportEl
 * @param {{ preferFit?: boolean, inset?: number }} [options]
 */
export function measureViewportForDiagram(viewportEl, options = {}) {
  const { preferFit = true, inset = 32 } = options;
  const svgEl = viewportEl?.querySelector?.('svg');
  const svgSize = readSvgLayoutSize(svgEl);
  const inner = readViewportInnerSize(viewportEl);
  if (!svgSize || inner.width <= 0 || inner.height <= 0) {
    return { x: 0, y: 0, scale: 1 };
  }

  if (preferFit) {
    return computeFitViewport({
      svgWidth: svgSize.width,
      svgHeight: svgSize.height,
      innerWidth: inner.width,
      innerHeight: inner.height,
      inset
    });
  }

  return computeCenteredViewport({
    svgWidth: svgSize.width,
    svgHeight: svgSize.height,
    innerWidth: inner.width,
    innerHeight: inner.height,
    inset
  });
}
