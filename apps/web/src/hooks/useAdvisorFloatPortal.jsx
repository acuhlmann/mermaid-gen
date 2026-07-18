import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const ANCHOR_GAP_PX = 8;
const VIEWPORT_TOP_MARGIN_PX = 8;

/**
 * Track the mascot anchor's viewport rect while a float surface is live.
 *
 * @param {React.RefObject<HTMLElement | null>} anchorRef
 * @param {boolean} active
 */
export function useAdvisorFloatAnchor(anchorRef, active) {
  const [anchorRect, setAnchorRect] = useState(/** @type {DOMRect | null} */ (null));

  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!el || !active) {
      setAnchorRect(null);
      return undefined;
    }

    const measure = () => {
      const node = anchorRef.current;
      if (!node) return;
      setAnchorRect(node.getBoundingClientRect());
    };

    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', measure);
    vv?.addEventListener('scroll', measure);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      vv?.removeEventListener('resize', measure);
      vv?.removeEventListener('scroll', measure);
    };
  }, [anchorRef, active]);

  return anchorRect;
}

/**
 * Render the advisor thinking chip / speech bubble in a body portal so it is
 * never clipped by `.app-shell { overflow: hidden }`, streaming GPU layers on
 * `.bottom-chrome`, or `display: contents` ancestors in the mobile action row.
 *
 * @param {{
 *   anchorRef: React.RefObject<HTMLElement | null>,
 *   active: boolean,
 *   children: React.ReactNode
 * }} props
 */
export function AdvisorFloatPortal({ anchorRef, active, children }) {
  const rect = useAdvisorFloatAnchor(anchorRef, active);
  if (!active || !children || !rect || typeof document === 'undefined') return null;

  const vv = window.visualViewport;
  const vvTop = vv?.offsetTop ?? 0;
  const maxHeight = Math.max(
    VIEWPORT_TOP_MARGIN_PX,
    Math.floor(rect.top - vvTop - ANCHOR_GAP_PX - VIEWPORT_TOP_MARGIN_PX)
  );

  return createPortal(
    <div
      className="advisor-float-portal"
      style={{
        position: 'fixed',
        left: rect.left,
        top: rect.top,
        transform: `translateY(calc(-100% - ${ANCHOR_GAP_PX}px))`,
        maxHeight,
        zIndex: 100,
        pointerEvents: 'none',
        ['--advisor-float-max-h']: maxHeight > 0 ? `${maxHeight}px` : undefined
      }}
    >
      <div className="advisor-float-portal-inner">{children}</div>
    </div>,
    document.body
  );
}
