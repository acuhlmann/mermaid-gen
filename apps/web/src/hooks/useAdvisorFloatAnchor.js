import { useLayoutEffect, useState } from 'react';

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

export const ADVISOR_FLOAT_ANCHOR_GAP_PX = ANCHOR_GAP_PX;
export const ADVISOR_FLOAT_VIEWPORT_TOP_MARGIN_PX = VIEWPORT_TOP_MARGIN_PX;
