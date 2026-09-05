import { describe, expect, it, vi, beforeEach } from 'vitest';

const { initializeMock, renderMock } = vi.hoisted(() => ({
  initializeMock: vi.fn(),
  renderMock: vi.fn()
}));

vi.mock('mermaid', () => ({
  default: {
    initialize: initializeMock,
    render: renderMock
  }
}));

vi.mock('@archislop/shared', () => ({
  prepareMermaidForRender: vi.fn((source) => source),
  sanitizeMermaid: vi.fn((source) => ({
    sanitized: `${source}\n  Z[fixed]`,
    applied: ['mockFix']
  })),
  sanitizeSvgMarkup: vi.fn((svg) => svg)
}));

import { sanitizeMermaid } from '@archislop/shared';
import {
  renderMermaidPreviewSvg,
  MERMAID_PREVIEW_INIT
} from '../src/utils/renderMermaidPreview.js';

describe('renderMermaidPreviewSvg', () => {
  beforeEach(() => {
    initializeMock.mockClear();
    renderMock.mockReset();
    sanitizeMermaid.mockClear();
  });

  it('renders the source as-is on success (no sanitizer)', async () => {
    const source = 'flowchart TD\n  A --> B';
    renderMock.mockResolvedValueOnce({ svg: '<svg id="ok" />' });

    const result = await renderMermaidPreviewSvg('preview-1', source);

    expect(initializeMock).toHaveBeenCalledWith(expect.objectContaining(MERMAID_PREVIEW_INIT));
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(renderMock).toHaveBeenCalledWith('preview-1', source);
    expect(sanitizeMermaid).not.toHaveBeenCalled();
    expect(result.svg).toContain('ok');
    expect(result.sanitizerApplied).toEqual([]);
  });

  it('retries with sanitizeMermaid only after a render failure', async () => {
    const source = 'flowchart TD\n  A["bad"] --> B';
    renderMock
      .mockRejectedValueOnce(new Error('parse error'))
      .mockResolvedValueOnce({ svg: '<svg id="rescued" />' });

    const result = await renderMermaidPreviewSvg('preview-2', source);

    expect(renderMock).toHaveBeenCalledTimes(2);
    expect(renderMock.mock.calls[0][1]).toBe(source);
    expect(renderMock.mock.calls[1][1]).toContain('Z[fixed]');
    expect(sanitizeMermaid).toHaveBeenCalledTimes(1);
    expect(result.sanitizerApplied).toEqual(['mockFix']);
  });

  it('stamps pie wedges with selectable identity on the success path (#523)', async () => {
    // What mermaid actually emits for a pie: bare `path.pieCircle`, no id, no `g.node` ancestor.
    // Stamping here rather than in DiagramCanvas means the canvas, the embedded previews and all
    // six selection/highlight call sites get it from one place.
    const pie = 'pie title Pets\n  "Dogs" : 386\n  "Cats" : 85';
    renderMock.mockResolvedValueOnce({
      svg:
        '<svg><g transform="translate(225,225)"><g>' +
        '<circle class="pieOuterCircle"></circle>' +
        '<path d="M0,-185L0,0Z" class="pieCircle"></path>' +
        '<path d="M-177,-50L0,0Z" class="pieCircle"></path>' +
        '<text class="slice">79%</text><text class="slice">17%</text>' +
        '</g></g></svg>'
    });

    const { svg } = await renderMermaidPreviewSvg('preview-pie', pie);

    expect(svg).toContain('<g class="node" id="diagram-0-node-0"><title>Dogs</title>');
    expect(svg).toContain('<g class="node" id="diagram-0-node-1"><title>Cats</title>');
    expect(svg.match(/class="node"/g)).toHaveLength(2);
  });

  it('stamps on the sanitizer-retry path too, where the DSL handed to mermaid is not the DSL given', async () => {
    // The retry renders `sanitized`, so the labels must be read from the same string mermaid saw.
    // Reading them from the original would index into a source that no longer matches the wedges.
    renderMock.mockRejectedValueOnce(new Error('parse error')).mockResolvedValueOnce({
      svg: '<svg><path d="M0,0Z" class="pieCircle"></path></svg>'
    });

    const { svg, sanitizerApplied } = await renderMermaidPreviewSvg(
      'preview-pie-retry',
      'pie title Pets\n  "Dogs" : 386'
    );

    expect(sanitizerApplied).toEqual(['mockFix']);
    expect(svg).toContain('<g class="node" id="diagram-0-node-0">');
    expect(svg).toContain('</g>');
  });

  it('leaves a non-pie render byte-identical', async () => {
    renderMock.mockResolvedValueOnce({ svg: '<svg><g class="node" id="flowA"><rect/></g></svg>' });
    const { svg } = await renderMermaidPreviewSvg('preview-flow', 'flowchart TD\n  A --> B');
    expect(svg).toBe('<svg><g class="node" id="flowA"><rect/></g></svg>');
  });
});
