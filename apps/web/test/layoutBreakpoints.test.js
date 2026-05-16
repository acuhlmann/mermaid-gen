import { describe, expect, it } from 'vitest';
import {
  COMPACT_BRAND_MAX_WIDTH_PX,
  COMPACT_BRAND_MEDIA_QUERY,
  MOBILE_MAX_WIDTH_PX,
  MOBILE_MEDIA_QUERY
} from '../src/utils/layoutBreakpoints.js';

describe('layoutBreakpoints', () => {
  it('exports mobile breakpoint at 1024px', () => {
    expect(MOBILE_MAX_WIDTH_PX).toBe(1024);
    expect(MOBILE_MEDIA_QUERY).toBe('(max-width: 1024px)');
  });

  it('exports compact-brand breakpoint below the mobile gate', () => {
    expect(COMPACT_BRAND_MAX_WIDTH_PX).toBe(540);
    expect(COMPACT_BRAND_MEDIA_QUERY).toBe('(max-width: 540px)');
    expect(COMPACT_BRAND_MAX_WIDTH_PX).toBeLessThan(MOBILE_MAX_WIDTH_PX);
  });
});
