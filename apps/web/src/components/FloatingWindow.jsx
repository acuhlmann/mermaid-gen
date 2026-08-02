import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { FloatingWindowContext, useFloatingWindow } from './floatingWindowContext.js';
import { useDraggablePosition } from '../hooks/useDraggablePosition.js';
import { useSheetSnap } from '../hooks/useSheetSnap.js';
import { useWindowPresentation } from '../hooks/useWindowPresentation.js';
import { overlayLayerStyle, useOverlayLayer } from '../hooks/useOverlayLayer.js';
import { officeChromeCopy } from '../utils/officeCast.js';
import {
  bringOverlayToFront,
  getFocusedOverlayId,
  isOverlayMinimized,
  minimizeOtherOverlays,
  minimizeOverlay,
  subscribe
} from '../state/overlayStack.js';

/**
 * Office window shell. One component, three placements — free-dragging on the
 * desktop, a fixed panel on a tablet, a snap-point bottom sheet on a phone
 * (`useWindowPresentation`). Minimize is not local state here: it lives in
 * `overlayStack` so the taskbar pill can bring the window back, which is what a
 * taskbar is for. See docs/office-window-manager.md.
 *
 * @param {{
 *   id: string,
 *   open?: boolean,
 *   group?: import('../state/overlayStack.js').OverlayGroupId,
 *   className?: string,
 *   children: import('react').ReactNode,
 *   draggable?: boolean,
 *   defaultCorner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'center',
 *   defaultOffsetX?: number,
 *   defaultOffsetY?: number,
 *   cascade?: number,
 *   storageKey?: string | null,
 *   title?: string,
 *   kind?: string,
 *   senderId?: string | null,
 *   manageable?: boolean,
 *   style?: import('react').CSSProperties,
 *   onFocusWindow?: () => void
 * } & import('react').HTMLAttributes<HTMLDivElement>} props
 */
