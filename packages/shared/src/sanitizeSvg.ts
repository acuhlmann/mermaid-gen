/**
 * @param {string} viewBoxValue
 * @returns {{ width: number, height: number } | null}
 */
export function parseViewBoxPixelSize(viewBoxValue) {
  if (typeof viewBoxValue !== 'string' || !viewBoxValue.trim()) return null;
  const parts = viewBoxValue
    .trim()
    .split(/[\s,]+/)
    .map((n) => Number(n));
  if (parts.length !== 4 || !(parts[2] > 0) || !(parts[3] > 0)) return null;
  return { width: parts[2], height: parts[3] };
}

/**
 * Pin explicit pixel width/height from viewBox on a live root `<svg>` (AntV infographic).
 *
 * @param {SVGElement | null | undefined} svgEl
 * @returns {boolean} true when width/height were updated
 */
/**
 * Expand a tight AntV viewBox so labels/edges drawn outside the initial box are not clipped.
 *
 * @param {SVGElement | null | undefined} svgEl
 * @param {number} [padding]
 * @returns {boolean}
 */
export function expandRootSvgViewBoxToContent(svgEl, padding = 20) {
  if (!svgEl || typeof svgEl.getBBox !== 'function') return false;
  let bbox;
  try {
    bbox = svgEl.getBBox();
  } catch {
    return false;
  }
  if (!(bbox.width > 0) || !(bbox.height > 0)) return false;

  const pad = Math.max(0, padding);
  const x = bbox.x - pad;
  const y = bbox.y - pad;
  const width = bbox.width + pad * 2;
  const height = bbox.height + pad * 2;
  svgEl.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
  svgEl.setAttribute('width', String(width));
  svgEl.setAttribute('height', String(height));
  return true;
}

export function normalizeRootSvgElement(svgEl) {
  if (!svgEl) return false;
  expandRootSvgViewBoxToContent(svgEl);
  const vb = svgEl.viewBox?.baseVal;
  const size =
    (vb && vb.width > 0 && vb.height > 0 ? { width: vb.width, height: vb.height } : null) ??
    parseViewBoxPixelSize(svgEl.getAttribute('viewBox') ?? '');
  if (!size) return false;
  svgEl.setAttribute('width', String(size.width));
  svgEl.setAttribute('height', String(size.height));
  return true;
}

/**
 * Mermaid 11 often emits `width="100%"` on the root `<svg>`. Inside an absolutely
 * positioned host with no width (main canvas zoom layer), that resolves to 0×0.
 * Pin explicit pixel dimensions from `viewBox` so layout + fit-to-viewport work.
 *
 * @param {string} svg
 * @returns {string}
 */
export function normalizeMermaidRootSvgSize(svg) {
  const openMatch = svg.match(/<svg\b([^>]*)>/i);
  if (!openMatch) return svg;

  const attrs = openMatch[1];
  const viewBoxMatch = attrs.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
  if (!viewBoxMatch) return svg;

  const size = parseViewBoxPixelSize(viewBoxMatch[1]);
  if (!size) return svg;

  const width = size.width;
  const height = size.height;
  let nextAttrs = attrs
    .replace(/\swidth\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\sheight\s*=\s*["'][^"']*["']/gi, '');

  return svg.replace(/<svg\b[^>]*>/i, `<svg${nextAttrs} width="${width}" height="${height}">`);
}

/**
 * Strip common XSS vectors from Mermaid SVG before innerHTML injection.
 * Keeps `foreignObject` nodes — neo / HTML labels render inside them and must not be removed.
 *
 * @param {string} svg
 * @returns {string}
 */
export function sanitizeSvgMarkup(svg) {
  if (typeof svg !== 'string' || !svg) return '';
  let out = svg;
  out = out.replace(/<script[\s\S]*?<\/script>/gi, '');
  out = out.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  out = out.replace(/\s+(href|xlink:href)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '');
  out = normalizeMermaidRootSvgSize(out);
  return out;
}
