/**
 * Screen-relative sizing for scene text.
 *
 * This is the fifth time the same trap has been paid for here (the fog band, the
 * AO radius, the accent caption, the guided read's camera flight — see
 * CLAUDE.md § Metaphor3D). Anything whose job is described in terms of what the
 * VIEWER sees cannot be authored as a world size, because these scenes run from
 * a 14-unit cake to a 60-unit bridge and are viewed on canvases from a 390 px
 * phone to a 2560 px desktop.
 *
 * Item labels were the last holdout, and it showed: a label is drawn in world
 * units, so a near one rendered three times the size of a far one in the same
 * scene. Measured on the fused composite, "Shipping API" came out at 26 px cap
 * height and "Browse" at 9 px, which reads as a rendering fault rather than as
 * perspective — and on a phone the far half of every scene fell under the size
 * anyone can read at all.
 *
 * The conversion is exact: at camera distance `d`, one screen pixel spans
 * `2·d·tan(fov/2) / viewportHeightPx` world units, so a label wanting `p` pixels
 * of cap height wants `p` of those. The clamps only stop pathological cases —
 * an item practically inside the camera, or one behind the far plane.
 */
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

/** Cap height, in CSS pixels, that an item label aims for. */
export const LABEL_TARGET_PX = 13.5;

/** Cap height for the smaller secondary labels (link captions). */
export const LINK_LABEL_TARGET_PX = 11;

/**
 * Pathological-case bounds only, deliberately far outside anything a real scene
 * asks for. Tight clamps here quietly re-create the bug: at 0.35 a 14-unit
 * layercake was already pinned to the floor of the range, so the type size the
 * conversion had just solved for was thrown away on exactly the small scenes it
 * mattered most on.
 */
const MIN_SCALE = 0.05;
const MAX_SCALE = 12;

/**
 * World size of one screen pixel at `distance` from a perspective camera.
 *
 * @param {number} distance — camera-to-subject distance, world units
 * @param {number} fovDegrees — vertical field of view
 * @param {number} viewportHeightPx — canvas height in CSS pixels
 */
export function worldUnitsPerPixel(distance, fovDegrees, viewportHeightPx) {
  const height = Math.max(1, viewportHeightPx);
  const tanV = Math.tan((Math.max(1, fovDegrees) * Math.PI) / 360);
  return (2 * Math.max(0.001, distance) * tanV) / height;
}

/**
 * Multiplier that turns an authored world size into a constant on-screen size.
 *
 * @param {object} args
 * @param {number} args.distance — camera-to-object distance, world units
 * @param {number} args.fovDegrees
 * @param {number} args.viewportHeightPx
 * @param {number} args.worldSize — the size the object is authored at
 * @param {number} args.targetPx — the size it should occupy on screen
 * @returns {number}
 */
export function screenConstantScale({
  distance,
  fovDegrees,
  viewportHeightPx,
  worldSize,
  targetPx
}) {
  if (!(worldSize > 0) || !(targetPx > 0)) return 1;
  const wanted = targetPx * worldUnitsPerPixel(distance, fovDegrees, viewportHeightPx);
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, wanted / worldSize));
}

/**
 * Holds `ref`'s group at a constant on-screen size. Written straight onto the
 * object every frame rather than through React state: a hundred labels
 * re-rendering whenever the camera moves would cost more than the labels do.
 */
export function useScreenConstantScale(ref, worldSize, targetPx) {
  const probe = useRef(new THREE.Vector3());
  useFrame((state) => {
    const group = ref.current;
    if (!group) return;
    group.getWorldPosition(probe.current);
    group.scale.setScalar(
      screenConstantScale({
        distance: state.camera.position.distanceTo(probe.current),
        fovDegrees: state.camera.fov ?? 45,
        viewportHeightPx: state.size.height,
        worldSize,
        targetPx
      })
    );
  });
}
