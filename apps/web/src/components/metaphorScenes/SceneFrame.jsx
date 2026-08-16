/**
 * `<SceneFrame>` — fits the camera to the scene it wraps. The maths (and the
 * reasoning behind it) lives in sceneFraming.js; this file only owns the R3F
 * lifecycle: when to re-measure, and what to do with the answer.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { DEFAULT_FRAME_DIRECTION, collectFramePoints, solveFrameFit } from './sceneFraming.js';

/**
 * Frames `children` in the camera. Re-fits when `contentKey` changes or the
 * canvas resizes, then leaves the camera alone so OrbitControls owns it.
 *
 * @param {object} props
 * @param {number} [props.margin] — breathing room multiplier (1 = edge-to-edge).
 * @param {string} props.contentKey — refit trigger; change it when the scene changes.
 * @param {{ distance: number, radius: number, center: number[], ready: boolean }} [props.fitRef]
 */
export function SceneFrame({ children, margin = 1.06, contentKey, fitRef = null }) {
  const groupRef = useRef(null);
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls);
  const size = useThree((state) => state.size);
  const pendingRef = useRef(true);
  const settleRef = useRef(0);
  const directionRef = useRef(DEFAULT_FRAME_DIRECTION.clone());

  useEffect(() => {
    pendingRef.current = true;
    settleRef.current = 0;
  }, [contentKey, size.width, size.height, margin]);

  useFrame(() => {
    if (!pendingRef.current || !groupRef.current) return;
    // Geometry built in children's `useMemo` exists at mount, but drei/troika
    // label meshes only publish their glyph bounds a frame or two later, and
    // fitting early frames a scene with no labels in it.
    settleRef.current += 1;
    if (settleRef.current < 3) return;

    const points = collectFramePoints(groupRef.current);
    if (!points.length) return;

    // Preserve whatever direction the viewer is currently looking from, so a
    // refit after an edit does not yank the camera back to the default angle.
    const target = controls?.target ?? new THREE.Vector3();
    const current = camera.position.clone().sub(target);
    if (current.lengthSq() > 1e-6) directionRef.current.copy(current).normalize();
    const dir = directionRef.current;

    const solved = solveFrameFit(points, dir, camera.fov, camera.aspect);
    if (!solved) return;
    const distance = Math.max(0.5, solved.distance * margin);

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

    pendingRef.current = false;
    settleRef.current = 0;
  });

  return <group ref={groupRef}>{children}</group>;
}
