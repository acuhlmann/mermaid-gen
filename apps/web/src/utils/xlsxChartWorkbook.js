import { strToU8, zipSync } from 'fflate';

/**
 * Write a Flint Excel chart spec (`flint-chart/excel` → `assembleExcel`) as a real .xlsx:
 * the data grid on a "Data" sheet plus a native Excel chart (DrawingML) bound to it.
 *
 * Flint's own Excel backend drives a running Excel through Office.js; it does not write a
 * file. This is the smallest OOXML that Excel, Numbers, LibreOffice and Google Sheets open
 * with a live chart. Chart families Flint maps to that are not listed in CHART_KINDS
 * (box-whisker, funnel, sunburst, treemap, waterfall, stock, radar, bubble) still export
 * their data; `buildChartWorkbook` reports `chartIncluded: false` for them.
 */

const SHEET_NAME = 'Data';

/** Excel.ChartType → DrawingML plot element + options. */
const CHART_KINDS = {
  ColumnClustered: { tag: 'barChart', barDir: 'col', grouping: 'clustered' },
  ColumnStacked: { tag: 'barChart', barDir: 'col', grouping: 'stacked' },
  BarClustered: { tag: 'barChart', barDir: 'bar', grouping: 'clustered' },
  BarStacked: { tag: 'barChart', barDir: 'bar', grouping: 'stacked' },
  Line: { tag: 'lineChart', grouping: 'standard' },
  Area: { tag: 'areaChart', grouping: 'standard' },
  AreaStacked: { tag: 'areaChart', grouping: 'stacked' },
  Pie: { tag: 'pieChart' },
  Doughnut: { tag: 'doughnutChart' },
  XYScatter: { tag: 'scatterChart', lines: false },
  XYScatterLines: { tag: 'scatterChart', lines: true }
};

const LEGEND_POS = { Top: 't', Bottom: 'b', Left: 'l', Right: 'r' };

/**
 * Vega's default categorical scheme (tableau10), so the workbook's series colours match
 * the canvas. Explicit fills are needed: without a theme part, LibreOffice draws bars and
 * slices with no fill at all.
 */
const SERIES_COLORS = [
  '4C78A8',
  'F58518',
  'E45756',
  '72B7B2',
  '54A24B',
  'EECA3B',
  'B279A2',
  'FF9DA6',
  '9D755D',
  'BAB0AC'
];
const seriesColor = (i) => SERIES_COLORS[i % SERIES_COLORS.length];
const solidFill = (rgb) => `<a:solidFill><a:srgbClr val="${rgb}"/></a:solidFill>`;

