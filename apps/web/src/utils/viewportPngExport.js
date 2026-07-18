/**
 * Live-viewport PNG capture for share-friendly exports.
 *
 * Renderers register a baker while the primary canvas is mounted. Falls back to
 * DOM queries for SVG-based modes when no registration exists.
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { svgMarkupToPngBlob } from './svgPngRaster.js';

/** @typedef {() => Promise<Blob>} ViewportPngExporter */

/** @type {Map<string, ViewportPngExporter>} */
const exportersByMode = new Map();

/**
 * @param {string} contentType
 * @param {ViewportPngExporter | null} exporter
 */
export function registerViewportPngExporter(contentType, exporter) {
  if (exporter) {
    exportersByMode.set(contentType, exporter);
  } else {
    exportersByMode.delete(contentType);
  }
}

/**
 * @param {string} contentType
 * @param {ViewportPngExporter} exporter
 */
export function unregisterViewportPngExporter(contentType, exporter) {
  if (exportersByMode.get(contentType) === exporter) {
    exportersByMode.delete(contentType);
  }
}

/**
 * @param {string} contentType
 * @returns {boolean}
 */
export function isViewportPngExporterReady(contentType) {
  return typeof exportersByMode.get(contentType) === 'function';
}

/**
 * @param {string} contentType
 * @returns {Promise<Blob>}
 */
export async function captureViewportPngBlob(contentType) {
  const registered = exportersByMode.get(contentType);
  if (registered) {
    return registered();
  }
  return captureViewportPngFromDom(contentType);
}

/**
 * @param {string} contentType
 * @returns {Promise<Blob>}
 */
async function captureViewportPngFromDom(contentType) {
  if (typeof document === 'undefined') {
    throw new Error('PNG export requires a browser');
  }
  switch (contentType) {
    case 'infographic': {
      const svg = document.querySelector('.diagram-viewport .infographic-canvas svg');
      if (!svg) throw new Error('Infographic is not ready to export — wait for it to render.');
      return svgElementToPngBlob(svg);
    }
    case 'chart': {
      const svg = document.querySelector('.diagram-viewport .chart-embed-container svg');
      if (!svg) throw new Error('Chart is not ready to export — wait for it to render.');
      return svgElementToPngBlob(svg);
    }
    case 'forms': {
      const root = document.querySelector('.diagram-viewport .forms-renderer-root');
      if (!root) throw new Error('Form is not ready to export — wait for it to render.');
      return htmlElementToPngBlob(root);
    }
    default:
      throw new Error(`PNG export is not available for ${contentType}`);
  }
}

/**
 * @param {SVGSVGElement} svg
 * @param {{ scale?: number, background?: string }} [options]
 * @returns {Promise<Blob>}
 */
export async function svgElementToPngBlob(svg, options = {}) {
  const clone = /** @type {SVGSVGElement} */ (svg.cloneNode(true));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const serializer = new XMLSerializer();
  const markup = serializer.serializeToString(clone);
  const withXml = markup.startsWith('<?xml')
    ? markup
    : `<?xml version="1.0" encoding="UTF-8"?>\n${markup}`;
  return svgMarkupToPngBlob(withXml, options);
}

/**
 * @param {HTMLElement} element
 * @param {{ scale?: number, background?: string }} [options]
 * @returns {Promise<Blob>}
 */
export async function htmlElementToPngBlob(element, { scale = 2, background = '#ffffff' } = {}) {
  const rect = element.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));
  const xmlns = 'http://www.w3.org/2000/svg';
  const xhtml = 'http://www.w3.org/1999/xhtml';
  const serialized = new XMLSerializer().serializeToString(element);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="${xmlns}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="${xhtml}" style="width:${width}px;height:${height}px;background:${background};">
      ${serialized}
    </div>
  </foreignObject>
</svg>`;
  return svgMarkupToPngBlob(svg, { scale, background });
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ background?: string }} [options]
 * @returns {Promise<Blob>}
 */
export function canvasElementToPngBlob(canvas, { background = '#ffffff' } = {}) {
  if (canvas.width < 1 || canvas.height < 1) {
    return Promise.reject(new Error('Canvas is empty'));
  }
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas 2D context unavailable'));
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0);
  return new Promise((resolve, reject) => {
    out.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG encode failed'));
    }, 'image/png');
  });
}

/**
 * R3F bridge: registers a PNG baker for the live WebGL canvas while mounted.
 * Requires `preserveDrawingBuffer: true` on the Canvas gl prop.
 *
 * @param {{ enabled?: boolean, background?: string }} props
 */
export function MetaphorPngExportBridge({ enabled = true, background = '#0b1020' }) {
  const { gl } = useThree();

  useEffect(() => {
    if (!enabled) return undefined;

    const exporter = async () => {
      const canvas = gl.domElement;
      if (!(canvas instanceof HTMLCanvasElement)) {
        throw new Error('3D canvas is not ready to export');
      }
      return canvasElementToPngBlob(canvas, { background });
    };

    registerViewportPngExporter('metaphor3d', exporter);
    return () => unregisterViewportPngExporter('metaphor3d', exporter);
  }, [gl, enabled, background]);

  return null;
}
