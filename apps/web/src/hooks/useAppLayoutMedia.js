import { useEffect, useState } from 'react';
import {
  COMPACT_BRAND_MEDIA_QUERY,
  FOLDABLE_DUAL_SCREEN_MEDIA_QUERY,
  MOBILE_MEDIA_QUERY,
  PHONE_MEDIA_QUERY,
  WIDE_MOBILE_MEDIA_QUERY
} from '../utils/layoutBreakpoints.js';

function readInlineSize(entry) {
  const size = entry?.contentBoxSize?.[0]?.inlineSize ?? entry?.contentRect?.width ?? 0;
  return typeof size === 'number' ? size : 0;
}

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

/** True on touch-first devices where keyboard shortcut hints are noise. */
export function useCoarsePointer() {
  return useMatchMedia('(pointer: coarse)');
}

/**
 * True when the brand chip cannot fit the inline XP bar — drop the bar into the row below.
 */
export function useCompactBrandLayout() {
  return useMatchMedia(COMPACT_BRAND_MEDIA_QUERY);
}

/** True when a measured element's inline size is below the given pixel threshold. */
export function useElementNarrow(ref, maxWidthPx) {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const el = ref?.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;

    const sync = (width) => {
      setNarrow(width > 0 && width < maxWidthPx);
    };

    const ro = new ResizeObserver((entries) => {
      sync(readInlineSize(entries[0]));
    });
    ro.observe(el);
    sync(el.getBoundingClientRect().width);

    return () => ro.disconnect();
  }, [ref, maxWidthPx]);

  return narrow;
}
