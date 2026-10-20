// @vitest-environment jsdom
/**
 * The canvas half of a point: ring the node, and move the camera only when it
 * has to.
 *
 * The ring and the camera are the two things that can go wrong in a way the
 * user sees but no unit test of the geometry would catch — a ring on the wrong
 * node, or a camera that yanks the diagram every time somebody says a word.
 */

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDiagramPointFocus } from '../src/features/canvas/useDiagramPointFocus.js';
import { OFFICE_POINTED_CLASS } from '../src/utils/officePairPointing.js';

const CHANGE_ADDED = 'is-diagram-change-added';

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

/**
 * A viewport with two nodes: one on screen, one far off it. The on-screen one
 * also carries a change-highlight class, because a diff and a point can be true
 * of the same node at once and neither may clear the other.
 *
 * @param {{ onScreenRect?: object, offScreenRect?: object }} [rects]
 */
function buildViewport(rects = {}) {
  const viewport = document.createElement('div');
  viewport.className = 'diagram-viewport';
  viewport.style.width = '400px';
  viewport.style.height = '300px';
  document.body.appendChild(viewport);

  const layer = document.createElement('div');
  layer.className = 'diagram-zoom-layer';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

  const makeNode = (id, rect, { changed = false } = {}) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    node.setAttribute('class', 'node');
    node.setAttribute('id', id);
    if (changed) node.classList.add(CHANGE_ADDED);
    const shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    shape.setAttribute('width', '80');
    shape.setAttribute('height', '40');
    node.appendChild(shape);
    node.getBBox = () => ({ x: 10, y: 10, width: 80, height: 40 });
    node.getBoundingClientRect = () => rect;
    svg.appendChild(node);
    return node;
  };

  const onScreen = makeNode('flowchart-Auth-0', rects.onScreenRect ?? box(120, 90, 80, 40), {
    changed: true
  });
  const offScreen = makeNode('flowchart-Billing-1', rects.offScreenRect ?? box(900, 900, 80, 40));

  layer.appendChild(svg);
  viewport.appendChild(layer);
  viewport.getBoundingClientRect = () => box(0, 0, 400, 300);
  return { viewport, onScreen, offScreen };
}

function renderFocus({ viewport, pointFocus, contentType = 'mermaid' }) {
  const setViewport = vi.fn();
  const viewportRef = { current: viewport };
  const hook = renderHook(
    ({ focus }) =>
      useDiagramPointFocus({
        viewportRef,
        setViewport,
        contentType,
        svgMarkup: '<svg></svg>',
        pointFocus: focus
      }),
    { initialProps: { focus: pointFocus } }
  );
  return { setViewport, rerenderWith: (focus) => hook.rerender({ focus }) };
}

describe('useDiagramPointFocus', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('rings the node that was pointed at, and leaves the others alone', () => {
    const { viewport, onScreen, offScreen } = buildViewport();
    renderFocus({ viewport, pointFocus: { ids: ['flowchart-Auth-0'], seq: 1 } });

    expect(onScreen.classList.contains(OFFICE_POINTED_CLASS)).toBe(true);
    expect(offScreen.classList.contains(OFFICE_POINTED_CLASS)).toBe(false);
  });

  it('keeps a diff highlight that was already on the same node', () => {
    const { viewport, onScreen } = buildViewport();
    renderFocus({ viewport, pointFocus: { ids: ['flowchart-Auth-0'], seq: 1 } });

    // Both are true at once — "this changed" and "look here" — and the point
    // applier only ever removes classes it was given.
    expect(onScreen.classList.contains(CHANGE_ADDED)).toBe(true);
    expect(onScreen.classList.contains(OFFICE_POINTED_CLASS)).toBe(true);
  });

  it('clears the ring when the point goes away', () => {
    const { viewport, onScreen } = buildViewport();
    const { rerenderWith } = renderFocus({
      viewport,
      pointFocus: { ids: ['flowchart-Auth-0'], seq: 1 }
    });
    expect(onScreen.classList.contains(OFFICE_POINTED_CLASS)).toBe(true);

    rerenderWith(null);
    // The hand leaves when the line does; a ring that outstayed its remark would
    // be pointing at a box nobody is talking about.
    expect(onScreen.classList.contains(OFFICE_POINTED_CLASS)).toBe(false);
    expect(onScreen.classList.contains(CHANGE_ADDED)).toBe(true);
  });

  it('does not move the camera for a node you can already see', () => {
    const { viewport } = buildViewport();
    const { setViewport } = renderFocus({
      viewport,
      pointFocus: { ids: ['flowchart-Auth-0'], seq: 1 }
    });
    expect(setViewport).not.toHaveBeenCalled();
  });

  it('moves the camera only for a node that is off screen', () => {
    const { viewport } = buildViewport();
    const { setViewport } = renderFocus({
      viewport,
      pointFocus: { ids: ['flowchart-Billing-1'], seq: 1 }
    });
    expect(setViewport).toHaveBeenCalledTimes(1);
    const next = setViewport.mock.calls[0][0];
    expect(Number.isFinite(next.x)).toBe(true);
    expect(Number.isFinite(next.y)).toBe(true);
    expect(next.scale).toBeGreaterThan(0);
  });

  it('does nothing at all on a content type whose ids cannot be resolved', () => {
    const { viewport, offScreen } = buildViewport();
    const { setViewport } = renderFocus({
      viewport,
      pointFocus: { ids: ['flowchart-Billing-1'], seq: 1 },
      contentType: 'chart'
    });
    expect(setViewport).not.toHaveBeenCalled();
    expect(offScreen.classList.contains(OFFICE_POINTED_CLASS)).toBe(false);
  });

  it('does nothing when nobody is pointing', () => {
    const { viewport, onScreen, offScreen } = buildViewport();
    const { setViewport } = renderFocus({ viewport, pointFocus: null });
    expect(setViewport).not.toHaveBeenCalled();
    expect(onScreen.classList.contains(OFFICE_POINTED_CLASS)).toBe(false);
    expect(offScreen.classList.contains(OFFICE_POINTED_CLASS)).toBe(false);
  });
});
