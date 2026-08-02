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

  it('portals the comms cluster once the bottom nav slot mounts after hydrate', () => {
    const view = render(
      <>
        <OfficeLayer {...BASE_PROPS} deskActionsAnchorReady={false} />
        <BottomNavSlot ready={false} />
      </>
    );

    expect(screen.queryByTestId('desk-comms-cluster')).toBeNull();

    view.rerender(
      <>
        <OfficeLayer {...BASE_PROPS} deskActionsAnchorReady />
        <BottomNavSlot ready />
      </>
    );

    expect(screen.getByTestId('desk-comms-cluster')).toBeTruthy();
    expect(screen.queryByTestId('desk-comms-inbox')).toBeNull();
    expect(screen.getByTestId('desk-comms-slopChat')).toBeTruthy();
    expect(screen.getByTestId('desk-comms-meeting')).toBeTruthy();
  });

  it('finds the slot when OfficeLayer renders before the bottom nav in tree order', () => {
    render(
      <>
        <OfficeLayer {...BASE_PROPS} deskActionsAnchorReady />
        <BottomNavSlot ready />
      </>
    );

    expect(screen.getByTestId('desk-comms-cluster')).toBeTruthy();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('keeps the portal bound across re-renders', () => {
    const view = render(
      <>
        <OfficeLayer {...BASE_PROPS} deskActionsAnchorReady />
        <BottomNavSlot ready />
      </>
    );

    expect(screen.getByTestId('desk-comms-cluster')).toBeTruthy();

    view.rerender(
      <>
        <OfficeLayer {...BASE_PROPS} deskActionsAnchorReady />
        <BottomNavSlot ready />
      </>
    );

    expect(screen.getByTestId('desk-comms-cluster')).toBeTruthy();
  });
});
