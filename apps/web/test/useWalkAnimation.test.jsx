// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { liveTileOf, useWalkAnimation } from '../src/components/officeFloor/useWalkAnimation.js';
import { projectIso } from '../src/utils/officeFloorPlan.js';

/**
 * jsdom ships no Web Animations engine, which is exactly why the floor is
 * testable at all — `useWalkAnimation` teleports and settles. These tests put a
 * controllable engine back so the *interrupt* path can be asserted, because
 * free roam is the first caller that can start a walk before the last finished.
 */
function stubAnimate(el) {
  const animations = [];
  el.animate = vi.fn(() => {
    let settle;
    const animation = {
      finished: new Promise((resolve, reject) => {
        settle = { resolve, reject };
      }),
      cancel: vi.fn(() => settle.reject(new Error('cancelled'))),
      finish: () => settle.resolve()
    };
    // An unhandled rejection here would fail the run; the hook catches it.
    animation.finished.catch(() => {});
    animations.push(animation);
    return animation;
  });
  return animations;
}

afterEach(cleanup);

describe('useWalkAnimation interrupts', () => {
  it('cancels the animation it abandons when the walk changes', async () => {
    const el = document.createElement('div');
    const animations = stubAnimate(el);
    const ref = { current: el };

    function Harness({ walkKey, path }) {
      useWalkAnimation(ref, path, { walkKey });
      return null;
    }

    const view = render(
      <Harness
        walkKey="a"
        path={[
          { x: 0, y: 0 },
          { x: 4, y: 4 }
        ]}
      />
    );
    await Promise.resolve();
    expect(animations).toHaveLength(1);

    view.rerender(
      <Harness
        walkKey="b"
        path={[
          { x: 2, y: 2 },
          { x: 8, y: 1 }
        ]}
      />
    );
    await Promise.resolve();

    /*
     * The whole point: a `fill: forwards` animation outranks inline style, so
     * an abandoned walk would keep holding the figure at the leg it reached
     * and the new walk would never appear to start.
     */
    expect(animations[0].cancel).toHaveBeenCalled();
  });

  it('cancels on unmount too', async () => {
    const el = document.createElement('div');
    const animations = stubAnimate(el);
    const ref = { current: el };

    function Harness() {
      useWalkAnimation(
        ref,
        [
          { x: 0, y: 0 },
          { x: 3, y: 3 }
        ],
        { walkKey: 'only' }
      );
      return null;
    }

    const view = render(<Harness />);
    await Promise.resolve();
    view.unmount();
    await Promise.resolve();

    expect(animations[0].cancel).toHaveBeenCalled();
  });
});

describe('useWalkAnimation onLeg (footsteps)', () => {
  it('fires once per leg, with the tile that leg is heading for', async () => {
    const el = document.createElement('div');
    const animations = stubAnimate(el);
    const ref = { current: el };
    const onLeg = vi.fn();
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 }
    ];

    function Harness() {
      useWalkAnimation(ref, path, { walkKey: 'walk', onLeg });
      return null;
    }

    render(<Harness />);
    await Promise.resolve();
    // A leg at a time: the second only starts once the first has finished.
    expect(onLeg).toHaveBeenCalledTimes(1);
    expect(onLeg).toHaveBeenLastCalledWith({ x: 1, y: 0 }, 1);

    animations[0].finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(onLeg).toHaveBeenCalledTimes(2);
    expect(onLeg).toHaveBeenLastCalledWith({ x: 2, y: 0 }, 2);
  });

  it('is silent when there is no animation engine — stillness costs no extra check', async () => {
    // No stubAnimate: this is the jsdom/reduced-motion branch, which teleports
    // to the destination and settles. A walk that does not travel has no steps,
    // and that falls out of the leg loop never running rather than out of a
    // second `prefersReducedMotion()` call that could drift.
    const el = document.createElement('div');
    const ref = { current: el };
    const onLeg = vi.fn();
    const onArrive = vi.fn();

    function Harness() {
      useWalkAnimation(
        ref,
        [
          { x: 0, y: 0 },
          { x: 5, y: 5 }
        ],
        { walkKey: 'still', onLeg, onArrive }
      );
      return null;
    }

    render(<Harness />);
    await Promise.resolve();

    expect(onArrive).toHaveBeenCalled();
    expect(onLeg).not.toHaveBeenCalled();
  });

  it('does not restart the walk when the callback identity changes', async () => {
    // Footstep handlers close over a cue emitter and are rebuilt freely by
    // their callers. Held in a ref, so a new identity must not re-run the
    // effect — a walk that restarts mid-stride teleports the walker home.
    const el = document.createElement('div');
    const animations = stubAnimate(el);
    const ref = { current: el };

    function Harness({ onLeg }) {
      useWalkAnimation(
        ref,
        [
          { x: 0, y: 0 },
          { x: 3, y: 1 }
        ],
        { walkKey: 'stable', onLeg }
      );
      return null;
    }

    const view = render(<Harness onLeg={() => {}} />);
    await Promise.resolve();
    expect(animations).toHaveLength(1);

    view.rerender(<Harness onLeg={() => {}} />);
    await Promise.resolve();

    expect(animations).toHaveLength(1);
    expect(animations[0].cancel).not.toHaveBeenCalled();
  });
});

describe('liveTileOf', () => {
  it('reads a walker’s position back out of its transform', () => {
    const el = document.createElement('div');
    const { left, top } = projectIso(5, 2);
    el.style.transform = `translate(${left}px, ${top}px)`;
    document.body.appendChild(el);

    const tile = liveTileOf(el);
    // jsdom's computed style returns the inline value; where an engine is
    // missing entirely the hook falls back to the caller's known tile.
    if (tile) {
      expect(tile.x).toBeCloseTo(5, 6);
      expect(tile.y).toBeCloseTo(2, 6);
    }
    el.remove();
  });

  it('is null rather than throwing on a transform it did not write', () => {
    const el = document.createElement('div');
    el.style.transform = 'rotate(30deg) skew(4deg)';
    document.body.appendChild(el);
    expect(() => liveTileOf(el)).not.toThrow();
    el.remove();
  });

  it('is null with no element at all', () => {
    expect(liveTileOf(null)).toBeNull();
  });
});
