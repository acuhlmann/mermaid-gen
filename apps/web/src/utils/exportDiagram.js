import { parseChartDsl } from '@archislop/shared';
import { renderMermaidPreviewSvg } from './renderMermaidPreview.js';

/**
 * Per-mode export formats. Each entry is a download the user can take out of
 * archislop and reopen elsewhere (editor, browser, spreadsheet, Vega editor).
 *
 * Rationale (v1):
 * - mermaid: source for Mermaid Live / IDE plugins; SVG for slides/docs
 * - infographic: AntV DSL text (SVG export needs renderer hooks; deferred)
 * - metaphor3d: scene JSON (authoring) + baked glTF/GLB (delivery)
 * - chart: CSV when tabular data exists; full wrapper JSON; bare Vega-Lite
 * - anything: standalone HTML with vendored libs inlined (not a PWA — a
 *   single file that opens offline in any browser is the right replay shape)
 * - forms: A2UI document JSON
 */

/** @typedef {'mermaid'|'infographic'|'metaphor3d'|'chart'|'forms'|'anything'} ExportContentType */

/**
 * @typedef {'text' | 'image' | 'file'} ExportDeliveryKind
 */

/**
 * @typedef {object} ExportFormat
 * @property {string} id
 * @property {string} ext
 * @property {string} mime
 * @property {string} labelKey — key under controls.settings
 * @property {ExportDeliveryKind} [delivery] — defaults to text
 * @property {(source: string) => boolean} [isAvailable]
 * @property {string} [shareAsFormatId] — rasterize or alias Share to this format id
 */

/**
 * @typedef {object} ExportPayload
 * @property {string} filename
 * @property {string} mime
 * @property {string} ext
 * @property {string} [body] — UTF-8 text when delivery is text
 * @property {Blob} [blob] — binary body (e.g. PNG)
 * @property {ExportDeliveryKind} delivery
 */

/**
 * @typedef {'download' | 'share-file' | 'share-text' | 'clipboard-text' | 'clipboard-image'} ExportDeliveryMethod
 */

/**
 * @typedef {object} ExportDeliveryResult
 * @property {ExportDeliveryMethod} method
 * @property {string} filename
 * @property {string | null} previewUrl
 * @property {ExportPayload} payload
 */

/** How long an in-browser preview blob URL stays valid after export. */
export const EXPORT_PREVIEW_URL_TTL_MS = 120_000;

/** Cap rasterized / downloaded mermaid exports so wide sequence diagrams stay shareable. */
export const MERMAID_EXPORT_MAX_WIDTH_PX = 1600;

/** @type {Record<ExportContentType, ExportFormat[]>} */
export const EXPORT_FORMATS_BY_MODE = {
  mermaid: [
    {
      id: 'mermaid-source',
      ext: 'mmd',
      mime: 'text/plain;charset=utf-8',
      labelKey: 'exportMermaidSource'
    },
    {
      id: 'mermaid-png',
      ext: 'png',
      mime: 'image/png',
      labelKey: 'exportMermaidPng',
      delivery: 'image'
    },
    {
      id: 'mermaid-svg',
      ext: 'svg',
      mime: 'image/svg+xml;charset=utf-8',
      labelKey: 'exportMermaidSvg',
      /** Share delivers a PNG raster so chat apps receive a picture attachment. */
      shareAsFormatId: 'mermaid-png'
    }
  ],
  infographic: [
    {
      id: 'infographic-dsl',
      ext: 'txt',
      mime: 'text/plain;charset=utf-8',
      labelKey: 'exportInfographicDsl'
    }
  ],
  metaphor3d: [
    {
      id: 'metaphor-json',
      ext: 'json',
      mime: 'application/json;charset=utf-8',
      labelKey: 'exportMetaphorJson'
    },
    {
      id: 'metaphor-gltf',
      ext: 'glb',
      mime: 'model/gltf-binary',
      labelKey: 'exportMetaphorGltf',
      delivery: 'file'
    }
  ],
  chart: [
    {
      id: 'chart-csv',
      ext: 'csv',
      mime: 'text/csv;charset=utf-8',
      labelKey: 'exportChartCsv',
      isAvailable: (source) => chartDataValues(source) != null
    },
    {
      id: 'chart-json',
      ext: 'json',
      mime: 'application/json;charset=utf-8',
      labelKey: 'exportChartJson'
    },
    {
      id: 'chart-vl',
      ext: 'vl.json',
      mime: 'application/json;charset=utf-8',
      labelKey: 'exportChartVegaLite'
    }
  ],
  anything: [
    {
      id: 'anything-html',
      ext: 'html',
      mime: 'text/html;charset=utf-8',
      labelKey: 'exportAnythingHtml'
    }
  ],
  forms: [
    {
      id: 'forms-json',
      ext: 'json',
      mime: 'application/json;charset=utf-8',
      labelKey: 'exportFormsJson'
    }
  ]
};

