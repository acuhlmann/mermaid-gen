// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { useAdvisorFloatMaxHeight } from '../src/hooks/useAdvisorFloatMaxHeight.js';

function Probe({ active }) {
  const ref = useRef(null);
  useAdvisorFloatMaxHeight(ref, active);
  return <div ref={ref} data-testid="wrap" style={{ position: 'fixed', top: '120px', left: 0 }} />;
}

describe('useAdvisorFloatMaxHeight', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('publishes available space above the anchor as --advisor-float-max-h', () => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        offsetTop: 0,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }
    });
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 120,
      left: 0,
      right: 40,
      bottom: 160,
      width: 40,
      height: 40,
      x: 0,
      y: 120,
      toJSON: () => ({})
    });
    const { getByTestId } = render(<Probe active />);
    const wrap = getByTestId('wrap');
    expect(wrap.style.getPropertyValue('--advisor-float-max-h')).toBe('112px');
    rectSpy.mockRestore();
  });

  it('clears the custom property when inactive', () => {
    const { getByTestId, rerender } = render(<Probe active />);
    const wrap = getByTestId('wrap');
    wrap.style.setProperty('--advisor-float-max-h', '200px');
    rerender(<Probe active={false} />);
    expect(wrap.style.getPropertyValue('--advisor-float-max-h')).toBe('');
  });
});
