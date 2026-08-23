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
 *
 * The **substrate** opts out for the same reason, and it is the larger win.
 * Every grounded kind stands on a disc sized `max(floor, contentRadius × pad)`,
 * so the ground is 1.3–1.5× the widest item on an ordinary 6–10 item scene —
 * and because it is a *circle* around a layout that is rarely circular, its rim
 * reaches furthest exactly where nothing stands. Measured on the city that is a
 * subject at 77% of the width it could have; on the garden, 65%. Cutting a
 * ground plane off at the frame edge is also the better picture: a floor that
 * runs out of frame reads as a world, a disc with margin all round reads as a
 * coaster. What the ground still owes the subject is *lateral* room for the
 * labels, which is `SceneFrame`'s annotation margin, not the disc's padding.
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

/** Elevation of that default, in degrees — the desktop three-quarter view. */
const BASE_ELEVATION_DEG = THREE.MathUtils.radToDeg(Math.asin(DEFAULT_FRAME_DIRECTION.y));
/** Elevation a portrait canvas is viewed from. */
const TALL_ELEVATION_DEG = 52;
/** Aspect at which the portrait lift is fully applied (≈ a phone in portrait). */
const TALL_ASPECT = 0.4;
/** Elevation a letterbox window is viewed from — still a three-quarter view. */
const WIDE_ELEVATION_DEG = 19;
/** Aspect at which the letterbox drop is fully applied. */
const WIDE_ASPECT = 3;

/**
 * The angle a scene should first be seen from on THIS canvas.
 *
 * Almost every kind here is a wide, flat world — a plate of towers, an ocean of
 * islands, a grove. Seen from the desktop three-quarter angle its footprint
 * projects to under half its width in height, which is exactly right in a
 * landscape frame and wasteful in a portrait one: measured on a 390×844 phone,
 * the fused composite was width-bound and left 46% of the canvas empty above and
 * below the world. Raising the camera toward top-down makes that footprint
 * project rounder, so the same width-bound fit fills the height too.
 *
 * The other end of the same argument is a LETTERBOX, and it is the one a
 * foldable cover hands you: between a full-width reading strip and the app's
 * composer band, a 717x512 cover leaves a window of aspect 3. A flat world seen
 * from high up projects rounder — which is exactly wrong there, because the
 * height is the axis that ran out. Dropping toward 19° foreshortens the
 * footprint back into the band the chrome left, and 19° is still a built
 * three-quarter view rather than a plan.
 *
 * Pass the FRAMED aspect (see `framedAspect`), not the canvas aspect: the two
 * disagree most on exactly the short screens this exists for.
 *
 * Azimuth is untouched — the diagonal is what makes these scenes read as
 * built rather than plotted, and a phone has no reason to lose it.
 *
 * @param {number} aspect — framed width / height
 * @returns {THREE.Vector3} unit direction from subject toward camera
 */
export function frameDirectionForAspect(aspect) {
  const safe = typeof aspect === 'number' && Number.isFinite(aspect) ? aspect : 1;
  if (safe >= 1) {
    if (safe <= 1.6) return DEFAULT_FRAME_DIRECTION.clone();
    const wide = Math.min(1, (safe - 1.6) / (WIDE_ASPECT - 1.6));
    return directionAtElevation(
      BASE_ELEVATION_DEG + (WIDE_ELEVATION_DEG - BASE_ELEVATION_DEG) * wide
    );
  }
  const t = Math.min(1, Math.max(0, (1 - safe) / (1 - TALL_ASPECT)));
  return directionAtElevation(BASE_ELEVATION_DEG + (TALL_ELEVATION_DEG - BASE_ELEVATION_DEG) * t);
}

/** The default azimuth, raised or dropped to `degrees` above the ground plane. */
function directionAtElevation(degrees) {
  const elevation = THREE.MathUtils.degToRad(degrees);
  const horizontal = Math.cos(elevation);
  return new THREE.Vector3(
    horizontal * Math.SQRT1_2,
    Math.sin(elevation),
    horizontal * Math.SQRT1_2
  );
}