/**
 * @param {string | null | undefined} contentType
 * @returns {contentType is ExportContentType}
 */
export function isExportableContentType(contentType) {
  return Boolean(contentType && contentType in EXPORT_FORMATS_BY_MODE);
}

/**
 * Formats available for the active mode + current source.
 * @param {string | null | undefined} contentType
 * @param {string | null | undefined} diagramSource
 * @returns {ExportFormat[]}
 */
export function listExportFormats(contentType, diagramSource) {
  if (!isExportableContentType(contentType)) return [];
  const source = typeof diagramSource === 'string' ? diagramSource : '';
  return EXPORT_FORMATS_BY_MODE[contentType].filter((format) =>
    format.isAvailable ? format.isAvailable(source) : true
  );
}

/**
 * Format id whose pre-warmed payload Web Share should use. SVG save stays vector;
 * Share on the SVG row delivers PNG so WhatsApp and similar apps get a picture.
 * @param {string} formatId
 * @param {string | null | undefined} [contentType]
 * @returns {string}
 */
export function getShareFormatId(formatId, contentType = null) {
  if (contentType && isExportableContentType(contentType)) {
    const format = EXPORT_FORMATS_BY_MODE[contentType].find((entry) => entry.id === formatId);
    if (format?.shareAsFormatId) return format.shareAsFormatId;
  }
  return formatId;
}

/**
 * Minimal placeholder for synchronous canShare checks before pre-warm finishes.
 * @param {string} formatId
 * @param {string | null | undefined} [contentType]
 * @returns {ExportPayload}
 */
export function exportFormatSharePreview(formatId, contentType = null) {
  const shareFormatId = getShareFormatId(formatId, contentType);
  if (!contentType || !isExportableContentType(contentType)) {
    return {
      filename: 'preview',
      mime: 'text/plain',
      ext: 'txt',
      delivery: 'text',
      body: 'x'
    };
  }
  const format = EXPORT_FORMATS_BY_MODE[contentType].find((entry) => entry.id === shareFormatId);
  if (!format) {
    return {
      filename: 'preview',
      mime: 'text/plain',
      ext: 'txt',
      delivery: 'text',
      body: 'x'
    };
  }
  const delivery = format.delivery ?? 'text';
  if (delivery === 'image') {
    return {
      filename: `preview.${format.ext}`,
      mime: format.mime,
      ext: format.ext,
      delivery: 'image',
      blob: new Blob(['x'], { type: format.mime })
    };
  }
  if (delivery === 'file') {
    return {
      filename: `preview.${format.ext}`,
      mime: format.mime,
      ext: format.ext,
      delivery: 'file',
      blob: new Blob(['x'], { type: format.mime })
    };
  }
  return {
    filename: `preview.${format.ext}`,
    mime: format.mime,
    ext: format.ext,
    delivery: 'text',
    body: 'x'
  };
}

/**
 * @param {string} source
 * @returns {Record<string, unknown>[] | null}
 */
export function chartDataValues(source) {
  const parsed = parseChartDsl(source);
  if (!parsed.ok) return null;
  const data = parsed.dsl.spec?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const values = /** @type {{ values?: unknown }} */ (data).values;
  if (!Array.isArray(values) || values.length === 0) return null;
  if (!values.every((row) => row && typeof row === 'object' && !Array.isArray(row))) {
    return null;
  }
  return /** @type {Record<string, unknown>[]} */ (values);
}

/**
 * Convert tabular chart rows to CSV (RFC 4180-ish).
 * @param {Record<string, unknown>[]} rows
 * @returns {string}
 */
