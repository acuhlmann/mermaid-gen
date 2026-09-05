/**
 * Descriptor helpers for Metaphor3D canvas graph edit.
 */

/**
 * @param {{ id?: string, label?: string }} item
 * @param {string | null | undefined} metaphor
 * @returns {object | null}
 */
export function metaphorItemDescriptor(item, metaphor) {
  if (!item?.id) return null;
  const label = typeof item.label === 'string' && item.label.trim() ? item.label.trim() : item.id;
  return {
    kind: 'metaphor-item',
    id: `metaphor3d-${item.id}`,
    dataId: item.id,
    partName: label,
    label,
    metaphor: metaphor ?? 'tree'
  };
}

/**
 * Descriptor for a tap-picked LINK.
 *
 * `kind: 'edge'` is what `selectionKind()` in `useFlowchartGraphEdit.js`
 * already maps, and `edgeFrom`/`edgeTo` are what its `deleteEdge` and
 * `renameEdge` paths already read — nothing in that hook branches on diagram
 * family, so this descriptor reaches `renameCityEdge` and the four `canLink`
 * flat-kind mutators without a hook change (#495).
 *
 * There is deliberately **no synthetic edge id**: the `{from, to}` PAIR is the
 * identity these mutators resolve on, and `connectCityNodes` refuses a
 * duplicate pair, so an invented id would be a second name for the same thing
 * with nothing keeping the two in step. The `id` below is a stable React/DOM
 * key, never an argument to a mutator.
 *
 * `label` is the link's own caption where it has one, so rename opens
 * prefilled; an unlabelled link opens empty rather than with a guess.
 *
 * @param {{ from?: string, to?: string, label?: string }} link
 * @param {string | null | undefined} metaphor
 * @returns {object | null}
 */
export function metaphorLinkDescriptor(link, metaphor) {
  if (!link?.from || !link?.to) return null;
  const label = typeof link.label === 'string' ? link.label.trim() : '';
  return {
    kind: 'edge',
    id: `metaphor3d-link-${link.from}-${link.to}`,
    edgeFrom: link.from,
    edgeTo: link.to,
    label,
    partName: label || `${link.from} → ${link.to}`,
    metaphor: metaphor ?? 'tree'
  };
}
