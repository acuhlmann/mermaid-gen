/**
 * `<SceneFrame>` — fits the camera to the scene it wraps. The maths (and the
 * reasoning behind it) lives in sceneFraming.js; this file only owns the R3F
 * lifecycle: when to re-measure, and what to do with the answer.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import {
  ANNOTATION_HEADROOM_PX,
  DEFAULT_FRAME_DIRECTION,
  FULL_SAFE_AREA,
  collectFramePoints,
  frameDirectionForAspect,
  framedAspect,
  solveFrameFit
} from './sceneFraming.js';

/** Cap on re-solves per refit; the loop converges in two on every real scene. */
const MAX_FIT_PASSES = 4;
/** Relative distance change under which a re-solve counts as agreement. */
const FIT_TOLERANCE = 0.01;

/**
 * Frames `children` in the camera. Re-fits when `contentKey` changes, the canvas
 * resizes, or the HTML chrome over it moves, then leaves the camera alone so
 * OrbitControls owns it.
 *
 * @param {object} props
 * @param {number} [props.margin] — breathing room multiplier (1 = edge-to-edge).
 * @param {string} props.contentKey — refit trigger; change it when the scene changes.
 * @param {{top:number,right:number,bottom:number,left:number}} [props.safeArea]
 *   — fractions of the canvas the overlays cover, so the subject is fitted into
 *   what they leave rather than behind them.
 * @param {{ distance: number, radius: number, center: number[], ready: boolean }} [props.fitRef]
 */
export function SceneFrame({
  children,
  margin = 1.06,
  contentKey,
  safeArea = FULL_SAFE_AREA,
  fitRef = null
}) {
  const groupRef = useRef(null);
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls);
  const size = useThree((state) => state.size);
  const pendingRef = useRef(true);
  const settleRef = useRef(0);
  const passRef = useRef(0);
  const lastDistanceRef = useRef(0);
  const firstFitRef = useRef(true);
  const viewerOrbitedRef = useRef(false);
  const directionRef = useRef(DEFAULT_FRAME_DIRECTION.clone());

  // OrbitControls raises `start` on viewer input only — the intro's programmatic
  // auto-rotate does not. That is the difference between "nobody has chosen an
  // angle yet" and "this is the angle they chose", which is what decides whether
  // a resize may re-pick the view direction. A foldable opening from a 0.85
  // cover to a 1.4 inner screen is a resize nobody asked for; an orbit is.
  useEffect(() => {
    if (!controls?.addEventListener) return undefined;
    const onStart = () => {
      viewerOrbitedRef.current = true;
    };
    controls.addEventListener('start', onStart);
    return () => controls.removeEventListener('start', onStart);
  }, [controls]);

  const { top, right, bottom, left } = safeArea ?? FULL_SAFE_AREA;
  useEffect(() => {
    pendingRef.current = true;
    settleRef.current = 0;
    passRef.current = 0;
    lastDistanceRef.current = 0;
  }, [contentKey, size.width, size.height, margin, top, right, bottom, left]);

  // A resize before the viewer has touched the scene re-opens the angle
  // question: the canvas that answer was chosen for no longer exists.
  useEffect(() => {
    if (!viewerOrbitedRef.current) firstFitRef.current = true;
  }, [size.width, size.height, contentKey]);

  useFrame(() => {
    if (!pendingRef.current || !groupRef.current) return;
    // Geometry built in children's `useMemo` exists at mount, but drei/troika
    // label meshes only publish their glyph bounds a frame or two later, and
    // fitting early frames a scene with no labels in it.
    settleRef.current += 1;
    if (settleRef.current < 3) return;

    const points = collectFramePoints(groupRef.current);
    if (!points.length) return;

    // The FIRST fit chooses the angle this canvas is best seen from — a
    // portrait phone is looked at from higher up, or a flat world leaves half
    // the screen empty (see frameDirectionForAspect). Every later fit preserves
    // whatever direction the viewer is currently looking from, so a refit after
    // an edit does not yank the camera back out of the angle they orbited to.
    if (firstFitRef.current && !viewerOrbitedRef.current) {
      // The framed aspect, not the canvas aspect: the angle is a claim about
      // the window the chrome leaves, and on a short screen those two disagree
      // by more than a phone differs from a desktop.
      directionRef.current.copy(
        frameDirectionForAspect(framedAspect(camera.aspect, { top, right, bottom, left }))
      );
    } else {
      const target = controls?.target ?? new THREE.Vector3();
      const current = camera.position.clone().sub(target);
      if (current.lengthSq() > 1e-6) directionRef.current.copy(current).normalize();
    }
    const dir = directionRef.current;

    const solved = solveFrameFit(points, dir, camera.fov, camera.aspect, {
      safeArea: { top, right, bottom, left },
      // One label's height above the subject. Labels are not in the fit (a name
      // is not the thing it names) but they are drawn above their items, so a
      // fit that ends at the tallest item ends where its label starts.
      headroom: ANNOTATION_HEADROOM_PX / Math.max(1, size.height),
      margin
    });
    if (!solved) return;
    const distance = solved.distance;

    camera.position.copy(solved.center).addScaledVector(dir, distance);
    camera.near = Math.max(0.1, distance / 120);
    // Generous far plane: the gradient sky sphere lives outside this group at a
    // fixed radius of 220 and must never be clipped away.
    camera.far = Math.max(distance * 12, 900);
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.copy(solved.center);
      controls.update?.();
    }

    if (fitRef) {
      fitRef.distance = distance;
      fitRef.radius = solved.radius;
      fitRef.center = [solved.center.x, solved.center.y, solved.center.z];
      fitRef.ready = true;
    }

    // Labels are sized against the camera (see metaphorScreenScale.js), so the
    // first solve measures them at the pre-fit distance — on a scene the fit
    // pulls back from, every name then grows and the outermost ones hang off the
    // edge of the frame the solve just chose. Re-solve until the answer stops
    // moving; without chrome or labels the second pass agrees immediately and
    // this costs one extra frame.
    const previous = lastDistanceRef.current;
    lastDistanceRef.current = distance;
    passRef.current += 1;
    const settled =
      passRef.current >= MAX_FIT_PASSES ||
      (previous > 0 && Math.abs(distance - previous) / previous < FIT_TOLERANCE);
    if (settled) {
      pendingRef.current = false;
      passRef.current = 0;
      lastDistanceRef.current = 0;
      firstFitRef.current = false;
    }
    settleRef.current = 2;
  });

  return <group ref={groupRef}>{children}</group>;
}
