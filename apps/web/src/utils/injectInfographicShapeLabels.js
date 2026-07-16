/**
 * Dagre relation templates (e.g. relation-dagre-flow-tb-simple-circle-node) render
 * node labels in SVG <title> tooltips only. Inject visible centered labels so
 * circle nodes are readable on the canvas and in advisor label collection.
 */

const MAX_VISIBLE_LABEL_CHARS = 48;

function readShapeTitleLabel(shape) {
  const titleEl = shape.querySelector?.(':scope > title');
  const label = (titleEl?.textContent ?? '').replace(/\s+/g, ' ').trim();
  return label || '';
}

function groupHasVisibleItemLabel(group) {
  return Boolean(
    group?.querySelector?.('[data-element-type="item-label"]:not([data-shape-label-injected])')
  );
}

function shapeLabelAnchor(shape) {
  const tag = shape.tagName?.toLowerCase?.() ?? '';
  if (tag === 'ellipse' || tag === 'circle') {
    const cx = Number.parseFloat(shape.getAttribute('cx') ?? '');
    const cy = Number.parseFloat(shape.getAttribute('cy') ?? '');
    if (Number.isFinite(cx) && Number.isFinite(cy)) {
      return { cx, cy };
    }
  }
  try {
    const bbox = shape.getBBox?.();
    if (bbox && bbox.width > 0 && bbox.height > 0) {
      return { cx: bbox.x + bbox.width / 2, cy: bbox.y + bbox.height / 2 };
    }
  } catch {
    // jsdom and some detached SVG trees lack layout metrics.
  }
  return null;
}

/**
 * @param {ParentNode | null | undefined} container
 */
export function injectInfographicShapeTitleLabels(container) {
  const svg = container?.querySelector?.('svg');
  if (!svg) return;

  const shapes = svg.querySelectorAll?.('[data-element-type="shape"]') ?? [];
  for (const shape of shapes) {
    if (shape.getAttribute('data-shape-label-injected') === 'true') continue;
    const group = shape.parentElement;
    if (!group || groupHasVisibleItemLabel(group)) continue;

    const label = readShapeTitleLabel(shape);
    if (!label) continue;

    const anchor = shapeLabelAnchor(shape);
    if (!anchor) continue;

    const display =
      label.length > MAX_VISIBLE_LABEL_CHARS
        ? `${label.slice(0, MAX_VISIBLE_LABEL_CHARS - 1).trimEnd()}…`
        : label;

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('data-element-type', 'item-label');
    text.setAttribute('data-shape-label-injected', 'true');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('pointer-events', 'none');
    text.setAttribute('x', String(anchor.cx));
    text.setAttribute('y', String(anchor.cy));
    text.textContent = display;
    group.appendChild(text);
    shape.setAttribute('data-shape-label-injected', 'true');
  }
}
