// @vitest-environment jsdom
/**
 * The accented name's depth has to follow the accent, not just the first
 * layout.
 *
 * `MetaphorAccents`' callout is depth-test-free by design, and the accented
 * item's own name was lifted over it (see `metaphorDrawOrder.js`) by dropping
 * its depth test too. That drop was delivered only through drei's `onSync`,
 * and `onSync` is a one-shot for this purpose: drei asks troika to sync on
 * every render, but troika's `sync()` drops the callback unless `_needsSync`
 * is set, and only its `SYNCABLE_PROPS` setters — `text`, `fontSize`,
 * `letterSpacing`, `maxWidth`, the anchors — set it. Being accented is none of
 * them.
 *
 * So on the commonest way an accent ever changes — a Refine turn that moves it
 * from one item to another, same strings, both labels keyed by `item.id` and
 * neither remounted — nothing re-ran the depth write, and both ends of the
 * swap were wrong at once: the new accent's glyphs stayed depth-tested (the
 * marker keeps eating the one name the scene most wants read) and the old
 * one's stayed depth-free (a back-row name floating in front of the geometry
 * between it and the camera, the trap the lift is scoped to one item to
 * avoid).
 *
 * Invisible to a screenshot of a first render, because on a first render
 * `onSync` does fire. It takes a second render, which is what this drives.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  setLabelDepthTest,
  useLabelDepthTest
} from '../src/components/metaphorScenes/metaphorLabelDepth.js';

/** Stands in for troika's outlined `<Text>`: `material` is an ARRAY of two. */
const outlinedTroikaMesh = () => ({
  material: [{ depthTest: true }, { depthTest: true }]
});

const depthTests = (mesh) => mesh.material.map((material) => material.depthTest);

afterEach(() => {
  cleanup();
});

describe('setLabelDepthTest', () => {
  it('writes both materials of an outlined label, not just the derived one', () => {
    // troika's outline material is `Object.create(mainMaterial)`, so the
    // prototype link propagates in exactly one direction. Both are written
    // because that link is troika's private business rather than a contract.
    const mesh = outlinedTroikaMesh();
    setLabelDepthTest(mesh, true);
    expect(depthTests(mesh)).toEqual([false, false]);

    setLabelDepthTest(mesh, false);
    expect(depthTests(mesh)).toEqual([true, true]);
  });

  it('handles the un-outlined case, where troika returns a single material', () => {
    const mesh = { material: { depthTest: true } };
    setLabelDepthTest(mesh, true);
    expect(mesh.material.depthTest).toBe(false);
  });

  it('does not throw before troika has built anything', () => {
    expect(() => setLabelDepthTest(null, true)).not.toThrow();
    expect(() => setLabelDepthTest({}, true)).not.toThrow();
  });
});

describe('useLabelDepthTest', () => {
  it('drops depth on the name that has just become the accent', () => {
    // The scene renders again with a moved accent. troika does not re-sync —
    // no syncable prop changed — so `onSync` is NOT called a second time, and
    // the hook is the only thing left that can write the new value.
    const mesh = outlinedTroikaMesh();
    const { result, rerender } = renderHook(({ accented }) => useLabelDepthTest(accented), {
      initialProps: { accented: false }
    });

    act(() => result.current(mesh)); // the one `onSync` troika ever delivers
    expect(depthTests(mesh)).toEqual([true, true]);

    rerender({ accented: true });
    expect(depthTests(mesh)).toEqual([false, false]);
  });

  it('restores depth on the name that has just stopped being the accent', () => {
    // The half that reads as broken rather than as untidy: a stale
    // `depthTest = false` puts an ordinary back-row label in front of whatever
    // stands between it and the camera.
    const mesh = outlinedTroikaMesh();
    const { result, rerender } = renderHook(({ accented }) => useLabelDepthTest(accented), {
      initialProps: { accented: true }
    });

    act(() => result.current(mesh));
    expect(depthTests(mesh)).toEqual([false, false]);

    rerender({ accented: false });
    expect(depthTests(mesh)).toEqual([true, true]);
  });

  it('still applies on the first sync, which is all onSync was ever doing', () => {
    // Unchanged behaviour, pinned so the effect is not mistaken for a
    // replacement: troika hands the mesh back once, after layout, and that
    // first delivery is the only chance to reach a label that never re-renders.
    const mesh = outlinedTroikaMesh();
    const { result } = renderHook(() => useLabelDepthTest(true));

    act(() => result.current(mesh));
    expect(depthTests(mesh)).toEqual([false, false]);
  });

  it('writes nothing before troika has handed a mesh back', () => {
    const { rerender } = renderHook(({ accented }) => useLabelDepthTest(accented), {
      initialProps: { accented: false }
    });
    expect(() => rerender({ accented: true })).not.toThrow();
  });
});
