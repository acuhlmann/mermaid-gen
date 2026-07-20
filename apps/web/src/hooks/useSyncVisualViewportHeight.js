import { useEffect } from 'react';

/**
 * Sync the `--app-vvh` CSS variable to the visual-viewport height so layouts
 * (mobile keyboard, address bar, foldable hinge transitions) snap to the actual
 * usable area, not 100vh. Falls back to `window.innerHeight` if `visualViewport`
 * is unavailable.
 */
export function useSyncVisualViewportHeight() {
  useEffect(() => {
    const root = document.documentElement;

    function applyHeight() {
      const vv = window.visualViewport;
      const h = vv ? vv.height : window.innerHeight;
      root.style.setProperty('--app-vvh', `${Math.round(h)}px`);
    }

    applyHeight();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', applyHeight);
      vv.addEventListener('scroll', applyHeight);
    }
    window.addEventListener('resize', applyHeight);
    window.addEventListener('orientationchange', applyHeight);
    const orientation = window.screen?.orientation;
    orientation?.addEventListener?.('change', applyHeight);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', applyHeight);
        vv.removeEventListener('scroll', applyHeight);
      }
      window.removeEventListener('resize', applyHeight);
      window.removeEventListener('orientationchange', applyHeight);
      orientation?.removeEventListener?.('change', applyHeight);
    };
  }, []);
}
