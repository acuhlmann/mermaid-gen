import { createPortal } from 'react-dom';

/**
 * Keeps diagram-surface overlays usable while the canvas is in native fullscreen.
 *
 * Native fullscreen paints only the fullscreen element's own subtree, so
 * overlays that normally live as siblings of `.diagram-output` (the radial
 * action menu) simply vanish. When `isFullscreen` is true we portal the
 * overlays *into* the fullscreen surface (`host`). Exit + mailroom live in
 * `DiagramFullscreenToolbar`, not here.
 *
 * @param {{
 *   isFullscreen: boolean,
 *   host: HTMLElement | null,
 *   children: import('react').ReactNode
 * }} props
 */
export default function DiagramFullscreenOverlay({ isFullscreen, host, children }) {
  if (!isFullscreen || !host) return children;
  return createPortal(children, host);
}
