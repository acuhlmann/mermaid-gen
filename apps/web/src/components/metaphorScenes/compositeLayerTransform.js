/** Spacing between adjacent layer centres along +X. */
const ADJACENT_GAP = 28;

/**
 * Resolve a composite layer's world transform. Explicit `transform.position`
 * always wins; otherwise adjacent layout fans layers along X and overlay keeps
 * them stacked with a tiny Y stagger.
 *
 * @param {{ transform?: { position?: number[], scale?: number } }} layer
 * @param {number} index
 * @param {'adjacent' | 'overlay'} layout
 * @param {number} layerCount
 * @returns {{ position: number[], scale: number }}
 */
export function resolveCompositeLayerTransform(layer, index, layout, layerCount) {
  const scale =
    typeof layer.transform?.scale === 'number' && Number.isFinite(layer.transform.scale)
      ? layer.transform.scale
      : 1;

  if (Array.isArray(layer.transform?.position) && layer.transform.position.length === 3) {
    return { position: layer.transform.position, scale };
  }

  if (layout === 'overlay') {
    // Slight Y stagger so co-located grounds don't z-fight as badly.
    return { position: [0, index * 0.04, 0], scale };
  }

  const offset = (index - (layerCount - 1) / 2) * ADJACENT_GAP;
  return { position: [offset, 0, 0], scale };
}
