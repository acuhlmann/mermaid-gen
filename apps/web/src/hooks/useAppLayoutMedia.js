import { useEffect, useState } from 'react';
import {
  COMPACT_BRAND_MEDIA_QUERY,
  FOLDABLE_DUAL_SCREEN_MEDIA_QUERY,
  MOBILE_MEDIA_QUERY,
  PHONE_MEDIA_QUERY,
  WIDE_MOBILE_MEDIA_QUERY
} from '../utils/layoutBreakpoints.js';

function useMatchMedia(query) {
  const [matches, setMatches] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(query).matches
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);

  return matches;
}

/** True when the mobile radial / stacked chrome layout should be used. */
export function useNarrowLayout() {
  return useMatchMedia(MOBILE_MEDIA_QUERY);
}

/** True on phone-sized viewports where Thinking uses a fullscreen overlay. */
export function usePhoneLayout() {
  return useMatchMedia(PHONE_MEDIA_QUERY);
}

/**
 * True on unfolded foldables / small tablets — side-by-side canvas + Thinking
 * instead of a fullscreen overlay (still uses mobile bottom chrome).
 */
export function useWideMobileLayout() {
  return useMatchMedia(WIDE_MOBILE_MEDIA_QUERY);
}

/** True when the viewport spans two segments (horizontal fold). */
export function useFoldableDualScreen() {
  return useMatchMedia(FOLDABLE_DUAL_SCREEN_MEDIA_QUERY);
}

/**
 * True when the brand chip cannot fit the inline XP bar — drop the bar into the row below.
 */
export function useCompactBrandLayout() {
  return useMatchMedia(COMPACT_BRAND_MEDIA_QUERY);
}
