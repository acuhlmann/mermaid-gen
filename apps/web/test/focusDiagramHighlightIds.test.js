// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  computeViewportFocusForChangeHighlight,
  computeViewportFocusForHighlightIds
} from '../src/utils/focusDiagramHighlightIds.js';

describe('computeViewportFocusForHighlightIds', () => {
  it('returns null when no nodes match', () => {
    const viewport = document.createElement('div');
    viewport.className = 'diagram-viewport';
    viewport.style.width = '400px';
    viewport.style.height = '300px';
    document.body.appendChild(viewport);

    const layer = document.createElement('div');
    layer.className = 'diagram-zoom-layer';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '200');
    svg.setAttribute('height', '100');
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    node.setAttribute('class', 'node');
    node.setAttribute('id', 'flowchart-A-0');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '10');
    rect.setAttribute('y', '10');
    rect.setAttribute('width', '40');
    rect.setAttribute('height', '20');
    node.appendChild(rect);
    svg.appendChild(node);
    layer.appendChild(svg);
    viewport.appendChild(layer);

    expect(computeViewportFocusForHighlightIds(viewport, ['missing'])).toBeNull();
    viewport.remove();
  });

  it('returns viewport coords when nodes match', () => {
    const viewport = document.createElement('div');
    viewport.className = 'diagram-viewport';
    viewport.style.width = '400px';
    viewport.style.height = '300px';
    document.body.appendChild(viewport);

    const layer = document.createElement('div');
    layer.className = 'diagram-zoom-layer';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '200');
    svg.setAttribute('height', '100');
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    node.setAttribute('class', 'node');
    node.setAttribute('id', 'flowchart-A-0');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '10');
    rect.setAttribute('y', '10');
    rect.setAttribute('width', '80');
    rect.setAttribute('height', '40');
    node.appendChild(rect);
    node.getBBox = () => ({ x: 10, y: 10, width: 80, height: 40 });
    svg.appendChild(node);
    layer.appendChild(svg);
    viewport.appendChild(layer);

    const result = computeViewportFocusForHighlightIds(viewport, ['flowchart-A-0']);
    expect(result).not.toBeNull();
    expect(result.scale).toBeGreaterThan(0);
    expect(Number.isFinite(result.x)).toBe(true);
    expect(Number.isFinite(result.y)).toBe(true);
    viewport.remove();
  });
});

describe('computeViewportFocusForChangeHighlight', () => {
  it('fits the full diagram instead of zooming to changed nodes only', () => {
    const viewport = document.createElement('div');
    viewport.className = 'diagram-viewport';
    viewport.style.width = '400px';
    viewport.style.height = '300px';
    viewport.style.padding = '0';
    document.body.appendChild(viewport);

    const layer = document.createElement('div');
    layer.className = 'diagram-zoom-layer';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 400 200');
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    node.setAttribute('class', 'node');
    node.setAttribute('id', 'flowchart-A-0');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '300');
    rect.setAttribute('y', '140');
    rect.setAttribute('width', '40');
    rect.setAttribute('height', '20');
    node.appendChild(rect);
    svg.appendChild(node);
    layer.appendChild(svg);
    viewport.appendChild(layer);

    const result = computeViewportFocusForChangeHighlight(
      viewport,
      { addedIds: ['A'], modifiedIds: [], removedIds: [] },
      'mermaid'
    );
    expect(result).not.toBeNull();
    expect(result.scale).toBeLessThanOrEqual(1);
    expect(Number.isFinite(result.x)).toBe(true);
    expect(Number.isFinite(result.y)).toBe(true);
    viewport.remove();
  });
});
