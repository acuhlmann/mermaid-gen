// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import OfficeLayer from '../src/components/OfficeLayer.jsx';
import { setDeskSlotElement } from '../src/state/deskSlotStore.js';

const BASE_PROPS = {
  pause: false,
  advisorBusy: false,
  getDiagramSource: () => 'flowchart LR\n  A-->B',
  getContentType: () => 'mermaid',
  getSessionId: () => 'test-session',
  getSvgRoot: () => document,
  getUserTitle: () => 'Intern Architect',
  onUsage: () => {},
  onAdoptPrompt: () => {},
  onMeetingMinutes: () => {},
  onOfficeEvent: () => {},
  onTalkToTeam: () => {},
  onCheckHrProgression: () => {},
  playChime: () => {}
};

function BottomNavSlot({ ready = false }) {
  if (!ready) return null;
  return (
    <div
      id="office-desk-bottom-slot"
      className="bottom-office-desk-slot"
      ref={(el) => setDeskSlotElement(el)}
    />
  );
}

describe('OfficeLayer desk actions portal', () => {
  afterEach(() => {
    setDeskSlotElement(null);
    cleanup();
  });

  it('portals the desk trigger once the bottom nav slot mounts after hydrate', () => {
    const view = render(
      <>
        <OfficeLayer {...BASE_PROPS} deskActionsAnchorReady={false} />
        <BottomNavSlot ready={false} />
      </>
    );

    expect(screen.queryByTestId('bottom-brand-mark')).toBeNull();

    view.rerender(
      <>
        <OfficeLayer {...BASE_PROPS} deskActionsAnchorReady />
        <BottomNavSlot ready />
      </>
    );

    expect(screen.getByTestId('bottom-brand-mark')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Your desk/i })).toBeTruthy();
  });

  it('finds the slot when OfficeLayer renders before the bottom nav in tree order', () => {
    render(
      <>
        <OfficeLayer {...BASE_PROPS} deskActionsAnchorReady deskMenuInitialOpen />
        <BottomNavSlot ready />
      </>
    );

    expect(screen.getByTestId('bottom-brand-mark')).toBeTruthy();
    expect(screen.getByRole('menu', { name: /Desk actions/i })).toBeTruthy();
  });

  it('opens the desk menu when deskMenuInitialOpen is set', () => {
    render(
      <>
        <OfficeLayer {...BASE_PROPS} deskActionsAnchorReady deskMenuInitialOpen />
        <BottomNavSlot ready />
      </>
    );

    expect(screen.getByRole('menu', { name: /Desk actions/i })).toBeTruthy();
    expect(screen.getByText('Your seat')).toBeTruthy();
  });

  it('rebinds when the bottom nav layout key changes', () => {
    const view = render(
      <>
        <OfficeLayer {...BASE_PROPS} deskActionsAnchorReady deskActionsLayoutKey="desktop" />
        <BottomNavSlot ready />
      </>
    );

    expect(screen.getByTestId('bottom-brand-mark')).toBeTruthy();

    view.rerender(
      <>
        <OfficeLayer {...BASE_PROPS} deskActionsAnchorReady deskActionsLayoutKey="mobile" />
        <BottomNavSlot ready />
      </>
    );

    expect(screen.getByTestId('bottom-brand-mark')).toBeTruthy();
  });
});
