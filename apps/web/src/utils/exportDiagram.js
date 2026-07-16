import { parseChartDsl } from '@archislop/shared';
import { renderMermaidPreviewSvg } from './renderMermaidPreview.js';

/**
 * Per-mode export formats. Each entry is a download the user can take out of
 * archislop and reopen elsewhere (editor, browser, spreadsheet, Vega editor).
 *
 * Rationale (v1):
 * - mermaid: source for Mermaid Live / IDE plugins; SVG for slides/docs
 * - infographic: AntV DSL text (SVG export needs renderer hooks; deferred)
 * - metaphor3d: scene JSON (the portable authoring format)
 * - chart: CSV when tabular data exists; full wrapper JSON; bare Vega-Lite
 * - anything: standalone HTML with vendored libs inlined (not a PWA — a
 *   single file that opens offline in any browser is the right replay shape)
 * - forms: A2UI document JSON
 */

/** @typedef {'mermaid'|'infographic'|'metaphor3d'|'chart'|'forms'|'anything'} ExportContentType */

/**
 * @typedef {object} ExportFormat
 * @property {string} id
 * @property {string} ext
 * @property {string} mime
 * @property {string} labelKey — key under controls.settings
 * @property {(source: string) => boolean} [isAvailable]
 */

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
      id: 'mermaid-svg',
      ext: 'svg',
      mime: 'image/svg+xml;charset=utf-8',
      labelKey: 'exportMermaidSvg'
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
 * @returns {Promise<{ filename: string, mime: string, body: string, ext: string }>}
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

  const body = await buildExportBody(contentType, formatId, source);
  const stamp = exportTimestamp();
  return {
    filename: `archislop-${contentType}-${stamp}.${format.ext}`,
    mime: format.mime,
    body,
    ext: format.ext
  };
}

/**
 * @param {ExportContentType} contentType
 * @param {string} formatId
 * @param {string} source
 * @returns {Promise<string>}
 */
async function buildExportBody(contentType, formatId, source) {
  switch (formatId) {
    case 'mermaid-source':
      return source.endsWith('\n') ? source : `${source}\n`;
    case 'mermaid-svg': {
      const id = `export-mermaid-${Date.now().toString(36)}`;
      const { svg } = await renderMermaidPreviewSvg(id, source);
      return svg.startsWith('<?xml') ? svg : `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`;
    }
    case 'infographic-dsl':
      return source.endsWith('\n') ? source : `${source}\n`;
    case 'metaphor-json':
    case 'forms-json':
    case 'chart-json':
      return prettyJsonOrRaw(source);
    case 'chart-vl': {
      const parsed = parseChartDsl(source);
      if (!parsed.ok) throw new Error(parsed.error);
      return `${JSON.stringify(parsed.dsl.spec, null, 2)}\n`;
    }
    case 'chart-csv': {
      const rows = chartDataValues(source);
      if (!rows) throw new Error('Chart has no tabular data.values to export');
      return rowsToCsv(rows);
    }
    case 'anything-html':
      return expandAnythingStandaloneHtml(source);
    default:
      throw new Error(`Unhandled export format: ${formatId}`);
  }
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
 * Trigger a browser file download for a UTF-8 text/binary string body.
 * @param {{ body: string, mime: string, filename: string }} payload
 * @param {{ createObjectURL?: typeof URL.createObjectURL, revokeObjectURL?: typeof URL.revokeObjectURL, document?: Document }} [deps]
 */
export function triggerBrowserDownload(payload, deps = {}) {
  const createObjectURL = deps.createObjectURL ?? URL.createObjectURL.bind(URL);
  const revokeObjectURL = deps.revokeObjectURL ?? URL.revokeObjectURL.bind(URL);
  const doc = deps.document ?? document;
  const blob = new Blob([payload.body], { type: payload.mime });
  const url = createObjectURL(blob);
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = payload.filename;
  anchor.rel = 'noopener';
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Defer revoke so Safari finishes the download navigation.
  setTimeout(() => revokeObjectURL(url), 0);
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
