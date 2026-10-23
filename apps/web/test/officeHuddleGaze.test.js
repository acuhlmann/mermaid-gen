// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  HUDDLE_GAZE_MAX_PX,
  PAIR_DOCK_DEFAULT,
  attentionNodeId,
  gazeOffset,
  huddleLookTargets,
  pairDockPlacement,
  seatIsInTheWay
} from '../src/utils/officeHuddleGaze.js';

const LAYER = { left: 0, top: 0, width: 1000, height: 600 };

describe('gazeOffset', () => {
  it('leans toward the target, never further than the cap', () => {
    const seat = { left: 0, top: 290, width: 20, height: 20 };
    expect(gazeOffset(seat, { x: 900, y: 300 })).toEqual({ x: HUDDLE_GAZE_MAX_PX, y: 0 });
    expect(gazeOffset(seat, { x: 10, y: 0 })).toEqual({ x: 0, y: -HUDDLE_GAZE_MAX_PX });
  });

  it('stays still when the target is where it already is', () => {
    expect(gazeOffset({ left: 0, top: 0, width: 20, height: 20 }, { x: 10, y: 10 })).toEqual({
      x: 0,
      y: 0
    });
  });
});

describe('huddleLookTargets', () => {
  it('turns a mob toward whoever has the floor, and the speaker to their box', () => {
    expect(
      huddleLookTargets({
        attendees: ['gilfoyle', 'dinesh', 'erlich'],
        floorId: 'dinesh',
        focusIds: ['flowchart-Auth-0']
      })
    ).toEqual({
      gilfoyle: { seat: 'dinesh' },
      dinesh: { node: 'flowchart-Auth-0' },
      erlich: { seat: 'dinesh' }
    });
  });

  it('looks nowhere in particular when nobody has the floor', () => {
    expect(huddleLookTargets({ attendees: ['gilfoyle', 'dinesh'] })).toEqual({});
  });

  it('has the pair look at a box they just reacted to before the one they point at', () => {
    expect(
      huddleLookTargets({
        attendees: ['gilfoyle'],
        pairing: true,
        focusIds: ['flowchart-Auth-0'],
        gestureFocusId: 'flowchart-Billing-1'
      })
    ).toEqual({ gilfoyle: { node: 'flowchart-Billing-1' } });
    expect(
      huddleLookTargets({ attendees: ['gilfoyle'], pairing: true, focusIds: ['flowchart-Auth-0'] })
    ).toEqual({ gilfoyle: { node: 'flowchart-Auth-0' } });
  });
});

describe('pairDockPlacement', () => {
  it('takes the default chair with nothing to sit beside', () => {
    expect(pairDockPlacement({ layerRect: LAYER })).toEqual(PAIR_DOCK_DEFAULT);
  });

  it('sits on the side of the box, level with it', () => {
    const focusRect = { left: 100, top: 100, width: 80, height: 40 };
    expect(pairDockPlacement({ layerRect: LAYER, focusRect })).toEqual({ side: 'left', pos: 0.2 });
  });

  it('moves off the label you are typing in', () => {
    const focusRect = { left: 800, top: 270, width: 80, height: 40 };
    const label = { left: 900, top: 260, width: 100, height: 60 };
    const dock = pairDockPlacement({ layerRect: LAYER, focusRect, avoidRects: [label] });
    expect(dock.side).toBe('right');
    expect(dock.pos).not.toBe(0.48);
  });

  it('keeps the bubble beside the face off the boxes too', () => {
    const focusRect = { left: 100, top: 280, width: 80, height: 40 };
    // A neighbour the bare face would clear but its bubble would cover.
    const neighbour = { left: 150, top: 240, width: 80, height: 120 };
    const bare = pairDockPlacement({ layerRect: LAYER, focusRect, avoidRects: [neighbour] });
    expect(bare).toEqual({ side: 'left', pos: 0.5 });
    const withBubble = pairDockPlacement({
      layerRect: LAYER,
      focusRect,
      avoidRects: [neighbour],
      reach: 190
    });
    expect(withBubble.side).toBe('left');
    expect(withBubble.pos).not.toBe(0.5);
  });

  it('crosses to the far side when the near side is all in the way', () => {
    const focusRect = { left: 800, top: 270, width: 80, height: 40 };
    const wall = { left: 950, top: 0, width: 50, height: 600 };
    expect(pairDockPlacement({ layerRect: LAYER, focusRect, avoidRects: [wall] }).side).toBe(
      'left'
    );
  });
});

describe('seatIsInTheWay', () => {
  it('flags a seat over your work, and only that', () => {
    const seat = { left: 0, top: 0, width: 50, height: 50 };
    expect(seatIsInTheWay(seat, [{ left: 40, top: 40, width: 30, height: 30 }])).toBe(true);
    expect(seatIsInTheWay(seat, [{ left: 60, top: 60, width: 30, height: 30 }])).toBe(false);
  });
});

describe('attentionNodeId', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reads the node you selected, preferring one you are dragging a connection from', () => {
    document.body.innerHTML = `
      <div class="diagram-zoom-layer"><svg>
        <g class="node is-diagram-selected" id="flowchart-Auth-0"></g>
        <g class="node" id="flowchart-Billing-1"></g>
      </svg></div>`;
    expect(attentionNodeId()).toBe('flowchart-Auth-0');
    document.querySelector('#flowchart-Billing-1').classList.add('is-connect-source');
    expect(attentionNodeId()).toBe('flowchart-Billing-1');
  });

  it('is null when nothing is picked up', () => {
    document.body.innerHTML = '<div class="diagram-zoom-layer"><svg></svg></div>';
    expect(attentionNodeId()).toBeNull();
  });
});
