// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import FloatingWindow, { FloatingWindowDragHandle } from '../src/components/FloatingWindow.jsx';
import { FloatingWindowMinimizeButton } from '../src/components/FloatingWindowChrome.jsx';
import DeskOsTray from '../src/components/DeskOsTray.jsx';
import { resetOverlayStackForTests } from '../src/state/overlayStack.js';
import { PHONE_MAX_WIDTH_PX, MOBILE_MAX_WIDTH_PX } from '../src/utils/layoutBreakpoints.js';

/**
 * The window manager as the user meets it (docs/office-window-manager.md):
 * minimize goes to the taskbar, the pill is the way back, and a phone shows one
 * office window at a time.
 *
 * These are the tests whose absence let the old split survive — the store had
 * `bringOverlayToFront` coverage and each window had its own local `minimized`
 * boolean, so nothing ever asserted that the two were connected. They were not.
 */

/** Stub matchMedia so `useWindowPresentation` resolves a chosen breakpoint. */
function stubViewport(widthPx) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query) => {
      const max = Number(query.match(/max-width:\s*(\d+)px/)?.[1] ?? Infinity);
      const min = Number(query.match(/min-width:\s*(\d+)px/)?.[1] ?? 0);
      return {
        matches: widthPx <= max && widthPx >= min,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      };
    })
  );
}

function OfficeWindow({ id, title, kind }) {
  return (
    <FloatingWindow id={id} open group="officeModal" kind={kind} title={title} aria-label={title}>
      <FloatingWindowDragHandle className="titlebar">
        <span>{title}</span>
        <FloatingWindowMinimizeButton label={`Minimize ${title}`} />
      </FloatingWindowDragHandle>
      <div>{title} body</div>
    </FloatingWindow>
  );
}

describe('office window manager', () => {
  beforeEach(() => {
    resetOverlayStackForTests();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('minimize hides the window but keeps its taskbar pill', () => {
    stubViewport(1440);
    render(
      <>
        <OfficeWindow id="office-messenger" title="Slop Chat" kind="messenger" />
        <DeskOsTray />
      </>
    );

    expect(screen.getByText('Slop Chat body')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Minimize Slop Chat'));

    // Gone from the canvas — not collapsed to a stub floating over it.
    expect(screen.queryByText('Slop Chat body')).toBeNull();
    // Still switchable, which is the whole point of sending it *to* the taskbar.
    expect(screen.getByRole('button', { name: /Slop Chat/ })).toBeTruthy();
  });

  it('the taskbar pill brings a minimized window back', () => {
    stubViewport(1440);
    render(
      <>
        <OfficeWindow id="office-messenger" title="Slop Chat" kind="messenger" />
        <DeskOsTray />
      </>
    );
    fireEvent.click(screen.getByLabelText('Minimize Slop Chat'));

    fireEvent.click(screen.getByRole('button', { name: /Slop Chat/ }));

    expect(screen.getByText('Slop Chat body')).toBeTruthy();
  });

  it('shows one office window at a time on a phone', () => {
    stubViewport(PHONE_MAX_WIDTH_PX - 1);
    render(
      <>
        <OfficeWindow id="office-inbox" title="Inbox" kind="inbox" />
        <OfficeWindow id="office-messenger" title="Slop Chat" kind="messenger" />
      </>
    );

    // The later window wins the screen; the earlier one is in the taskbar, not
    // clipped behind it. "Not enough space anyway" is the whole rule.
    expect(screen.getByText('Slop Chat body')).toBeTruthy();
    expect(screen.queryByText('Inbox body')).toBeNull();
  });

  it('keeps both windows on a tablet, where there is room', () => {
    stubViewport(MOBILE_MAX_WIDTH_PX);
    render(
      <>
        <OfficeWindow id="office-inbox" title="Inbox" kind="inbox" />
        <OfficeWindow id="office-messenger" title="Slop Chat" kind="messenger" />
      </>
    );

    expect(screen.getByText('Slop Chat body')).toBeTruthy();
    expect(screen.getByText('Inbox body')).toBeTruthy();
  });

  it('opens a phone sheet at half height, not covering the canvas', () => {
    stubViewport(PHONE_MAX_WIDTH_PX - 1);
    render(<OfficeWindow id="office-messenger" title="Slop Chat" kind="messenger" />);

    const el = document.querySelector('[data-floating-window="office-messenger"]');
    expect(el.dataset.presentation).toBe('sheet');
    // The canvas is the work and the office is the side show.
    expect(el.dataset.snap).toBe('half');
  });

  it('resolves a placement per breakpoint', () => {
    for (const [width, expected] of [
      [PHONE_MAX_WIDTH_PX - 1, 'sheet'],
      [MOBILE_MAX_WIDTH_PX, 'docked'],
      [MOBILE_MAX_WIDTH_PX + 1, 'floating']
    ]) {
      cleanup();
      resetOverlayStackForTests();
      stubViewport(width);
      render(<OfficeWindow id="office-messenger" title="Slop Chat" kind="messenger" />);
      const el = document.querySelector('[data-floating-window="office-messenger"]');
      expect(el.dataset.presentation, `${width}px`).toBe(expected);
    }
  });

  it('the sheet grip is a real button, so the snap is reachable without a drag', () => {
    stubViewport(PHONE_MAX_WIDTH_PX - 1);
    render(<OfficeWindow id="office-messenger" title="Slop Chat" kind="messenger" />);

    const grip = document.querySelector('.floating-window-sheet-grip');
    expect(grip).toBeTruthy();
    expect(grip.getAttribute('aria-label')).toBeTruthy();

    fireEvent.click(grip);

    expect(document.querySelector('[data-floating-window="office-messenger"]').dataset.snap).toBe(
      'full'
    );
  });
});