/** Custom number-format id for the date column (ids below 164 are Excel built-ins). */
const DATE_NUMFMT_ID = 164;
const DATE_STYLE_INDEX = 1;

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const NS_CHART = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const NS_DRAW = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Zero-based column index → "A", "B", … "AA". */
export function columnLetter(index) {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/** Flint hands temporal categories over as Excel date serials plus a display format. */
const dateFormatOf = (spec) =>
  spec.categoryAxis?.categoryType === 'DateAxis'
    ? spec.categoryAxis.numberFormat || 'yyyy-mm-dd'
    : null;

/** Absolute reference into the data sheet, e.g. `'Data'!$B$2:$B$5`. */
function rangeRef(col, firstRow, lastRow) {
  const c = columnLetter(col);
  return `'${SHEET_NAME}'!$${c}$${firstRow}:$${c}$${lastRow}`;
}

/** Rows as a grid with series running down columns, whatever Flint's `seriesBy` says. */
function columnSeriesGrid(spec) {
  const grid = Array.isArray(spec.data) ? spec.data : [];
  if (spec.seriesBy !== 'Rows' || grid.length === 0) return grid;
  const width = Math.max(...grid.map((row) => row.length));
  return Array.from({ length: width }, (_, c) => grid.map((row) => row[c] ?? null));
}

// ─────────────────────────────── sheet ───────────────────────────────

function cellXml(value, col, row, style) {
  const ref = `${columnLetter(col)}${row}`;
  if (value == null || value === '') return '';
  if (isNumber(value)) return `<c r="${ref}"${style ? ` s="${style}"` : ''}><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

/** Widen columns to their longest text so headers and dates are not cut or shown as `###`. */
function colsXml(grid, dateColumn) {
  const width = grid[0]?.length ?? 0;
  const cols = Array.from({ length: width }, (_, c) => {
    const longest = Math.max(...grid.map((row) => String(row[c] ?? '').length));
    const chars = Math.min(40, Math.max(10, longest + 2, dateColumn && c === 0 ? 12 : 0));
    return `<col min="${c + 1}" max="${c + 1}" width="${chars}" customWidth="1"/>`;
  });
  return width ? `<cols>${cols.join('')}</cols>` : '';
}

function sheetXml(grid, withDrawing, dateColumn) {
  const styleOf = (c, r) => (dateColumn && c === 0 && r > 0 ? DATE_STYLE_INDEX : 0);
  const rows = grid
    .map(
      (row, r) =>
        `<row r="${r + 1}">${row.map((value, c) => cellXml(value, c, r + 1, styleOf(c, r))).join('')}</row>`
    )
    .join('');
  const drawing = withDrawing ? '<drawing r:id="rId1"/>' : '';
  return `${XML_HEAD}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">${colsXml(grid, dateColumn)}<sheetData>${rows}</sheetData>${drawing}</worksheet>`;
}

// ─────────────────────────────── chart ───────────────────────────────

function strCache(values) {
  const pts = values
    .map((v, i) => `<c:pt idx="${i}"><c:v>${escapeXml(v ?? '')}</c:v></c:pt>`)
    .join('');
  return `<c:strCache><c:ptCount val="${values.length}"/>${pts}</c:strCache>`;
}

function numCache(values, formatCode = 'General') {
  const pts = values
    .map((v, i) => (isNumber(v) ? `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>` : ''))
    .join('');
  return `<c:numCache><c:formatCode>${escapeXml(formatCode)}</c:formatCode><c:ptCount val="${values.length}"/>${pts}</c:numCache>`;
}

function dataRef(tag, ref, values, formatCode) {
  const numeric = values.every((v) => v == null || isNumber(v));
  return numeric
    ? `<c:${tag}><c:numRef><c:f>${escapeXml(ref)}</c:f>${numCache(values, formatCode)}</c:numRef></c:${tag}>`
    : `<c:${tag}><c:strRef><c:f>${escapeXml(ref)}</c:f>${strCache(values)}</c:strRef></c:${tag}>`;
}

function seriesName(name, col) {
  const ref = `'${SHEET_NAME}'!$${columnLetter(col)}$1`;
  return `<c:tx><c:strRef><c:f>${escapeXml(ref)}</c:f>${strCache([name])}</c:strRef></c:tx>`;
}

const lineMarker = (rgb) =>
  `<c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr>${solidFill(rgb)}<a:ln>${solidFill(rgb)}</a:ln></c:spPr></c:marker>`;

/** Series fill (and, for pie/doughnut, one fill per slice), in schema order before `cat`. */
function seriesStyleXml(kind, index, pointCount) {
  const rgb = seriesColor(index);
  if (kind.tag === 'lineChart') {
    return `<c:spPr><a:ln w="28575" cap="rnd">${solidFill(rgb)}</a:ln></c:spPr>${lineMarker(rgb)}`;
  }
  if (kind.tag === 'pieChart' || kind.tag === 'doughnutChart') {
    const slices = Array.from(
      { length: pointCount },
      (_, i) =>
        `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr>${solidFill(seriesColor(i))}<a:ln>${solidFill('FFFFFF')}</a:ln></c:spPr></c:dPt>`
    ).join('');
    return slices;
  }
  return `<c:spPr>${solidFill(rgb)}</c:spPr>`;
}

/** Category-axis series: column 0 holds categories, every other column one series. */
function categorySeriesXml(grid, kind, dateFormat) {
  const lastRow = grid.length;
  const categories = grid.slice(1).map((row) => row[0] ?? null);
  const width = grid[0]?.length ?? 0;
  const out = [];
  for (let col = 1; col < width; col += 1) {
    const values = grid.slice(1).map((row) => row[col] ?? null);
    const smooth = kind.tag === 'lineChart' ? '<c:smooth val="0"/>' : '';
    out.push(
      `<c:ser><c:idx val="${col - 1}"/><c:order val="${col - 1}"/>${seriesName(grid[0][col], col)}` +
        seriesStyleXml(kind, col - 1, categories.length) +
        `${dataRef('cat', rangeRef(0, 2, lastRow), categories, dateFormat ?? undefined)}${dataRef('val', rangeRef(col, 2, lastRow), values)}${smooth}</c:ser>`
    );
  }
  return out.join('');
}

/** XY series from Flint's explicit bindings, else column 0 as X against every other column. */
function scatterSeriesXml(grid, spec, kind) {
  const bindings =
    Array.isArray(spec.series) && spec.series.length > 0
      ? spec.series
      : (grid[0] ?? []).slice(1).map((name, i) => ({
          name,
          xColumn: 0,
          yColumn: i + 1,
          rowCount: grid.length - 1
        }));
  return bindings
    .map((s, i) => {
      const rgb = seriesColor(i);
      const line = kind.lines
        ? `<c:spPr><a:ln w="28575" cap="rnd">${solidFill(rgb)}</a:ln></c:spPr>`
        : '<c:spPr><a:ln w="19050"><a:noFill/></a:ln></c:spPr>';
      const lastRow = 1 + s.rowCount;
      const xs = grid.slice(1, lastRow).map((row) => row[s.xColumn] ?? null);
      const ys = grid.slice(1, lastRow).map((row) => row[s.yColumn] ?? null);
      return (
        `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>` +
        `<c:tx><c:v>${escapeXml(s.name ?? '')}</c:v></c:tx>${line}${lineMarker(rgb)}` +
        `${dataRef('xVal', rangeRef(s.xColumn, 2, lastRow), xs)}${dataRef('yVal', rangeRef(s.yColumn, 2, lastRow), ys)}` +
        `<c:smooth val="0"/></c:ser>`
      );
    })
    .join('');
}

function axisTitle(text) {
  if (!text) return '';
  return `<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:t>${escapeXml(text)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`;
}

const TIME_UNITS = new Set(['days', 'months', 'years']);
const timeUnit = (value, fallback) => {
  const unit = String(value ?? '').toLowerCase();
  return TIME_UNITS.has(unit) ? unit : fallback;
};

/** Flint's date-axis tick spacing (`baseTimeUnit`, `majorUnit` × `majorTimeUnitScale`). */
function dateUnitsXml(axis) {
  const base = `<c:baseTimeUnit val="${timeUnit(axis?.baseTimeUnit, 'days')}"/>`;
  if (!isNumber(axis?.majorUnit)) return base;
  const scale = timeUnit(axis.majorTimeUnitScale, null);
  return `${base}<c:majorUnit val="${axis.majorUnit}"/>${scale ? `<c:majorTimeUnit val="${scale}"/>` : ''}`;
}

const hasNegativeValue = (grid) =>
  grid.slice(1).some((row) => row.slice(1).some((v) => isNumber(v) && v < 0));

function axesXml(spec, kind, grid) {
  const horizontal = kind.barDir === 'bar';
  const catPos = horizontal ? 'l' : 'b';
  const valPos = horizontal ? 'b' : 'l';
  const valFormat = spec.valueAxis?.numberFormat
    ? `<c:numFmt formatCode="${escapeXml(spec.valueAxis.numberFormat)}" sourceLinked="0"/>`
    : '';
  const common = '<c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/>';
  const bound = (tag, value) => (isNumber(value) ? `<c:${tag} val="${value}"/>` : '');
  // Bars and areas encode length, so they start at zero as on the canvas; Excel's
  // auto-scaling would otherwise start a 97–108 column chart at 90.
  const lengthMark = kind.tag === 'barChart' || kind.tag === 'areaChart';
  const zeroBased = lengthMark && !hasNegativeValue(grid) ? 0 : undefined;
  const min = spec.valueAxis?.minimumScale ?? zeroBased;
  const valScaling = `<c:scaling><c:orientation val="minMax"/>${bound('max', spec.valueAxis?.maximumScale)}${bound('min', min)}</c:scaling><c:delete val="0"/>`;
  const valAx = (id, cross, pos, title, fmt) =>
    `<c:valAx><c:axId val="${id}"/>${id === 1002 ? valScaling : common}<c:axPos val="${pos}"/><c:majorGridlines/>${axisTitle(title)}${fmt}<c:tickLblPos val="nextTo"/><c:crossAx val="${cross}"/><c:crosses val="autoZero"/></c:valAx>`;
  if (kind.tag === 'scatterChart') {
    return (
      valAx(1001, 1002, 'b', spec.categoryAxis?.title, '') +
      valAx(1002, 1001, 'l', spec.valueAxis?.title, valFormat)
    );
  }
  const dateFormat = dateFormatOf(spec);
  const catAx = dateFormat
    ? `<c:dateAx><c:axId val="1001"/>${common}<c:axPos val="${catPos}"/>${axisTitle(spec.categoryAxis?.title)}<c:numFmt formatCode="${escapeXml(dateFormat)}" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="1002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblOffset val="100"/>${dateUnitsXml(spec.categoryAxis)}</c:dateAx>`
    : `<c:catAx><c:axId val="1001"/>${common}<c:axPos val="${catPos}"/>${axisTitle(spec.categoryAxis?.title)}<c:tickLblPos val="nextTo"/><c:crossAx val="1002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx>`;
  return catAx + valAx(1002, 1001, valPos, spec.valueAxis?.title, valFormat);
}

function plotXml(spec, kind, grid) {
  const axIds = '<c:axId val="1001"/><c:axId val="1002"/>';
  const dateFormat = dateFormatOf(spec);
  switch (kind.tag) {
    case 'barChart': {
      const overlap = kind.grouping === 'stacked' ? 100 : (spec.overlap ?? 0);
      return `<c:barChart><c:barDir val="${kind.barDir}"/><c:grouping val="${kind.grouping}"/><c:varyColors val="0"/>${categorySeriesXml(grid, kind, dateFormat)}<c:gapWidth val="${spec.gapWidth ?? 150}"/><c:overlap val="${overlap}"/>${axIds}</c:barChart>`;
    }
    case 'lineChart':
      return `<c:lineChart><c:grouping val="${kind.grouping}"/><c:varyColors val="0"/>${categorySeriesXml(grid, kind, dateFormat)}<c:marker val="1"/>${axIds}</c:lineChart>`;
    case 'areaChart':
      return `<c:areaChart><c:grouping val="${kind.grouping}"/><c:varyColors val="0"/>${categorySeriesXml(grid, kind, dateFormat)}${axIds}</c:areaChart>`;
    case 'pieChart':
      return `<c:pieChart><c:varyColors val="1"/>${categorySeriesXml(grid, kind, dateFormat)}<c:firstSliceAng val="0"/></c:pieChart>`;
    case 'doughnutChart':
      return `<c:doughnutChart><c:varyColors val="1"/>${categorySeriesXml(grid, kind, dateFormat)}<c:firstSliceAng val="0"/><c:holeSize val="${spec.doughnutHoleSize ?? 50}"/></c:doughnutChart>`;
    default:
      return `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${scatterSeriesXml(grid, spec, kind)}${axIds}</c:scatterChart>`;
  }
}

function chartXml(spec, kind, grid) {
  const title = spec.title
    ? `<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:t>${escapeXml(spec.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`
    : '<c:autoTitleDeleted val="1"/>';
  const hasAxes = kind.tag !== 'pieChart' && kind.tag !== 'doughnutChart';
  const legend =
    spec.legend?.visible === false
      ? ''
      : `<c:legend><c:legendPos val="${LEGEND_POS[spec.legend?.position] ?? 'r'}"/><c:overlay val="0"/></c:legend>`;
  return (
    `${XML_HEAD}<c:chartSpace xmlns:c="${NS_CHART}" xmlns:a="${NS_DRAW}" xmlns:r="${NS_REL}">` +
    `<c:roundedCorners val="0"/><c:chart>${title}<c:plotArea><c:layout/>${plotXml(spec, kind, grid)}` +
    `${hasAxes ? axesXml(spec, kind, grid) : ''}</c:plotArea>${legend}<c:plotVisOnly val="1"/></c:chart></c:chartSpace>`
  );
}

/** Anchor the chart to the right of the data, sized from Flint's points (≈ 64 pt columns, 20 pt rows). */
function drawingXml(spec, dataWidth) {
  const fromCol = dataWidth + 1;
  const toCol = fromCol + Math.max(6, Math.round((spec.width ?? 480) / 64));
  const toRow = 1 + Math.max(16, Math.round((spec.height ?? 320) / 20));
  const point = (col, row) =>
    `<xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff>`;
  return (
    `${XML_HEAD}<xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_DRAW}" xmlns:r="${NS_REL}" xmlns:c="${NS_CHART}">` +
    `<xdr:twoCellAnchor><xdr:from>${point(fromCol, 1)}</xdr:from><xdr:to>${point(toCol, toRow)}</xdr:to>` +
    `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Chart 1"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
    `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${NS_CHART}">` +
    `<c:chart r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`
  );
}

// ─────────────────────────────── package ───────────────────────────────

const rels = (entries) =>
  `${XML_HEAD}<Relationships xmlns="${NS_PKG_REL}">${entries
    .map(([id, type, target]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`)
    .join('')}</Relationships>`;

function contentTypesXml(withChart) {
  const chartParts = withChart
    ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' +
      '<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>'
    : '';
  return (
    `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    `${chartParts}</Types>`
  );
}

