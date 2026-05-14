/**
 * Hit-testing helpers for the AntV Infographic renderer.
 *
 * AntV emits `data-element-type` on every rendered SVG element and `data-indexes`
 * on every data-bearing element. We use those attributes to map a DOM click back
 * to the specific DSL item the user touched, rather than walking up by text content
 * (which collapses to large container groups).
 */

/**
 * Element types we treat as selectable hits. Excludes container groups (items-group,
 * btns-group, shapes-group), plain decorative shapes, and the editor add/remove buttons.
 */
export const INFOGRAPHIC_SELECTABLE_TYPES = new Set([
  'item-label',
  'item-desc',
  'item-value',
  'item-icon',
  'item-icon-group',
  'item-illus',
  'title',
  'desc'
]);

/** Walk up from `el` collecting the nearest non-empty `data-indexes` attribute. */
export function infographicIndexesFor(el, boundary) {
  let node = el;
  while (node && node !== boundary && node.nodeType === 1) {
    const raw = node.getAttribute?.('data-indexes');
    if (raw != null && raw !== '') return raw;
    node = node.parentNode;
  }
  return null;
}

function escapeAttr(value) {
  if (typeof globalThis !== 'undefined' && typeof globalThis.CSS?.escape === 'function') {
    return globalThis.CSS.escape(value);
  }
  // Minimal fallback — `data-indexes` is always digits + commas, so quoting is enough.
  return String(value).replace(/["\\]/g, '\\$&');
}

/**
 * Resolve the item's primary label by matching a sibling `[data-element-type=item-label]`
 * with the same `data-indexes` inside the boundary subtree. Falls back to the clicked
 * element's own text content when no sibling label exists.
 */
export function infographicItemLabelFor(boundary, indexes, fallbackEl) {
  if (boundary && indexes) {
    try {
      const sel = `[data-element-type="item-label"][data-indexes="${escapeAttr(indexes)}"]`;
      const labelEl = boundary.querySelector(sel);
      const text = (labelEl?.textContent || '').replace(/\s+/g, ' ').trim();
      if (text) return text.slice(0, 240);
    } catch {
      // ignore selector errors
    }
  }
  const own = (fallbackEl?.textContent || '').replace(/\s+/g, ' ').trim();
  return own ? own.slice(0, 240) : '';
}

/**
 * Walk from `start` toward `boundary`, returning the innermost selectable infographic
 * element (per `data-element-type`), along with its `data-indexes` path and the item's
 * primary label. Returns `null` for container groups / plain shapes / background.
 */
export function findInfographicTapTarget(start, boundary) {
  if (!start || !boundary) return null;
  let node = start;
  while (node && node !== boundary) {
    if (node.nodeType === 1) {
      const tag = node.tagName?.toLowerCase?.();
      if (tag === 'svg') return null;
      const elementType = node.getAttribute?.('data-element-type');
      if (elementType && INFOGRAPHIC_SELECTABLE_TYPES.has(elementType)) {
        const indexes = infographicIndexesFor(node, boundary);
        const clicked = (node.textContent || '').replace(/\s+/g, ' ').trim();
        const label = infographicItemLabelFor(boundary, indexes, node);
        return {
          node,
          label: label || clicked.slice(0, 240),
          clickedLabel: clicked ? clicked.slice(0, 240) : '',
          indexes: indexes || '',
          elementType
        };
      }
    }
    node = node.parentNode;
  }
  return null;
}
