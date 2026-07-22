import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  clampWindowPosition,
  defaultWindowPosition,
  readMobileBottomChromeReservePx,
  readViewportBounds
} from '../utils/viewportBounds.js';

/**
 * Drag-to-reposition for floating windows. Returns absolute left/top in viewport
 * coordinates and pointer handlers for a drag handle element.
 *
 * @param {{
 *   enabled?: boolean,
 *   defaultCorner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center',
 *   defaultOffsetX?: number,
 *   defaultOffsetY?: number,
 *   cascade?: number,
 *   respectMobileChrome?: boolean,
 *   storageKey?: string | null
 * }} [options]
 */
export function useDraggablePosition(options = {}) {
  const {
    enabled = true,
    defaultCorner = 'bottom-right',
    defaultOffsetX = 14,
    defaultOffsetY = 96,
    cascade = 0,
    respectMobileChrome = true,
    storageKey = null,
    placementOnMount = true
  } = options;

  const nodeRef = useRef(null);
  const dragStateRef = useRef(null);
  const [position, setPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const readStoredPosition = useCallback(() => {
    if (!storageKey || typeof window === 'undefined') return null;
    try {
      const raw = window.sessionStorage.getItem(`floating-window:${storageKey}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.left === 'number' && typeof parsed?.top === 'number') return parsed;
    } catch {
      // Ignore corrupt storage.
    }
    return null;
  }, [storageKey]);

  const persistPosition = useCallback(
    (next) => {
      if (!storageKey || typeof window === 'undefined') return;
      try {
        window.sessionStorage.setItem(
          `floating-window:${storageKey}`,
          JSON.stringify({ left: next.left, top: next.top })
        );
      } catch {
        // Storage full or blocked.
      }
    },
    [storageKey]
  );

  const measureAndPlace = useCallback(() => {
    const el = nodeRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const size = { width: rect.width || el.offsetWidth, height: rect.height || el.offsetHeight };
    if (!size.width || !size.height) return;

    const stored = readStoredPosition();
    if (!stored && !placementOnMount) return;
    const bottomReservePx =
      respectMobileChrome && window.matchMedia('(max-width: 1024px)').matches
        ? readMobileBottomChromeReservePx() +
          (parseInt(
            getComputedStyle(document.documentElement).getPropertyValue('--safe-area-bottom'),
            10
          ) || 0)
        : 0;

    const base =
      stored ??
      defaultWindowPosition(defaultCorner, size, {
        offsetX: defaultOffsetX,
        offsetY: defaultOffsetY,
        cascade,
        bottomReservePx
      });
    setPosition(
      clampWindowPosition(base.left, base.top, size, readViewportBounds(), {
        bottomReservePx,
        minVisiblePx: 56
      })
    );
  }, [
    cascade,
    defaultCorner,
    defaultOffsetX,
    defaultOffsetY,
    placementOnMount,
    readStoredPosition,
    respectMobileChrome
  ]);

  useLayoutEffect(() => {
    if (!enabled) return undefined;
    measureAndPlace();
    const onResize = () => {
      if (dragStateRef.current) return;
      measureAndPlace();
    };
    window.addEventListener('resize', onResize);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', onResize);
    vv?.addEventListener('scroll', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      vv?.removeEventListener('resize', onResize);
      vv?.removeEventListener('scroll', onResize);
    };
  }, [enabled, measureAndPlace]);

  const onDragPointerDown = useCallback(
    (event) => {
      if (!enabled) return;
      if (event.target.closest('button, a, input, textarea, select, label')) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const el = nodeRef.current;
      if (!el) return;
      event.preventDefault();
      event.stopPropagation();

      if (!position) measureAndPlace();
      const rect = el.getBoundingClientRect();
      const currentLeft = position?.left ?? rect.left;
      const currentTop = position?.top ?? rect.top;
      dragStateRef.current = {
        pointerId: event.pointerId,
        offsetX: event.clientX - currentLeft,
        offsetY: event.clientY - currentTop,
        size: { width: rect.width, height: rect.height }
      };
      setIsDragging(true);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture may fail on some browsers.
      }
    },
    [enabled, measureAndPlace, position]
  );

  const onDragPointerMove = useCallback(
    (event) => {
      const state = dragStateRef.current;
      if (!state || event.pointerId !== state.pointerId) return;
      const bottomReservePx =
        respectMobileChrome && window.matchMedia('(max-width: 1024px)').matches
          ? readMobileBottomChromeReservePx()
          : 0;
      const next = clampWindowPosition(
        event.clientX - state.offsetX,
        event.clientY - state.offsetY,
        state.size,
        readViewportBounds(),
        { bottomReservePx, minVisiblePx: 56 }
      );
      setPosition(next);
    },
    [respectMobileChrome]
  );

  const endDrag = useCallback(
    (event) => {
      const state = dragStateRef.current;
      if (!state) return;
      if (event && event.pointerId !== state.pointerId) return;
      dragStateRef.current = null;
      setIsDragging(false);
      if (event) {
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // Ignore.
        }
      }
      setPosition((prev) => {
        if (prev) persistPosition(prev);
        return prev;
      });
    },
    [persistPosition]
  );

  return {
    nodeRef,
    position,
    isDragging,
    isRepositioned: Boolean(position),
    dragHandleProps: enabled
      ? {
          onPointerDown: onDragPointerDown,
          onPointerMove: onDragPointerMove,
          onPointerUp: endDrag,
          onPointerCancel: endDrag
        }
      : {},
    remeasure: measureAndPlace
  };
}
