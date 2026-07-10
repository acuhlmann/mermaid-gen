/**
 * Walk the rendered diagram SVG, return the label + id of nodes whose bounding
 * rect intersects the current visual viewport. Feeds the proactive advisor so
 * suggestions reference what the user is actually looking at right now.
 */

const NODE_SELECTOR = 'g.node, g.timeline-node, g.cluster, [data-et="participant"]';
const MAX_LABELS = 30;
const MAX_LABEL_CHARS = 160;

function viewportBounds() {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  if (vv) {
    return {
      left: vv.offsetLeft,
      top: vv.offsetTop,
      right: vv.offsetLeft + vv.width,
      bottom: vv.offsetTop + vv.height
    };
  }
  if (typeof window !== 'undefined') {
    return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  }
  return { left: 0, top: 0, right: 0, bottom: 0 };
}

function rectIntersects(rect, vp) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return false;
  return (
    rect.right >= vp.left && rect.left <= vp.right && rect.bottom >= vp.top && rect.top <= vp.bottom
  );
}

function readNodeLabel(group) {
  const texts = group.querySelectorAll('text, .nodeLabel, .label, foreignObject');
  for (const t of texts) {
    const raw = (t.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (raw) return raw.slice(0, MAX_LABEL_CHARS);
  }
  return '';
}

function readNodeId(group) {
  const direct = group.id || group.getAttribute?.('data-id') || '';
  if (direct) return direct;
  const anchor = group.querySelector?.(':scope > [id]');
  if (anchor?.id) return anchor.id;
  const nested = group.querySelector?.('[id]');
  return nested?.id || '';
}

/**
 * @param {ParentNode | null | undefined} rootEl  Root containing the rendered SVG (e.g. document.body).
 * @returns {{ labels: string[], ids: string[] }}
 */
export function getVisibleDiagramLabels(rootEl) {
  const host = rootEl ?? (typeof document !== 'undefined' ? document : null);
  if (!host?.querySelectorAll) return { labels: [], ids: [] };
  const svg = host.querySelector?.('.diagram-zoom-layer svg') || host.querySelector?.('svg');
  if (!svg) return { labels: [], ids: [] };
  const vp = viewportBounds();
  const groups = svg.querySelectorAll(NODE_SELECTOR);
  const labels = [];
  const ids = [];
  const seenLabels = new Set();
  const seenIds = new Set();
  for (const g of groups) {
    if (labels.length >= MAX_LABELS) break;
    let rect;
    try {
      rect = g.getBoundingClientRect();
    } catch {
      continue;
    }
    if (!rectIntersects(rect, vp)) continue;
    const label = readNodeLabel(g);
    if (label && !seenLabels.has(label)) {
      seenLabels.add(label);
      labels.push(label);
    }
    const id = readNodeId(g);
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      ids.push(id);
    }
  }
  return { labels, ids };
}
