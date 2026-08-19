/**
 * How much of the canvas the metaphor's own HTML chrome is standing on.
 *
 * The overlays are siblings of the `<Canvas>`, not part of the scene, so the
 * camera fit has always solved against the whole canvas rect and then had a
 * title strip drawn across the top of the result. That is invisible on a wide
 * desktop scene with room to spare and ruinous everywhere else: on a phone the
 * reading strip is a fifth of the screen, and the part of a tall subject it
 * covers — the iceberg's above-water blocks, a city's tallest tower, the top of
 * a tree — is the part the metaphor exists to show.
 *
 * `overlaySafeArea` turns measured panel rects into per-edge fractions that
 * `solveFrameFit` reserves. Two rules make it behave:
 *
 * 1. **One edge per panel** — whichever it sits closest to, ties to the
 *    horizontal. A panel is not a frame; reserving both edges for one corner
 *    card would pay for it twice.
 * 2. **A corner card costs less than a band.** The reservation is scaled by how
 *    much of the perpendicular axis the panel spans, saturating at half. A
 *    full-width strip claims its whole height; a narrow bottom-right layer key
 *    claims a third of its own, because the scene can simply lean away from it.
 *
 * Only *persistent* chrome is measured. The guided read and the tap inspector
 * are user-raised, transient, and already own the screen through the one-panel
 * CSS rule — refitting the camera when one opens would yank the scene sideways
 * at exactly the moment the viewer is reading about a specific item.
 */

/** Marks an overlay as persistent chrome the camera must fit around. */
export const CHROME_ATTR = 'data-metaphor-chrome';

/** Below this a panel is noise (a one-line pill), not a claim on the frame. */
const MIN_EDGE_FRACTION = 0.02;

/**
 * The perpendicular span at which a panel claims its whole thickness. A
 * half-width corner card at 0.5 over-claimed badly — on a phone the composite's
 * layer key reserved as much of the bottom as the full-width reading strip did
 * of the top, and the world ended up squeezed into the middle third with a
 * visible band of nothing on the side the panel does not cover.
 */
const FULL_SPAN = 0.72;

/** A one-line pill is noise, not a claim on the frame. */
function significant(value) {
  return value < MIN_EDGE_FRACTION ? 0 : value;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

/** Which edge one panel claims, and how much of it. */
function panelClaim(canvas, panel) {
  const top = Math.max(0, panel.top);
  const left = Math.max(0, panel.left);
  const bottom = Math.min(canvas.height, panel.bottom);
  const right = Math.min(canvas.width, panel.right);
  const panelWidth = right - left;
  const panelHeight = bottom - top;
  if (panelWidth <= 0 || panelHeight <= 0) return null;

  const across = panelWidth / canvas.width;
  const down = panelHeight / canvas.height;
  // Ordered top, bottom, left, right, and the pick below is strict, so a corner
  // card equidistant from two edges lands on the horizontal one — the edge a
  // scene can most cheaply lean away from.
  const candidates = [
    { edge: 'top', gap: top, thickness: bottom / canvas.height, span: across },
    {
      edge: 'bottom',
      gap: canvas.height - bottom,
      thickness: 1 - top / canvas.height,
      span: across
    },
    { edge: 'left', gap: left, thickness: right / canvas.width, span: down },
    { edge: 'right', gap: canvas.width - right, thickness: 1 - left / canvas.width, span: down }
  ];
  let best = candidates[0];
  for (const candidate of candidates) {
    if (candidate.gap < best.gap) best = candidate;
  }
  return { edge: best.edge, claim: clamp01(best.thickness) * clamp01(best.span / FULL_SPAN) };
}

/**
 * @param {{width: number, height: number}} canvas — the canvas box, in px
 * @param {Array<{top: number, right: number, bottom: number, left: number}>} panels
 *   — panel rects relative to the canvas box's top-left, in px
 * @returns {{top: number, right: number, bottom: number, left: number}}
 */
export function overlaySafeArea(canvas, panels) {
  const width = Number.isFinite(canvas?.width) ? canvas.width : 0;
  const height = Number.isFinite(canvas?.height) ? canvas.height : 0;
  const area = { top: 0, right: 0, bottom: 0, left: 0 };
  if (width <= 0 || height <= 0 || !Array.isArray(panels)) return area;

  for (const panel of panels) {
    const claimed = panelClaim({ width, height }, panel);
    if (claimed && claimed.claim > area[claimed.edge]) area[claimed.edge] = claimed.claim;
  }
  return {
    top: significant(area.top),
    right: significant(area.right),
    bottom: significant(area.bottom),
    left: significant(area.left)
  };
}

/** True when two safe areas differ by enough to be worth a camera refit. */
export function safeAreaChanged(a, b, epsilon = 0.02) {
  for (const edge of ['top', 'right', 'bottom', 'left']) {
    if (Math.abs((a?.[edge] ?? 0) - (b?.[edge] ?? 0)) > epsilon) return true;
  }
  return false;
}

/**
 * Measure the persistent chrome inside `container` against the canvas box.
 * Returns null when there is nothing to measure (SSR, unmounted, zero-size).
 */
export function measureOverlaySafeArea(container) {
  if (!container || typeof container.getBoundingClientRect !== 'function') return null;
  const box = container.getBoundingClientRect();
  if (!(box.width > 0) || !(box.height > 0)) return null;
  const panels = [];
  const nodes = container.querySelectorAll?.(`[${CHROME_ATTR}]`) ?? [];
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (!(rect.width > 0) || !(rect.height > 0)) continue;
    panels.push({
      top: rect.top - box.top,
      right: rect.right - box.left,
      bottom: rect.bottom - box.top,
      left: rect.left - box.left
    });
  }
  return overlaySafeArea({ width: box.width, height: box.height }, panels);
}
