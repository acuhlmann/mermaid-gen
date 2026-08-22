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
 * 1. **One edge per panel, the one a reservation costs least on.** A panel is
 *    not a frame; reserving both edges for one corner card would pay for it
 *    twice. The edge is picked by how much of the canvas each reservation would
 *    swallow, not by which edge the panel sits nearest to — a nearest-edge rule
 *    reads a rect's smallest margin as its allegiance, and the app's composer
 *    band sits 7px from the left of a phone and 42px from the bottom, so it
 *    claimed 94% of the left edge for a band 97px tall. Thinnest-claim cannot
 *    make that mistake: a band along one edge is always cheapest to reserve on
 *    that edge.
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

/**
 * Marks a fixed / absolute element OUTSIDE the metaphor container that still
 * paints over its canvas — the app's top-shell (brand chip + corner controls)
 * is the one that matters today. Two things go wrong when this is not measured:
 * the reading strip is drawn under the brand chip on phones (occluded), and
 * the camera flies the accented item into the same band on landscape foldables
 * (framed into what the app chrome will later cover).
 *
 * The attribute is on a global element rather than on `data-metaphor-chrome`
 * because the container's own overlays already scale with content — reserving
 * the same rect twice would compound. External chrome is claimed at its raw
 * rect projected onto the canvas box.
 */
