/**
 * Where the person in the chair is pointing.
 *
 * A pairing beat can carry a `focusId` — a node id the server has already
 * checked against the ids the client could actually see — and this turns that
 * id into somewhere on screen to draw a hand. Pure lookups over the rendered
 * SVG: no React, no store, so the resolution rules can be tested without
 * mounting a canvas.
 *
 * The class name lives here and nowhere else. The canvas applies it (see
 * `DiagramCanvas`'s `pointFocus`) and the styles live beside the rest of the
 * huddle chrome, so a rename is one edit.
 */

import { resolveDiagramNodeWrap } from './diagramGraphEditNodeResolve.js';

/** The ring a pointed-at node wears. Applied through `applyDiagramHighlightToSvg`. */
export const OFFICE_POINTED_CLASS = 'is-office-pointed';

/**
 * The canvas host to search. Same reach as the advisor's label walk
 * (`useAdvisorShell`): the office layer is a sibling of the canvas in the shell
 * tree, so there is no ref to hand down and no reason to invent one.
 *
 * @param {ParentNode | null | undefined} [root]
 * @returns {ParentNode | null}
 */
export function pointSearchRoot(root) {
  if (root?.querySelector) return root;
  if (typeof document === 'undefined') return null;
  return document.querySelector('.diagram-zoom-layer') ?? document;
}

/**
 * Resolve a focus id to the rendered group that would wear the ring.
 *
 * @param {ParentNode | null | undefined} root
 * @param {string | null | undefined} focusId
 * @returns {Element | null}
 */
export function resolvePointTarget(root, focusId) {
  const id = typeof focusId === 'string' ? focusId.trim() : '';
  if (!id) return null;
  const host = pointSearchRoot(root);
  if (!host) return null;
  /*
   * Both lookups, in the order the canvas edit path already uses them: the id
   * Mermaid wrote into the DOM (suffixed per render) first, then the logical id
   * from the source. Which one the model was shown depends on how the label
   * walk read the node, so neither alone is enough.
   */
  return (
    resolveDiagramNodeWrap(host, { id }) ?? resolveDiagramNodeWrap(host, { dataId: id }) ?? null
  );
}

/**
 * Where to draw the hand: the pointed-at node's rect on screen.
 *
 * Null when there is nothing to point at — an unrendered node, a stale id from
 * a diagram that has since changed. The caller drops the pointer rather than
 * parking it at the origin, because a hand over empty canvas says "look here"
 * about nothing.
 *
 * @param {ParentNode | null | undefined} root
 * @param {string | null | undefined} focusId
 * @returns {{ left: number, top: number, width: number, height: number } | null}
 */
export function pointTargetRect(root, focusId) {
  const target = resolvePointTarget(root, focusId);
  if (!target?.getBoundingClientRect) return null;
  let rect;
  try {
    rect = target.getBoundingClientRect();
  } catch {
    return null;
  }
  if (!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return null;
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

/**
 * The anchor for the hand itself: just off the target's top-right corner, which
 * is where a finger arrives when somebody leans in beside you and indicates a
 * box. Kept separate from the rect so the gesture can be repositioned without
 * re-measuring.
 *
 * @param {{ left: number, top: number, width: number, height: number }} rect
 * @returns {{ x: number, y: number }}
 */
export function pointHandAnchor(rect) {
  return {
    x: rect.left + rect.width * 0.78,
    y: rect.top + rect.height * 0.22
  };
}
