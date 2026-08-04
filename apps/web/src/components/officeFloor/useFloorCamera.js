/**
 * The directed camera — performing the move (docs/office-isometric-mode.md
 * § 5 slice 14). `floorCamera.js` decides **what** to frame; this hook eases
 * the stage toward it and back out again.
 *
 * One clock, not two: scale state and scroll position are both derived per
 * frame from the same eased value, where the arrival ceremony's CSS
 * width-transition + smooth-scroll pairing runs them as separate animations
 * that can drift. The layout effect writes scroll synchronously before paint,
 * so the room never paints a frame where the zoom and the pan disagree.
 *
 * The camera proposes, never insists (the slice-14 override rule): a wheel,
 * touch or pointer on the viewport hands panning back to the user for the
 * rest of the current moment, and only the next moment — or the moment
 * ending — picks the camera back up. Programmatic scrolls cannot trigger the
 * override because it listens to input events only, which are by definition
 * the user's.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cameraScaleFor } from './floorCamera.js';
import { prefersReducedMotion } from './useWalkAnimation.js';
import { projectIso } from '../../utils/officeFloorPlan.js';

export const CAMERA_IN_MS = 700;
export const CAMERA_OUT_MS = 600;
/** The beat between a moment clearing and the camera pulling back to the wide view. */
export const CAMERA_HOLD_MS = 250;

/**
 * @param {number} t 0…1
 * @returns {number}
 */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * @param {{ current: HTMLElement | null }} viewportRef
 * @param {{ key: string, tile: { x: number, y: number }, boost: number, bias: number } | null} focus
 * @param {number} fitScale
 * @returns {number} the scale to hand `FloorStage`
 */
export function useFloorCamera(viewportRef, focus, fitScale) {
  const [scale, setScale] = useState(fitScale);

  const scaleRef = useRef(fitScale);
  const fitScaleRef = useRef(fitScale);
  /**
   * The frame target. Written only inside the focus-change effect, so the
   * layout effect (which runs after it on a focus change) can read the
   * current moment, and during a release it is still the last moment — the
   * tile the room eases out around.
   */
  const lastFocusRef = useRef(null);
  /** The camera is doing something: framed, easing in, or easing back out. */
  const engagedRef = useRef(false);
  /** Mid-ease-out — a new moment arriving must cancel it. */
  const releasingRef = useRef(false);
  /** The user took the pan for the current moment; do not re-centre. */
  const overrideRef = useRef(false);
  const rafRef = useRef(0);
  const holdTimerRef = useRef(0);

  /*
   * Primitive deps for the tween effect: `focus` is a fresh object every
   * render, and depending on it would cancel and restart the tween on every
   * frame of its own animation. The key + boost identify the moment.
   */
  const focusKey = focus ? focus.key : null;
  const focusBoost = focus ? focus.boost : null;
  const focusTileX = focus ? focus.tile.x : null;
  const focusTileY = focus ? focus.tile.y : null;
  const focusBias = focus ? focus.bias : 0;

  const commit = useCallback((next) => {
    scaleRef.current = next;
    setScale((current) => (current === next ? current : next));
  }, []);

  const startTween = useCallback(
    (target, durationMs) => {
      window.cancelAnimationFrame(rafRef.current);
      engagedRef.current = true;
      const from = scaleRef.current;
      const settle = () => {
        if (releasingRef.current) {
          releasingRef.current = false;
          engagedRef.current = false;
        }
      };
      if (prefersReducedMotion() || durationMs <= 0 || from === target) {
        commit(target);
        settle();
        return;
      }
      const startedAt = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - startedAt) / durationMs);
        commit(from + (target - from) * easeInOutCubic(t));
        if (t < 1) rafRef.current = window.requestAnimationFrame(step);
        else settle();
      };
      rafRef.current = window.requestAnimationFrame(step);
    },
    [commit]
  );

  const release = useCallback(() => {
    holdTimerRef.current = 0;
    releasingRef.current = true;
    startTween(cameraScaleFor(fitScaleRef.current, null), CAMERA_OUT_MS);
  }, [startTween]);

  /* A resize while idle must not leave the stage on a stale fit scale. */
  useEffect(() => {
    fitScaleRef.current = fitScale;
    if (focusKey !== null || engagedRef.current || scaleRef.current === fitScale) return;
    commit(fitScale);
  }, [fitScale, focusKey, commit]);

  /* A new moment always gets the camera back, whatever the user did before. */
  useEffect(() => {
    overrideRef.current = false;
  }, [focusKey]);

  /* Only the user's own input can take the pan away from the camera. */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof viewport.addEventListener !== 'function') return undefined;
    const onUserInput = () => {
      if (engagedRef.current) overrideRef.current = true;
    };
    viewport.addEventListener('wheel', onUserInput, { passive: true });
    viewport.addEventListener('touchmove', onUserInput, { passive: true });
    viewport.addEventListener('pointerdown', onUserInput);
    return () => {
      viewport.removeEventListener('wheel', onUserInput);
      viewport.removeEventListener('touchmove', onUserInput);
      viewport.removeEventListener('pointerdown', onUserInput);
    };
  }, [viewportRef]);

  useEffect(() => {
    if (focusKey === null) {
      /*
       * The moment ended. Hold the frame for a beat — scenes and meetings can
       * run back to back — then ease back to the wide view. Mid-release there
       * is nothing to schedule; the tween is already on its way.
       */
      if (!engagedRef.current || releasingRef.current) return undefined;
      holdTimerRef.current = window.setTimeout(release, CAMERA_HOLD_MS);
      return () => window.clearTimeout(holdTimerRef.current);
    }
    window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = 0;
    releasingRef.current = false;
    startTween(cameraScaleFor(fitScaleRef.current, focusBoost), CAMERA_IN_MS);
    return undefined;
    /* `fitScale` in deps so a resize mid-moment reframes at the new fit. */
  }, [focusKey, focusBoost, fitScale, release, startTween]);

  /*
   * Centre the framed tile before paint, on every scale change. Reads the
   * current render's `focus` while framed and the last moment while easing
   * back out — the tile the room releases around — and keeps
   * `lastFocusRef` up to date so a release always knows what it is leaving.
   * An override leaves the scale moving but stops re-centring, so the
   * user's scroll position survives the rest of the moment.
   */
  useLayoutEffect(() => {
    if (focus) lastFocusRef.current = focus;
    if (!engagedRef.current || overrideRef.current) return;
    const viewport = viewportRef.current;
    const target = focus ?? lastFocusRef.current;
    if (!viewport || typeof viewport.scrollTo !== 'function' || !target) return;
    const stage = viewport.querySelector('.office-floor-stage');
    const { left, top } = projectIso(target.tile.x, target.tile.y);
    viewport.scrollTo({
      left: (stage?.offsetLeft ?? 0) + left * scale - viewport.clientWidth / 2,
      top: (stage?.offsetTop ?? 0) + top * scale - viewport.clientHeight / 2 - target.bias
    });
  }, [viewportRef, scale, focus, focusKey, focusTileX, focusTileY, focusBias]);

  useEffect(
    () => () => {
      window.cancelAnimationFrame(rafRef.current);
      window.clearTimeout(holdTimerRef.current);
    },
    []
  );

  return scale;
}

export default useFloorCamera;
