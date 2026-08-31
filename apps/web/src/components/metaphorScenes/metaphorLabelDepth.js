/**
 * Depth-test state for a metaphor label's glyphs, and the one thing that keeps
 * it honest when the accent moves.
 *
 * A pure sibling module rather than a block inside `MetaphorSceneChrome.jsx`
 * (ADR-0005): the wiring below is the whole of a bug that no screenshot can
 * see, so it is worth a file that can be tested without a renderer.
 *
 * ## Why depth is set through troika's own object
 *
 * With an outline configured — every label in these scenes has one — troika's
 * `material` getter returns an ARRAY of two materials, so r3f's `material-*`
 * pierce assigns the key onto the array itself and the renderer reads nothing:
 * no warning, no error, and a screenshot identical to the fix not being needed.
 * The outline material is `Object.create(mainMaterial)`, so setting the derived
 * one alone would in fact propagate — but that prototype link is troika's
 * private business rather than a contract, and it only propagates in that one
 * direction, so both are written.
 *
 * ## Why `onSync` alone is not enough — the part that reads as broken
 *
 * drei's `<Text>` calls `troikaMesh.sync(cb)` from a `useLayoutEffect` with no
 * dependency array, so it asks on every render. troika's `sync()` has no `else`
 * branch: when `_needsSync` is false it drops the callback silently, and
 * `_needsSync` is raised only by its own `SYNCABLE_PROPS` setters — `text`,
 * `font`, `fontSize`, `letterSpacing`, `maxWidth`, `lineHeight`, the anchors.
 * Whether an item is accented is none of them.
 *
 * So `onSync` fires once, when the label first lays out, and then never again
 * for a change of accent. That is exactly the change that has to move depth,
 * and the failure is symmetric — both halves of it are wrong at once, on an
 * ordinary Refine turn that moves the accent from one item to another:
 *
 * - the newly accented name keeps `depthTest = true`, so the marker's own
 *   geometry goes on eating it and the lift the ladder describes never lands
 *   on the one item the user just asked to read;
 * - the previously accented name keeps `depthTest = false` forever, so a
 *   back-row label floats in front of the tower standing between it and the
 *   camera — the trap `assignSiteLabelPlacement` and the declutter pass both
 *   exist to avoid, and the reason the lift is scoped to one item at all.
 *
 * Neither is visible to a first-render screenshot, because on a first render
 * `onSync` does fire. It takes a second render with a moved accent, which is
 * what `useLabelDepthTest` below pins and what its test drives directly.
 */
import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Write `depthTest` onto every material troika built for this label.
 *
 * @param {{ material?: unknown }|null|undefined} troikaMesh
 * @param {boolean} accented
 */
export function setLabelDepthTest(troikaMesh, accented) {
  const materials = Array.isArray(troikaMesh?.material)
    ? troikaMesh.material
    : [troikaMesh?.material];
  for (const material of materials) if (material) material.depthTest = !accented;
}

/**
 * The `onSync` handler for a label's `<Text>`, plus the re-application that
 * `onSync` cannot do by itself.
 *
 * Returns the handler to hand to `<Text onSync={...}>`. It remembers the mesh
 * troika hands back so a later accent change has something to write to.
 *
 * @param {boolean} accented
 * @returns {(troikaMesh: unknown) => void}
 */
export function useLabelDepthTest(accented) {
  const meshRef = useRef(null);

  const onSync = useCallback(
    (troikaMesh) => {
      meshRef.current = troikaMesh ?? null;
      setLabelDepthTest(troikaMesh, accented);
    },
    [accented]
  );

  // The re-application `onSync` cannot do. Layout-phase rather than passive,
  // because the sibling `renderOrder` and chip props are plain r3f props that
  // land in the same commit — a depth write a frame behind them would show the
  // marker and the name disagreeing for one frame on every accent change.
  useLayoutEffect(() => {
    if (meshRef.current) setLabelDepthTest(meshRef.current, accented);
  }, [accented]);

  return onSync;
}
