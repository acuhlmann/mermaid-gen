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
  beatFocusIds,
  pairReplyAbout,
  pairTopicLabel,
  pointHandPlacement,
  POINT_HAND_SIZE_PX,
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

  // The hand used to sit inside the node's corner, over the label it was
  // pointing at. It now sits beside the box, fingertip just off the edge.
  it('places the hand beside the node, never over it', () => {
    const rect = { left: 300, top: 80, width: 96, height: 40 };
    const hand = pointHandPlacement(rect, { viewportWidth: 1280 });
    expect(hand.side).toBe('left');
    expect(hand.x).toBeLessThan(rect.left);
    expect(hand.x - POINT_HAND_SIZE_PX).toBeGreaterThanOrEqual(0);
    expect(hand.y).toBe(rect.top + rect.height / 2);
  });

  it('flips to the right when the left edge has no room', () => {
    const hand = pointHandPlacement(
      { left: 10, top: 80, width: 96, height: 40 },
      { viewportWidth: 1280 }
    );
    expect(hand.side).toBe('right');
    expect(hand.x).toBeGreaterThan(10 + 96);
  });

  // Two hands bracket the pair from outside instead of crossing the arrow
  // that runs between the boxes.
  it('puts each of two hands on the far side from the other box', () => {
    const auth = { left: 200, top: 80, width: 96, height: 40 };
    const billing = { left: 600, top: 80, width: 96, height: 40 };
    expect(pointHandPlacement(auth, { otherRect: billing, viewportWidth: 1280 }).side).toBe('left');
    expect(pointHandPlacement(billing, { otherRect: auth, viewportWidth: 1280 }).side).toBe(
      'right'
    );
  });

  // The hand must not land on a neighbouring box either: a tight left gap
  // sends it to the right, and a box hemmed in on both sides is pointed at
  // from above.
  it('avoids landing on a neighbouring node', () => {
    const auth = { left: 300, top: 200, width: 96, height: 40 };
    const leftNeighbour = { left: 240, top: 200, width: 50, height: 40 };
    const rightNeighbour = { left: 404, top: 200, width: 50, height: 40 };
    expect(pointHandPlacement(auth, { obstacles: [leftNeighbour], viewportWidth: 1280 }).side).toBe(
      'right'
    );
    const hemmed = pointHandPlacement(auth, {
      obstacles: [leftNeighbour, rightNeighbour],
      viewportWidth: 1280,
      viewportHeight: 800
    });
    expect(hemmed.side).toBe('top');
    expect(hemmed.y).toBeLessThan(auth.top);
  });

  it('prefers a side that also misses the arrows, but never trades a box for one', () => {
    const auth = { left: 300, top: 200, width: 96, height: 40 };
    // An arrow leaves Auth's left edge at mid-height: go right instead.
    const arrowIn = { left: 250, top: 217, width: 50, height: 6 };
    expect(pointHandPlacement(auth, { softObstacles: [arrowIn], viewportWidth: 1280 }).side).toBe(
      'right'
    );
    // With a box on the right, the arrow side still beats landing on the box.
    const rightNeighbour = { left: 404, top: 200, width: 50, height: 40 };
    const aboveNeighbour = { left: 300, top: 150, width: 96, height: 40 };
    const belowNeighbour = { left: 300, top: 250, width: 96, height: 40 };
    expect(
      pointHandPlacement(auth, {
        obstacles: [rightNeighbour, aboveNeighbour, belowNeighbour],
        softObstacles: [arrowIn],
        viewportWidth: 1280,
        viewportHeight: 800
      }).side
    ).toBe('left');
  });

  it('reads both points off a beat, once each', () => {
    expect(beatFocusIds({ focusId: 'a', alsoFocusId: 'b' })).toEqual(['a', 'b']);
    expect(beatFocusIds({ focusId: 'a', alsoFocusId: 'a' })).toEqual(['a']);
    expect(beatFocusIds({ alsoFocusId: 'b' })).toEqual(['b']);
    expect(beatFocusIds({ text: 'nothing' })).toEqual([]);
    expect(beatFocusIds(null)).toEqual([]);
  });
});

describe('pair topics', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('names a point by the boxes it pointed at, else by its first words', () => {
    document.body.innerHTML = `
      <div class="diagram-zoom-layer"><svg>
        <g class="node" id="flowchart-Auth-0"><text>Auth</text></g>
        <g class="node" id="flowchart-Billing-1"><text>Billing</text></g>
      </svg></div>`;
    expect(pairTopicLabel({ text: 'x', focusId: 'flowchart-Auth-0' })).toBe('Auth');
    expect(
      pairTopicLabel({
        text: 'x',
        focusId: 'flowchart-Auth-0',
        alsoFocusId: 'flowchart-Billing-1'
      })
    ).toBe('Auth ↔ Billing');
    expect(pairTopicLabel({ text: 'Caching is the real problem here' })).toBe(
      'Caching is the real…'
    );
    expect(pairTopicLabel({ text: 'Too many hops' })).toBe('Too many hops');
  });

  it('ties a reply to the point it answers only when there was more than one', () => {
    const topic = { text: 'Billing reads Auth.' };
    expect(pairReplyAbout('Why?', topic, 3)).toBe('Why? (about your point: "Billing reads Auth.")');
    expect(pairReplyAbout('Why?', topic, 1)).toBe('Why?');
    expect(pairReplyAbout('Why?', null, 3)).toBe('Why?');
  });
});
