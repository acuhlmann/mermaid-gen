import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  DEFAULT_FRAME_DIRECTION,
  FRAME_IGNORE,
  FRAME_IGNORE_DATA,
  collectFramePoints,
  frameDirectionForAspect,
  safeAreaWindow,
  solveFrameFit
} from '../src/components/metaphorScenes/sceneFraming.js';
import { MetaphorGroundShadow } from '../src/components/metaphorScenes/MetaphorSceneChrome.jsx';
import {
  DEFAULT_GROUND_HAZE,
  hazeBand,
  sceneWantsHaze
} from '../src/components/metaphorScenes/metaphorAtmosphere.js';

const DIR = new THREE.Vector3(18, 14, 18).normalize();
const FULL = { top: 0, right: 0, bottom: 0, left: 0 };

/** Fraction of the frame the solved fit gives the content, on each axis. */
function frameFill(points, dir, fov, aspect) {
  const solved = solveFrameFit(points, dir, fov, aspect);
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
  const up = new THREE.Vector3().crossVectors(dir, right).normalize();
  const tanV = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  const tanH = tanV * aspect;
  let maxU = 0;
  let maxV = 0;
  for (const point of points) {
    const local = point.clone().sub(solved.center);
    const depth = solved.distance - local.dot(dir);
    maxU = Math.max(maxU, Math.abs(local.dot(right)) / (depth * tanH));
    maxV = Math.max(maxV, Math.abs(local.dot(up)) / (depth * tanV));
  }
  return { width: maxU, height: maxV, distance: solved.distance };
}

/** Where every point lands in NDC for a solved fit — what the viewer sees. */
function ndcBox(points, dir, fov, aspect, options) {
  const solved = solveFrameFit(points, dir, fov, aspect, options);
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
  const up = new THREE.Vector3().crossVectors(dir, right).normalize();
  const tanV = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  const tanH = tanV * aspect;
  const box = { xMin: Infinity, xMax: -Infinity, yMin: Infinity, yMax: -Infinity };
  for (const point of points) {
    const local = point.clone().sub(solved.center);
    const depth = solved.distance - local.dot(dir);
    const x = local.dot(right) / (depth * tanH);
    const y = local.dot(up) / (depth * tanV);
    box.xMin = Math.min(box.xMin, x);
    box.xMax = Math.max(box.xMax, x);
    box.yMin = Math.min(box.yMin, y);
    box.yMax = Math.max(box.yMax, y);
  }
  return { ...box, distance: solved.distance };
}

/** Ring of points approximating a flat ground disc of `radius`. */
function disc(radius, segments = 64) {
  return Array.from({ length: segments }, (_, i) => {
    const angle = (i / segments) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  });
}

describe('solveFrameFit', () => {
  it('fills at least one axis of the frame edge to edge', () => {
    // The whole point of replacing drei Bounds: its largest-axis solve left the
    // subject at ~55-65% of the frame on every substrate-disc scene.
    const points = [...disc(12), new THREE.Vector3(0, 9, 0)];
    const fill = frameFill(points, DIR, 45, 1280 / 820);
    expect(Math.max(fill.width, fill.height)).toBeGreaterThan(0.98);
  });

  it('never clips: no sampled point falls outside the frame', () => {
    const points = [...disc(12), new THREE.Vector3(0, 9, 0), new THREE.Vector3(4, 26, -3)];
    const fill = frameFill(points, DIR, 45, 1280 / 820);
    expect(fill.width).toBeLessThanOrEqual(1.0001);
    expect(fill.height).toBeLessThanOrEqual(1.0001);
  });

  it('scales the distance with the content, not with the point count', () => {
    const small = frameFill(disc(6), DIR, 45, 1.6);
    const large = frameFill(disc(24), DIR, 45, 1.6);
    expect(large.distance / small.distance).toBeGreaterThan(3.5);
    expect(large.distance / small.distance).toBeLessThan(4.5);
  });

  it('centres the subject even when its mass is off to one side', () => {
    // A ferris wheel over a small plaza: most geometry high, ground at zero.
    const points = [...disc(4), new THREE.Vector3(0, 14, 0), new THREE.Vector3(2, 12, 1)];
    const solved = solveFrameFit(points, DIR, 45, 1.6);
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), DIR).normalize();
    const up = new THREE.Vector3().crossVectors(DIR, right).normalize();
    let vMin = Infinity;
    let vMax = -Infinity;
    for (const point of points) {
      const v = point.clone().sub(solved.center).dot(up);
      vMin = Math.min(vMin, v);
      vMax = Math.max(vMax, v);
    }
    expect(Math.abs(vMin + vMax)).toBeLessThan(0.01);
  });
});

