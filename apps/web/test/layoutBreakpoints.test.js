import { describe, expect, it } from 'vitest';
import { MOBILE_MAX_WIDTH_PX, MOBILE_MEDIA_QUERY } from '../src/utils/layoutBreakpoints.js';

describe('layoutBreakpoints', () => {
  it('exports mobile breakpoint at 1024px', () => {
    expect(MOBILE_MAX_WIDTH_PX).toBe(1024);
    expect(MOBILE_MEDIA_QUERY).toBe('(max-width: 1024px)');
  });
});
