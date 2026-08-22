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
