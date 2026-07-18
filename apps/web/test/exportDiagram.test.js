// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  buildExportPayload,
  chartDataValues,
  copyExportPayload,
  deliverExportPayload,
  exportPayloadToBlob,
  isExportUserAbortError,
  isPreviewableExportPayload,
  listExportFormats,
  prettyJsonOrRaw,
  readSvgDimensions,
  rowsToCsv,
  shareExportPayload,
  startWebShare,
  resolveWebShareMode,
  getShareFormatId,
  exportFormatSharePreview,
  isShareUserGestureError,
  isSharePermissionError,
  isVisualExportPayload,
  normalizeSvgMarkupForExport,
  MERMAID_EXPORT_MAX_WIDTH_PX,
  triggerBrowserDownload
} from '../src/utils/exportDiagram.js';
import {
  registerMetaphorGltfExporter,
  unregisterMetaphorGltfExporter
} from '../src/utils/metaphorGltfExport.js';

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
      'mermaid-png',
      'mermaid-svg'
    ]);
    expect(listExportFormats('anything', '<!DOCTYPE html><html></html>').map((f) => f.id)).toEqual([
      'anything-html'
    ]);
    expect(listExportFormats('metaphor3d', '{"metaphor":"city"}').map((f) => f.id)).toEqual([
      'metaphor-json',
      'metaphor-gltf'
    ]);
  });

  it('hides chart CSV when there is no tabular data.values', () => {
    const noData = JSON.stringify({
      archislopVersion: 1,
      theme: 'noir',
      spec: { mark: 'bar', data: { url: 'https://example.com/data.json' } }
    });
    expect(listExportFormats('chart', noData).map((f) => f.id)).toEqual(['chart-json', 'chart-vl']);
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

  it('builds metaphor glTF from the registered live-scene exporter', async () => {
    const glb = new Blob([new Uint8Array([0x67, 0x6c, 0x54, 0x46])], {
      type: 'model/gltf-binary'
    });
    const exporter = async () => glb;
    registerMetaphorGltfExporter(exporter);
    try {
      const payload = await buildExportPayload({
        contentType: 'metaphor3d',
        diagramSource: '{"metaphor":"city","items":[],"links":[]}',
        formatId: 'metaphor-gltf'
      });
      expect(payload.ext).toBe('glb');
      expect(payload.mime).toBe('model/gltf-binary');
      expect(payload.delivery).toBe('file');
      expect(payload.blob).toBe(glb);
      expect(payload.filename).toMatch(/^archislop-metaphor3d-\d{8}-\d{6}\.glb$/);
    } finally {
      unregisterMetaphorGltfExporter(exporter);
    }
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
      {
        body: 'hello',
        mime: 'text/plain',
        filename: 'x.txt',
        ext: 'txt',
        delivery: 'text'
      },
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

describe('readSvgDimensions', () => {
  it('reads width and height from svg attributes', () => {
    expect(readSvgDimensions('<svg width="120" height="80" viewBox="0 0 120 80"></svg>')).toEqual({
      width: 120,
      height: 80
    });
  });

  it('ignores percentage widths and uses viewBox instead', () => {
    expect(
      readSvgDimensions('<svg width="100%" height="100%" viewBox="0 0 320 160"></svg>')
    ).toEqual({
      width: 320,
      height: 160
    });
  });
});

describe('normalizeSvgMarkupForExport', () => {
  it('caps oversized mermaid svg width for export', () => {
    const wide = `<svg viewBox="0 0 3200 400" width="3200" height="400"><rect width="10"/></svg>`;
    const out = normalizeSvgMarkupForExport(wide, { maxWidth: MERMAID_EXPORT_MAX_WIDTH_PX });
    expect(out).toContain(`width="${MERMAID_EXPORT_MAX_WIDTH_PX}"`);
    expect(out).toContain('height="200"');
  });
});

describe('deliverExportPayload', () => {
  it('returns a preview URL for text exports', async () => {
    const payload = {
      filename: 'archislop-mermaid.txt',
      mime: 'text/plain;charset=utf-8',
      ext: 'txt',
      delivery: 'text',
      body: 'flowchart TD\nA-->B\n'
    };
    const createObjectURL = vi.fn(() => 'blob:preview');
    const result = await deliverExportPayload(payload, 'download', {
      createObjectURL,
      revokeObjectURL: vi.fn(),
      document: {
        createElement: () => ({ click: vi.fn(), remove: vi.fn() }),
        body: { appendChild: vi.fn() }
      }
    });
    expect(result.method).toBe('download');
    expect(result.previewUrl).toBe('blob:preview');
    expect(isPreviewableExportPayload(payload)).toBe(true);
    expect(exportPayloadToBlob(payload).type).toContain('text/plain');
  });
});

describe('copyExportPayload', () => {
  it('falls back to execCommand when clipboard.writeText is denied', async () => {
    const writeText = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    const execCommand = vi.fn(() => true);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand
    });

    const method = await copyExportPayload({
      filename: 'x.txt',
      mime: 'text/plain',
      ext: 'txt',
      delivery: 'text',
      body: 'hello'
    });

    expect(method).toBe('clipboard-text');
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('falls back to Web Share when clipboard copy is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => false)
    });
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: share
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: () => true
    });

    const method = await copyExportPayload({
      filename: 'x.txt',
      mime: 'text/plain',
      ext: 'txt',
      delivery: 'text',
      body: 'hello'
    });

    expect(method).toBe('share-text');
    expect(share).toHaveBeenCalledWith({ text: 'hello', title: 'x.txt' });
  });
});

