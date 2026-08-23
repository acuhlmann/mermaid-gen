import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  ANNOTATION_GUTTER_PX,
  DEFAULT_FRAME_DIRECTION,
  FRAME_IGNORE,
  FRAME_IGNORE_DATA,
  collectFramePoints,
  frameDirectionForAspect,
  framedAspect,
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

  it('leaves the subject a majority of an axis both panels squeeze', () => {
    // The foldable-cover case: a legal top claim and a legal bottom claim that
    // together left a 717x512 city 46% of the height and it rendered as a
    // speck. Neither panel is at fault on its own, which is why the cap has to
    // be per AXIS rather than per edge.
    const window_ = safeAreaWindow({ top: 0.28, bottom: 0.26 });
    expect((window_.yMax - window_.yMin) / 2).toBeGreaterThanOrEqual(0.55 - 1e-9);
  });

  it('scales two opposed claims in proportion, not to the same number', () => {
    const window_ = safeAreaWindow({ top: 0.3, bottom: 0.15 });
    const top = (1 - window_.yMax) / 2;
    const bottom = (1 + window_.yMin) / 2;
    expect(top).toBeGreaterThan(bottom);
    expect(top / bottom).toBeCloseTo(2, 6);
  });

  it('reserves a line of annotation above the subject', () => {
    // Labels are out of the fit (a name is not the thing it names) but they are
    // drawn ABOVE their items, so a fit ending at the tallest item ends where
    // its label starts. Measured on a 717x512 foldable cover: the accented
    // tower's name landed astride the reading strip's lower edge.
    const bare = safeAreaWindow(FULL);
    const roomy = safeAreaWindow(FULL, 26 / 512);
    expect(roomy.yMax).toBeLessThan(bare.yMax);
    expect(roomy.yMin).toBe(bare.yMin);
  });

  it('spends the headroom on top of the chrome, not out of it', () => {
    // It is the subject's own margin, not a claim by a panel, so the rule that
    // stops two panels squeezing the subject must not spend it.
    const squeezed = safeAreaWindow({ top: 0.28, bottom: 0.26 });
    const withRoom = safeAreaWindow({ top: 0.28, bottom: 0.26 }, 0.05);
    expect(squeezed.yMax - withRoom.yMax).toBeCloseTo(0.1, 9);
  });

  it('caps the headroom so a tiny canvas cannot reserve its whole top', () => {
    expect(safeAreaWindow(FULL, 5).yMax).toBeCloseTo(1 - 2 * 0.1, 9);
    expect(safeAreaWindow(FULL, Number.NaN).yMax).toBe(1);
  });

  it('keeps the gutter to a few glyphs, not half a plate', () => {
    // Measured, not reasoned: at half a plate (58px) the fused composite came
    // back smaller than before the substrate opt-out AND one label short,
    // because its ocean was already out of the fit — it paid and collected
    // nothing. The gutter only has to buy back the last glyph of a name the
    // pinning rule has already decided to keep.
    expect(ANNOTATION_GUTTER_PX).toBeGreaterThan(0);
    expect(ANNOTATION_GUTTER_PX).toBeLessThan(40);
  });

  it('reserves the same line of annotation beside the subject, on both sides', () => {
    // The lateral counterpart, and the reason it had to exist: with the ground
    // substrate out of the fit (see the note at the top of sceneFraming.js) the
    // outermost item now reaches the frame edge, and a name is centred over its
    // item — so half a plate hangs past it, and the declutter pass drops any
    // label that is not ~97% on canvas. Reserving the overhang is what turns a
    // bigger subject into a more readable one rather than a wider one with
    // fewer names on it. Both ends of the range were measured — see the constant,
    // which is deliberately a few glyphs rather than half a plate.
    const bare = safeAreaWindow(FULL);
    const roomy = safeAreaWindow(FULL, 0, ANNOTATION_GUTTER_PX / 390);
    expect(roomy.xMax).toBeLessThan(bare.xMax);
    expect(roomy.xMin).toBeGreaterThan(bare.xMin);
    // Symmetric: the leftmost and rightmost items each carry a name.
    expect(roomy.xMax).toBeCloseTo(-roomy.xMin, 9);
    expect(roomy.yMax).toBe(bare.yMax);
  });

  it('spends the gutter on top of the chrome, like the headroom', () => {
    const squeezed = safeAreaWindow({ left: 0.24, right: 0.22 });
    const withRoom = safeAreaWindow({ left: 0.24, right: 0.22 }, 0, 0.05);
    expect(squeezed.xMax - withRoom.xMax).toBeCloseTo(0.1, 9);
    expect(withRoom.xMin - squeezed.xMin).toBeCloseTo(0.1, 9);
  });

  it('caps the gutter so a narrow canvas cannot reserve both its sides', () => {
    // A per-side pixel constant is a bigger fraction of a narrower canvas, and
    // uncapped the pair would take more of the width than the phone's own
    // chrome does.
    expect(safeAreaWindow(FULL, 0, 5).xMax).toBeCloseTo(1 - 2 * 0.09, 9);
    expect(safeAreaWindow(FULL, 0, Number.NaN).xMax).toBe(1);
  });

  it('leaves a pair that already fits completely alone', () => {
    const window_ = safeAreaWindow({ top: 0.2, bottom: 0.2 });
    expect(window_.yMax).toBeCloseTo(1 - 0.4, 9);
    expect(window_.yMin).toBeCloseTo(-1 + 0.4, 9);
  });
});