/**
 * Cap on what one edge of chrome may claim. Past this the camera has to retreat
 * so far that the subject is a speck framed politely between two panels, which
 * reads worse than a panel over one corner of it. The cap also guarantees the
 * window still contains the frame centre, which the solve below relies on.
 */
const MAX_SAFE_EDGE = 0.3;

/**
 * Floor under the window an axis keeps for the subject, whatever the chrome on
 * BOTH its edges adds up to. The per-edge cap alone does not provide one: it is
 * a rule about one panel, and a short canvas has a band on each end. Measured on
 * a 717x512 foldable cover, the reading strip claimed 0.28 of the top and the
 * app's composer band plus taskbar claimed 0.26 of the bottom — each legal, and
 * together they left the city 46% of the height to live in, so it rendered as a
 * small island of towers inside a frame of empty gradient.
 *
 * Two opposed panels are the case where reserving honestly is worse than
 * overlapping slightly: the subject cannot lean away from both, so every pixel
 * reserved is paid twice. Past this floor the excess is scaled back across the
 * pair, in proportion — the thicker band still claims more, and the thinner one
 * is not asked to give up what the thick one wants.
 */
const MIN_AXIS_WINDOW = 0.55;

/** Cap on the annotation line, so a tiny canvas cannot reserve its whole top. */
const MAX_HEADROOM = 0.1;

/**
 * The annotation line above the subject, in CSS pixels — one item label's drawn
 * height (`ItemLabel` plates ~13.5px type into ~21px) plus a little air. It is
 * a pixel constant rather than a fraction because labels are screen-constant:
 * the room a name needs is the same on every canvas, so it costs a 4K display
 * almost nothing and a foldable cover a visible slice, which is exactly right.
 */
export const ANNOTATION_HEADROOM_PX = 26;

/**
 * The lateral counterpart, in CSS pixels per side. A name is centred over its
 * item, so the outermost item hangs part of a plate past its own geometry — and
 * with the substrate out of the fit (see the note at the top of this file) that
 * geometry now reaches the frame edge. Like the headroom it is a pixel constant,
 * because a screen-constant label needs the same room on every canvas.
 *
 * It is deliberately much smaller than half a plate, and both ends were
 * measured on a 390x844 phone rather than reasoned about:
 *
 * - At **58px** (half a typical plate) the reservation cost more than the
 *   substrate opt-out gained. The fused composite came back SMALLER than before
 *   either change, showing one label fewer, because its ocean was already out of
 *   the fit — so it paid the gutter and collected nothing.
 * - At **0** the city and the composite were both bigger AND showed more names,
 *   which very nearly makes the case for dropping this outright. What stops it
 *   is the subway: "SIGNUP" rendered as "SIGNU", clipped by the canvas edge. A
 *   pinned placard survives at the relaxed on-canvas bar precisely so a fused
 *   world's edge placards are not all dropped, and that relaxation is what lets
 *   a genuinely cut one through.
 *
 * So the job is not to fit a whole label past the subject — the declutter pass
 * already drops one that lands too far out. It is to buy back the last glyph of
 * a name the pinning rule has decided to keep, which is a few characters, not
 * half a plate.
 */
export const ANNOTATION_GUTTER_PX = 26;

/** Cap on the lateral line — a narrow canvas must not reserve both its sides. */
const MAX_GUTTER = 0.09;

/** No chrome — the whole canvas is the frame. */
export const FULL_SAFE_AREA = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });

function edge(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(MAX_SAFE_EDGE, Math.max(0, value))
    : 0;
}

/**
 * The pair of claims on one axis, scaled back together if they would leave the
 * subject less than `MIN_AXIS_WINDOW` of it.
 *
 * @param {number} low — claim on the near edge (bottom / left)
 * @param {number} high — claim on the far edge (top / right)
 * @returns {[number, number]}
 */
export function scaleAxisClaims(low, high) {
  const total = low + high;
  const budget = 1 - MIN_AXIS_WINDOW;
  if (total <= budget || total <= 0) return [low, high];
  const factor = budget / total;
  return [low * factor, high * factor];
}