describe('shareExportPayload', () => {
  it('treats AbortError as user cancellation', async () => {
    const share = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: share
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: () => true
    });

    await expect(
      shareExportPayload({
        filename: 'x.txt',
        mime: 'text/plain',
        ext: 'txt',
        delivery: 'text',
        body: 'hello'
      })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(
      isExportUserAbortError(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    ).toBe(true);
  });
});

describe('getShareFormatId', () => {
  it('maps mermaid SVG share to the PNG raster format', () => {
    expect(getShareFormatId('mermaid-svg', 'mermaid')).toBe('mermaid-png');
    expect(getShareFormatId('mermaid-png', 'mermaid')).toBe('mermaid-png');
    expect(getShareFormatId('chart-csv', 'chart')).toBe('chart-csv');
  });

  it('builds a PNG placeholder for SVG share capability checks', () => {
    const preview = exportFormatSharePreview('mermaid-svg', 'mermaid');
    expect(preview.delivery).toBe('image');
    expect(preview.mime).toContain('image/png');
  });
});

describe('resolveWebShareMode', () => {
  it('prefers file share for PNG and other visual payloads', () => {
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: () => true
    });

    expect(
      resolveWebShareMode({
        filename: 'diagram.png',
        mime: 'image/png',
        ext: 'png',
        delivery: 'image',
        blob: new Blob(['x'], { type: 'image/png' })
      })
    ).toBe('file');
  });

  it('prefers file share for HTML, JSON, and glTF when file share is supported', () => {
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: () => true
    });

    expect(
      resolveWebShareMode({
        filename: 'page.html',
        mime: 'text/html;charset=utf-8',
        ext: 'html',
        delivery: 'text',
        body: '<!DOCTYPE html><html></html>'
      })
    ).toBe('file');

    expect(
      resolveWebShareMode({
        filename: 'scene.json',
        mime: 'application/json;charset=utf-8',
        ext: 'json',
        delivery: 'text',
        body: '{}'
      })
    ).toBe('file');

    expect(
      resolveWebShareMode({
        filename: 'scene.glb',
        mime: 'model/gltf-binary',
        ext: 'glb',
        delivery: 'file',
        blob: new Blob(['x'], { type: 'model/gltf-binary' })
      })
    ).toBe('file');
  });

  it('falls back to text share when file share is unavailable', () => {
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (data) => Boolean(data.text) && !data.files
    });

    expect(
      resolveWebShareMode({
        filename: 'diagram.mmd',
        mime: 'text/plain;charset=utf-8',
        ext: 'mmd',
        delivery: 'text',
        body: 'flowchart TD\nA-->B'
      })
    ).toBe('text');
  });

  it('uses file share for image delivery when text is unavailable', () => {
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (data) => Boolean(data.files)
    });

    expect(
      resolveWebShareMode({
        filename: 'diagram.png',
        mime: 'image/png',
        ext: 'png',
        delivery: 'image',
        blob: new Blob(['x'], { type: 'image/png' })
      })
    ).toBe('file');
  });
});

