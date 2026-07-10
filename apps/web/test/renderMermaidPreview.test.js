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
});