export function rowsToCsv(rows) {
  const keys = [];
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  const lines = [keys.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(keys.map((key) => csvEscape(row[key])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function csvEscape(value) {
  if (value == null) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Pretty-print JSON when possible; otherwise return the original string.
 * @param {string} source
 * @returns {string}
 */
export function prettyJsonOrRaw(source) {
  try {
    return `${JSON.stringify(JSON.parse(source), null, 2)}\n`;
  } catch {
    return source.endsWith('\n') ? source : `${source}\n`;
  }
}

/**
 * Build download payload for a format (without triggering the browser download).
 * @param {{ contentType: string, diagramSource: string, formatId: string }} args
 * @returns {Promise<ExportPayload>}
 */
export async function buildExportPayload({ contentType, diagramSource, formatId }) {
  const source = (diagramSource ?? '').trim();
  if (!source) {
    throw new Error('Nothing to export');
  }
  if (!isExportableContentType(contentType)) {
    throw new Error(`Unsupported export mode: ${contentType}`);
  }
  const format = EXPORT_FORMATS_BY_MODE[contentType].find((entry) => entry.id === formatId);
  if (!format) {
    throw new Error(`Unknown export format: ${formatId}`);
  }
  if (format.isAvailable && !format.isAvailable(source)) {
    throw new Error(`Export format unavailable for current content: ${formatId}`);
  }

  const built = await buildExportBody(contentType, formatId, source);
  const stamp = exportTimestamp();
  const delivery = format.delivery ?? 'text';
  return {
    filename: `archislop-${contentType}-${stamp}.${format.ext}`,
    mime: format.mime,
    ext: format.ext,
    delivery,
    ...(built.blob ? { blob: built.blob } : { body: built.body ?? '' })
  };
}

/**
 * @param {ExportContentType} contentType
 * @param {string} formatId
 * @param {string} source
 * @returns {Promise<{ body?: string, blob?: Blob }>}
 */
async function buildExportBody(contentType, formatId, source) {
  switch (formatId) {
    case 'mermaid-source':
      return { body: source.endsWith('\n') ? source : `${source}\n` };
    case 'mermaid-svg': {
      const id = `export-mermaid-${Date.now().toString(36)}`;
      const { svg } = await renderMermaidPreviewSvg(id, source);
      const markup = normalizeSvgMarkupForExport(
        svg.startsWith('<?xml') ? svg : `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`
      );
      return { body: markup };
    }
    case 'mermaid-png': {
      const id = `export-mermaid-png-${Date.now().toString(36)}`;
      const { svg } = await renderMermaidPreviewSvg(id, source);
      const markup = normalizeSvgMarkupForExport(
        svg.startsWith('<?xml') ? svg : `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`
      );
      const blob = await svgMarkupToPngBlob(markup);
      return { blob };
    }
    case 'infographic-dsl':
      return { body: source.endsWith('\n') ? source : `${source}\n` };
    case 'metaphor-json':
    case 'forms-json':
    case 'chart-json':
      return { body: prettyJsonOrRaw(source) };
    case 'metaphor-gltf': {
      const { exportMetaphorGltfBlob } = await import('./metaphorGltfExport.js');
      const blob = await exportMetaphorGltfBlob();
      return { blob };
    }
    case 'chart-vl': {
      const parsed = parseChartDsl(source);
      if (!parsed.ok) throw new Error(parsed.error);
      return { body: `${JSON.stringify(parsed.dsl.spec, null, 2)}\n` };
    }
    case 'chart-csv': {
      const rows = chartDataValues(source);
      if (!rows) throw new Error('Chart has no tabular data.values to export');
      return { body: rowsToCsv(rows) };
    }
    case 'anything-html':
      return { body: await expandAnythingStandaloneHtml(source) };
    default:
      throw new Error(`Unhandled export format: ${formatId}`);
  }
}

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

/**
 * @param {ExportPayload} payload
 * @returns {Blob}
 */
export function exportPayloadToBlob(payload) {
  if (payload.blob) return payload.blob;
  return new Blob([payload.body ?? ''], { type: payload.mime });
}

/**
 * @param {ExportPayload} payload
 * @returns {boolean}
 */
export function isPreviewableExportPayload(payload) {
  const mime = payload.mime.toLowerCase();
  return (
    mime.startsWith('image/') ||
    mime.startsWith('text/html') ||
    mime.startsWith('text/plain') ||
    mime.includes('json') ||
    mime.includes('csv')
  );
}

/**
 * @param {ExportPayload} payload
 * @returns {string}
 */
export function createExportPreviewUrl(payload) {
  return URL.createObjectURL(exportPayloadToBlob(payload));
}

/**
 * @returns {boolean}
 */
export function isWebShareAvailable() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/**
 * User dismissed the native share sheet — not an export failure.
 * @param {unknown} err
 * @returns {boolean}
 */
export function isExportUserAbortError(err) {
  return err instanceof Error && err.name === 'AbortError';
}

/**
 * Web Share rejected because the click activation expired (async export build).
 * @param {unknown} err
 * @returns {boolean}
 */
export function isShareUserGestureError(err) {
  if (!(err instanceof Error)) return false;
  if (err.name !== 'NotAllowedError' && err.name !== 'SecurityError') return false;
  return /user gesture/i.test(err.message);
}

/**
 * Web Share rejected for policy / capability reasons (not user cancel).
 * @param {unknown} err
 * @returns {boolean}
 */
export function isSharePermissionError(err) {
  if (!(err instanceof Error)) return false;
  if (err.name === 'NotSupportedError') return true;
  if (err.name !== 'NotAllowedError' && err.name !== 'SecurityError') return false;
  return !isShareUserGestureError(err);
}

/**
 * @param {unknown} err
 * @returns {boolean}
 */
function isClipboardPermissionError(err) {
  return err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
}

/**
 * @param {string} text
 * @param {Document} [doc]
 */
function copyTextWithExecCommand(text, doc = document) {
  const textarea = doc.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  doc.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    if (!doc.execCommand('copy')) {
      throw new Error('Clipboard is not available');
    }
  } finally {
    textarea.remove();
  }
}

/**
 * Copy UTF-8 text: Clipboard API first, then execCommand fallback.
 * @param {string} text
 */
async function copyTextWithFallback(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (err) {
      if (!isClipboardPermissionError(err)) throw err;
    }
  }
  if (typeof document !== 'undefined') {
    copyTextWithExecCommand(text);
    return;
  }
  throw new Error('Clipboard is not available');
}

/**
 * @param {ExportPayload} payload
 * @returns {boolean}
 */
export function canShareExportPayload(payload) {
  return resolveWebShareMode(payload) != null;
}

/**
 * @param {ExportPayload} payload
 * @returns {boolean}
 */
export function canCopyExportPayload(payload) {
  if (payload.delivery === 'file') {
    // Binary exports (glTF) are not clipboard-friendly; share/download instead.
    return false;
  }
  if (payload.delivery === 'image') {
    const hasClipboard = Boolean(
      typeof navigator !== 'undefined' &&
      navigator.clipboard?.write &&
      typeof ClipboardItem !== 'undefined'
    );
    return hasClipboard || canShareExportPayload(payload);
  }
  const hasClipboard = Boolean(typeof navigator !== 'undefined' && navigator.clipboard?.writeText);
  return hasClipboard || canShareExportPayload(payload);
}

/**
 * @param {ExportPayload} payload
 * @returns {File}
 */
export function exportPayloadToFile(payload) {
  const blob = exportPayloadToBlob(payload);
  return new File([blob], payload.filename, { type: payload.mime });
}

/**
 * @param {ExportPayload} payload
 * @returns {Promise<ExportDeliveryMethod>}
 */
export async function copyExportPayload(payload) {
  if (payload.delivery === 'file') {
    throw new Error('This format cannot be copied — use Save or Share instead');
  }
  if (payload.delivery === 'image') {
    const blob = payload.blob ?? exportPayloadToBlob(payload);
    const file = exportPayloadToFile(payload);
    if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      try {
        const item = new ClipboardItem({ [blob.type]: blob });
        await navigator.clipboard.write([item]);
        return 'clipboard-image';
      } catch (err) {
        if (!isClipboardPermissionError(err)) throw err;
      }
    }
    if (isWebShareAvailable() && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ files: [file], title: payload.filename });
      return 'share-file';
    }
    throw new Error('Image copy is not supported in this browser');
  }

  const text = payload.body ?? '';
  try {
    await copyTextWithFallback(text);
    return 'clipboard-text';
  } catch (clipboardErr) {
    if (isWebShareAvailable() && (!navigator.canShare || navigator.canShare({ text }))) {
      await navigator.share({ text, title: payload.filename });
      return 'share-text';
    }
    throw clipboardErr;
  }
}

