/**
 * Hit-testing helpers for the AntV Infographic renderer.
 *
 * AntV emits `data-element-type` on every rendered SVG element and `data-indexes`
 * on every data-bearing element. We use those attributes to map a DOM click back
 * to the specific DSL item the user touched, rather than walking up by text content
 * (which collapses to large container groups).
 */

/**
 * Element types that are ALWAYS selectable — the canonical per-item / canvas-level slots
 * that AntV stamps on every template. A click landing directly on one of these returns
 * immediately, regardless of whether the element carries `data-indexes`.
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

/**
 * Infographic element types whose DOM is literal text (SVG `text` / `tspan`).
 * For these we skip diagram pointer-capture and default-action suppression so
 * the browser can run native text selection and I‑beam cursor behavior.
 */
export const INFOGRAPHIC_NATIVE_TEXT_SELECTION_TYPES = new Set([
  'item-label',
  'item-desc',
  'item-value',
  'title',
  'desc'
]);

/**
 * Element types that should NEVER be selectable: backgrounds, container groups, and
 * editor-only buttons. Walking up the DOM we skip past these even when they carry
 * `data-indexes`, since selecting "the items group" isn't a user-meaningful action.
 *
 * Sourced from `ElementTypeEnum` in @antv/infographic (lowercase wire values seen in
 * `data-element-type`): background, btns-group, btn-add, btn-remove, items-group,
 * illus-group, illus-volume, transient-container.
 */
const INFOGRAPHIC_NEVER_SELECTABLE_TYPES = new Set([
  'background',
  'btns-group',
  'btn-add',
  'btn-remove',
  'items-group',
  'illus-group',
  'illus-volume',
  'transient-container'
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

function buildHit(node, boundary, indexes, elementType) {
  const clicked = (node.textContent || '').replace(/\s+/g, ' ').trim();
  const label = infographicItemLabelFor(boundary, indexes, node);
  return {
    node,
    label: label || clicked.slice(0, 240),
    clickedLabel: clicked ? clicked.slice(0, 240) : '',
    indexes: indexes || '',
    elementType: elementType || ''
  };
}

/**
 * Walk from `start` toward `boundary`, returning the innermost selectable infographic
 * element along with its `data-indexes` path and the item's primary label.
 *
 * Three selectability rules, applied per ancestor on the way up:
 *   1. `data-element-type` in `INFOGRAPHIC_NEVER_SELECTABLE_TYPES` → skip; keep walking.
 *   2. `data-element-type` in `INFOGRAPHIC_SELECTABLE_TYPES` → return immediately
 *      (the canonical per-item / canvas-level slots).
 *   3. Element has `data-element-type` (anything else, e.g. `illus`, `unknown`) AND
 *      is item-bound by some ancestor's `data-indexes` → return.
 *
 * Rule 3 is what makes the colored row body of templates like `list-row-simple-horizontal-arrow`
 * clickable. Previously only the inner text/icon nodes matched a whitelist and the rest of the
 * row (the arrow shape, item-bound illustrations, per-template decorative shapes) was treated as
 * background. Anything truly background-y carries no `data-indexes` and still returns null.
 *
 * Returns `null` when the walk reaches the `<svg>` root (or the boundary) without a hit.
 */
export function findInfographicTapTarget(start, boundary) {
  if (!start || !boundary) return null;
  let node = start;
  while (node && node !== boundary) {
    if (node.nodeType === 1) {
      const tag = node.tagName?.toLowerCase?.();
      if (tag === 'svg') return null;
      const elementType = node.getAttribute?.('data-element-type');
      if (elementType && INFOGRAPHIC_NEVER_SELECTABLE_TYPES.has(elementType)) {
        node = node.parentNode;
        continue;
      }
      if (elementType && INFOGRAPHIC_SELECTABLE_TYPES.has(elementType)) {
        const indexes = infographicIndexesFor(node, boundary);
        return buildHit(node, boundary, indexes, elementType);
      }
      if (elementType) {
        // Check this element's OWN data-indexes attribute (not walked up). Inherited indexes
        // from ancestors must not make decorative children selectable — the user's intent
        // is to click the visible item-bound shape, not its background scaffolding.
        const ownIndexes = node.getAttribute?.('data-indexes');
        if (ownIndexes != null && ownIndexes !== '') {
          return buildHit(node, boundary, ownIndexes, elementType);
        }
      }
    }
    node = node.parentNode;
  }
  return null;
}