describe('isVisualExportPayload', () => {
  it('detects image mime and image delivery', () => {
    expect(
      isVisualExportPayload({
        filename: 'x.svg',
        mime: 'image/svg+xml',
        ext: 'svg',
        delivery: 'text',
        body: '<svg/>'
      })
    ).toBe(true);
    expect(
      isVisualExportPayload({
        filename: 'x.png',
        mime: 'image/png',
        ext: 'png',
        delivery: 'image',
        blob: new Blob()
      })
    ).toBe(true);
    expect(
      isVisualExportPayload({
        filename: 'x.mmd',
        mime: 'text/plain',
        ext: 'mmd',
        delivery: 'text',
        body: 'flowchart TD'
      })
    ).toBe(false);
  });
});

describe('startWebShare', () => {
  it('invokes navigator.share synchronously and returns share-file for PNG payloads', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: share
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: () => true
    });

    const method = await startWebShare({
      filename: 'diagram.png',
      mime: 'image/png',
      ext: 'png',
      delivery: 'image',
      blob: new Blob(['x'], { type: 'image/png' })
    });

    expect(method).toBe('share-file');
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        files: expect.arrayContaining([expect.any(File)]),
        title: 'diagram.png'
      })
    );
  });

  it('invokes navigator.share synchronously and returns share-text for plain text', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: share
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (data) => Boolean(data.text) && !data.files
    });

    const method = await startWebShare({
      filename: 'x.txt',
      mime: 'text/plain',
      ext: 'txt',
      delivery: 'text',
      body: 'hello'
    });

    expect(method).toBe('share-text');
    expect(share).toHaveBeenCalledWith({ text: 'hello', title: 'x.txt' });
  });

  it('shares anything HTML as a file attachment when file share is supported', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: share
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: () => true
    });

    const method = await startWebShare({
      filename: 'page.html',
      mime: 'text/html;charset=utf-8',
      ext: 'html',
      delivery: 'text',
      body: '<!DOCTYPE html><html><body>hi</body></html>\n'
    });

    expect(method).toBe('share-file');
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        files: expect.arrayContaining([expect.any(File)]),
        title: 'page.html'
      })
    );
  });

  it('does not retry text share after an async file-share rejection', async () => {
    const share = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('file share failed'), { name: 'NotSupportedError' })
      )
      .mockResolvedValueOnce(undefined);
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: share
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (data) => Boolean(data.files)
    });

    await expect(
      startWebShare({
        filename: 'diagram.png',
        mime: 'image/png',
        ext: 'png',
        delivery: 'image',
        blob: new Blob(['x'], { type: 'image/png' })
      })
    ).rejects.toThrow('file share failed');
    expect(share).toHaveBeenCalledTimes(1);
  });
});

describe('isShareUserGestureError', () => {
  it('detects Web Share user-gesture NotAllowedError', () => {
    const err = Object.assign(
      new Error(
        "Failed to execute 'share' on 'Navigator': Must be handling a user gesture to perform a share request."
      ),
      {
        name: 'NotAllowedError'
      }
    );
    expect(isShareUserGestureError(err)).toBe(true);
    expect(isSharePermissionError(err)).toBe(false);
    expect(isShareUserGestureError(new Error('nope'))).toBe(false);
  });

  it('detects permission-denied share failures', () => {
    const err = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
    expect(isSharePermissionError(err)).toBe(true);
  });
});
