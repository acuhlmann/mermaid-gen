// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  applyEmbeddedDiagramFocus,
  collectHighlightedSvgElements,
  computeFocusedViewBox,
  resetEmbeddedDiagramFocus
} from '../src/utils/embeddedDiagramFocus.js';

function parseViewBox(viewBox) {
  const [x, y, w, h] = viewBox.split(/\s+/).map(Number);
  return { x, y, width: w, height: h };
}

function makeMermaidHost({ nodeBBox, viewBox = '0 0 400 200' }) {
  const host = document.createElement('div');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', viewBox);
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  node.setAttribute('class', 'node');
  node.setAttribute('id', 'flowchart-A-0');
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', String(nodeBBox.x));
  rect.setAttribute('y', String(nodeBBox.y));
  rect.setAttribute('width', String(nodeBBox.width));
  rect.setAttribute('height', String(nodeBBox.height));
  node.appendChild(rect);
  node.getBBox = () => ({ ...nodeBBox });
  svg.appendChild(node);
  host.appendChild(svg);
  document.body.appendChild(host);
  return { host, svg, node };
}

describe('embeddedDiagramFocus', () => {
  it('computeFocusedViewBox adds padding around the bbox', () => {
    const focused = parseViewBox(computeFocusedViewBox({ x: 100, y: 50, width: 80, height: 40 }));
    expect(focused.x).toBeLessThan(100);
    expect(focused.y).toBeLessThan(50);
    expect(focused.x + focused.width).toBeGreaterThan(180);
    expect(focused.y + focused.height).toBeGreaterThan(90);
  });

  it('collectHighlightedSvgElements finds mermaid nodes by highlight ids', () => {
    const { host } = makeMermaidHost({ nodeBBox: { x: 10, y: 10, width: 40, height: 20 } });
    const els = collectHighlightedSvgElements(host, { addedIds: ['A'], modifiedIds: [] }, 'mermaid');
    expect(els.length).toBe(1);
    host.remove();
  });

  it('applyEmbeddedDiagramFocus crops mermaid viewBox to highlighted nodes', () => {
    const { host, svg } = makeMermaidHost({
      nodeBBox: { x: 120, y: 60, width: 90, height: 50 },
      viewBox: '0 0 400 200'
    });
    applyEmbeddedDiagramFocus(host, { addedIds: ['A'], modifiedIds: [] }, 'mermaid');

    const focused = parseViewBox(svg.getAttribute('viewBox'));
    expect(focused.width).toBeLessThan(400);
    expect(focused.height).toBeLessThan(200);
    expect(focused.x).toBeGreaterThan(0);
    expect(svg.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
    expect(svg.getAttribute('width')).toBe('100%');
    expect(svg.getAttribute('height')).toBe('100%');
    host.remove();
  });

  it('applyEmbeddedDiagramFocus crops infographic viewBox to diff elements', () => {
    const host = document.createElement('div');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 1000 500');
    const item = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    item.setAttribute('data-indexes', '2');
    item.setAttribute('data-diff-state', 'added');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '700');
    rect.setAttribute('y', '200');
    rect.setAttribute('width', '60');
    rect.setAttribute('height', '40');
    item.appendChild(rect);
    item.getBBox = () => ({ x: 700, y: 200, width: 60, height: 40 });
    svg.appendChild(item);
    host.appendChild(svg);
    document.body.appendChild(host);

    applyEmbeddedDiagramFocus(host, { addedIds: ['2'], modifiedIds: [] }, 'infographic');

    const focused = parseViewBox(svg.getAttribute('viewBox'));
    expect(focused.width).toBeLessThan(1000);
    expect(focused.x).toBeGreaterThan(600);
    host.remove();
  });

  it('falls back to full viewBox when highlight has no matching nodes', () => {
    const { host, svg } = makeMermaidHost({
      nodeBBox: { x: 10, y: 10, width: 40, height: 20 },
      viewBox: '0 0 400 200'
    });
    applyEmbeddedDiagramFocus(host, { addedIds: ['missing'], modifiedIds: [] }, 'mermaid');
    expect(svg.getAttribute('viewBox')).toBe('0 0 400 200');
    host.remove();
  });

  it('resetEmbeddedDiagramFocus restores the stored original viewBox', () => {
    const { host, svg } = makeMermaidHost({
      nodeBBox: { x: 120, y: 60, width: 90, height: 50 },
      viewBox: '0 0 400 200'
    });
    applyEmbeddedDiagramFocus(host, { addedIds: ['A'], modifiedIds: [] }, 'mermaid');
    expect(svg.getAttribute('viewBox')).not.toBe('0 0 400 200');

    resetEmbeddedDiagramFocus(host);
    expect(svg.getAttribute('viewBox')).toBe('0 0 400 200');
    expect(svg.getAttribute('data-embed-original-viewbox')).toBeNull();
    host.remove();
  });
});
