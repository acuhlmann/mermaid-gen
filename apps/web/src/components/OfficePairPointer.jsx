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
 * Both portal to <body>. They are positioned in viewport coordinates measured
 * off the canvas, and `position: fixed` stops being viewport-relative inside a
 * transformed ancestor — the office layer has animated, transformed children,
 * so a hand rendered in place could land a pane away from the node it names.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { pointHandAnchor, pointTargetRect } from '../utils/officePairPointing.js';

/**
 * Re-measure cadence while a point is live. A pan or a zoom moves the node
 * under the hand, so the anchor has to follow; 90 ms is smooth enough to ride a
 * camera transition and cheap enough to leave running for the length of a line.
 */
const POINT_MEASURE_MS = 90;

/** How long the keyboard slide plays before it removes itself. */
export const PAIR_HANDOVER_MS = 1400;

function portal(node) {
  if (typeof document === 'undefined') return null;
  return createPortal(node, document.body);
}

/**
 * The hand itself, mounted per focus id.
 *
 * Keyed by the id it points at (see `OfficePairPointer`) so a new point
 * remounts and replays the reach-in instead of teleporting a hand that is
 * already on screen — and so there is no stale anchor to clear in an effect.
 *
 * @param {{ focusId: string }} props
 */
function PointingHand({ focusId }) {
  const [anchor, setAnchor] = useState(null);

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
      setAnchor(rect ? pointHandAnchor(rect) : null);
    };
    const first = setTimeout(measure, 0);
    const interval = setInterval(measure, POINT_MEASURE_MS);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [focusId]);

  if (!anchor) return null;

  return portal(
    <div
      className="office-pair-pointer"
      style={{ left: `${anchor.x}px`, top: `${anchor.y}px` }}
      aria-hidden="true"
      data-testid="office-pair-pointer"
      data-focus-id={focusId}
    >
      <span className="office-pair-pointer-hand">👉</span>
    </div>
  );
}

/**
 * @param {{ focusId?: string | null }} props
 */
export function OfficePairPointer({ focusId = null }) {
  if (!focusId) return null;
  return <PointingHand key={focusId} focusId={focusId} />;
}

/**
 * The keyboard slide.
 *
 * Visibility is derived from props rather than mirrored into state: `seq` is
 * the handover that was asked for, `finishedSeq` the one that has played out,
 * and the gesture is live whenever they differ. A second handover in the same
 * session therefore replays with nothing to reset, and the `key` restarts the
 * animation because it is genuinely a new element.
 *
 * @param {{ seq: number, caption?: string }} props
 */
export function OfficePairHandover({ seq, caption = '' }) {
  const [finishedSeq, setFinishedSeq] = useState(0);

  useEffect(() => {
    if (!seq) return undefined;
    const timer = setTimeout(() => setFinishedSeq(seq), PAIR_HANDOVER_MS);
    return () => clearTimeout(timer);
  }, [seq]);

  if (!seq || seq === finishedSeq) return null;

  return portal(
    <div
      className="office-pair-handover"
      key={seq}
      aria-hidden="true"
      data-testid="office-pair-handover"
    >
      <span className="office-pair-handover-prop">⌨️</span>
      {caption ? <span className="office-pair-handover-caption">{caption}</span> : null}
    </div>
  );
}

export default OfficePairPointer;
