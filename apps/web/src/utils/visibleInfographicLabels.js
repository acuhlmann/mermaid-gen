/**
 * Collect visible item labels and data-index paths from a rendered AntV infographic SVG.
 */

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
  return rect.right >= vp.left && rect.left <= vp.right && rect.bottom >= vp.top && rect.top <= vp.bottom;
}

/**
 * @param {ParentNode | null | undefined} rootEl
 * @returns {{ labels: string[], ids: string[] }}
 */
export function getVisibleInfographicLabels(rootEl) {
  const host = rootEl ?? (typeof document !== 'undefined' ? document : null);
  if (!host?.querySelectorAll) return { labels: [], ids: [] };

  const boundary =
    host.querySelector?.('.infographic-output .infographic-canvas') ||
    host.querySelector?.('.infographic-canvas') ||
    host.querySelector?.('.infographic-output');
  if (!boundary) return { labels: [], ids: [] };

  const vp = viewportBounds();
  const labels = [];
  const ids = [];
  const seenLabels = new Set();
  const seenIds = new Set();

  const titleEl = boundary.querySelector?.('[data-element-type="title"]');
  if (titleEl) {
    try {
      if (rectIntersects(titleEl.getBoundingClientRect(), vp)) {
        const t = (titleEl.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_CHARS);
        if (t && !seenLabels.has(t)) {
          seenLabels.add(t);
          labels.push(t);
        }
        const id = titleEl.getAttribute?.('data-indexes') || 'title';
        if (!seenIds.has(id)) {
          seenIds.add(id);
          ids.push(id);
        }
      }
    } catch {
      // ignore
    }
  }

  const itemLabels = boundary.querySelectorAll?.('[data-element-type="item-label"]') ?? [];
  for (const el of itemLabels) {
    if (labels.length >= MAX_LABELS) break;
    let rect;
    try {
      rect = el.getBoundingClientRect();
    } catch {
      continue;
    }
    if (!rectIntersects(rect, vp)) continue;
    const label = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_CHARS);
    if (label && !seenLabels.has(label)) {
      seenLabels.add(label);
      labels.push(label);
    }
    const indexes = el.getAttribute?.('data-indexes');
    if (indexes && !seenIds.has(indexes)) {
      seenIds.add(indexes);
      ids.push(indexes);
    }
  }

  return { labels, ids };
}
