import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react';
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
 *   defaultCorner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center',
 *   defaultOffsetX?: number,
 *   defaultOffsetY?: number,
 *   cascade?: number,
 *   storageKey?: string | null,
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
  style,
  onFocusWindow,
  onPointerDown,
  ...rest
}) {
  const zIndex = useOverlayLayer(id, open, group);
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

  return (
    <FloatingWindowContext.Provider value={{ dragHandleProps, focusWindow }}>
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
    </FloatingWindowContext.Provider>
  );
}

/**
 * Title bar / header region that starts a drag. Skips interactive children.
 */
export function FloatingWindowDragHandle({ className = '', children, title, ...rest }) {
  const ctx = useContext(FloatingWindowContext);
  if (!ctx) {
    return (
      <div className={className} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <div
      className={`floating-window-drag-handle${className ? ` ${className}` : ''}`}
      title={title}
      {...ctx.dragHandleProps}
      {...rest}
    >
      <span className="floating-window-drag-grip" aria-hidden="true" />
      {children}
    </div>
  );
}
