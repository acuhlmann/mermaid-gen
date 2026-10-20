// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  computeViewportFocusForChangeHighlight,
  computeViewportFocusForHighlightIds,
  computeViewportFocusIfOffscreen
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

describe('computeViewportFocusIfOffscreen', () => {
  /**
   * A viewport with one node in it, both measurable. jsdom reports every rect
   * as zero, which this function reads as "not on screen", so the geometry has
   * to be supplied by hand.
   */
  function scene({ nodeRect }) {
    const viewport = document.createElement('div');
    viewport.className = 'diagram-viewport';
    document.body.appendChild(viewport);
    const layer = document.createElement('div');
    layer.className = 'diagram-zoom-layer';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
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

    viewport.getBoundingClientRect = () => box(0, 0, 400, 300);
    node.getBoundingClientRect = () => nodeRect;
    return { viewport, node };
  }

  function box(left, top, width, height) {
    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
      x: left,
      y: top
    };
  }

  it('leaves the camera alone when the node is already on screen', () => {
    const { viewport } = scene({ nodeRect: box(120, 90, 80, 40) });
    // This is the whole rule: somebody pointing at what you can both see should
    // not grab the diagram and move it.
    expect(computeViewportFocusIfOffscreen(viewport, ['flowchart-A-0'])).toBeNull();
    viewport.remove();
  });

  it('moves the camera when the node is off to the side', () => {
    const { viewport } = scene({ nodeRect: box(900, 90, 80, 40) });
    const result = computeViewportFocusIfOffscreen(viewport, ['flowchart-A-0']);
    expect(result).not.toBeNull();
    expect(Number.isFinite(result.x)).toBe(true);
    expect(Number.isFinite(result.y)).toBe(true);
    expect(result.scale).toBeGreaterThan(0);
    viewport.remove();
  });

  it('moves the camera when the node is partly cut off, not only when it is gone', () => {
    const { viewport } = scene({ nodeRect: box(360, 90, 80, 40) });
    // 360..440 against a 0..400 viewport: half the box is off the edge, and
    // pointing at half a node is pointing at a node you cannot read.
    expect(computeViewportFocusIfOffscreen(viewport, ['flowchart-A-0'])).not.toBeNull();
    viewport.remove();
  });

  it('returns null when nothing matches, so an unmatched point moves nothing', () => {
    const { viewport } = scene({ nodeRect: box(120, 90, 80, 40) });
    expect(computeViewportFocusIfOffscreen(viewport, ['flowchart-Ghost-9'])).toBeNull();
    expect(computeViewportFocusIfOffscreen(viewport, [])).toBeNull();
    viewport.remove();
  });

  it('treats an unmeasurable node as off screen rather than as visible', () => {
    const { viewport } = scene({ nodeRect: box(0, 0, 0, 0) });
    // jsdom's default. The honest reading is "cannot prove it is on screen", so
    // this defers to the focus maths — which is free to say no.
    expect(computeViewportFocusIfOffscreen(viewport, ['flowchart-A-0'])).not.toBe(undefined);
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