/**
 * Turn a chrome inset (fractions of the canvas covered on each edge) into the
 * NDC window the subject must fit inside.
 *
 * The overlays are HTML siblings of the canvas, so the camera has always fitted
 * the subject to the *whole* canvas and then had a title strip drawn across the
 * top of it. On a phone that strip is a fifth of the screen, and on a tall
 * subject — the iceberg's above-water blocks, a city's tallest tower — the part
 * it covers is exactly the part the metaphor exists to show.
 *
 * `headroom` is a line of annotation above the subject, as a fraction of the
 * canvas height. Item labels are not part of the fit — a name is not the thing
 * it names — but they are drawn ABOVE their items, so a fit that ends exactly
 * at the tallest item ends exactly where its label starts. Measured on a
 * 717x512 foldable cover: the accented tower's name landed astride the reading
 * strip's lower edge, half of it dimmed by a translucent panel, which reads as
 * a glitch. It is applied AFTER the axis scaling because it is the subject's
 * own margin, not a claim by a panel, so the rule that stops two panels
 * squeezing the subject must not spend it.
 *
 * `gutter` is the same idea on the horizontal axis — see ANNOTATION_GUTTER_PX —
 * and is applied to both sides, because the leftmost and rightmost items each
 * carry a name centred over them. Both are applied AFTER the axis scaling
 * because they are the subject's own margin, not a claim by a panel, so the
 * rule that stops two panels squeezing the subject must not spend them.
 *
 * @param {{top?: number, right?: number, bottom?: number, left?: number}} [safeArea]
 * @param {number} [headroom] — annotation line above the subject, 0–0.1
 * @param {number} [gutter] — annotation line beside the subject, per side, 0–0.09
 * @returns {{ xMin: number, xMax: number, yMin: number, yMax: number }}
 */
export function safeAreaWindow(safeArea, headroom = 0, gutter = 0) {
  const [bottom, top] = scaleAxisClaims(edge(safeArea?.bottom), edge(safeArea?.top));
  const [left, right] = scaleAxisClaims(edge(safeArea?.left), edge(safeArea?.right));
  const room =
    typeof headroom === 'number' && Number.isFinite(headroom)
      ? Math.min(MAX_HEADROOM, Math.max(0, headroom))
      : 0;
  const side =
    typeof gutter === 'number' && Number.isFinite(gutter)
      ? Math.min(MAX_GUTTER, Math.max(0, gutter))
      : 0;
  return {
    xMin: -1 + 2 * (left + side),
    xMax: 1 - 2 * (right + side),
    yMin: -1 + 2 * bottom,
    yMax: 1 - 2 * (top + room)
  };
}

/**
 * The aspect the subject is actually framed into: the canvas aspect stretched
 * by how much of each axis the chrome left. This is what the view angle should
 * be chosen from, not the canvas aspect — a 717x512 foldable cover reads as a
 * comfortable 1.4 landscape while the window between its two bands is a 3.0
 * letterbox, and those two want the scene seen from very different heights.
 *
 * @param {number} aspect — canvas width / height
 * @param {{top?: number, right?: number, bottom?: number, left?: number}} [safeArea]
 * @returns {number}
 */
export function framedAspect(aspect, safeArea) {
  const safe = typeof aspect === 'number' && Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const window_ = safeAreaWindow(safeArea);
  const width = (window_.xMax - window_.xMin) / 2;
  const height = (window_.yMax - window_.yMin) / 2;
  if (!(width > 0) || !(height > 0)) return safe;
  return safe * (width / height);
}

/** Mutable fit record shared with the atmosphere layer. */
export function createSceneFit() {
  return { distance: 32, radius: 12, center: [0, 0, 0], ready: false };
}

/**
 * True for troika text — the glyph mesh drei's `<Text>` renders. It carries no
 * marker of its own, so it is found through its material, exactly as
 * `itemBounds.js` finds it.
 *
 * @param {THREE.Object3D} object
 */
