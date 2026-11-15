// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ARCHISLOP_MERMAID_CANVAS_INIT } from '../src/utils/mermaidRenderInit.js';
import { renderMermaidSvg } from '../src/utils/renderMermaidPreview.js';

const SOURCE = `%%{init: {"theme":"base","look":"neo","themeVariables":{"lineColor":"#4b4b4b"},"flowchart":{"curve":"rounded"}}}%%
flowchart TD
  GZ["Guizhou Province"]
  GZ --> GEO["Geography"]
  classDef root fill:#d7ffb8,stroke:#58cc02,stroke-width:2px,color:#3c3c3c
  class GZ root`;

describe('mermaid classDef container collision', () => {
  const elProto = window.SVGElement ? window.SVGElement.prototype : window.Element.prototype;
  if (!elProto.getBBox) {
    elProto.getBBox = function getBBox() {
      const text = this.textContent ?? '';
      return { x: 0, y: 0, width: Math.max(8, text.length * 8), height: 14 };
    };
  }
  if (!elProto.getComputedTextLength) {
    elProto.getComputedTextLength = function () {
      return (this.textContent ?? '').length * 8;
    };
  }

  it('scopes classDef root styles to g.node so edges keep fill none', async () => {
    const { svg } = await renderMermaidSvg(
      'diagram-collision',
      SOURCE,
      ARCHISLOP_MERMAID_CANVAS_INIT
    );
    expect(svg).toMatch(/g\.node\.root path\{fill:rgb\(215, 255, 184\)/);
    expect(svg).not.toMatch(/#diagram-collision \.root path\{fill:rgb\(215, 255, 184\)/);
  });
});
