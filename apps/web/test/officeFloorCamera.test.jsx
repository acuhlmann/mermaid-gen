// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CAMERA_IN_MS, useFloorCamera } from '../src/components/officeFloor/useFloorCamera.js';
import { projectIso } from '../src/utils/officeFloorPlan.js';

/**
 * jsdom has no rAF engine and no layout, so the camera is driven by a hand-
 * turned frame clock (the way `useWalkAnimation.test.jsx` stubs WAAPI) and
 * its centre-on assertions are arithmetic against `scrollTo` rather than
 * pixels. Reduced motion is the lever for the snap tests: with it on, a
 * focus change commits in the same render it arrives in.
 */

let rafCallbacks;
let nextRafId;
let scrollToSpy;
let timeoutCallbacks;

const MEETING_FOCUS = {
  key: 'meeting:m1',
  tile: { x: 10.45, y: 7.1 },
  boost: 1.38,
  bias: 110
};
const SCENE_FOCUS = {
  key: 'scene:coffee:c1:1',
  tile: { x: 2.5, y: 7.5 },
  boost: 1.35,
  bias: 0
};

function setReducedMotion(on) {
  window.matchMedia = vi.fn(() => ({ matches: on }));
}

function runFrames(now) {
  const callbacks = [...rafCallbacks.values()];
  rafCallbacks.clear();
  for (const callback of callbacks) callback(now);
}

function Harness({ focus, fitScale = 1 }) {
  const viewportRef = useRef(null);
  const scale = useFloorCamera(viewportRef, focus, fitScale);
  return (
    <div ref={viewportRef} data-testid="viewport">
      <span data-testid="camera-scale">{scale}</span>
    </div>
  );
}

function cameraScale() {
  return Number(screen.getByTestId('camera-scale').textContent);
}

beforeEach(() => {
  rafCallbacks = new Map();
  nextRafId = 1;
  window.requestAnimationFrame = (callback) => {
    rafCallbacks.set(nextRafId, callback);
    return nextRafId;
  };
  window.cancelAnimationFrame = (id) => rafCallbacks.delete(id);
  scrollToSpy = vi.fn();
  HTMLElement.prototype.scrollTo = scrollToSpy;
  timeoutCallbacks = [];
  vi.spyOn(window, 'setTimeout').mockImplementation((callback) => {
    timeoutCallbacks.push(callback);
    return timeoutCallbacks.length;
  });
  vi.spyOn(window, 'clearTimeout').mockImplementation(() => {});
  setReducedMotion(false);
  vi.spyOn(performance, 'now').mockReturnValue(1000);
});

afterEach(() => {
  cleanup();
  delete HTMLElement.prototype.scrollTo;
  vi.restoreAllMocks();
});

describe('useFloorCamera frames a moment', () => {
  it('eases to the boost scale frame by frame and centres the tile', () => {
    render(<Harness focus={MEETING_FOCUS} />);
    expect(cameraScale()).toBe(1);

    act(() => runFrames(1000 + CAMERA_IN_MS));
    expect(cameraScale()).toBeCloseTo(1.38);

    // One clock: the centre-on lands where the eased scale puts the tile,
    // minus the meeting's top-card bias. jsdom gives no layout, so this is
    // the arithmetic the layout effect must perform.
    const projected = projectIso(MEETING_FOCUS.tile.x, MEETING_FOCUS.tile.y);
    const last = scrollToSpy.mock.calls.at(-1)[0];
    expect(last.left).toBeCloseTo(projected.left * 1.38);
    expect(last.top).toBeCloseTo(projected.top * 1.38 - MEETING_FOCUS.bias);
  });

  it('is partway at half time, not jumped', () => {
    render(<Harness focus={MEETING_FOCUS} />);
    act(() => runFrames(1000 + CAMERA_IN_MS / 2));
    // easeInOutCubic(0.5) is 0.5 — halfway on the way in.
    expect(cameraScale()).toBeCloseTo(1 + (1.38 - 1) * 0.5);
  });

  it('snaps to the frame under reduced motion', () => {
    setReducedMotion(true);
    render(<Harness focus={MEETING_FOCUS} />);
    expect(cameraScale()).toBeCloseTo(1.38);
    expect(rafCallbacks.size).toBe(0);
    expect(scrollToSpy).toHaveBeenCalled();
  });

  it('follows the fit scale while idle', () => {
    const view = render(<Harness focus={null} fitScale={1} />);
    view.rerender(<Harness focus={null} fitScale={0.8} />);
    expect(cameraScale()).toBeCloseTo(0.8);
  });
});

describe('the camera proposes, never insists', () => {
  it('a user pan stops re-centring for the rest of the moment', () => {
    render(<Harness focus={MEETING_FOCUS} />);
    fireEvent.wheel(screen.getByTestId('viewport'));

    // The zoom still completes — only the re-centring is the user's now.
    act(() => runFrames(1000 + CAMERA_IN_MS));
    expect(cameraScale()).toBeCloseTo(1.38);
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('a new moment reclaims the camera after an override', () => {
    setReducedMotion(true);
    const view = render(<Harness focus={MEETING_FOCUS} />);
    expect(scrollToSpy).toHaveBeenCalledTimes(1);

    fireEvent.wheel(screen.getByTestId('viewport'));
    view.rerender(<Harness focus={SCENE_FOCUS} />);

    expect(cameraScale()).toBeCloseTo(1.35);
    expect(scrollToSpy).toHaveBeenCalledTimes(2);
  });
});

describe('the camera lets go when the moment does', () => {
  it('holds the frame for a beat, then eases back to fit', () => {
    setReducedMotion(true);
    const view = render(<Harness focus={MEETING_FOCUS} />);
    expect(cameraScale()).toBeCloseTo(1.38);

    view.rerender(<Harness focus={null} />);
    // Not released instantly — the hold is what lets moments run back to back.
    expect(cameraScale()).toBeCloseTo(1.38);
    expect(timeoutCallbacks).toHaveLength(1);

    act(() => timeoutCallbacks[0]());
    expect(cameraScale()).toBe(1);
  });

  it('a moment arriving during the hold cancels the release', () => {
    setReducedMotion(true);
    const view = render(<Harness focus={MEETING_FOCUS} />);
    view.rerender(<Harness focus={null} />);
    expect(timeoutCallbacks).toHaveLength(1);

    view.rerender(<Harness focus={SCENE_FOCUS} />);
    expect(window.clearTimeout).toHaveBeenCalled();
    expect(cameraScale()).toBeCloseTo(1.35);
  });
});
