/**
 * The element currently in native fullscreen, or null.
 *
 * Native fullscreen paints only the fullscreen element's own subtree, so any
 * overlay portaled to <body> (or mounted as a sibling of the canvas) vanishes
 * the moment the diagram goes fullscreen. Office overlays that have to stay
 * visible there — the pair in the chair, their pointing hands — portal into
 * this element instead. `DiagramFullscreenOverlay` solves the same problem for
 * the radial menu, but it is handed the surface by its parent; the office layer
 * is a sibling of the canvas with no ref to it, so it asks the document.
 */

import { useSyncExternalStore } from 'react';

const EVENTS = ['fullscreenchange', 'webkitfullscreenchange'];

function subscribe(onChange) {
  if (typeof document === 'undefined') return () => {};
  for (const name of EVENTS) document.addEventListener(name, onChange);
  return () => {
    for (const name of EVENTS) document.removeEventListener(name, onChange);
  };
}

function getSnapshot() {
  if (typeof document === 'undefined') return null;
  return document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
}

function getServerSnapshot() {
  return null;
}

/** @returns {Element | null} */
export function useFullscreenElement() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export default useFullscreenElement;
