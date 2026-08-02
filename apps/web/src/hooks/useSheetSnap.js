import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Snap heights, low to high. Deliberately an ordered list rather than a
 * continuous drag: a sheet you can leave at any height is a sheet you can leave
 * covering the canvas by 3px, which is the free-positioning problem again in one
 * axis. The actual heights are CSS (`--sheet-block-size` per `data-snap`) so the
 * safe-area and bottom-chrome math stays where the rest of it lives.
 */
export const SHEET_SNAPS = /** @type {const} */ (['peek', 'half', 'full']);

/**
 * Default on open. Mail, chat and a meeting are *apps* — on a phone the useful
 * thing is the vertical space, so a sheet slides up to nearly the top rather
 * than politely taking half. `half` and `peek` stay one drag away, which is the
 * version of "the office is a side show" that costs nothing when you want it.
 */
export const DEFAULT_SHEET_SNAP = 'full';

/** Drag distance that commits a snap change. */
const STEP_PX = 56;

/** Extra pull past `peek` that dismisses instead of snapping. */
const DISMISS_PX = 96;

/** Rubber-band ceiling when dragging up from `full` — there is nothing above it. */
const OVERPULL_PX = 24;

/**
 * Vertical-only snap gesture for a bottom sheet.
 *
 * Kept separate from `useDraggablePosition` on purpose: one clamps a point in a
 * plane and persists it, the other selects from an ordered list and persists
 * nothing. They share the words "drag" and "pointer" and nothing else, and
 * merging them is how a 240-line hook becomes 400
 * (docs/office-window-manager.md §5A).
 *
 * @param {{ enabled?: boolean, onDismiss?: () => void }} [options]
 */
export function useSheetSnap(options = {}) {
  const { enabled = true, onDismiss } = options;

  const nodeRef = useRef(/** @type {HTMLElement | null} */ (null));
  const dragStateRef = useRef(/** @type {{ pointerId: number, startY: number } | null} */ (null));
  const [snap, setSnap] = useState(/** @type {typeof SHEET_SNAPS[number]} */ (DEFAULT_SHEET_SNAP));
  const [isDragging, setIsDragging] = useState(false);

  // Leaving the mode (rotate to landscape, fold open) must not strand a
  // half-finished gesture's inline transform on the node.
  useEffect(() => {
    if (enabled) return;
    dragStateRef.current = null;
    setIsDragging(false);
    setSnap(DEFAULT_SHEET_SNAP);
    if (nodeRef.current) nodeRef.current.style.transform = '';
  }, [enabled]);

  const applyLiveOffset = useCallback((dy) => {
    const node = nodeRef.current;
    if (!node) return;
    node.style.transform = dy === 0 ? '' : `translateY(${Math.max(-OVERPULL_PX, dy)}px)`;
  }, []);

  const onPointerDown = useCallback(
    (event) => {
      if (!enabled) return;
      // Same rule the free drag uses: controls in the titlebar stay clickable.
      if (event.target.closest('button, a, input, textarea, select, label')) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      dragStateRef.current = { pointerId: event.pointerId, startY: event.clientY };
      setIsDragging(true);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture may fail on some browsers.
      }
    },
    [enabled]
  );

  const onPointerMove = useCallback(
    (event) => {
      const state = dragStateRef.current;
      if (!state || event.pointerId !== state.pointerId) return;
      applyLiveOffset(event.clientY - state.startY);
    },
    [applyLiveOffset]
  );

  const endDrag = useCallback(
    (event) => {
      const state = dragStateRef.current;
      if (!state) return;
      if (event && event.pointerId !== state.pointerId) return;
      const dy = event ? event.clientY - state.startY : 0;
      dragStateRef.current = null;
      setIsDragging(false);
      applyLiveOffset(0);
      if (event) {
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // Ignore.
        }
      }

      setSnap((prev) => {
        const idx = SHEET_SNAPS.indexOf(prev);
        if (dy >= STEP_PX) {
          // Pulling down off the lowest snap is the dismiss gesture. It goes to
          // the taskbar rather than closing: a swipe is easy to do by accident,
          // and losing an unsent reply to one would be unforgivable.
          if (idx === 0 && dy >= DISMISS_PX) {
            onDismiss?.();
            return prev;
          }
          return SHEET_SNAPS[Math.max(0, idx - 1)];
        }
        if (dy <= -STEP_PX) return SHEET_SNAPS[Math.min(SHEET_SNAPS.length - 1, idx + 1)];
        return prev;
      });
    },
    [applyLiveOffset, onDismiss]
  );

  /** Tap target for anyone not making a drag gesture — including keyboards. */
  const cycleSnap = useCallback(() => {
    setSnap((prev) => (prev === 'full' ? 'half' : 'full'));
  }, []);

  return {
    nodeRef,
    snap,
    setSnap,
    cycleSnap,
    isDragging,
    dragHandleProps: enabled
      ? { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag }
      : {}
  };
}