describe('solveFrameFit with overlay chrome', () => {
  // A tall subject on a wide plate — the shape every reported collision had:
  // the reading strip sat across the top of the canvas and the top of the
  // subject was drawn behind it.
  const SUBJECT = [...disc(12), new THREE.Vector3(0, 16, 0), new THREE.Vector3(2, 14, -1)];

  it('keeps the subject out of the band the chrome covers', () => {
    const top = 0.22;
    const box = ndcBox(SUBJECT, DIR, 45, 390 / 844, { safeArea: { top } });
    expect(box.yMax).toBeLessThanOrEqual(1 - 2 * top + 0.02);
    expect(box.yMin).toBeGreaterThanOrEqual(-1.02);
  });

  it('clears both a top strip and a bottom card at once', () => {
    const box = ndcBox(SUBJECT, DIR, 45, 390 / 844, {
      safeArea: { top: 0.2, bottom: 0.14 }
    });
    expect(box.yMax).toBeLessThanOrEqual(1 - 0.4 + 0.02);
    expect(box.yMin).toBeGreaterThanOrEqual(-1 + 0.28 - 0.02);
  });

  it('pulls back rather than cropping when the chrome takes height', () => {
    const bare = solveFrameFit(SUBJECT, DIR, 45, 1280 / 820);
    const chromed = solveFrameFit(SUBJECT, DIR, 45, 1280 / 820, { safeArea: { top: 0.22 } });
    expect(chromed.distance).toBeGreaterThan(bare.distance);
  });

  it('changes nothing at all when there is no chrome', () => {
    const bare = solveFrameFit(SUBJECT, DIR, 45, 1.6);
    const empty = solveFrameFit(SUBJECT, DIR, 45, 1.6, { safeArea: FULL });
    expect(empty.distance).toBeCloseTo(bare.distance, 6);
    expect(empty.center.distanceTo(bare.center)).toBeLessThan(1e-6);
  });

  it('folds the margin in rather than leaving it to the caller', () => {
    // The margin has to be applied before the off-centre shift is computed:
    // multiplying the distance afterwards slides the subject back under the
    // chrome by exactly the margin.
    const plain = solveFrameFit(SUBJECT, DIR, 45, 1.6);
    const roomy = solveFrameFit(SUBJECT, DIR, 45, 1.6, { margin: 1.2 });
    expect(roomy.distance / plain.distance).toBeCloseTo(1.2, 6);
  });

  it('caps what one edge of chrome may claim', () => {
    const window_ = safeAreaWindow({ top: 0.9, bottom: 0.9 });
    expect(window_.yMax).toBeGreaterThan(0);
    expect(window_.yMin).toBeLessThan(0);
  });
});

describe('frameDirectionForAspect', () => {
  it('keeps the desktop three-quarter angle on a landscape canvas', () => {
    expect(frameDirectionForAspect(1440 / 900).distanceTo(DEFAULT_FRAME_DIRECTION)).toBeLessThan(
      1e-6
    );
  });

  it('looks down harder on a portrait canvas so a flat world fills it', () => {
    const phone = frameDirectionForAspect(390 / 844);
    expect(phone.y).toBeGreaterThan(DEFAULT_FRAME_DIRECTION.y);
    expect(phone.length()).toBeCloseTo(1, 6);
  });

  it('fills more of a portrait canvas than the landscape angle would', () => {
    const world = disc(14);
    const aspect = 390 / 844;
    const flat = ndcBox(world, DEFAULT_FRAME_DIRECTION, 45, aspect);
    const lifted = ndcBox(world, frameDirectionForAspect(aspect), 45, aspect);
    expect(lifted.yMax - lifted.yMin).toBeGreaterThan((flat.yMax - flat.yMin) * 1.3);
  });

  it('keeps the diagonal — a phone loses elevation, not azimuth', () => {
    const phone = frameDirectionForAspect(0.46);
    expect(phone.x).toBeCloseTo(phone.z, 6);
  });
});