export const EXTERNAL_CHROME_ATTR = 'data-app-chrome';

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
  // The edge is chosen on raw thickness — how much of the canvas a reservation
  // on that edge would swallow — and the span discount is applied only after,
  // to the winner. Discounting before the comparison decides nothing useful: a
  // thin full-width strip spans almost nothing perpendicular, so its left and
  // right claims shrink to within a rounding error of its (correct) top claim,
  // and which edge the reading strip lands on becomes a coin toss.
  //
  // Ordered top, bottom, left, right, and the pick below is strict, so a card
  // equally thick on two edges lands on the horizontal one.
  const candidates = [
    { edge: 'top', thickness: bottom / canvas.height, span: across },
    { edge: 'bottom', thickness: 1 - top / canvas.height, span: across },
    { edge: 'left', thickness: right / canvas.width, span: down },
    { edge: 'right', thickness: 1 - left / canvas.width, span: down }
  ];
  let best = candidates[0];
  for (const candidate of candidates) {
    if (candidate.thickness < best.thickness) best = candidate;
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
 * How far, in raw pixels within `container`'s box, external app chrome extends
 * from each edge. Used to write the `--metaphor-app-*-inset` CSS variables the
 * inline reading strip and title card push away from — so the strip lands
 * BELOW the brand chip on phones rather than under it.
 *
 * Returns `null` when there's nothing to measure. Zero on every edge is a
 * meaningful answer (no chrome overlaps the canvas), so it's kept distinct
 * from null.
 *
 * @param {Element | null | undefined} container
 * @param {{ document?: Document }} [options]
 * @returns {{ top: number, right: number, bottom: number, left: number } | null}
 */
export function measureExternalChromeInsets(container, options = {}) {
  if (!container || typeof container.getBoundingClientRect !== 'function') return null;
  const box = container.getBoundingClientRect();
  if (!(box.width > 0) || !(box.height > 0)) return null;
  const ownerDocument =
    options.document ??
    container.ownerDocument ??
    (typeof globalThis !== 'undefined' ? globalThis.document : null);
  const panels = readExternalChromePanels(box, ownerDocument);
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  for (const panel of panels) {
    // Same "one edge per panel, the cheapest one" rule as the fractional path,
    // in raw pixels: the band a panel is part of is always the band it is
    // cheapest to push a card clear of.
    const costs = {
      top: panel.bottom,
      bottom: box.height - panel.top,
      left: panel.right,
      right: box.width - panel.left
    };
    let bestEdge = 'top';
    for (const edge of ['bottom', 'left', 'right']) {
      if (costs[edge] < costs[bestEdge]) bestEdge = edge;
    }
    if (costs[bestEdge] > insets[bestEdge]) insets[bestEdge] = costs[bestEdge];
  }
  return insets;
}

/**
 * Read every element in `root` tagged with `data-app-chrome` and project its
 * rect into `box`'s coordinate space, clipped to the box. Returns panels the
 * camera fit should reserve for, or an empty array when no external chrome is
 * present or none overlaps the canvas.
 *
 * The app's top-shell and its bottom band (the prompt composer plus the OS
 * taskbar) are `position: fixed` layers higher in the z-stack than the metaphor
 * canvas — their rects always paint over any pixel the camera aimed at that
 * location. `overlaySafeArea` already reserves for the metaphor's own overlays;
 * this adds the same treatment for panels that live outside the container but
 * still cover pixels inside the canvas rect.
 *
 * Native fullscreen is the one case where a marked element keeps its layout
 * rect and paints nothing: only the fullscreen element's own subtree renders,
 * so app chrome outside it is invisible and must not be reserved for. Layout
 * alone cannot tell you that — `getBoundingClientRect` reports the top-shell at
 * its usual 16px whether the canvas is fullscreen or not — so the containment
 * check is the only thing keeping a fullscreen scene from framing itself around
 * chrome nobody can see.
 */
function readExternalChromePanels(box, root) {
  const document = root ?? (typeof globalThis !== 'undefined' ? globalThis.document : null);
  if (!document || typeof document.querySelectorAll !== 'function') return [];
  const panels = [];
  // Both spellings, the same pair `useDiagramFullscreen` resolves — Safari
  // reports only the prefixed one, and reading only the standard property there
  // would leave a fullscreen scene framed around invisible chrome.
  const fullscreenElement = document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
  const nodes = document.querySelectorAll(`[${EXTERNAL_CHROME_ATTR}]`);
  for (const node of nodes) {
    if (typeof node.getBoundingClientRect !== 'function') continue;
    if (fullscreenElement && typeof fullscreenElement.contains === 'function') {
      if (!fullscreenElement.contains(node)) continue;
    }
    const rect = node.getBoundingClientRect();
    if (!(rect.width > 0) || !(rect.height > 0)) continue;
    // Clip to the canvas box — a top-shell that spans the whole viewport should
    // only claim the strip that actually paints over the canvas.
    const top = Math.max(0, rect.top - box.top);
    const left = Math.max(0, rect.left - box.left);
    const bottom = Math.min(box.height, rect.bottom - box.top);
    const right = Math.min(box.width, rect.right - box.left);
    if (bottom <= 0 || right <= 0 || top >= box.height || left >= box.width) continue;
    if (bottom - top <= 0 || right - left <= 0) continue;
    panels.push({ top, left, bottom, right });
  }
  return panels;
}

/**
 * The panels, as NDC rectangles over the canvas.
 *
 * This is a different question from the safe area above, and it needs a
 * different answer. The safe area is a *reservation*: it is discounted by how
 * much of the perpendicular axis a panel spans, capped per edge, and scaled
 * back again so two opposed bands cannot squeeze the subject to nothing — all
 * of which is right for deciding how far the camera pulls back, and all of
 * which makes it a poor map of which pixels are actually covered. The label
 * declutter pass needs the map: a name behind an opaque panel is gone, and the
 * slack the fit deliberately leaves is exactly where that happens.
 *
 * Returns `[]` when there is nothing to measure, which is a real answer (no
 * chrome), so it is not distinguished from "could not measure".
 *
 * @param {Element | null | undefined} container
 * @param {{ document?: Document, includeExternal?: boolean }} [options]
 * @returns {Array<{xMin: number, xMax: number, yMin: number, yMax: number}>}
 */
export function measureChromeRects(container, options = {}) {
  if (!container || typeof container.getBoundingClientRect !== 'function') return [];
  const box = container.getBoundingClientRect();
  if (!(box.width > 0) || !(box.height > 0)) return [];
  const panels = [];
  for (const node of container.querySelectorAll?.(`[${CHROME_ATTR}]`) ?? []) {
    const rect = node.getBoundingClientRect();
    if (!(rect.width > 0) || !(rect.height > 0)) continue;
    panels.push({
      top: rect.top - box.top,
      left: rect.left - box.left,
      bottom: rect.bottom - box.top,
      right: rect.right - box.left
    });
  }
  if (options.includeExternal !== false) {
    const ownerDocument =
      options.document ??
      container.ownerDocument ??
      (typeof globalThis !== 'undefined' ? globalThis.document : null);
    for (const external of readExternalChromePanels(box, ownerDocument)) panels.push(external);
  }
  // NDC: x runs −1 (left) → +1 (right), y runs −1 (bottom) → +1 (top), so the
  // vertical axis flips against the DOM's.
  return panels.map((panel) => ({
    xMin: (panel.left / box.width) * 2 - 1,
    xMax: (panel.right / box.width) * 2 - 1,
    yMin: 1 - (panel.bottom / box.height) * 2,
    yMax: 1 - (panel.top / box.height) * 2
  }));
}

/**
 * Measure the persistent chrome inside `container` against the canvas box, plus
 * any external app chrome (e.g. the top-shell) that paints over pixels within
 * the same box. Returns null when there is nothing to measure (SSR, unmounted,
 * zero-size).
 *
 * @param {Element | null | undefined} container
 * @param {{ document?: Document, includeExternal?: boolean }} [options]
 */
export function measureOverlaySafeArea(container, options = {}) {
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
  const includeExternal = options.includeExternal !== false;
  if (includeExternal) {
    const ownerDocument =
      options.document ??
      container.ownerDocument ??
      (typeof globalThis !== 'undefined' ? globalThis.document : null);
    for (const external of readExternalChromePanels(box, ownerDocument)) {
      panels.push(external);
    }
  }
  return overlaySafeArea({ width: box.width, height: box.height }, panels);
}
