/**
 * Shared title-bar controls for office windows — minimize and close.
 *
 * **Minimize sends the window to the taskbar.** It used to toggle a local
 * `minimized` boolean in each window, collapsing it to a titlebar that stayed
 * wherever it had been dragged; the tray pill beside it could only re-focus, so
 * the two never met. Both halves now go through `overlayStack`, which is why
 * this button needs no props from its caller beyond its label — it reads the
 * window id from context. See docs/office-window-manager.md §5B.
 */

import { minimizeOverlay } from '../state/overlayStack.js';
import { useFloatingWindow } from './floatingWindowContext.js';

export function FloatingWindowMinimizeButton({
  label = 'Minimize',
  title,
  className = 'floating-window-minimize'
}) {
  const ctx = useFloatingWindow();
  // Nothing to minimize *to* if the taskbar will not list this surface.
  if (!ctx?.id || ctx.manageable === false) return null;
  return (
    <button
      type="button"
      className={className}
      title={title ?? label}
      aria-label={label}
      onClick={() => minimizeOverlay(ctx.id)}
    >
      —
    </button>
  );
}

export function FloatingWindowCloseButton({
  label = 'Close',
  title,
  onClose,
  className = 'floating-window-close'
}) {
  if (typeof onClose !== 'function') return null;
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      title={title ?? label}
      onClick={onClose}
    >
      ×
    </button>
  );
}
