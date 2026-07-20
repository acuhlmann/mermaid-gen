// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  useCompactBrandLayout,
  useFoldableDualScreen,
  useNarrowLayout,
  usePhoneLayout,
  useWideMobileLayout
} from '../src/hooks/useAppLayoutMedia.js';
import {
  COMPACT_BRAND_MEDIA_QUERY,
  FOLDABLE_DUAL_SCREEN_MEDIA_QUERY,
  MOBILE_MEDIA_QUERY,
  PHONE_MEDIA_QUERY,
  WIDE_MOBILE_MEDIA_QUERY
} from '../src/utils/layoutBreakpoints.js';

function Probe() {
  return (
    <div
      data-testid="layout-probe"
      data-narrow={useNarrowLayout()}
      data-phone={usePhoneLayout()}
      data-wide-mobile={useWideMobileLayout()}
      data-foldable={useFoldableDualScreen()}
      data-compact={useCompactBrandLayout()}
    />
  );
}

describe('useAppLayoutMedia', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reflects matchMedia for layout breakpoints', () => {
    const matchers = {
      [MOBILE_MEDIA_QUERY]: true,
      [PHONE_MEDIA_QUERY]: false,
      [WIDE_MOBILE_MEDIA_QUERY]: true,
      [FOLDABLE_DUAL_SCREEN_MEDIA_QUERY]: false,
      [COMPACT_BRAND_MEDIA_QUERY]: false
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query) => ({
        matches: matchers[query] ?? false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    );

    render(<Probe />);
    const el = screen.getByTestId('layout-probe');
    expect(el.getAttribute('data-narrow')).toBe('true');
    expect(el.getAttribute('data-phone')).toBe('false');
    expect(el.getAttribute('data-wide-mobile')).toBe('true');
    expect(el.getAttribute('data-foldable')).toBe('false');
    expect(el.getAttribute('data-compact')).toBe('false');
  });
});
