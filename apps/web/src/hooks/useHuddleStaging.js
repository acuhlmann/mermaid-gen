import { useEffect, useRef, useState } from 'react';
import { pointObstacleRects, pointTargetRect } from '../utils/officePairPointing.js';
import {
  HUDDLE_BUBBLE_REACH_PX,
  gazeOffset,
  pairDockPlacement,
  rectCenter,
  seatIsInTheWay
} from '../utils/officeHuddleGaze.js';

/** Re-measure cadence: fast enough to follow a pan, slow enough to leave running. */
const STAGING_MEASURE_MS = 250;
/** The pair only changes sides for a box this far across the layer (a fraction of its width). */
const DOCK_FAR_FRACTION = 0.6;

const EMPTY_STAGING = Object.freeze({ gaze: {}, yielding: [], dock: null });

/** What a face must never cover: the label you are typing, and the node you have selected. */
function workRects() {
  if (typeof document === 'undefined') return [];
  const rects = [];
  for (const selector of ['.graph-edit-label-inline', '.diagram-zoom-layer .is-diagram-selected']) {
    const el = document.querySelector(selector);
    const r = el?.getBoundingClientRect?.();
    if (r && r.width > 0 && r.height > 0) {
      rects.push({ left: r.left, top: r.top, width: r.width, height: r.height });
    }
  }
  return rects;
}

function measuredSeats(layer) {
  const seats = {};
  for (const el of layer.querySelectorAll('[data-seat-id]')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      seats[el.getAttribute('data-seat-id')] = {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height
      };
    }
  }
  return seats;
}

function gazeFor(targets, seats) {
  const gaze = {};
  for (const [id, target] of Object.entries(targets ?? {})) {
    const from = seats[id];
    if (!from) continue;
    const toRect = 'seat' in target ? seats[target.seat] : pointTargetRect(null, target.node);
    if (toRect) gaze[id] = gazeOffset(from, rectCenter(toRect));
  }
  return gaze;
}

/**
 * Stage the huddle against what is on screen: which way each face leans, which
 * faces step back because they cover your work, and where the person in the
 * chair sits.
 *
 * Measured on an interval rather than in render, because every input is
 * layout — the seats, the nodes, the label box — and all of it moves under a
 * pan or a zoom without React hearing about it. State only changes when the
 * staging does, so a still screen costs a few `getBoundingClientRect` calls
 * and no renders.
 *
 * The dock is sticky on purpose. Someone in the next chair does not switch
 * sides every sentence; they move when they are in your way, or when the
 * conversation goes to a box clear across the screen.
 *
 * @param {{
 *   layerRef: { current: HTMLElement | null },
 *   active: boolean,
 *   pairing: boolean,
 *   lookTargets: Record<string, { seat: string } | { node: string }>,
 *   dockFocusId?: string | null
 * }} params
 * @returns {{
 *   gaze: Record<string, { x: number, y: number }>,
 *   yielding: string[],
 *   dock: { side: 'left' | 'right', pos: number } | null
 * }}
 */
export function useHuddleStaging({ layerRef, active, pairing, lookTargets, dockFocusId = null }) {
  const [staging, setStaging] = useState(EMPTY_STAGING);
  const inputsRef = useRef({ lookTargets, dockFocusId });
  useEffect(() => {
    inputsRef.current = { lookTargets, dockFocusId };
  });

  useEffect(() => {
    if (!active) return undefined;
    let lastKey = '';
    let dock = null;
    let dockedFor = null;
    const measure = () => {
      const layer = layerRef.current;
      if (!layer?.getBoundingClientRect) return;
      const lr = layer.getBoundingClientRect();
      const layerRect = { left: lr.left, top: lr.top, width: lr.width, height: lr.height };
      const avoid = workRects();
      const seats = measuredSeats(layer);
      const yielding = Object.keys(seats).filter((id) => seatIsInTheWay(seats[id], avoid));

      if (pairing) {
        const { dockFocusId: focusId } = inputsRef.current;
        const focusRect = focusId ? pointTargetRect(null, focusId) : null;
        const seat = Object.values(seats)[0] ?? null;
        const inTheWay = yielding.length > 0;
        const farAway =
          focusRect &&
          seat &&
          Math.abs(rectCenter(focusRect).x - rectCenter(seat).x) >
            layerRect.width * DOCK_FAR_FRACTION;
        if (!dock || inTheWay || (focusId !== dockedFor && farAway)) {
          // Every box is in the way of a seat, not only your work: a face and
          // its bubble parked over a node hide the thing being talked about.
          dock = pairDockPlacement({
            layerRect,
            focusRect,
            avoidRects: [...avoid, ...pointObstacleRects()],
            reach: HUDDLE_BUBBLE_REACH_PX
          });
          dockedFor = focusId;
        }
      }

      const next = {
        gaze: gazeFor(inputsRef.current.lookTargets, seats),
        yielding,
        dock
      };
      const key = JSON.stringify(next);
      if (key === lastKey) return;
      lastKey = key;
      setStaging(next);
    };
    const first = setTimeout(measure, 0);
    const interval = setInterval(measure, STAGING_MEASURE_MS);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [active, pairing, layerRef]);

  return active ? staging : EMPTY_STAGING;
}

export default useHuddleStaging;