/** Style 0 is General; style 1 ({@link DATE_STYLE_INDEX}) shows the date column in Flint's format. */
const stylesXml = (dateFormat) =>
  `${XML_HEAD}<styleSheet xmlns="${NS_MAIN}">` +
  `<numFmts count="1"><numFmt numFmtId="${DATE_NUMFMT_ID}" formatCode="${escapeXml(dateFormat || 'yyyy-mm-dd')}"/></numFmts><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>` +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  `<xf numFmtId="${DATE_NUMFMT_ID}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`;

/**
 * @param {{ chartType: string, data: Array<Array<string|number|null>>, seriesBy?: string, title?: string } & Record<string, any>} spec
 *   a Flint `ExcelNativeChartSpec`
 * @returns {{ bytes: Uint8Array, chartIncluded: boolean }}
 */
export function buildChartWorkbook(spec) {
  const grid = columnSeriesGrid(spec);
  if (grid.length < 2 || (grid[0]?.length ?? 0) < 2) {
    throw new Error('Excel export needs a header row and at least one data row.');
  }
  const kind = CHART_KINDS[spec.chartType];
  const withChart = Boolean(kind);
  const files = {
    '[Content_Types].xml': contentTypesXml(withChart),
    '_rels/.rels': rels([['rId1', `${REL_TYPE}/officeDocument`, 'xl/workbook.xml']]),
    'xl/workbook.xml': `${XML_HEAD}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets><sheet name="${SHEET_NAME}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': rels([
      ['rId1', `${REL_TYPE}/worksheet`, 'worksheets/sheet1.xml'],
      ['rId2', `${REL_TYPE}/styles`, 'styles.xml']
    ]),
    'xl/styles.xml': stylesXml(dateFormatOf(spec)),
    'xl/worksheets/sheet1.xml': sheetXml(grid, withChart, Boolean(dateFormatOf(spec)))
  };
  if (withChart) {
    files['xl/worksheets/_rels/sheet1.xml.rels'] = rels([
      ['rId1', `${REL_TYPE}/drawing`, '../drawings/drawing1.xml']
    ]);
    files['xl/drawings/drawing1.xml'] = drawingXml(spec, grid[0].length);
    files['xl/drawings/_rels/drawing1.xml.rels'] = rels([
      ['rId1', `${REL_TYPE}/chart`, '../charts/chart1.xml']
    ]);
    files['xl/charts/chart1.xml'] = chartXml(spec, kind, grid);
  }
  const zipped = zipSync(
    Object.fromEntries(Object.entries(files).map(([name, xml]) => [name, strToU8(xml)]))
  );
  return { bytes: zipped, chartIncluded: withChart };
}
