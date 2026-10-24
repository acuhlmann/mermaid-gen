import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { buildChartWorkbook, columnLetter } from '../src/utils/xlsxChartWorkbook.js';

const unzip = (bytes) =>
  Object.fromEntries(
    Object.entries(unzipSync(bytes)).map(([name, data]) => [name, strFromU8(data)])
  );

const COLUMN_SPEC = {
  chartType: 'ColumnClustered',
  title: 'Sales & <profit>',
  seriesBy: 'Columns',
  data: [
    ['region', '2023', '2024'],
    ['North', 1, 96],
    ['South', 95, 13]
  ],
  categoryAxis: { title: 'region' },
  valueAxis: { title: 'sales' },
  legend: { visible: true, position: 'Bottom' }
};

describe('columnLetter', () => {
  it('maps zero-based indexes to spreadsheet columns', () => {
    expect([0, 1, 25, 26, 27, 701, 702].map(columnLetter)).toEqual([
      'A',
      'B',
      'Z',
      'AA',
      'AB',
      'ZZ',
      'AAA'
    ]);
  });
});

describe('buildChartWorkbook', () => {
  it('writes a package whose parts all reference each other', () => {
    const { bytes, chartIncluded } = buildChartWorkbook(COLUMN_SPEC);
    expect(chartIncluded).toBe(true);
    const files = unzip(bytes);
    expect(Object.keys(files).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/charts/chart1.xml',
      'xl/drawings/_rels/drawing1.xml.rels',
      'xl/drawings/drawing1.xml',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/_rels/sheet1.xml.rels',
      'xl/worksheets/sheet1.xml'
    ]);
    expect(files['[Content_Types].xml']).toContain('/xl/charts/chart1.xml');
    expect(files['xl/worksheets/sheet1.xml']).toContain('<drawing r:id="rId1"/>');
    expect(files['xl/drawings/_rels/drawing1.xml.rels']).toContain('../charts/chart1.xml');
  });

  it('binds one coloured series per column to the data sheet', () => {
    const chart = unzip(buildChartWorkbook(COLUMN_SPEC).bytes)['xl/charts/chart1.xml'];
    expect(chart).toContain('<c:barDir val="col"/><c:grouping val="clustered"/>');
    expect(chart.match(/<c:ser>/g)).toHaveLength(2);
    expect(chart).toContain("<c:f>'Data'!$A$2:$A$3</c:f>");
    expect(chart).toContain("<c:f>'Data'!$C$2:$C$3</c:f>");
    expect(chart).toContain('<a:srgbClr val="4C78A8"/>');
    expect(chart).toContain('<a:srgbClr val="F58518"/>');
    expect(chart).toContain('Sales &amp; &lt;profit&gt;');
    expect(chart).toContain('<c:legendPos val="b"/>');
    // Bars start at zero, as on the canvas.
    expect(chart).toContain('<c:min val="0"/>');
  });

  it('writes numbers as numbers and text as inline strings', () => {
    const sheet = unzip(buildChartWorkbook(COLUMN_SPEC).bytes)['xl/worksheets/sheet1.xml'];
    expect(sheet).toContain('<c r="B2"><v>1</v></c>');
    expect(sheet).toContain(
      '<c r="A2" t="inlineStr"><is><t xml:space="preserve">North</t></is></c>'
    );
  });

  it('formats a Flint date axis and its column as dates', () => {
    const files = unzip(
      buildChartWorkbook({
        chartType: 'Line',
        data: [
          ['year', 'North'],
          [44927, 1],
          [45292, 96]
        ],
        categoryAxis: {
          categoryType: 'DateAxis',
          numberFormat: 'yyyy-mm-dd',
          baseTimeUnit: 'Days',
          majorUnit: 5,
          majorTimeUnitScale: 'Months'
        }
      }).bytes
    );
    const chart = files['xl/charts/chart1.xml'];
    expect(chart).toContain('<c:dateAx>');
    expect(chart).toContain('<c:majorUnit val="5"/><c:majorTimeUnit val="months"/>');
    expect(files['xl/styles.xml']).toContain('formatCode="yyyy-mm-dd"');
    expect(files['xl/worksheets/sheet1.xml']).toContain('<c r="A2" s="1"><v>44927</v></c>');
  });

  it('transposes row-wise series and colours each pie slice', () => {
    const chart = unzip(
      buildChartWorkbook({
        chartType: 'Pie',
        seriesBy: 'Rows',
        data: [
          ['region', 'North', 'South', 'East'],
          ['sales', 3, 4, 5]
        ]
      }).bytes
    )['xl/charts/chart1.xml'];
    expect(chart).toContain('<c:pieChart>');
    expect(chart.match(/<c:dPt>/g)).toHaveLength(3);
    expect(chart).toContain("<c:f>'Data'!$A$2:$A$4</c:f>");
    expect(chart).not.toContain('<c:valAx>');
  });

  it('keeps the data but no chart for a type it has no DrawingML for', () => {
    const { bytes, chartIncluded } = buildChartWorkbook({ ...COLUMN_SPEC, chartType: 'Treemap' });
    expect(chartIncluded).toBe(false);
    const files = unzip(bytes);
    expect(files['xl/charts/chart1.xml']).toBeUndefined();
    expect(files['xl/worksheets/sheet1.xml']).not.toContain('<drawing');
    expect(files['[Content_Types].xml']).not.toContain('chart1.xml');
  });

  it('refuses a grid without a data row', () => {
    expect(() => buildChartWorkbook({ ...COLUMN_SPEC, data: [['region', 'sales']] })).toThrow(
      /header row and at least one data row/
    );
  });
});
