import { createPortal } from 'react-dom';
import {
  ADVISOR_FLOAT_ANCHOR_GAP_PX,
  ADVISOR_FLOAT_VIEWPORT_TOP_MARGIN_PX,
  useAdvisorFloatAnchor
} from '../hooks/useAdvisorFloatAnchor.js';
import { overlayLayerStyle, useOverlayLayer } from '../hooks/useOverlayLayer.js';

/**
 * Render the advisor thinking chip / speech bubble in a body portal so it is
 * never clipped by `.app-shell { overflow: hidden }`, streaming GPU layers on
 * `.bottom-chrome`, or `display: contents` ancestors in the mobile action row.
 */
export default function AdvisorFloatPortal({ anchorRef, active, children }) {
  const rect = useAdvisorFloatAnchor(anchorRef, active);
  const advisorZIndex = useOverlayLayer('advisor-float', active, 'advisor');
  if (!active || !children || !rect || typeof document === 'undefined') return null;

  const vv = window.visualViewport;
  const vvTop = vv?.offsetTop ?? 0;
  const maxHeight = Math.max(
    ADVISOR_FLOAT_VIEWPORT_TOP_MARGIN_PX,
    Math.floor(
      rect.top - vvTop - ADVISOR_FLOAT_ANCHOR_GAP_PX - ADVISOR_FLOAT_VIEWPORT_TOP_MARGIN_PX
    )
  );

  return createPortal(
    <div
      className="advisor-float-portal"
      style={overlayLayerStyle(advisorZIndex, {
        position: 'fixed',
        left: rect.left,
        top: rect.top,
        transform: `translateY(calc(-100% - ${ADVISOR_FLOAT_ANCHOR_GAP_PX}px))`,
        maxHeight,
        pointerEvents: 'none',
        ['--advisor-float-max-h']: maxHeight > 0 ? `${maxHeight}px` : undefined
      })}
    >
      <div className="advisor-float-portal-inner">{children}</div>
    </div>,
    document.body
  );
}
