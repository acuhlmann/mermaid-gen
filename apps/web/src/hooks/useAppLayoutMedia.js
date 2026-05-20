import { useEffect, useState } from 'react';
import { COMPACT_BRAND_MEDIA_QUERY, MOBILE_MEDIA_QUERY } from '../utils/layoutBreakpoints.js';

/** True when the mobile radial / stacked chrome layout should be used. */
export function useNarrowLayout() {
  const [narrowLayout, setNarrowLayout] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(MOBILE_MEDIA_QUERY).matches
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(MOBILE_MEDIA_QUERY);
    const sync = () => setNarrowLayout(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return narrowLayout;
}

/**
 * True when the brand chip cannot fit the inline XP bar — drop the bar into the row below.
 */
export function useCompactBrandLayout() {
  const [compact, setCompact] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(COMPACT_BRAND_MEDIA_QUERY).matches
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(COMPACT_BRAND_MEDIA_QUERY);
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return compact;
}
