import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  FRAME_IGNORE,
  FRAME_IGNORE_DATA,
  collectFramePoints,
  solveFrameFit
} from '../src/components/metaphorScenes/sceneFraming.js';
import { MetaphorGroundShadow } from '../src/components/metaphorScenes/MetaphorSceneChrome.jsx';
import {
  DEFAULT_GROUND_HAZE,
  hazeBand,
  sceneWantsHaze
} from '../src/components/metaphorScenes/metaphorAtmosphere.js';

const DIR = new THREE.Vector3(18, 14, 18).normalize();

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
