/**
 * Hit-testing and selection descriptors for Vega-Lite charts rendered via vega-embed.
 *
 * Primary selection uses Vega's scenegraph `click` event (see ChartRenderer). DOM helpers
 * here support hover previews, background deselect, and pan/zoom gesture routing in
 * DiagramCanvas.
 */

export const CHART_PART_KINDS = {
  mark: 'mark',
  'axis-tick': 'axis',
  'axis-title': 'axis',
  axis: 'axis',
  legend: 'legend',
  'legend-label': 'legend',
  title: 'title'
};

const CHART_INTERACTIVE_ROLE_DESCRIPTIONS = new Set([
  'mark',
  'legend entry',
  'legend title',
  'axis tick label',
  'axis title',
  'chart title'
]);

function normalizeWhitespace(text) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashStringStable(input) {
  let hash = 0;
  const str = String(input ?? '');
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return `h${Math.abs(hash)}`;
}

function datumLabel(datum) {
  if (!datum || typeof datum !== 'object') return '';
  for (const value of Object.values(datum)) {
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 240);
    if (typeof value === 'number' && Number.isFinite(value)) return String(value).slice(0, 240);
  }
  return '';
}

function resolveElementType(item) {
  const role = item?.mark?.role;
  if (role === 'legend') {
    return item?.datum?.label != null ? 'legend-label' : 'legend';
  }
  if (role === 'axis') {
    return item?.datum?.label != null ? 'axis-tick' : 'axis';
  }
  if (role === 'title') return 'title';
  return 'mark';
}

function resolveMarkType(item) {
  return (
    item?.mark?.marktype ||
    item?.mark?.type ||
    item?.markdef?.type ||
    item?.mark?.name ||
    'mark'
  );
}

function nearestChartAnchor(node, boundary) {
  let el = node;
  while (el && el !== boundary) {
    if (el.nodeType === 1 && isChartInteractiveDomNode(el, boundary)) return el;
    el = el.parentNode;
  }
  return node?.nodeType === 1 ? node : null;
}

function isChartClassSelectable(className) {
  if (!className) return false;
  return (
    /\bmark-/.test(className) ||
    /\brole-legend\b/.test(className) ||
    /\brole-axis\b/.test(className) ||
    /\brole-title\b/.test(className)
  );
}

/** True when `node` is inside an interactive Vega mark, axis, legend, or title element. */
export function isChartInteractiveDomNode(node, boundary) {
  let el = node;
  while (el && el !== boundary) {
    if (el.nodeType === 1) {
      const tag = el.tagName?.toLowerCase?.();
      if (tag === 'svg') return false;
      const roleDesc = el.getAttribute?.('aria-roledescription');
      if (roleDesc && CHART_INTERACTIVE_ROLE_DESCRIPTIONS.has(roleDesc)) return true;
      if (isChartClassSelectable(el.getAttribute?.('class'))) return true;
    }
    el = el.parentNode;
  }
  return false;
}

/**
 * Walk from a DOM click target toward `boundary`, returning the innermost selectable chart
 * element. Used for hover and background-tap detection when Vega's view is unavailable.
 */
export function findChartTapTarget(start, boundary) {
  if (!start || !boundary) return null;
  let node = start;
  while (node && node !== boundary) {
    if (node.nodeType === 1) {
      const tag = node.tagName?.toLowerCase?.();
      if (tag === 'svg') return null;
      const roleDesc = node.getAttribute?.('aria-roledescription');
      const className = node.getAttribute?.('class') || '';
      if (
        (roleDesc && CHART_INTERACTIVE_ROLE_DESCRIPTIONS.has(roleDesc)) ||
        isChartClassSelectable(className)
      ) {
        const label = normalizeWhitespace(
          node.getAttribute?.('aria-label') || node.textContent || ''
        ).slice(0, 240);
        return {
          node,
          roleDesc: roleDesc || '',
          className,
          label
        };
      }
    }
    node = node.parentNode;
  }
  return null;
}

function buildChartId(elementType, markType, indexes, label) {
  const idxPart = indexes ? `:${indexes}` : '';
  const labelPart = label ? `:${hashStringStable(label)}` : '';
  return `chart:${elementType}:${markType}${idxPart}${labelPart}`;
}

/** Build a radial-menu selection descriptor from a Vega scenegraph click item. */
export function buildChartDescriptorFromVegaItem(item, event, boundary) {
  if (!item) return null;

  const elementType = resolveElementType(item);
  const markType = resolveMarkType(item);
  const datum = item.datum;
  const label =
    normalizeWhitespace(
      datum?.label ?? datumLabel(datum) ?? item.mark?.ariaLabel ?? item.description ?? ''
    ).slice(0, 240) || markType;

  const rawIndex = item.index ?? item._index;
  const indexes =
    rawIndex != null && Number.isFinite(Number(rawIndex)) ? String(Math.trunc(Number(rawIndex))) : '';

  const partKind = CHART_PART_KINDS[elementType] || 'mark';
  const anchorEl = nearestChartAnchor(event?.target, boundary);

  return {
    kind: 'chart-mark',
    id: buildChartId(elementType, markType, indexes, label),
    label,
    elementType,
    markType,
    ...(indexes ? { indexes } : {}),
    partKind,
    partName: label,
    anchorEl,
    domNode: anchorEl
  };
}

/** Build a lightweight descriptor from a DOM hit (hover / coarse tap). */
export function buildChartDescriptorFromDomHit(chartHit) {
  if (!chartHit?.node) return null;
  const roleDesc = chartHit.roleDesc || '';
  let elementType = 'mark';
  if (roleDesc.includes('legend')) elementType = roleDesc.includes('title') ? 'legend' : 'legend-label';
  else if (roleDesc.includes('axis')) {
    elementType = roleDesc.includes('title') ? 'axis-title' : 'axis-tick';
  } else if (roleDesc.includes('title')) elementType = 'title';

  const markType =
    (chartHit.className || '')
      .split(/\s+/)
      .find((token) => token.startsWith('mark-'))
      ?.slice('mark-'.length) || 'mark';

  const label = chartHit.label || markType;
  const partKind = CHART_PART_KINDS[elementType] || 'mark';

  return {
    kind: 'chart-mark',
    id: buildChartId(elementType, markType, '', label),
    label,
    elementType,
    markType,
    partKind,
    partName: label,
    anchorEl: chartHit.node,
    domNode: chartHit.node
  };
}
