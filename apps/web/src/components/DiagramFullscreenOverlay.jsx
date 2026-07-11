import { createPortal } from 'react-dom';
import { useUiCopy } from '../i18n/useUiLocale.js';

function FullscreenCloseIcon() {
  return (
    <svg
      className="diagram-fullscreen-close-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 6l12 12M18 6 6 18"
      />
    </svg>
  );
}

/**
 * Keeps diagram-surface overlays usable while the canvas is in native fullscreen.
 *
 * Native fullscreen paints only the fullscreen element's own subtree, so
 * overlays that normally live as siblings of `.diagram-output` (the radial
 * action menu, the top-corner fullscreen/code buttons) simply vanish. When
 * `isFullscreen` is true we portal the overlays *into* the fullscreen surface
 * (`host`) and add a small top-right exit button — the regular fullscreen
 * toggle is itself hidden in fullscreen, so without this there is no on-screen
 * way back (only Esc). When not fullscreen we render `children` inline,
 * unchanged.
 *
 * @param {{
 *   isFullscreen: boolean,
 *   host: HTMLElement | null,
 *   onExit: () => void,
 *   children: import('react').ReactNode
 * }} props
 */
export default function DiagramFullscreenOverlay({ isFullscreen, host, onExit, children }) {
  const { controls } = useUiCopy();
  if (!isFullscreen || !host) return children;
  return createPortal(
    <>
      <button
        type="button"
        className="diagram-fullscreen-close"
        title={controls.fullscreen.exit}
        aria-label={controls.fullscreen.exit}
        // Don't let the press bubble into the canvas pan/selection handlers.
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => onExit?.()}
      >
        <FullscreenCloseIcon />
      </button>
      {children}
    </>,
    host
  );
}