describe('framedAspect', () => {
  it('reports the canvas aspect when nothing is over the canvas', () => {
    expect(framedAspect(1.6, FULL)).toBeCloseTo(1.6, 9);
  });

  it('reads a foldable cover between two bands as the letterbox it is', () => {
    // 717x512 is a comfortable 1.4 landscape; the window the reading strip and
    // the composer band leave is nothing like it, and the view angle is a claim
    // about the window.
    expect(framedAspect(717 / 512, { top: 0.28, bottom: 0.26 })).toBeGreaterThan(2.4);
  });

  it('survives a nonsense aspect', () => {
    expect(framedAspect(Number.NaN, FULL)).toBe(1);
    expect(framedAspect(0, FULL)).toBe(1);
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

  it('drops toward the ground on a letterbox window', () => {
    // The other end of the portrait argument: a window three times wider than
    // it is tall ran out of HEIGHT, and a flat world seen from high up projects
    // rounder, which is exactly the wrong direction there.
    const letterbox = frameDirectionForAspect(3);
    expect(letterbox.y).toBeLessThan(DEFAULT_FRAME_DIRECTION.y);
    expect(letterbox.length()).toBeCloseTo(1, 6);
    expect(letterbox.x).toBeCloseTo(letterbox.z, 6);
  });

  it('stays a built three-quarter view rather than becoming a plan', () => {
    // Both ends are bounded: no window drops the camera to the horizon and
    // none takes it overhead, because either loses what makes these read as
    // constructed rather than plotted.
    for (const aspect of [0.2, 0.46, 1, 1.6, 3, 12]) {
      const elevation = Math.asin(frameDirectionForAspect(aspect).y) * (180 / Math.PI);
      expect(elevation).toBeGreaterThan(15);
      expect(elevation).toBeLessThan(60);
    }
  });

  it('fills more of a letterbox window than the desktop angle would', () => {
    const world = disc(14);
    const flat = ndcBox(world, DEFAULT_FRAME_DIRECTION, 45, 3);
    const dropped = ndcBox(world, frameDirectionForAspect(3), 45, 3);
    expect(dropped.xMax - dropped.xMin).toBeGreaterThan(flat.xMax - flat.xMin);
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

  it('prunes scene text — a name is not the thing it names', () => {
    // Labels are sized for the READER, so their world size grows as the camera
    // pulls back: left in the fit they are a fixed point of it rather than a
    // constraint on it, and the solve settles wherever the labels stop growing.
    // Measured on a 717x512 foldable cover, the city's geometry needed 45 units
    // and its labels pushed the answer to 118. Troika publishes no marker, so
    // it is recognised the same way itemBounds.js recognises it.
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 6),
      Object.assign(new THREE.MeshBasicMaterial(), { isTroikaTextMaterial: true })
    );
    label.position.set(30, 20, 0);
    root.add(label);

    const reach = Math.max(...collectFramePoints(root).map((p) => p.length()));
    expect(reach).toBeLessThan(2);
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

  /**
   * Every grounded kind stands on a disc sized `max(floor, contentRadius × pad)`
   * — 1.3–1.5× the widest item on an ordinary 6–10 item scene, and a CIRCLE
   * around a layout that is rarely circular, so its rim reaches furthest exactly
   * where nothing stands. Left in the fit that is the binding constraint on the
   * whole kind: measured, the city's subject at 77% of the width it could have,
   * the garden's at 65%. Same rule as the shadow catcher and the ambience
   * layers — anything that is not the subject must not decide how the subject
   * is framed.
   *
   * Pinned on the source because these all use hooks and R3F cannot mount in
   * jsdom, the same way the fused ocean disc above is. Each entry names the
   * geometry it is about as well as the flag, so a slice that silently stopped
   * matching the substrate fails instead of passing on an unrelated hit.
   */
  const SUBSTRATES = [
    ['MetaphorRenderer.jsx', 'function CityFooting', 'circleGeometry'],
    ['metaphorScenes/CycleScene.jsx', 'function CyclePlaza', 'circleGeometry'],
    ['metaphorScenes/MachineScene.jsx', 'function MachinePlate', 'circleGeometry'],
    ['metaphorScenes/TreeScene.jsx', 'function TreeMeadow', 'circleGeometry'],
    ['metaphorScenes/RiverScene.jsx', 'function RiverMeadow', 'circleGeometry'],
    ['metaphorScenes/ArchipelagoScene.jsx', 'function OceanPlane', 'circleGeometry'],
    ['metaphorScenes/GardenScene.jsx', 'export function GardenScene', 'treeMeadowColor'],
    ['metaphorScenes/SubwayScene.jsx', 'export function SubwayScene', 'circleGeometry']
  ];

  it("keeps every grounded kind's substrate out of the fit", () => {
    // A sweep over a set nothing joins passes while examining nothing; assert
    // the set is what it claims to be before trusting any member of it.
    expect(SUBSTRATES.length).toBe(8);
    for (const [file, marker, geometry] of SUBSTRATES) {
      const source = readFileSync(new URL(`../src/components/${file}`, import.meta.url), 'utf8');
      const at = source.indexOf(marker);
      expect(at, `${file}: ${marker}`).toBeGreaterThan(-1);
      // Bounded slice: the substrate is drawn at the top of the component, and
      // an unbounded one would happily match a FRAME_IGNORE_DATA belonging to
      // some ambience layer three hundred lines further down.
      const body = source.slice(at, at + 2600);
      expect(body, `${file}: ${geometry}`).toContain(geometry);
      expect(body, `${file}: FRAME_IGNORE_DATA`).toContain('FRAME_IGNORE_DATA');
    }
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
