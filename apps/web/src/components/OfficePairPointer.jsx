/**
 * The pair's hands, drawn over the canvas.
 *
 * The person in the chair indicating something on *your* screen. The 👉 tracks
 * the node their line named; a passing 👀 or 👍 is a wordless reaction to the
 * node you just picked up or the edit you just made.
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

const GESTURE_GLYPHS = { glance: '👀', nod: '👍' };

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
 * `gesture` swaps the 👉 for a passing reaction — 👀 for a glance at the node
 * you picked up, 👍 for a nod at an edit you made — drawn in the same spot by
 * the same placement rules, and faded out by CSS rather than unmounted on a
 * timer of its own.
 *
 * @param {{
 *   focusId: string,
 *   otherId?: string | null,
 *   host?: Element | null,
 *   gesture?: 'nod' | 'glance' | null
 * }} props
 */
function PointingHand({ focusId, otherId = null, host = null, gesture = null }) {
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
      className={[
        'office-pair-pointer',
        `is-side-${placement.side}`,
        gesture ? `is-gesture is-${gesture}` : ''
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ left: `${placement.x}px`, top: `${placement.y}px` }}
      aria-hidden="true"
      data-testid={gesture ? 'office-pair-gesture' : 'office-pair-pointer'}
      data-focus-id={focusId}
      data-side={placement.side}
      data-gesture={gesture ?? undefined}
    >
      <span className="office-pair-pointer-hand">{GESTURE_GLYPHS[gesture] ?? '👉'}</span>
    </div>,
    host
  );
}

/**
 * @param {{
 *   focusIds?: string[] | null,
 *   host?: Element | null,
 *   gesture?: { kind: 'nod' | 'glance', focusId: string | null, seq: number } | null
 * }} props `gesture` is a live nod or glance (`usePairGesture`); it is drawn
 *   only when it names a box nobody is already pointing at.
 */
export function OfficePairPointer({ focusIds = null, host = null, gesture = null }) {
  const ids = Array.isArray(focusIds) ? focusIds.filter(Boolean).slice(0, 2) : [];
  const hands = ids.map((id) => (
    <PointingHand
      key={id}
      focusId={id}
      otherId={ids.find((other) => other !== id) ?? null}
      host={host}
    />
  ));
  if (gesture?.focusId && !ids.includes(gesture.focusId)) {
    hands.push(
      <PointingHand
        key={`gesture-${gesture.seq}`}
        focusId={gesture.focusId}
        host={host}
        gesture={gesture.kind}
      />
    );
  }
  return hands.length > 0 ? hands : null;
}

export default OfficePairPointer;
