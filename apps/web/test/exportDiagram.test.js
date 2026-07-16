import { describe, expect, it, vi } from 'vitest';
import {
  buildExportPayload,
  chartDataValues,
  listExportFormats,
  prettyJsonOrRaw,
  rowsToCsv,
  triggerBrowserDownload
} from '../src/utils/exportDiagram.js';

const CHART_SOURCE = JSON.stringify({
  archislopVersion: 1,
  theme: 'whiteboard',
  spec: {
    mark: 'bar',
    data: {
      values: [
        { category: 'A', value: 1 },
        { category: 'B, "quoted"', value: 2 }
      ]
    }
  }
});

describe('listExportFormats', () => {
  it('returns mode-specific formats', () => {
    expect(listExportFormats('mermaid', 'flowchart TD\nA-->B').map((f) => f.id)).toEqual([
      'mermaid-source',
      'mermaid-svg'
    ]);
    expect(listExportFormats('anything', '<!DOCTYPE html><html></html>').map((f) => f.id)).toEqual([
      'anything-html'
    ]);
  });

  it('hides chart CSV when there is no tabular data.values', () => {
    const noData = JSON.stringify({
      archislopVersion: 1,
      theme: 'noir',
      spec: { mark: 'bar', data: { url: 'https://example.com/data.json' } }
    });
    expect(listExportFormats('chart', noData).map((f) => f.id)).toEqual([
      'chart-json',
      'chart-vl'
    ]);
    expect(listExportFormats('chart', CHART_SOURCE).map((f) => f.id)).toEqual([
      'chart-csv',
      'chart-json',
      'chart-vl'
    ]);
  });

  it('returns empty for unknown or empty modes', () => {
    expect(listExportFormats('auto', 'x')).toEqual([]);
    expect(listExportFormats(null, 'x')).toEqual([]);
  });
});

describe('chart CSV helpers', () => {
  it('extracts tabular values', () => {
    expect(chartDataValues(CHART_SOURCE)).toEqual([
      { category: 'A', value: 1 },
      { category: 'B, "quoted"', value: 2 }
    ]);
  });

  it('escapes CSV cells', () => {
    expect(rowsToCsv(chartDataValues(CHART_SOURCE))).toBe(
      'category,value\nA,1\n"B, ""quoted""",2\n'
    );
  });
});

describe('buildExportPayload', () => {
  it('builds chart CSV and Vega-Lite payloads', async () => {
    const csv = await buildExportPayload({
      contentType: 'chart',
      diagramSource: CHART_SOURCE,
      formatId: 'chart-csv'
    });
    expect(csv.ext).toBe('csv');
    expect(csv.body).toContain('category,value');
    expect(csv.filename).toMatch(/^archislop-chart-\d{8}-\d{6}\.csv$/);

    const vl = await buildExportPayload({
      contentType: 'chart',
      diagramSource: CHART_SOURCE,
      formatId: 'chart-vl'
    });
    expect(vl.ext).toBe('vl.json');
    expect(JSON.parse(vl.body).mark).toBe('bar');
    expect(JSON.parse(vl.body).archislopVersion).toBeUndefined();
  });

  it('pretty-prints metaphor JSON', async () => {
    const source = '{"metaphor":"city","scene":{"title":"T"},"items":[],"links":[]}';
    const payload = await buildExportPayload({
      contentType: 'metaphor3d',
      diagramSource: source,
      formatId: 'metaphor-json'
    });
    expect(payload.body).toBe(prettyJsonOrRaw(source));
  });

  it('rejects empty source', async () => {
    await expect(
      buildExportPayload({ contentType: 'forms', diagramSource: '  ', formatId: 'forms-json' })
    ).rejects.toThrow(/Nothing to export/);
  });
});

describe('triggerBrowserDownload', () => {
  it('creates an object URL and clicks a temporary anchor', () => {
    const clicks = [];
    const revoked = [];
    const created = [];
    const fakeAnchor = {
      href: '',
      download: '',
      rel: '',
      click() {
        clicks.push({ href: this.href, download: this.download });
      },
      remove: vi.fn()
    };
    const fakeDoc = {
      createElement: vi.fn(() => fakeAnchor),
      body: { appendChild: vi.fn() }
    };

    triggerBrowserDownload(
      { body: 'hello', mime: 'text/plain', filename: 'x.txt' },
      {
        createObjectURL: (blob) => {
          created.push(blob);
          return 'blob:mock';
        },
        revokeObjectURL: (url) => revoked.push(url),
        document: fakeDoc
      }
    );

    expect(created).toHaveLength(1);
    expect(fakeDoc.body.appendChild).toHaveBeenCalledWith(fakeAnchor);
    expect(clicks).toEqual([{ href: 'blob:mock', download: 'x.txt' }]);
    expect(fakeAnchor.remove).toHaveBeenCalled();
  });
});
