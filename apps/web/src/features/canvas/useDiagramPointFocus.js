/**
 * Somebody is pointing at a node — ring it, and move the camera only if the
 * ring would land somewhere the user cannot see.
 *
 * Extracted rather than inlined into `DiagramCanvas.jsx` on purpose: that file
 * is at its ratchet budget (`docs/agents/ratchet.json` → monolithLoc), which may
 * only fall, so a new canvas behaviour arrives as a hook it calls.
 *
 * Mermaid only. `pointFocus.ids` are rendered `g.node` ids the server has
 * already validated against what the client could see, and no other content
 * type produces ids that resolve to a node — pointing at one would ring nothing
 * and pan the camera to nowhere.
 *
 * @param {{
 *   viewportRef: { current: HTMLElement | null },
 *   setViewport: (next: { x: number, y: number, scale: number }) => void,
 *   contentType: string,
 *   svgMarkup: string,
 *   pointFocus: { ids: string[], seq: number } | null
 * }} options
 */

import { useLayoutEffect } from 'react';
import { applyDiagramHighlightToSvg } from '../../utils/applyDiagramHighlightToSvg.js';
import { computeViewportFocusIfOffscreen } from '../../utils/focusDiagramHighlightIds.js';
import { OFFICE_POINTED_CLASS } from '../../utils/officePairPointing.js';

export function useDiagramPointFocus({
  viewportRef,
  setViewport,
  contentType,
  svgMarkup,
  pointFocus
}) {
  useLayoutEffect(() => {
    if (contentType !== 'mermaid') return undefined;
    const viewportEl = viewportRef.current;
    if (!viewportEl) return undefined;
    const ids = Array.isArray(pointFocus?.ids) ? pointFocus.ids.filter(Boolean) : [];

    /** @returns {boolean} false while the SVG has not landed yet. */
    const apply = () => {
      if (ids.length > 0 && !viewportEl.querySelector('svg')) return false;
      /*
       * The change-highlight applier with this effect's own class names. It is
       * already an idempotent clear-then-apply walk over exactly these node
       * selectors, and it removes only the classes it was given — so a point
       * ring and a diff highlight coexist and neither clears the other.
       */
      applyDiagramHighlightToSvg(viewportEl, ids.length > 0 ? { addedIds: ids } : null, {
        addedClass: OFFICE_POINTED_CLASS,
        modifiedClass: OFFICE_POINTED_CLASS
      });
      if (ids.length === 0) return true;
      // The camera rule a person at your shoulder follows: point at what you can
      // both see, scroll it into view only when you cannot.
      const next = computeViewportFocusIfOffscreen(viewportEl, ids);
      if (next) setViewport(next);
      return true;
    };

    if (apply()) return undefined;
    const observer = new MutationObserver(() => {
      if (apply()) observer.disconnect();
    });
    observer.observe(viewportEl, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [contentType, svgMarkup, pointFocus, setViewport, viewportRef]);
}

export default useDiagramPointFocus;
