/**
 * The pair's hands, drawn over the canvas.
 *
 * Two gestures, one module, because both are the same idea: the person in the
 * chair indicating something on *your* screen. The 👉 tracks the node their
 * line named; the ⌨️ is what their "Do it" became — they slide the keyboard
 * over and watch you type.
 *
 * Deliberately an overlay and not something the canvas draws. The canvas owns
 * the ring and the camera (`useDiagramPointFocus`); this owns the gesture, and
 * it lives in the office layer so both office renderers get it without either
 * knowing about it (ADR-0011). Decorative by construction — the line they said
 * already names the node out loud and in captions, so the hand adds the
 * indication, never the information.
 *
 * Both portal to <body> — or into the fullscreen element while the canvas is
 * fullscreen, since native fullscreen paints nothing outside it. They are
 * positioned in viewport coordinates measured off the canvas, and `position:
 * fixed` stops being viewport-relative inside a transformed ancestor — the
 * office layer has animated, transformed children, so a hand rendered in place
 * could land a pane away from the node it names.
 *
 * A line can point at two boxes ("these two should not talk directly"), so the
 * pointer draws one hand per id, each beside its own box, on the far side from
 * the other one, and clear of every other node (`pointHandPlacement`).
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  pointEdgeRects,
  pointHandPlacement,
  pointObstacleRects,
  pointTargetRect
} from '../utils/officePairPointing.js';

/**
 * Re-measure cadence while a point is live. A pan or a zoom moves the node
 * under the hand, so the anchor has to follow; 90 ms is smooth enough to ride a
 * camera transition and cheap enough to leave running for the length of a line.
 */
const POINT_MEASURE_MS = 90;

function portal(node, host = null) {
  if (typeof document === 'undefined') return null;
  return createPortal(node, host ?? document.body);
}

/**
 * One hand, mounted per focus id.
 *
 * Keyed by the id it points at (see `OfficePairPointer`) so a new point
 * remounts and replays the reach-in instead of teleporting a hand that is
 * already on screen — and so there is no stale anchor to clear in an effect.
 *
 * @param {{ focusId: string, otherId?: string | null, host?: Element | null }} props
 */
function PointingHand({ focusId, otherId = null, host = null }) {
  const [placement, setPlacement] = useState(null);

  useEffect(() => {
    /*
     * Measuring reads the layout, so it happens in a callback and never in the
     * effect body — including the first pass, which is deferred a tick. The
     * hand therefore arrives a frame after the line does, which is also the
     * order a real gesture happens in.
     */
    const measure = () => {
      const rect = pointTargetRect(null, focusId);
      // The node can vanish mid-remark (the diagram changed under it). Dropping
      // the hand beats leaving it over whatever now sits at that coordinate.
      if (!rect) {
        setPlacement(null);
        return;
      }
      const otherRect = otherId ? pointTargetRect(null, otherId) : null;
      setPlacement(
        pointHandPlacement(rect, {
          otherRect,
          obstacles: pointObstacleRects(),
          softObstacles: pointEdgeRects()
        })
      );
    };
    const first = setTimeout(measure, 0);
    const interval = setInterval(measure, POINT_MEASURE_MS);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [focusId, otherId]);

  if (!placement) return null;

  return portal(
    <div
      className={`office-pair-pointer is-side-${placement.side}`}
      style={{ left: `${placement.x}px`, top: `${placement.y}px` }}
      aria-hidden="true"
      data-testid="office-pair-pointer"
      data-focus-id={focusId}
      data-side={placement.side}
    >
      <span className="office-pair-pointer-hand">👉</span>
    </div>,
    host
  );
}

/**
 * @param {{ focusIds?: string[] | null, host?: Element | null }} props
 */
export function OfficePairPointer({ focusIds = null, host = null }) {
  const ids = Array.isArray(focusIds) ? focusIds.filter(Boolean).slice(0, 2) : [];
  if (ids.length === 0) return null;
  return ids.map((id) => (
    <PointingHand
      key={id}
      focusId={id}
      otherId={ids.find((other) => other !== id) ?? null}
      host={host}
    />
  ));
}

export default OfficePairPointer;