describe('collectFramePoints', () => {
  it('samples a disc by its vertices, not its square bounding box', () => {
    // A circleGeometry's bounding box corners sit √2 outside the disc, and being
    // nearest the camera they dominated the solve — the city fitted to 39% of
    // the frame off corners no geometry occupied.
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(10, 48));
    mesh.rotation.x = -Math.PI / 2;
    const root = new THREE.Group();
    root.add(mesh);
    const points = collectFramePoints(root);
    expect(points.length).toBeGreaterThan(40);
    const reach = Math.max(...points.map((p) => Math.hypot(p.x, p.z)));
    expect(reach).toBeLessThan(10.01);
  });

  it('prunes subtrees flagged as ambience', () => {
    const root = new THREE.Group();
    const subject = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const ambience = new THREE.Group();
    ambience.userData[FRAME_IGNORE] = true;
    ambience.position.set(60, 30, 60);
    ambience.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    root.add(subject, ambience);

    const reach = Math.max(...collectFramePoints(root).map((p) => p.length()));
    expect(reach).toBeLessThan(2);
  });

  it('keeps the contact-shadow catcher out of the fit', () => {
    // The catcher is deliberately sized past the subject so the blur has
    // somewhere to fall, and it is invisible except where a shadow lands. Left
    // in the fit it became the binding constraint on nearly every grounded kind
    // and the camera framed a rectangle nobody can see: measured, the city
    // needed 44 units for its skyline and 57 for this plane, and the fused
    // composite 20 against 30. Asserted on the element rather than through a
    // renderer because R3F cannot mount in jsdom.
    const element = MetaphorGroundShadow({ theme: { postfx: {} } });
    expect(element.props.userData).toBe(FRAME_IGNORE_DATA);
    expect(FRAME_IGNORE_DATA[FRAME_IGNORE]).toBe(true);
  });

  it('flags the fused ocean disc as framing scaffolding', () => {
    // circleGeometry's bounding box is a square; a disc sized to the world
    // otherwise becomes the fit the same way the city footing did. WorldGround
    // uses hooks so it cannot be called like MetaphorGroundShadow — pin the
    // flag on the function body instead.
    const source = readFileSync(
      new URL('../src/components/metaphorScenes/fusedCompositePrimitives.jsx', import.meta.url),
      'utf8'
    );
    const worldGround = source.slice(source.indexOf('export function WorldGround'));
    expect(worldGround.length).toBeGreaterThan(80);
    expect(worldGround).toContain('FRAME_IGNORE_DATA');
  });
});

describe('hazeBand', () => {
  it('keeps the haze behind the subject however far the camera sits', () => {
    // The reported bug: a fixed `near: 40` sat behind a small scene and in front
    // of a large one, so big tree groves washed out into the fog colour.
    for (const [distance, radius] of [
      [20, 6],
      [45, 14],
      [90, 30]
    ]) {
      const band = hazeBand(distance, radius, DEFAULT_GROUND_HAZE);
      expect(band.near).toBeGreaterThan(distance);
      expect(band.far).toBeGreaterThan(band.near);
    }
  });

  it('lets a heavy mood close in without swallowing the near face', () => {
    const storm = hazeBand(45, 14, 0.62);
    expect(storm.near).toBeLessThan(45);
    expect(storm.near).toBeGreaterThan(45 - 14);
  });

  it('gives space kinds no ground haze', () => {
    expect(sceneWantsHaze('galaxy')).toBe(false);
    expect(sceneWantsHaze('orrery')).toBe(false);
    expect(sceneWantsHaze('tree')).toBe(true);
  });
});
