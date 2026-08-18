/**
 * Reading helpers for metaphor3d overlays.
 *
 * The DSL already carries the topic (title, subtitle, legend, accent notes,
 * composite layer labels) — these functions flatten it into the compact
 * "how to read this scene" chrome. Kept out of the renderer so jsdom tests
 * can pin the contract without mounting a Canvas.
 */

/**
 * Walk every visible item, including composite layers. Each entry keeps the
 * layer it came from so a fused-world tooltip can name the slice.
 *
 * @param {object | null | undefined} dsl
 * @returns {Array<{ item: Record<string, unknown>, layer: object | null }>}
 */
export function flattenMetaphorItems(dsl) {
  if (!dsl || typeof dsl !== 'object') return [];
  if (dsl.metaphor === 'composite') {
    return (Array.isArray(dsl.layers) ? dsl.layers : []).flatMap((layer) =>
      (Array.isArray(layer?.items) ? layer.items : []).map((item) => ({ item, layer }))
    );
  }
  return (Array.isArray(dsl.items) ? dsl.items : []).map((item) => ({ item, layer: null }));
}

/**
 * The scene's spoken thesis: the accented item's note. The 3D pin already
 * prints this as a caption, but a caption in world space is easy to miss
 * against a busy skyline — the overlay repeats it as the one sentence a
 * viewer reads without orbiting.
 *
 * @param {object | null | undefined} dsl
 * @returns {string}
 */
export function accentThesisFromDsl(dsl) {
  const noted = flattenMetaphorItems(dsl)
    .map((entry) => entry.item)
    .filter((item) => item?.accent === true && typeof item.note === 'string' && item.note.trim());
  return noted[0] ? String(noted[0].note).trim() : '';
}

/**
 * One row per fused layer: the author's reading-key label plus the spatial
 * grammar (`as`) that layer is drawn in. Empty when the document is not a
 * composite or has no layers yet.
 *
 * @param {object | null | undefined} dsl
 * @returns {Array<{ id: string, as: string, label: string, itemCount: number }>}
 */
export function compositeLayerSummaries(dsl) {
  if (!dsl || dsl.metaphor !== 'composite' || !Array.isArray(dsl.layers)) return [];
  return dsl.layers
    .filter((layer) => layer && typeof layer === 'object')
    .map((layer, index) => {
      const as = typeof layer.as === 'string' && layer.as.trim() ? layer.as.trim() : 'city';
      const rawLabel = typeof layer.label === 'string' ? layer.label.trim() : '';
      return {
        id: typeof layer.id === 'string' && layer.id.trim() ? layer.id.trim() : `layer-${index}`,
        as,
        label: rawLabel || as,
        itemCount: Array.isArray(layer.items) ? layer.items.length : 0
      };
    });
}
