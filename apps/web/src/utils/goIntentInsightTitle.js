import { partKindLabel } from './partKindLabel.js';

const GO_TITLE_PROMPT_MAX = 72;

/** Focus fragment without the leading verb (e.g. `node "API"`). */
export function selectionFocusFragment(selectionLike) {
  if (!selectionLike) return '';
  if (selectionLike.partKind && selectionLike.partName) {
    return `${partKindLabel(selectionLike.partKind)} · ${selectionLike.partName}`;
  }
  const edgeLike =
    selectionLike.kind === 'edge' ||
    (selectionLike.selectionKind === 'edge' && selectionLike.edgeFrom && selectionLike.edgeTo);
  if (edgeLike) {
    return `edge ${selectionLike.edgeFrom} → ${selectionLike.edgeTo}`;
  }
  const infographicLike =
    selectionLike.kind === 'infographic-item' || selectionLike.selectionKind === 'infographic-item';
  if (infographicLike) {
    const labelText = selectionLike.label || selectionLike.clickedLabel || selectionLike.id;
    const elementType = selectionLike.elementType || '';
    const noun =
      elementType === 'title'
        ? 'title'
        : elementType === 'desc'
          ? 'description'
          : elementType === 'item-desc'
            ? 'item desc'
            : elementType === 'item-value'
              ? 'item value'
              : elementType === 'item-icon' || elementType === 'item-icon-group'
                ? 'item icon'
                : 'item';
    return `${noun} “${labelText}”`;
  }
  const metaphorLike =
    selectionLike.kind === 'metaphor-item' || selectionLike.selectionKind === 'metaphor-item';
  if (metaphorLike) {
    const labelText = selectionLike.label || selectionLike.id;
    return `item “${labelText}”`;
  }
  const clusterLike = selectionLike.kind === 'cluster' || selectionLike.selectionKind === 'cluster';
  if (clusterLike) {
    return `subgraph “${selectionLike.label || selectionLike.id}”`;
  }
  return `node “${selectionLike.label || selectionLike.id}”`;
}

/** Thinking-panel title for Go / intent runs. */
export function goIntentInsightTitle(promptText, selectionLike) {
  const trimmed = (promptText ?? '').trim();
  const excerpt =
    trimmed.length > GO_TITLE_PROMPT_MAX
      ? `${trimmed.slice(0, GO_TITLE_PROMPT_MAX).trimEnd()}…`
      : trimmed;
  const quoted = excerpt ? `Go '${excerpt}'` : 'Go';
  if (!excerpt) {
    return selectionLike ? `Go — ${selectionFocusFragment(selectionLike)}` : 'Go — diagram';
  }
  const focus = selectionFocusFragment(selectionLike);
  return focus ? `${quoted} · ${focus}` : quoted;
}
