import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useDraggablePosition } from '../hooks/useDraggablePosition.js';
import { overlayLayerStyle, useOverlayLayer } from '../hooks/useOverlayLayer.js';
import { bringOverlayToFront, getFocusedOverlayId, subscribe } from '../state/overlayStack.js';

const FloatingWindowContext = createContext(null);

/**
 * Reusable draggable floating window with overlay-stack z-index and focus ring.
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

  const { nodeRef, position, isDragging, isRepositioned, dragHandleProps, remeasure } =
    useDraggablePosition({
      enabled: draggable && open,
      defaultCorner,
      defaultOffsetX,
      defaultOffsetY,
      cascade,
      storageKey: storageKey ?? id
    });

  useEffect(() => {
    if (open) {
      bringOverlayToFront(id);
      remeasure();
    }
  }, [open, id, remeasure]);

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

  if (!open) return null;

  const positionedStyle = position
    ? { left: position.left, top: position.top, right: 'auto', bottom: 'auto' }
    : undefined;

  const classNames = [
    'floating-window',
    className,
    isFocused ? 'is-focused' : 'is-unfocused',
    isDragging ? 'is-dragging' : '',
    isRepositioned ? 'is-repositioned' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const windowEl = (
    <div
      ref={nodeRef}
      className={classNames}
      style={overlayLayerStyle(zIndex, { ...positionedStyle, ...style })}
      onPointerDown={handlePointerDown}
      data-floating-window={id}
      {...rest}
    >
      {children}
    </div>
  );

  return (
    <FloatingWindowContext.Provider value={{ dragHandleProps, focusWindow }}>
      {typeof document !== 'undefined' ? createPortal(windowEl, document.body) : windowEl}
    </FloatingWindowContext.Provider>
  );
}

/**
 * Title bar / header region that starts a drag. Skips interactive children.
 */
export function FloatingWindowDragHandle({
  className = '',
  children,
  title,
  onPointerDown,
  ...rest
}) {
  const ctx = useContext(FloatingWindowContext);

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
      <span className="floating-window-drag-grip" aria-hidden="true" />
      {children}
    </div>
  );
}
