/**
 * Emphasize the glass room when a physical sync is booked (docs/office-parody).
 *
 * Not a free camera: the floor still fits-to-viewport most of the time. When a
 * physical meeting is live we bump the stage scale past the fit and scroll the
 * glass room into the middle so "you booked the room" is visible, including on
 * desktop where the un-focused stage would otherwise fill the viewport and
 * leave nothing to pan.
 */

import { useEffect, useMemo } from 'react';
import { prefersReducedMotion } from './useWalkAnimation.js';
import {
  FLOOR_ZONES,
  MEETING_PLAYER_TILE,
  STAGE_H,
  STAGE_W,
  projectIso,
  zoneCentre
} from '../../utils/officeFloorPlan.js';
import { MAX_SCALE } from '../../hooks/useStageScale.js';

const MEETING_ZONE = FLOOR_ZONES.find((zone) => zone.id === 'meeting');
const FOCUS_BOOST = 1.38;

/**
 * @param {unknown} meeting
 * @returns {boolean}
 */
export function isPhysicalFloorMeeting(meeting) {
  return Boolean(meeting && meeting.modality !== 'remote' && meeting.state !== 'cancelled');
}

/**
 * @param {{ current: HTMLElement | null }} viewportRef
 * @param {unknown} meeting
 * @param {number} fitScale
 * @returns {number} scale to hand the stage (fit, or boosted for glass-room focus)
 */
export function useFloorMeetingFocus(viewportRef, meeting, fitScale) {
  const physical = isPhysicalFloorMeeting(meeting);
  const focusScale = useMemo(() => {
    if (!physical) return fitScale;
    return Math.min(MAX_SCALE + 0.35, Math.max(fitScale, fitScale * FOCUS_BOOST));
  }, [physical, fitScale]);

  const meetingKey = meeting?.id ?? meeting?.title ?? null;
  const meetingState = meeting?.state ?? null;

  useEffect(() => {
    if (!physical) return;
    const viewport = viewportRef.current;
    if (!viewport || typeof viewport.scrollTo !== 'function') return;

    const tile = MEETING_PLAYER_TILE;
    const centre = MEETING_ZONE ? zoneCentre(MEETING_ZONE.rect) : projectIso(tile.x, tile.y);
    const stage = viewport.querySelector('.office-floor-stage');

    // Wait a frame so the boosted stage size is in layout before we scroll.
    const frame = window.requestAnimationFrame(() => {
      viewport.scrollTo({
        left: (stage?.offsetLeft ?? 0) + centre.left * focusScale - viewport.clientWidth / 2,
        top: (stage?.offsetTop ?? 0) + centre.top * focusScale - viewport.clientHeight / 2,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth'
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [viewportRef, physical, focusScale, meetingKey, meetingState]);

  return focusScale;
}

/** CSS hint for a soft zoom emphasis on the glass room (optional class on stage). */
export function meetingFocusOriginStyle() {
  const centre = MEETING_ZONE
    ? zoneCentre(MEETING_ZONE.rect)
    : projectIso(MEETING_PLAYER_TILE.x, MEETING_PLAYER_TILE.y);
  return {
    transformOrigin: `${(centre.left / STAGE_W) * 100}% ${(centre.top / STAGE_H) * 100}%`
  };
}

export default useFloorMeetingFocus;