/**
 * Visual exports (PNG, SVG) should share as files so mobile apps like WhatsApp
 * receive an image attachment instead of raw markup in the message body.
 * @param {ExportPayload} payload
 * @returns {boolean}
 */
export function isVisualExportPayload(payload) {
  if (payload.delivery === 'image') return true;
  return (payload.mime ?? '').toLowerCase().startsWith('image/');
}

/**
 * Pick a Web Share mode synchronously so navigator.share runs in the click turn.
 * Prefer share({ files }) whenever the platform can attach a file so chat apps
 * receive HTML/JSON/glTF/images as attachments — not raw text in the body.
 * Fall back to share({ text }) only when file share is unavailable. An async
 * fallback loses the user-gesture activation, so the choice must be synchronous.
 * @param {ExportPayload} payload
 * @returns {'text' | 'file' | null}
 */
export function resolveWebShareMode(payload) {
  if (!isWebShareAvailable()) return null;

  const file = exportPayloadToFile(payload);
  const canShareFiles =
    typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

  if (canShareFiles) {
    return 'file';
  }

  if (payload.delivery === 'text') {
    const text = payload.body ?? '';
    const canShareText = typeof navigator.canShare !== 'function' || navigator.canShare({ text });
    if (canShareText) return 'text';
  }

  return null;
}

