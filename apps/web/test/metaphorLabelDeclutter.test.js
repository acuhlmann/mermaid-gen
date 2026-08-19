import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { resolveLabels } from '../src/components/metaphorScenes/labelDeclutter.js';

const VIEWPORT = { width: 1280, height: 820 };

function camera() {
  const cam = new THREE.PerspectiveCamera(45, VIEWPORT.width / VIEWPORT.height, 0.1, 1000);
  cam.position.set(0, 0, 30);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

function entry(x, y, { importance = 0, pinned = false, width = 4, height = 0.6 } = {}) {
  const object = new THREE.Object3D();
  object.position.set(x, y, 0);
  object.updateMatrixWorld(true);
  return { object, importance, pinned, width, height, target: 1, current: 1, apply: () => {} };
}

describe('resolveLabels', () => {
  it('hides the weaker of two labels sharing a screen box', () => {
    const strong = entry(0, 0, { importance: 10 });
    const weak = entry(0.15, 0, { importance: 1 });
    resolveLabels([weak, strong], camera(), VIEWPORT);
    expect(strong.target).toBe(1);
    expect(weak.target).toBe(0);
  });

  it('keeps both when they are far enough apart', () => {
    const a = entry(-8, 0, { importance: 5 });
    const b = entry(8, 0, { importance: 5 });
    resolveLabels([a, b], camera(), VIEWPORT);
    expect(a.target).toBe(1);
    expect(b.target).toBe(1);
  });

  it('never hides a pinned label, even under a more important neighbour', () => {
    // Group names and the accented item are the scene's structural claims;
    // dropping one to make room for a leaf label inverts the point of the pass.
    const pinned = entry(0, 0, { importance: 0, pinned: true });
    const loud = entry(0.1, 0, { importance: 99 });
    resolveLabels([loud, pinned], camera(), VIEWPORT);
    expect(pinned.target).toBe(1);
    expect(loud.target).toBe(0);
  });

  it('hides labels that have left the frame', () => {
    const off = entry(400, 0, { importance: 5 });
    resolveLabels([off], camera(), VIEWPORT);
    expect(off.target).toBe(0);
  });

  it('ranks by importance before nearness', () => {
    const cam = camera();
    const near = entry(0, 0, { importance: 1 });
    near.object.position.set(0.1, 0, 10);
    near.object.updateMatrixWorld(true);
    const far = entry(0, 0, { importance: 50 });
    far.object.position.set(0, 0, -10);
    far.object.updateMatrixWorld(true);
    resolveLabels([near, far], cam, VIEWPORT);
    expect(far.target).toBe(1);
    expect(near.target).toBe(0);
  });
});

describe('resolveLabels with screen-sized labels', () => {
  /** A label that reports the box it is actually drawn at, in CSS pixels. */
  function pxEntry(x, y, { importance = 0, pinned = false, w = 90, h = 20 } = {}) {
    const object = new THREE.Object3D();
    object.position.set(x, y, 0);
    object.updateMatrixWorld(true);
    return {
      object,
      importance,
      pinned,
      screenWidthPx: w,
      screenHeightPx: h,
      target: 1,
      current: 1,
      apply: () => {}
    };
  }

  it('measures a screen-constant label by its pixels, not by its world size', () => {
    // Item labels are drawn at a fixed pixel size now (metaphorScreenScale.js),
    // so projecting their authored world box would report a size that reaches
    // the screen only at one particular camera distance — near labels would
    // over-claim space and far ones would stop contesting it at all.
    const near = pxEntry(0, 0);
    const far = pxEntry(0, 0);
    far.object.position.set(0, 0, -18);
    far.object.updateMatrixWorld(true);
    resolveLabels([near, far], camera(), VIEWPORT);
    // Same screen box, same position: exactly one survives, and it is the near
    // one — nearness is the tie-break.
    expect(near.target).toBe(1);
    expect(far.target).toBe(0);
  });

  it('keeps two pixel-sized labels that do not overlap on screen', () => {
    const a = pxEntry(-9, 0);
    const b = pxEntry(9, 0);
    resolveLabels([a, b], camera(), VIEWPORT);
    expect(a.target).toBe(1);
    expect(b.target).toBe(1);
  });

  it('lets the accent caption push an item label aside', () => {
    // The caption is depth-test-free, so without a claim in this pass it simply
    // landed on top of the accented item's own name.
    const caption = pxEntry(0, 0, { importance: 100, pinned: true, w: 260, h: 54 });
    const label = pxEntry(0.6, 0, { importance: 5 });
    resolveLabels([label, caption], camera(), VIEWPORT);
    expect(caption.target).toBe(1);
    expect(label.target).toBe(0);
  });
});
