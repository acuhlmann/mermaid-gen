import { useEffect, useState } from 'react';

/**
 * Fixed positioning for ephemeral popups (advisor thinking / speech) so they sit
 * above corner chrome. Anchors above `anchorRef`'s top edge; updates on scroll/resize.
 */
export function useEphemeralAnchorStyle(anchorRef, { gapRem = 0.55, active = true } = {}) {
  const [style, setStyle] = useState(() => ({ visibility: 'hidden' }));

  useEffect(() => {
    if (!active) {
      setStyle({ visibility: 'hidden' });
      return undefined;
    }

    const anchor = anchorRef?.current;
    if (!anchor) {
      setStyle({ visibility: 'hidden' });
      return undefined;
    }

    const update = () => {
      const el = anchorRef.current;
      if (!el) {
        setStyle({ visibility: 'hidden' });
        return;
      }
      const rect = el.getBoundingClientRect();
      setStyle({
        position: 'fixed',
        left: `${Math.max(0, rect.left)}px`,
        bottom: `calc(100vh - ${rect.top}px + ${gapRem}rem)`,
        maxWidth: `min(24rem, calc(100vw - ${Math.max(0, rect.left)}px - 1rem))`,
        visibility: 'visible'
      });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(anchor);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef, gapRem, active]);

  return style;
}
