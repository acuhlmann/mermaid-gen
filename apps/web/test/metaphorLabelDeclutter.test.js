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

  describe('unreadable labels', () => {
    /** World x that puts a label's centre at `ndcX` for this camera. */
    function atNdcX(ndcX) {
      const cam = camera();
      const tanH = Math.tan((45 * Math.PI) / 360) * (VIEWPORT.width / VIEWPORT.height);
      return ndcX * cam.position.z * tanH;
    }

    it('drops a label the canvas edge would clip', () => {
      // Measured on a 390px phone: "Fulfillment" hung 6px off the right edge
      // and the fused composite rendered "Fulfillmen", which reads as a
      // rendering fault rather than as a crowded scene.
      const clipped = pxEntry(atNdcX(0.94), 0, { importance: 9, w: 120 });
      resolveLabels([clipped], camera(), VIEWPORT);
      expect(clipped.target).toBe(0);
    });

    it('keeps a label that merely sits near the edge', () => {
      const near = pxEntry(atNdcX(0.7), 0, { importance: 9, w: 120 });
      resolveLabels([near], camera(), VIEWPORT);
      expect(near.target).toBe(1);
    });

    it('drops a label a panel covers', () => {
      // The reading strip and the layer key are opaque: a name behind one is
      // gone, and it was still holding its box against every label that fitted.
      const covered = pxEntry(0, 0, { importance: 9 });
      resolveLabels([covered], camera(), VIEWPORT, [{ xMin: -1, xMax: 1, yMin: -0.2, yMax: 1 }]);
      expect(covered.target).toBe(0);
    });

    it('keeps a label a panel only grazes', () => {
      const grazed = pxEntry(0, 0, { importance: 9 });
      resolveLabels([grazed], camera(), VIEWPORT, [{ xMin: -1, xMax: 1, yMin: 0.02, yMax: 1 }]);
      expect(grazed.target).toBe(1);
    });

    it('reads two stacked panels as one cover, not two', () => {
      // The composer band and the OS taskbar sit one on top of the other on
      // every phone. Summing their coverage would read a grazed corner as a
      // fully buried label.
      const grazed = pxEntry(0, 0, { importance: 9 });
      resolveLabels([grazed], camera(), VIEWPORT, [
        { xMin: -1, xMax: 1, yMin: 0.02, yMax: 1 },
        { xMin: -1, xMax: 1, yMin: 0.03, yMax: 1 }
      ]);
      expect(grazed.target).toBe(1);
    });

    it('holds a pinned label to a higher bar, not an exemption', () => {
      // Pinning is what keeps a group placard on screen at the frame edge: it
      // is the only thing naming its territory and there is no second copy, so
      // it must not yield for a third of its box.
      const grazed = pxEntry(0, 0, { importance: 0, pinned: true });
      resolveLabels([grazed], camera(), VIEWPORT, [{ xMin: -1, xMax: 1, yMin: 0.005, yMax: 1 }]);
      expect(grazed.target).toBe(1);
    });

    it('drops a pinned label a panel has almost entirely buried', () => {
      // Measured on a 717x512 foldable cover: the accented item is the tallest
      // thing in the scene, so its (pinned) name floats up into the reading
      // strip — 87% behind it, drawn anyway, and the strip is translucent, so
      // the result read as a rendering glitch rather than as a label.
      const buried = pxEntry(0, 0, { importance: 0, pinned: true });
      resolveLabels([buried], camera(), VIEWPORT, [{ xMin: -1, xMax: 1, yMin: -0.2, yMax: 1 }]);
      expect(buried.target).toBe(0);
    });

    it('keeps a pinned placard the frame edge only nicks', () => {
      // A composite's affinity placards are placed outward from the world
      // centre, so they sit at the frame edge by construction — at the
      // non-pinned bar every group name in a fused world would disappear.
      const placard = pxEntry(atNdcX(0.94), 0, { importance: 0, pinned: true, w: 120 });
      resolveLabels([placard], camera(), VIEWPORT);
      expect(placard.target).toBe(1);
    });

    it('hides a pinned label that asked to yield when unreadable', () => {
      // The accent caption: pinned so no item label can push it aside, and
      // still willing to disappear behind the reading strip, because the strip
      // is printing that exact sentence.
      const caption = pxEntry(0, 0, { importance: 100, pinned: true, w: 260, h: 54 });
      caption.yieldWhenUnreadable = true;
      resolveLabels([caption], camera(), VIEWPORT, [{ xMin: -1, xMax: 1, yMin: -0.2, yMax: 1 }]);
      expect(caption.target).toBe(0);
    });

    it('leaves every label alone when no panel is passed', () => {
      const label = pxEntry(0, 0, { importance: 9 });
      resolveLabels([label], camera(), VIEWPORT);
      expect(label.target).toBe(1);
    });
  });
});