/**
 * Invoke Web Share synchronously from a click handler (returns a Promise).
 * Call this in the same turn as the user gesture — do not await async export
 * builds before calling it.
 * @param {ExportPayload} payload
 * @returns {Promise<ExportDeliveryMethod>}
 */
export function startWebShare(payload) {
  if (!isWebShareAvailable()) {
    return Promise.reject(new Error('Share is not available on this device'));
  }
  const mode = resolveWebShareMode(payload);
  if (mode === 'text') {
    return shareTextPayload(payload);
  }
  if (mode === 'file') {
    const file = exportPayloadToFile(payload);
    return navigator
      .share({ files: [file], title: payload.filename })
      .then(() => /** @type {ExportDeliveryMethod} */ ('share-file'));
  }
  return Promise.reject(new Error('Share is not available for this format'));
}

/**
 * @param {ExportPayload} payload
 * @returns {Promise<ExportDeliveryMethod>}
 */
function shareTextPayload(payload) {
  if (payload.delivery !== 'text') {
    return Promise.reject(new Error('Share is not available for this format'));
  }
  const text = payload.body ?? '';
  const canShareText = !navigator.canShare || navigator.canShare({ text });
  if (!canShareText) {
    return Promise.reject(new Error('Share is not available for this format'));
  }
  return navigator
    .share({ text, title: payload.filename })
    .then(() => /** @type {ExportDeliveryMethod} */ ('share-text'));
}

/**
 * @param {ExportPayload} payload
 * @returns {Promise<ExportDeliveryMethod>}
 */
export async function shareExportPayload(payload) {
  return startWebShare(payload);
}

/**
 * @param {ExportPayload} payload
 * @param {{ createObjectURL?: typeof URL.createObjectURL, revokeObjectURL?: typeof URL.revokeObjectURL, document?: Document }} [deps]
 */
export function triggerBrowserDownload(payload, deps = {}) {
  const createObjectURL = deps.createObjectURL ?? URL.createObjectURL.bind(URL);
  const revokeObjectURL = deps.revokeObjectURL ?? URL.revokeObjectURL.bind(URL);
  const doc = deps.document ?? document;
  const blob = exportPayloadToBlob(payload);
  const url = createObjectURL(blob);
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = payload.filename;
  anchor.rel = 'noopener';
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => revokeObjectURL(url), 0);
}

/**
 * Deliver an export via download, clipboard, or Web Share.
 * @param {ExportPayload} payload
 * @param {'download' | 'copy' | 'share'} action
 * @param {{ createObjectURL?: typeof URL.createObjectURL, revokeObjectURL?: typeof URL.revokeObjectURL, document?: Document }} [deps]
 * @returns {Promise<ExportDeliveryResult>}
 */
export async function deliverExportPayload(payload, action, deps = {}) {
  /** @type {ExportDeliveryMethod} */
  let method;
  if (action === 'copy') {
    method = await copyExportPayload(payload);
  } else if (action === 'share') {
    method = await shareExportPayload(payload);
  } else {
    triggerBrowserDownload(payload, deps);
    method = 'download';
  }
  const previewUrl = isPreviewableExportPayload(payload)
    ? (deps.createObjectURL ?? URL.createObjectURL.bind(URL))(exportPayloadToBlob(payload))
    : null;
  return { method, filename: payload.filename, previewUrl, payload };
}

/**
 * Inline allowlisted libs so the file opens offline outside the sandbox.
 * @param {string} source
 * @returns {Promise<string>}
 */
async function expandAnythingStandaloneHtml(source) {
  const vendor = await import('@archislop/shared/anythingLibVendor.js');
  const { html } = vendor.expandAnythingLibs(source);
  const trimmed = html.trim();
  if (/^<!DOCTYPE/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return trimmed.endsWith('\n') ? trimmed : `${trimmed}\n`;
  }
  // Slot content is sometimes a fragment — wrap so a double-click opens cleanly.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>archislop export</title>
</head>
<body>
${trimmed}
</body>
</html>
`;
}

function exportTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/**
 * Build payload + download in one step.
 * @param {{ contentType: string, diagramSource: string, formatId: string }} args
 */
export async function exportDiagram(args) {
  const payload = await buildExportPayload(args);
  triggerBrowserDownload(payload);
  return payload;
}