export default function FloatingWindow({
  id,
  open = true,
  group = 'officeChrome',
  className = '',
  children,
  draggable = true,
  defaultCorner = 'bottom-right',
  defaultOffsetX = 14,
  defaultOffsetY = 96,
  cascade = 0,
  storageKey = null,
  title,
  kind,
  senderId,
  manageable = true,
  style,
  onFocusWindow,
  onPointerDown,
  ...rest
}) {
  const zIndex = useOverlayLayer(id, open, group, { title, kind, senderId, manageable });
  const focusedId = useSyncExternalStore(subscribe, getFocusedOverlayId, getFocusedOverlayId);
  const isFocused = focusedId === id;

  const presentation = useWindowPresentation();
  const isSheet = presentation === 'sheet';
  const isFloating = presentation === 'floating';

  const readMinimized = useCallback(() => isOverlayMinimized(id), [id]);
  const minimized = useSyncExternalStore(subscribe, readMinimized, readMinimized);
  // Open but minimized stays *registered* — that is what keeps its taskbar pill.
  const visible = open && !minimized;

  const { nodeRef, position, isDragging, isRepositioned, dragHandleProps, remeasure } =
    useDraggablePosition({
      enabled: draggable && visible && isFloating,
      defaultCorner,
      defaultOffsetX,
      defaultOffsetY,
      cascade,
      storageKey: storageKey ?? id
    });

  const sheet = useSheetSnap({
    enabled: visible && isSheet,
    onDismiss: useCallback(() => minimizeOverlay(id), [id])
  });

  // One DOM node, two hooks that each want a ref to it.
  const sheetNodeRef = sheet.nodeRef;
  const setNode = useCallback(
    (node) => {
      nodeRef.current = node;
      sheetNodeRef.current = node;
    },
    [nodeRef, sheetNodeRef]
  );

  useEffect(() => {
    if (visible) {
      bringOverlayToFront(id);
      remeasure();
    }
  }, [visible, id, remeasure]);

  // The phone shows one office window at a time (§5C). Enforced here rather than
  // in the store's open path so it is scoped to the breakpoint that needs it —
  // two windows side by side on a tablet is fine.
  useEffect(() => {
    if (!visible || !isSheet) return;
    minimizeOtherOverlays(id);
  }, [visible, isSheet, id]);

  const focusWindow = useCallback(() => {
    bringOverlayToFront(id);
    onFocusWindow?.();
  }, [id, onFocusWindow]);

  const handlePointerDown = useCallback(
    (event) => {
      focusWindow();
      onPointerDown?.(event);
    },
    [focusWindow, onPointerDown]
  );

  if (!visible) return null;

  const positionedStyle =
    isFloating && position
      ? { left: position.left, top: position.top, right: 'auto', bottom: 'auto' }
      : undefined;

  const classNames = [
    'floating-window',
    kind ? `floating-window--${kind}` : '',
    'floating-window--os',
    `floating-window--${presentation}`,
    className,
    isFocused ? 'is-focused' : 'is-unfocused',
    (isFloating && isDragging) || (isSheet && sheet.isDragging) ? 'is-dragging' : '',
    isFloating && isRepositioned ? 'is-repositioned' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const windowEl = (
    <div
      ref={setNode}
      className={classNames}
      style={overlayLayerStyle(zIndex, { ...positionedStyle, ...style })}
      onPointerDown={handlePointerDown}
      data-floating-window={id}
      data-window-kind={kind || undefined}
      data-presentation={presentation}
      data-snap={isSheet ? sheet.snap : undefined}
      {...rest}
    >
      {children}
    </div>
  );

  const ctx = {
    id,
    presentation,
    manageable,
    copy: officeChromeCopy(),
    dragHandleProps: isSheet ? sheet.dragHandleProps : dragHandleProps,
    snap: isSheet ? sheet.snap : null,
    cycleSnap: sheet.cycleSnap,
    focusWindow
  };

  return (
    <FloatingWindowContext.Provider value={ctx}>
      {typeof document !== 'undefined' ? createPortal(windowEl, document.body) : windowEl}
    </FloatingWindowContext.Provider>
  );
}

/**
 * Title bar / header region that starts a drag. Skips interactive children.
 *
 * Which gesture it starts depends on the placement: a free move on the desktop,
 * a snap change (or a pull-down to the taskbar) on a phone. The grip doubles as
 * a real button in sheet mode so the snap is reachable without a drag — the
 * gesture is an accelerator, never the only way.
 */
export function FloatingWindowDragHandle({
  className = '',
  children,
  title,
  onPointerDown,
  ...rest
}) {
  const ctx = useFloatingWindow();

  const handlePointerDown = useCallback(
    (event) => {
      ctx?.focusWindow();
      ctx?.dragHandleProps.onPointerDown?.(event);
      onPointerDown?.(event);
    },
    [ctx, onPointerDown]
  );

  if (!ctx) {
    return (
      <div className={className} onPointerDown={onPointerDown} {...rest}>
        {children}
      </div>
    );
  }

  const isSheet = ctx.presentation === 'sheet';

  return (
    <div
      className={`floating-window-drag-handle${className ? ` ${className}` : ''}`}
      title={title}
      onPointerDown={handlePointerDown}
      onPointerMove={ctx.dragHandleProps.onPointerMove}
      onPointerUp={ctx.dragHandleProps.onPointerUp}
      onPointerCancel={ctx.dragHandleProps.onPointerCancel}
      {...rest}
    >
      {isSheet ? (
        <button
          type="button"
          className="floating-window-sheet-grip"
          aria-expanded={ctx.snap === 'full'}
          aria-label={ctx.snap === 'full' ? ctx.copy.sheetCollapse : ctx.copy.sheetExpand}
          title={ctx.snap === 'full' ? ctx.copy.sheetCollapse : ctx.copy.sheetExpand}
          onClick={ctx.cycleSnap}
        >
          <span className="floating-window-sheet-grip-bar" aria-hidden="true" />
        </button>
      ) : (
        <span className="floating-window-drag-grip" aria-hidden="true" />
      )}
      {children}
    </div>
  );
}
