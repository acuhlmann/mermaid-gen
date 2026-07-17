import { useLayoutEffect } from 'react';

const VIEWPORT_TOP_MARGIN_PX = 8;

/**
 * Measure how much vertical space sits above the stakeholders dock anchor and
 * publish it as `--advisor-float-max-h` on the wrap. The speech bubble / thinking
 * chip are absolutely positioned above the mascot; without this cap they can grow
 * past the top of `.app-shell { overflow: hidden }` — especially the taller Wise
 * Architect bubble (cast strip + Dumb it Down / Drill Deeper).
 *
 * @param {React.RefObject<HTMLElement | null>} wrapRef
 * @param {boolean} active  When false, clears the custom property.
 */
export function useAdvisorFloatMaxHeight(wrapRef, active) {
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !active) {
      wrap?.style.removeProperty('--advisor-float-max-h');
      return undefined;
    }

    const measure = () => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vv = window.visualViewport;
      const vvTop = vv?.offsetTop ?? 0;
      const available = Math.floor(rect.top - vvTop - VIEWPORT_TOP_MARGIN_PX);
      if (available > 0) {
        el.style.setProperty('--advisor-float-max-h', `${available}px`);
      } else {
        el.style.removeProperty('--advisor-float-max-h');
      }
    };

    measure();
    const vv = window.visualViewport;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(wrap);
    window.addEventListener('resize', measure);
    vv?.addEventListener('resize', measure);
    vv?.addEventListener('scroll', measure);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      vv?.removeEventListener('resize', measure);
      vv?.removeEventListener('scroll', measure);
      wrap.style.removeProperty('--advisor-float-max-h');
    };
  }, [wrapRef, active]);
}
