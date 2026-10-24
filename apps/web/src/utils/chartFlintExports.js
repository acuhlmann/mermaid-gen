import { parseChartDsl } from '@archislop/shared';

/**
 * Exports compiled from a chart's stored Flint source (`flint` in the chart wrapper — see
 * apps/server/src/tools/chartFlintAuthoring.js). The canvas draws the derived Vega-Lite;
 * these hand the same chart to other tools through Flint's other backends. Each backend
 * is imported lazily so none of it lands in the main bundle.
 */

/** Pinned CDN builds the exported pages load; a standalone file has nothing else to use. */
const ECHARTS_CDN = 'https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js';
const PLOTLY_CDN = 'https://cdn.jsdelivr.net/npm/plotly.js-dist-min@2.35.2/plotly.min.js';

/**
 * The Flint input of a Flint-sourced chart, or null for a plain Vega-Lite chart.
 * @param {string} source
 * @returns {{ data: { values: Record<string, unknown>[] }, semantic_types?: Record<string, unknown>, chart_spec: Record<string, any> } | null}
 */
export function chartFlintInput(source) {
  const parsed = parseChartDsl(source);
  if (!parsed.ok) return null;
  const flint = /** @type {any} */ (parsed.dsl.flint);
  if (!flint || !Array.isArray(flint.data?.values) || !flint.chart_spec?.chartType) return null;
  return flint;
}

/** @param {string} source */
export const hasChartFlintSource = (source) => chartFlintInput(source) != null;

/** @param {string} source */
function requireFlint(source) {
  const flint = chartFlintInput(source);
  if (!flint) throw new Error('This chart has no Flint source to export from.');
  return flint;
}

/** Drop Flint's private `_`-prefixed annotations from a backend spec. */
function stripPrivate(spec) {
  return Object.fromEntries(Object.entries(spec ?? {}).filter(([key]) => !key.startsWith('_')));
}

/** JSON safe to inline in a <script> element. */
const inlineJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

function standalonePage({ title, width, height, scriptSrc, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title || 'Chart')}</title>
<style>body{margin:0;padding:24px;font-family:system-ui,sans-serif;background:#fff}#chart{width:${width}px;max-width:100%;height:${height}px}</style>
<script src="${scriptSrc}"></script>
</head>
<body>
<div id="chart"></div>
<script>
${body}
</script>
</body>
</html>
`;
}

/** @param {string} source */
export function buildFlintSpecJson(source) {
  return `${JSON.stringify(requireFlint(source), null, 2)}\n`;
}

/** @param {string} source */
export async function buildEChartsHtml(source) {
  const flint = requireFlint(source);
  const { assembleECharts } = await import('flint-chart/echarts');
  const option = assembleECharts(flint);
  return standalonePage({
    title: flint.chart_spec.title,
    width: option._width ?? 720,
    height: option._height ?? 440,
    scriptSrc: ECHARTS_CDN,
    body: `echarts.init(document.getElementById('chart')).setOption(${inlineJson(stripPrivate(option))});`
  });
}

/** @param {string} source */
export async function buildPlotlyHtml(source) {
  const flint = requireFlint(source);
  const { assemblePlotly } = await import('flint-chart/plotly');
  const figure = assemblePlotly(flint);
  return standalonePage({
    title: flint.chart_spec.title,
    width: figure._width ?? 720,
    height: figure._height ?? 440,
    scriptSrc: PLOTLY_CDN,
    body: `Plotly.newPlot('chart', ${inlineJson(figure.data ?? [])}, ${inlineJson(figure.layout ?? {})}, { responsive: true });`
  });
}

/**
 * Office.js script that builds the chart natively in a running Excel (Script Lab or an
 * add-in) — Flint's own Excel route.
 * @param {string} source
 */
export async function buildOfficeJsScript(source) {
  const flint = requireFlint(source);
  const { assembleExcel, generateOfficeJs } = await import('flint-chart/excel');
  const { code } = generateOfficeJs(assembleExcel(flint));
  return `// Run in Excel (Script Lab or an Office add-in): Excel.run(renderFlintChart)\n${code}\n`;
}

/**
 * A downloadable .xlsx with the data and a native Excel chart.
 * @param {string} source
 * @returns {Promise<Blob>}
 */
export async function buildXlsxBlob(source) {
  const flint = requireFlint(source);
  const [{ assembleExcel }, { buildChartWorkbook }] = await Promise.all([
    import('flint-chart/excel'),
    import('./xlsxChartWorkbook.js')
  ]);
  const { bytes } = buildChartWorkbook(assembleExcel(flint));
  return new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}
