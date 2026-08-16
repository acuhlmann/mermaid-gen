/**
 * Pure camera-framing maths for metaphor scenes. The `<SceneFrame>` component
 * that drives it lives in SceneFrame.jsx; everything here is side-effect free
 * and directly testable.
 *
 * This replaces drei's `<Bounds fit>`, whose fit solves `maxSize / (2·tan(fov/2))`
 * from the box's LARGEST axis and compares it against the same number divided by
 * the aspect — so a wide, flat scene (every substrate-disc metaphor: city plate,
 * tree meadow, archipelago ocean) is fitted as if its width had to fit the
 * VERTICAL field of view. Measured on the tree grove: the subject filled ~55% of
 * the frame height and ~65% of its width, and the wasted margin read as "the
 * scene is small and far away" on every kind.
 *
 * We solve the fit exactly instead. Each sample point, expressed in the camera
 * basis (right `u`, up `v`, toward-camera `w`), is inside the frustum at camera
 * distance D when
 *
 *     |v| ≤ (D − w)·tan(vFov/2)     and     |u| ≤ (D − w)·tan(hFov/2)
 *
 * so the tightest D is the max over points of `w + |v|/tanV` and `w + |u|/tanH`.
 *
 * What we sample matters more than the solve. Bounding boxes over-claim, and
 * they over-claim worst exactly where these scenes spend their space: the
 * bounding box of a `circleGeometry` is a SQUARE, so its diagonal corners sit
 * √2 outside a ground disc that never reaches them. Those phantom corners are
 * also the points nearest the camera, so they win the max — measured on the
 * city, a footing of radius 24 pushed the camera out to 95 units and the
 * subject rendered at 39% of the frame. So small meshes are sampled by their
 * real vertices (a circle's vertices are on the circle), and only geometry too
 * dense to walk falls back to box corners, where a box is a fair description
 * anyway (heightmaps, planes).
 *
 * Ambient decoration — birds, pollen, embers, drifting clouds — opts out via
 * `userData[FRAME_IGNORE]`. A bird wheeling above the treeline is not part of
 * the subject, and letting one dictate the framing shrinks everything else to
 * make room for a 3-pixel silhouette.
 */
import * as THREE from 'three';

const WORLD_UP = new THREE.Vector3(0, 1, 0);
/** Per-mesh vertex budget; above this the box corners are used instead. */
const MAX_MESH_VERTICES = 512;
/** Whole-scene sample budget — the solve is two linear passes over this. */
const MAX_SAMPLE_POINTS = 60000;

/** userData flag that keeps a subtree out of the camera fit. */
export const FRAME_IGNORE = 'metaphorFrameIgnore';

/** Shared frozen userData for anything opting out of the fit. */
export const FRAME_IGNORE_DATA = Object.freeze({ [FRAME_IGNORE]: true });

/** Default view direction before OrbitControls has published a target. */
export const DEFAULT_FRAME_DIRECTION = new THREE.Vector3(18, 14, 18).normalize();

/** Mutable fit record shared with the atmosphere layer. */
export function createSceneFit() {
  return { distance: 32, radius: 12, center: [0, 0, 0], ready: false };
}

/**
 * World-space sample points describing what the camera must contain: every
 * visible mesh's vertices when it is small enough to walk, its bounding-box
 * corners otherwise. Subtrees flagged `userData[FRAME_IGNORE]` are pruned.
 *
 * @param {THREE.Object3D} root
 * @returns {THREE.Vector3[]}
 */
export function collectFramePoints(root) {
  const points = [];
  root.updateWorldMatrix(true, true);

  const pushBoxCorners = (geometry, matrix) => {
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box || box.isEmpty()) return;
    for (let sx = 0; sx < 2; sx += 1) {
      for (let sy = 0; sy < 2; sy += 1) {
        for (let sz = 0; sz < 2; sz += 1) {
          points.push(
            new THREE.Vector3(
              sx ? box.max.x : box.min.x,
              sy ? box.max.y : box.min.y,
              sz ? box.max.z : box.min.z
            ).applyMatrix4(matrix)
          );
        }
      }
    }
  };

  // Manual walk (not traverseVisible) so a flagged subtree can be skipped whole.
  const visit = (object) => {
    if (!object.visible || object.userData?.[FRAME_IGNORE]) return;
    const geometry = object.geometry;
    if (geometry && points.length < MAX_SAMPLE_POINTS) {
      const position = geometry.attributes?.position;
      if (position && position.count > 0 && position.count <= MAX_MESH_VERTICES) {
        for (let i = 0; i < position.count; i += 1) {
          points.push(
            new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i)).applyMatrix4(
              object.matrixWorld
            )
          );
        }
      } else {
        pushBoxCorners(geometry, object.matrixWorld);
      }
    }
    for (const child of object.children) visit(child);
  };
  visit(root);

  return points;
}

/**
 * Tight perspective fit for a point cloud along unit view direction `dir`
 * (pointing from the subject toward the camera).
 *
 * Recentres before solving: the look-at target is the midpoint of the points'
 * projected extent, not their bounding-box centre, so tall-and-off-centre
 * scenes (a ferris wheel over a small plaza) sit in the middle of the frame.
 *
 * @param {THREE.Vector3[]} points
 * @param {THREE.Vector3} dir
 * @param {number} fovDegrees — vertical field of view
 * @param {number} aspect — viewport width / height
 * @returns {{ distance: number, center: THREE.Vector3, radius: number } | null}
 */
export function solveFrameFit(points, dir, fovDegrees, aspect) {
  if (!points.length) return null;

  const right = new THREE.Vector3().crossVectors(WORLD_UP, dir);
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
  right.normalize();
  const up = new THREE.Vector3().crossVectors(dir, right).normalize();

  const tanV = Math.tan(THREE.MathUtils.degToRad(fovDegrees) / 2);
  const tanH = tanV * Math.max(0.2, aspect);

  const seed = new THREE.Vector3();
  for (const point of points) seed.add(point);
  seed.divideScalar(points.length);

  // Pass 1 — projected extent about the centroid, to find the true centre.
  let uMin = Infinity;
  let uMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;
  let wMin = Infinity;
  let wMax = -Infinity;
  const local = new THREE.Vector3();
  for (const point of points) {
    local.copy(point).sub(seed);
    const u = local.dot(right);
    const v = local.dot(up);
    const w = local.dot(dir);
    if (u < uMin) uMin = u;
    if (u > uMax) uMax = u;
    if (v < vMin) vMin = v;
    if (v > vMax) vMax = v;
    if (w < wMin) wMin = w;
    if (w > wMax) wMax = w;
  }

  const center = seed
    .clone()
    .addScaledVector(right, (uMin + uMax) / 2)
    .addScaledVector(up, (vMin + vMax) / 2)
    .addScaledVector(dir, (wMin + wMax) / 2);

  // Pass 2 — solve the binding distance about the recentred target.
  let distance = 0;
  for (const point of points) {
    local.copy(point).sub(center);
    const w = local.dot(dir);
    const need = Math.max(
      w + Math.abs(local.dot(up)) / tanV,
      w + Math.abs(local.dot(right)) / tanH
    );
    if (need > distance) distance = need;
  }

  const radius = Math.max(0.5, Math.hypot((uMax - uMin) / 2, (vMax - vMin) / 2, (wMax - wMin) / 2));
  return { distance: Math.max(0.5, distance), center, radius };
}
