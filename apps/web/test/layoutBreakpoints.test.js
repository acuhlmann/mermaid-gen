import { describe, expect, it } from 'vitest';
import {
  COMPACT_BRAND_MAX_WIDTH_PX,
  COMPACT_BRAND_MEDIA_QUERY,
  FOLDABLE_DUAL_SCREEN_MEDIA_QUERY,
  MOBILE_BOTTOM_CHROME_RESERVE_PX,
  MOBILE_MAX_WIDTH_PX,
  MOBILE_MEDIA_QUERY,
  PHONE_MAX_WIDTH_PX,
  PHONE_MEDIA_QUERY,
  WIDE_MOBILE_MIN_HEIGHT_PX,
  WIDE_MOBILE_MIN_WIDTH_PX,
  WIDE_MOBILE_MEDIA_QUERY
} from '../src/utils/layoutBreakpoints.js';

describe('layoutBreakpoints', () => {
  it('exports mobile breakpoint at 1024px', () => {
    expect(MOBILE_MAX_WIDTH_PX).toBe(1024);
    expect(MOBILE_MEDIA_QUERY).toBe('(max-width: 1024px)');
  });

  it('exports phone breakpoint below wide-mobile split-pane gate', () => {
    expect(PHONE_MAX_WIDTH_PX).toBe(639);
    expect(PHONE_MEDIA_QUERY).toBe('(max-width: 639px)');
    expect(PHONE_MAX_WIDTH_PX).toBeLessThan(WIDE_MOBILE_MIN_WIDTH_PX);
  });

  it('exports wide-mobile split-pane query between phone and desktop', () => {
    expect(WIDE_MOBILE_MIN_WIDTH_PX).toBe(640);
    expect(WIDE_MOBILE_MIN_HEIGHT_PX).toBe(480);
    expect(WIDE_MOBILE_MEDIA_QUERY).toBe(
      '(min-width: 640px) and (max-width: 1024px) and (min-height: 480px)'
    );
  });

  it('exports foldable dual-screen media query', () => {
    expect(FOLDABLE_DUAL_SCREEN_MEDIA_QUERY).toBe('(horizontal-viewport-segments: 2)');
  });

  it('exports compact-brand breakpoint below the mobile gate', () => {
    expect(COMPACT_BRAND_MAX_WIDTH_PX).toBe(540);
    expect(COMPACT_BRAND_MEDIA_QUERY).toBe('(max-width: 540px)');
    expect(COMPACT_BRAND_MAX_WIDTH_PX).toBeLessThan(MOBILE_MAX_WIDTH_PX);
  });

  it('exports bottom chrome reserve aligned with CSS --mobile-bottom-chrome-est', () => {
    expect(MOBILE_BOTTOM_CHROME_RESERVE_PX).toBe(216);
  });
});
