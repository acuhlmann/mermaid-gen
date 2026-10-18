/**
 * The radial actions the simple studio keeps: direct edits (rename, connect,
 * link, delete) and the plain "what is this?" explainer. The office cast
 * (Gilfoyle, Dinesh, Russ, …), the stakeholders tray and the Slopitect prompt
 * stay on the desk — the studio is one prompt and one result, not the parody.
 */
export const STUDIO_RADIAL_ACTION_IDS = Object.freeze([
  'rename',
  'connect',
  'link',
  'delete',
  'definition'
]);

/**
 * Return only rename, connect, link, delete, and definition actions, preserving
 * their order and object references. Missing input returns an empty array;
 * falsy entries are skipped.
 *
 * @template {{ id: string }} T
 * @param {T[] | null | undefined} actions
 * @returns {T[]}
 */
export function studioRadialActions(actions) {
  const allowed = new Set(STUDIO_RADIAL_ACTION_IDS);
  return (actions ?? []).filter((action) => action && allowed.has(action.id));
}

/**
 * Canvas props that turn on node selection + graph edit in the studio's
 * `DiagramCanvasSlot`. Without `canvasEditing` the canvas stays view-only.
 *
 * @param {object | null | undefined} canvasEditing
 */
export function studioCanvasEditProps(canvasEditing) {
  if (!canvasEditing) {
    return {
      selectedNode: null,
      hoverDescriptor: null,
      onSelectedNodeChange: null,
      onHoverTargetChange: null,
      onPanGestureStart: null,
      onNodeToolbarAnchor: null
    };
  }
  return {
    selectedNode: canvasEditing.selectedNode,
    hoverDescriptor: canvasEditing.hoverDescriptor,
    onSelectedNodeChange: canvasEditing.onSelectedNodeChange,
    onHoverTargetChange: canvasEditing.onHoverTargetChange,
    onPanGestureStart: canvasEditing.dismissRadialMenu,
    onNodeToolbarAnchor: canvasEditing.setToolbarAnchor,
    connectSourceId: canvasEditing.graphEdit?.connectSourceId ?? null,
    onConnectTarget: canvasEditing.graphEdit?.handleConnectTarget ?? null
  };
}
