// @vitest-environment jsdom
/**
 * Where the person in the chair points.
 *
 * These are the resolution rules the whole gesture rests on: the server only
 * ever sends back an id it was given, and this is what decides whether that id
 * becomes a hand over a real node or nothing at all. A wrong answer here is not
 * a missing animation — it is a finger pointing at empty canvas.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  OFFICE_POINTED_CLASS,
  pointHandAnchor,
  pointSearchRoot,
  pointTargetRect,
  resolvePointTarget
} from '../src/utils/officePairPointing.js';

/** A Mermaid flowchart as the canvas actually renders it: `flowchart-<id>-<n>`. */
const SVG = `
  <div class="diagram-viewport">
    <div class="diagram-zoom-layer">
      <svg>
        <g class="node" id="flowchart-Auth-0"><rect></rect><text>Auth</text></g>
        <g class="node" id="flowchart-Billing-1"><rect></rect><text>Billing</text></g>
      </svg>
    </div>
  </div>`;

/** jsdom reports every rect as zero, which the pointer reads as "not rendered". */
function stubRect(el, rect) {
  el.getBoundingClientRect = () => ({
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    width: rect.width,
    height: rect.height,
    x: rect.left,
    y: rect.top
  });
}

describe('officePairPointing', () => {
  beforeEach(() => {
    document.body.innerHTML = SVG;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('names the ring class the canvas applies, so the two cannot drift', () => {
    expect(OFFICE_POINTED_CLASS).toBe('is-office-pointed');
  });

  it('searches the zoom layer when handed nothing', () => {
    const root = pointSearchRoot(null);
    expect(root?.classList?.contains('diagram-zoom-layer')).toBe(true);
    // An explicit root wins — the office layer may hand down a host it already has.
    const scoped = document.querySelector('svg');
    expect(pointSearchRoot(scoped)).toBe(scoped);
  });

  it('resolves the id Mermaid wrote into the DOM', () => {
    const target = resolvePointTarget(null, 'flowchart-Billing-1');
    expect(target).not.toBeNull();
    expect(target?.classList.contains('node')).toBe(true);
    expect(target?.id).toBe('flowchart-Billing-1');
  });

  it('resolves a logical id, because that is the other form the label walk can return', () => {
    const target = resolvePointTarget(null, 'Auth');
    expect(target?.id).toBe('flowchart-Auth-0');
  });

  it('returns null for an id that is not on screen', () => {
    expect(resolvePointTarget(null, 'flowchart-Ghost-9')).toBeNull();
    expect(resolvePointTarget(null, '')).toBeNull();
    expect(resolvePointTarget(null, null)).toBeNull();
  });

  it('measures the target, and refuses an unrendered one', () => {
    const node = document.querySelector('#flowchart-Auth-0');
    // Unstubbed: jsdom's zero rect. Nothing to point at, so no hand.
    expect(pointTargetRect(null, 'flowchart-Auth-0')).toBeNull();

    stubRect(node, { left: 120, top: 80, width: 96, height: 40 });
    expect(pointTargetRect(null, 'flowchart-Auth-0')).toEqual({
      left: 120,
      top: 80,
      width: 96,
      height: 40
    });
    expect(pointTargetRect(null, 'flowchart-Ghost-9')).toBeNull();
  });

  it('anchors the hand at the corner a finger arrives from', () => {
    const anchor = pointHandAnchor({ left: 120, top: 80, width: 96, height: 40 });
    // Inside the node, towards its top-right — not centred on it, which would
    // cover the label the line is talking about.
    expect(anchor.x).toBeGreaterThan(120 + 48);
    expect(anchor.x).toBeLessThan(120 + 96);
    expect(anchor.y).toBeGreaterThan(80);
    expect(anchor.y).toBeLessThan(80 + 20);
  });
});
