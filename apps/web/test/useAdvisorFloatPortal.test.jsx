// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import AdvisorFloatPortal from '../src/components/AdvisorFloatPortal.jsx';

function Probe({ active, children }) {
  const anchorRef = useRef(null);
  return (
    <>
      <button ref={anchorRef} type="button" data-testid="anchor">
        Mascot
      </button>
      <AdvisorFloatPortal anchorRef={anchorRef} active={active}>
        {children}
      </AdvisorFloatPortal>
    </>
  );
}

describe('AdvisorFloatPortal', () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders float content in a body portal above the anchor', () => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        offsetTop: 0,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 500,
      left: 40,
      right: 80,
      bottom: 540,
      width: 40,
      height: 40,
      x: 40,
      y: 500,
      toJSON: () => ({})
    });

    render(
      <Probe active>
        <div data-testid="float-chip">Wise Architect says hi</div>
      </Probe>
    );

    const portal = document.body.querySelector('.advisor-float-portal');
    expect(portal).toBeTruthy();
    expect(screen.getByTestId('float-chip')).toBeTruthy();
    expect(portal?.style.getPropertyValue('--advisor-float-max-h')).toBeTruthy();
  });

  it('renders nothing when inactive', () => {
    render(
      <Probe active={false}>
        <div data-testid="float-chip">Hidden</div>
      </Probe>
    );
    expect(document.body.querySelector('.advisor-float-portal')).toBeNull();
  });
});