function isSceneText(object) {
  const material = object.material;
  if (!material) return false;
  if (Array.isArray(material)) return material.some((entry) => entry?.isTroikaTextMaterial);
  return Boolean(material.isTroikaTextMaterial);
}

/**
 * World-space sample points describing what the camera must contain: every
 * visible mesh's vertices when it is small enough to walk, its bounding-box
 * corners otherwise. Subtrees flagged `userData[FRAME_IGNORE]` are pruned.
 *
 * Scene text is pruned too, and it is the same rule the ground-shadow catcher
 * and the ambience layers are pruned by: **a name is not the thing it names.**
 * A label is sized for the READER (`metaphorScreenScale.js`), so its world size
 * grows as the camera pulls back — which makes it a fixed point of the fit, not
 * a constraint on it. Left in, that feedback loop settles wherever the labels
 * stop growing rather than where the subject fits: measured on a 717x512
 * foldable cover, the city's own geometry needed 45 units and its labels pushed
 * the solve to 118, so the towers rendered at 22% of the canvas width inside a
 * frame of empty gradient. The labels are still kept readable — they simply
 * yield when they would be drawn clipped or under a panel, which the declutter
 * pass decides in screen space where the question actually lives (see
 * `labelDeclutter.js`).
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
    if (isSceneText(object)) return;
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

/** Extent of `points` about `seed`, in the camera basis. */
function projectedExtent(points, seed, basis) {
  const local = new THREE.Vector3();
  const out = {
    uMin: Infinity,
    uMax: -Infinity,
    vMin: Infinity,
    vMax: -Infinity,
    wMin: Infinity,
    wMax: -Infinity
  };
  for (const point of points) {
    local.copy(point).sub(seed);
    const u = local.dot(basis.right);
    const v = local.dot(basis.up);
    const w = local.dot(basis.dir);
    if (u < out.uMin) out.uMin = u;
    if (u > out.uMax) out.uMax = u;
    if (v < out.vMin) out.vMin = v;
    if (v > out.vMax) out.vMax = v;
    if (w < out.wMin) out.wMin = w;
    if (w > out.wMax) out.wMax = w;
  }
  return out;
}

/** Rounds of the coupled distance/shift solve; two is enough on real scenes. */
const RECENTRE_ROUNDS = 4;

function isFullFrame(window_) {
  return window_.xMin === -1 && window_.xMax === 1 && window_.yMin === -1 && window_.yMax === 1;
}

/** Smallest camera distance at which every point sits inside the window. */
function bindingDistance(points, center, basis, half, shift) {
  const local = new THREE.Vector3();
  let need = 0;
  for (const point of points) {
    local.copy(point).sub(center);
    const w = local.dot(basis.dir);
    const u = local.dot(basis.right) - shift.u;
    const v = local.dot(basis.up) - shift.v;
    const forV = w + (v >= 0 ? v / half.vTop : -v / half.vBottom);
    const forU = w + (u >= 0 ? u / half.uRight : -u / half.uLeft);
    if (forV > need) need = forV;
    if (forU > need) need = forU;
  }
  return need;
}

/** Where the subject actually lands, in NDC, at `distance`. */
function ndcExtent(points, center, basis, distance, shift) {
  const local = new THREE.Vector3();
  let xLo = Infinity;
  let xHi = -Infinity;
  let yLo = Infinity;
  let yHi = -Infinity;
  for (const point of points) {
    local.copy(point).sub(center);
    const depth = Math.max(0.01, distance - local.dot(basis.dir));
    const x = (local.dot(basis.right) - shift.u) / (depth * basis.tanH);
    const y = (local.dot(basis.up) - shift.v) / (depth * basis.tanV);
    if (x < xLo) xLo = x;
    if (x > xHi) xHi = x;
    if (y < yLo) yLo = y;
    if (y > yHi) yHi = y;
  }
  return { midX: (xLo + xHi) / 2, midY: (yLo + yHi) / 2 };
}

