/** Cap rasterized / downloaded mermaid exports so wide sequence diagrams stay shareable. */
export const MERMAID_EXPORT_MAX_WIDTH_PX = 1600;

/**
 * Rasterize SVG markup to a PNG blob (client-side canvas).
 * @param {string} svgMarkup
 * @param {{ scale?: number, background?: string }} [options]
 * @returns {Promise<Blob>}
 */
export async function svgMarkupToPngBlob(svgMarkup, { scale = 2, background = '#ffffff' } = {}) {
  if (typeof document === 'undefined') {
    throw new Error('PNG export requires a browser canvas');
  }
  const { width, height } = readSvgDimensions(svgMarkup);
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(svgBlob);
  try {
    const image = await loadImageElement(objectUrl);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(width * scale));
    canvas.height = Math.max(1, Math.ceil(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pngBlob = await canvasToBlob(canvas, 'image/png');
    if (!pngBlob) throw new Error('PNG encode failed');
    return pngBlob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * @param {string} svgMarkup
 * @returns {{ width: number, height: number }}
 */
export function readSvgDimensions(svgMarkup) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgMarkup, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() === 'parsererror') {
    return { width: 800, height: 600 };
  }
  let width = parseSvgLength(root.getAttribute('width'));
  let height = parseSvgLength(root.getAttribute('height'));
  const viewBox = root.getAttribute('viewBox');
  if ((!width || !height) && viewBox) {
    const parts = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      if (!width) width = parts[2];
      if (!height) height = parts[3];
    }
  }
  return {
    width: width > 0 ? width : 800,
    height: height > 0 ? height : 600
  };
}

/**
 * @param {string | null} raw
 * @returns {number}
 */
function parseSvgLength(raw) {
  if (!raw) return 0;
  const text = String(raw).trim();
  if (/%$/.test(text)) return 0;
  const n = Number.parseFloat(text.replace(/px$/i, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Shrink oversized mermaid SVG roots for export/share (keeps viewBox, caps width).
 * @param {string} svgMarkup
 * @param {{ maxWidth?: number }} [options]
 * @returns {string}
 */
export function normalizeSvgMarkupForExport(
  svgMarkup,
  { maxWidth = MERMAID_EXPORT_MAX_WIDTH_PX } = {}
) {
  if (typeof document === 'undefined') return svgMarkup;
  const { width, height } = readSvgDimensions(svgMarkup);
  if (!(width > maxWidth) || !(height > 0)) return svgMarkup;

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgMarkup, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() === 'parsererror') return svgMarkup;

  const nextHeight = Math.max(1, Math.round((height * maxWidth) / width));
  root.setAttribute('width', String(maxWidth));
  root.setAttribute('height', String(nextHeight));
  return new XMLSerializer().serializeToString(doc);
}

/**
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load SVG for PNG export'));
    image.src = url;
  });
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string} type
 * @returns {Promise<Blob | null>}
 */
function canvasToBlob(canvas, type) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type);
  });
}
