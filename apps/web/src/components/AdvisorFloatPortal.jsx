import { createPortal } from 'react-dom';
import {
  ADVISOR_FLOAT_ANCHOR_GAP_PX,
  ADVISOR_FLOAT_VIEWPORT_TOP_MARGIN_PX,
  useAdvisorFloatAnchor
} from '../hooks/useAdvisorFloatAnchor.js';
import { useDraggablePosition } from '../hooks/useDraggablePosition.js';
import { overlayLayerStyle, useOverlayLayer } from '../hooks/useOverlayLayer.js';
import { bringOverlayToFront } from '../state/overlayStack.js';

/**
 * Render the advisor thinking chip / speech bubble in a body portal so it is
 * never clipped by `.app-shell { overflow: hidden }`, streaming GPU layers on
 * `.bottom-chrome`, or `display: contents` ancestors in the mobile action row.
 */
export default function AdvisorFloatPortal({ anchorRef, active, children }) {
  const rect = useAdvisorFloatAnchor(anchorRef, active);
  const advisorZIndex = useOverlayLayer('advisor-float', active, 'advisor');
  const { nodeRef, position, isDragging, isRepositioned, dragHandleProps } = useDraggablePosition({
    enabled: active,
    defaultCorner: 'bottom-right',
    defaultOffsetX: 14,
    defaultOffsetY: 200,
    storageKey: 'advisor-float',
    placementOnMount: false
  });

  if (!active || !children || !rect || typeof document === 'undefined') return null;

  const vv = window.visualViewport;
  const vvTop = vv?.offsetTop ?? 0;
  const maxHeight = Math.max(
    ADVISOR_FLOAT_VIEWPORT_TOP_MARGIN_PX,
    Math.floor(
      rect.top - vvTop - ADVISOR_FLOAT_ANCHOR_GAP_PX - ADVISOR_FLOAT_VIEWPORT_TOP_MARGIN_PX
    )
  );

  const anchoredStyle = isRepositioned
    ? position
      ? { left: position.left, top: position.top, transform: 'none' }
      : undefined
    : {
        left: rect.left,
        top: rect.top,
        transform: `translateY(calc(-100% - ${ADVISOR_FLOAT_ANCHOR_GAP_PX}px))`
      };

  return createPortal(
    <div
      ref={nodeRef}
      className={`advisor-float-portal floating-window${isDragging ? ' is-dragging' : ''}${isRepositioned ? ' is-repositioned' : ''}`}
      style={overlayLayerStyle(advisorZIndex, {
        position: 'fixed',
        ...anchoredStyle,
        maxHeight,
        pointerEvents: 'auto',
        ['--advisor-float-max-h']: maxHeight > 0 ? `${maxHeight}px` : undefined
      })}
      data-floating-window="advisor-float"
      onPointerDown={() => bringOverlayToFront('advisor-float')}
    >
      <div
        className="advisor-float-drag-handle floating-window-drag-handle"
        title="Drag to move"
        {...dragHandleProps}
      />
      <div className="advisor-float-portal-inner">{children}</div>
    </div>,
    document.body
  );
}