/**
 * Tight perspective fit for a point cloud along unit view direction `dir`
 * (pointing from the subject toward the camera).
 *
 * Recentres before solving: the look-at target is the midpoint of the points'
 * projected extent, not their bounding-box centre, so tall-and-off-centre
 * scenes (a ferris wheel over a small plaza) sit in the middle of the frame.
 *
 * `safeArea` reserves the edges the HTML overlays cover, as fractions of the
 * canvas. The subject is then fitted into that window and shifted to its centre,
 * so a title strip across the top of a phone canvas costs the scene height
 * rather than covering the top of it. `margin` is applied here rather than by
 * the caller because the recentring offset is proportional to the final
 * distance: multiplying afterwards would slide the subject back under the chrome
 * by exactly the margin.
 *
 * @param {THREE.Vector3[]} points
 * @param {THREE.Vector3} dir
 * @param {number} fovDegrees — vertical field of view
 * @param {number} aspect — viewport width / height
 * @param {{ safeArea?: object, margin?: number, headroom?: number, gutter?: number }} [options]
 * @returns {{ distance: number, center: THREE.Vector3, radius: number } | null}
 */
export function solveFrameFit(points, dir, fovDegrees, aspect, options = {}) {
  if (!points.length) return null;
  const window_ = safeAreaWindow(options.safeArea, options.headroom, options.gutter);
  const margin =
    typeof options.margin === 'number' && Number.isFinite(options.margin)
      ? Math.max(1, options.margin)
      : 1;

  const right = new THREE.Vector3().crossVectors(WORLD_UP, dir);
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
  right.normalize();
  const up = new THREE.Vector3().crossVectors(dir, right).normalize();

  const tanV = Math.tan(THREE.MathUtils.degToRad(fovDegrees) / 2);
  const tanH = tanV * Math.max(0.2, aspect);
  // Half-extents of the window the chrome leaves, in world units per unit of
  // camera depth. Asymmetric: a top strip shrinks `vTop` alone.
  const vTop = tanV * window_.yMax;
  const vBottom = tanV * -window_.yMin;
  const uRight = tanH * window_.xMax;
  const uLeft = tanH * -window_.xMin;

  const seed = new THREE.Vector3();
  for (const point of points) seed.add(point);
  seed.divideScalar(points.length);

  // Pass 1 — projected extent about the centroid, to find the true centre.
  const extent = projectedExtent(points, seed, { right, up, dir });
  const center = seed
    .clone()
    .addScaledVector(right, (extent.uMin + extent.uMax) / 2)
    .addScaledVector(up, (extent.vMin + extent.vMax) / 2)
    .addScaledVector(dir, (extent.wMin + extent.wMax) / 2);

  // Pass 2 — distance and off-centre shift together.
  //
  // With chrome the two are coupled: the shift that clears a top strip is
  // proportional to the distance, and the distance needed depends on where the
  // subject sits inside the asymmetric window. A single closed-form pass gets
  // one of them wrong — a shift applied after the solve slides the near face
  // back under the strip, because a point closer to the camera moves further
  // per unit of target shift. A few fixed-point rounds settle both; with no
  // chrome the shift stays zero and one round is the exact solve.
  const basis = { right, up, dir, tanV, tanH };
  const half = { vTop, vBottom, uRight, uLeft };
  const rounds = isFullFrame(window_) ? 1 : RECENTRE_ROUNDS;
  let distance = 0;
  const shift = { u: 0, v: 0 };
  for (let round = 0; round < rounds; round += 1) {
    distance = Math.max(0.5, bindingDistance(points, center, basis, half, shift) * margin);
    if (rounds === 1) break;
    const landed = ndcExtent(points, center, basis, distance, shift);
    shift.u += (landed.midX - (window_.xMin + window_.xMax) / 2) * distance * tanH;
    shift.v += (landed.midY - (window_.yMin + window_.yMax) / 2) * distance * tanV;
  }
  center.addScaledVector(right, shift.u).addScaledVector(up, shift.v);

  const radius = Math.max(
    0.5,
    Math.hypot(
      (extent.uMax - extent.uMin) / 2,
      (extent.vMax - extent.vMin) / 2,
      (extent.wMax - extent.wMin) / 2
    )
  );
  return { distance, center, radius };
}
