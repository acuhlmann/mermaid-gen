/**
 * World measurement of a single scene item, shared by everything that has to
 * point at one: the selection ring and the guided read's camera.
 *
 * The subtlety is what counts as "the item". An item group holds its shape AND
 * the annotations describing it — a billboarded name plate, a glow disc, an
 * accent pin — and those are far larger than the thing itself. A one-word label
 * is a ~7-unit wide plate over a 3-unit tower, so a naive bounding box reports
 * the item at twice its real width; a ring sized from it is a hoop around the
 * skyline and a camera framed on it stops short. Annotations already carry
 * `FRAME_IGNORE` for the scene fit, so the same flag prunes them here; troika
 * text has no marker of its own and is found through its material.
 */
import * as THREE from 'three';
import { FRAME_IGNORE } from './sceneFraming.js';

const scratchBox = new THREE.Box3();
const scratchGeometryBox = new THREE.Box3();
const scratchCenter = new THREE.Vector3();
const scratchSize = new THREE.Vector3();
const scratchWorld = new THREE.Vector3();

/**
 * World bounds of an object's own geometry — its shape, not the annotations
 * that describe it. Returns a shared Box3 (do not retain) or null.
 *
 * @param {THREE.Object3D} object
 * @returns {THREE.Box3 | null}
 */
export function measureItemShape(object) {
  object.updateWorldMatrix(true, true);
  scratchBox.makeEmpty();
  let found = false;
  const visit = (node) => {
    if (!node.visible || node.userData?.[FRAME_IGNORE]) return;
    if (node.material?.isTroikaTextMaterial) return;
    const geometry = node.geometry;
    if (geometry) {
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const local = geometry.boundingBox;
      if (local && !local.isEmpty()) {
        scratchGeometryBox.copy(local).applyMatrix4(node.matrixWorld);
        scratchBox.union(scratchGeometryBox);
        found = true;
      }
    }
    for (const child of node.children) visit(child);
  };
  visit(object);
  return found && !scratchBox.isEmpty() ? scratchBox : null;
}

/**
 * Resolve an item id to its live object plus the offsets and radii its two
 * consumers need.
 *
 * Offsets, not absolute points: measured once per pick rather than every frame,
 * because walking an item group's geometry at 60fps is far too costly — and an
 * item that animates (an orbiting planet, a cycling pod) moves its group
 * without changing its own shape, so the offset stays true while the world
 * position does the moving.
 *
 * - `baseOffset` lands on the ground under the item, where a spotlight falls.
 * - `centerOffset` lands in the middle of its mass, which is what a camera
 *   should look at: aiming at the base of an 18-unit tower puts the tower off
 *   the top of the frame.
 * - `groundRadius` measures the horizontal footprint (what a flat ring must
 *   enclose); `boundRadius` measures the whole shape (what a camera must fit).
 *
 * @param {THREE.Object3D | null} scene
 * @param {string | null} id
 * @returns {{ object: THREE.Object3D, baseOffset: THREE.Vector3, centerOffset: THREE.Vector3,
 *   groundRadius: number, boundRadius: number } | null}
 */
export function measureItemPlacement(scene, id) {
  if (!scene || !id) return null;
  const object = scene.getObjectByName(id);
  if (!object) return null;
  const box = measureItemShape(object);
  if (!box) return null;
  box.getCenter(scratchCenter);
  box.getSize(scratchSize);
  object.getWorldPosition(scratchWorld);
  return {
    object,
    baseOffset: new THREE.Vector3(scratchCenter.x, box.min.y, scratchCenter.z).sub(scratchWorld),
    centerOffset: scratchCenter.clone().sub(scratchWorld),
    groundRadius: Math.max(scratchSize.x, scratchSize.z) * 0.62,
    boundRadius: 0.5 * Math.hypot(scratchSize.x, scratchSize.y, scratchSize.z)
  };
}
