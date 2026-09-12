import { useCallback, useMemo } from 'react';
import { addCompositeLayer, removeCompositeLayer } from '../../utils/metaphorCompositeEdit.js';
import { switchMetaphorKind } from '../../utils/switchMetaphorKind.js';

/**
 * Duplicate / remove a whole composite layer from the layer-list overlay.
 *
 * This lives outside the 3D scene on purpose (#536). The fused planner dissolves
 * layers into one world — a city layer's towers are drawn standing on an
 * archipelago layer's island — so there is no region of the canvas that *is* a
 * layer to hit-test, and the placards that do exist are affinity groups keyed on
 * item fields, which deliberately span layers. The HTML layer list is the only
 * surface where "this layer" is an unambiguous target, and it already exists and
 * already works in all three layouts.
 *
 * Applies the same write path as `handleMetaphorKindChange`: mutate the source,
 * push it into the editor, and report a manual edit. A refused mutation (the
 * `capacity` / `last` guards) is a no-op — the overlay disables those buttons,
 * so a refusal here means the document changed underneath and the right answer
 * is to leave the source alone rather than surface an error.
 *
 * @param {{
 *   editorSource: string,
 *   enabled: boolean,
 *   setEditorSource: (updater: (prev: string) => string) => void,
 *   lastAppliedSourceRef: { current: string },
 *   onManualEdit?: ((next: string) => void) | null
 * }} args
 */
export function useMetaphorSourceEdit({
  editorSource,
  enabled,
  setEditorSource,
  lastAppliedSourceRef,
  onManualEdit
}) {
  const apply = useCallback(
    (mutate) => (layerIndex) => {
      if (!enabled) return;
      const result = mutate(editorSource, layerIndex);
      if (!result.ok) return;
      const nextValue = result.source;
      setEditorSource((prev) => (prev === nextValue ? prev : nextValue));
      lastAppliedSourceRef.current = nextValue;
      onManualEdit?.(nextValue);
    },
    [editorSource, enabled, lastAppliedSourceRef, onManualEdit, setEditorSource]
  );

  // The kind switch is the same write path with a different result field, and
  // it lived inline in DiagramCanvas.jsx. Co-located here so the two metaphor
  // document mutations cannot drift on how they push a new source, and so the
  // canvas monolith carries the wiring rather than the logic (ADR-0005).
  const onMetaphorKindChange = useCallback(
    (nextKind) => {
      if (!enabled) return;
      const result = switchMetaphorKind(editorSource, nextKind);
      if (!result.ok) return;
      const nextValue = result.text;
      setEditorSource((prev) => (prev === nextValue ? prev : nextValue));
      lastAppliedSourceRef.current = nextValue;
      onManualEdit?.(nextValue);
    },
    [editorSource, enabled, lastAppliedSourceRef, onManualEdit, setEditorSource]
  );

  return useMemo(
    () => ({
      onMetaphorKindChange,
      onCompositeLayerAdd: apply(addCompositeLayer),
      onCompositeLayerRemove: apply(removeCompositeLayer)
    }),
    [apply, onMetaphorKindChange]
  );
}
