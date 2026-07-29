// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfficeFloor from '../src/components/OfficeFloor.jsx';
import {
  enableFloorDialogueCaptions,
  renderFloor,
  resetOfficeFloorTestState,
  WALK_BY_FIXTURE
} from './helpers/officeFloorTestUtils.jsx';
import { getOfficeViewMode, sitDown, standUp } from '../src/state/officeViewModeStore.js';

beforeEach(() => {
  enableFloorDialogueCaptions();
});

afterEach(() => {
  resetOfficeFloorTestState();
});

describe('office view mode', () => {
  it('starts at your desk and is not persisted', () => {
    expect(getOfficeViewMode()).toBe('desk');
    standUp();
    expect(getOfficeViewMode()).toBe('floor');
    sitDown();
    expect(getOfficeViewMode()).toBe('desk');
  });
});

describe('OfficeFloor', () => {
  it('renders nothing in desktop screen mode', () => {
    render(<OfficeFloor />);
    expect(screen.queryByTestId('office-floor')).toBeNull();
  });

  it('renders the room and the whole cast once you stand up', () => {
    renderFloor();

    expect(screen.getByTestId('office-floor')).toBeTruthy();
    // One from each tier, plus you.
    expect(screen.getByRole('button', { name: /Chad/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Ulrich/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Gavin Belson/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^You/ })).toBeTruthy();
  });

  it('sits you back down from the button and from Escape', () => {
    renderFloor();

    fireEvent.click(screen.getByRole('button', { name: /Back to your screen/i }));
    expect(getOfficeViewMode()).toBe('desk');

    act(() => standUp());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(getOfficeViewMode()).toBe('desk');
  });

  it('opens a person card with Go and talk — not Slop Chat on the floor', () => {
    const onMessage = vi.fn();
    renderFloor({ onMessage });

    fireEvent.click(screen.getByRole('button', { name: /Chad/ }));
    expect(screen.getByText(/The Intern/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Go and talk/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Message/ })).toBeNull();
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('will not let you walk up to leadership without an invite', () => {
    const onMessage = vi.fn();
    renderFloor({ onMessage });

    fireEvent.click(screen.getByRole('button', { name: /Gavin Belson/ }));
    expect(screen.getByText(/Not without a calendar invite/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Message/ })).toBeNull();
  });

  it('lets you sit down from your own desk card', () => {
    renderFloor();

    fireEvent.click(screen.getByRole('button', { name: /^You/ }));
    fireEvent.click(screen.getByRole('button', { name: /Sit down here/i }));
    expect(getOfficeViewMode()).toBe('desk');
  });
});

describe('OfficeFloor walk-bys (slice 2)', () => {
  const WALK_BY = WALK_BY_FIXTURE;

  it('walks the colleague over and shows what they said', () => {
    renderFloor({ walkBy: WALK_BY });

    // Without a WAAPI engine (jsdom) the walker arrives immediately, which is
    // also the reduced-motion behaviour: the moment happens, it just doesn't travel.
    expect(screen.getByTestId('office-floor-walker')).toBeTruthy();
    expect(screen.getByText(/still in the mainframe/)).toBeTruthy();
  });

  it('leaves their desk in place but empty while they are up', () => {
    const view = renderFloor();
    const seatOf = (id) => view.container.querySelector(`[data-seat="${id}"]`);
    expect(seatOf('greybeard')?.querySelector('.office-floor-person')).toBeTruthy();

    view.rerender(<OfficeFloor walkBy={WALK_BY} />);
    // Ulrich is the walker now: the desk stays, the occupant does not.
    expect(seatOf('greybeard')).toBeTruthy();
    expect(seatOf('greybeard')?.querySelector('.office-floor-person')).toBeNull();
    expect(seatOf('greybeard')?.dataset.vacant).toBe('true');
  });

  it('adopts and dismisses through the same handlers as the desk card', () => {
    const onAdoptPrompt = vi.fn();
    const onDismissWalkBy = vi.fn();
    renderFloor({ walkBy: WALK_BY, onAdoptPrompt, onDismissWalkBy });

    fireEvent.click(screen.getByRole('button', { name: /Do it/i }));
    expect(onAdoptPrompt).toHaveBeenCalledWith('Add the legacy system', 'greybeard');

    fireEvent.click(screen.getByRole('button', { name: /Wave off/i }));
    expect(onDismissWalkBy).toHaveBeenCalledWith(WALK_BY.id);
  });

  it('walks them back to their desk after the moment clears', () => {
    const view = renderFloor({ walkBy: WALK_BY });
    expect(screen.getByTestId('office-floor-walker')).toBeTruthy();

    // Store clears (dismissed or TTL) → the walker departs, then the seat returns.
    view.rerender(<OfficeFloor walkBy={null} />);
    expect(screen.queryByTestId('office-floor-walker')).toBeNull();
    expect(screen.getByRole('button', { name: /Ulrich/ })).toBeTruthy();
  });

  it('shows no walker at all when nothing is happening', () => {
    renderFloor();
    expect(screen.queryByTestId('office-floor-walker')).toBeNull();
  });
});
