// @vitest-environment jsdom
/*
 * The elevator and the Machine Room, mounted inside the real floor.
 *
 * jsdom has no Web Animations, so every walk settles on the spot
 * (`useWalkAnimation`'s no-engine branch) — the walk to the doors is still the
 * open plan's own `walkTo`, it just takes no time. The ride's three beats are
 * real timers; reduced motion is switched on so they total a few hundred ms.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import OfficeFloor from '../src/components/OfficeFloor.jsx';
import {
  getBuildingSnapshot,
  resetBuildingForTests
} from '../src/features/building/officeBuildingStore.js';
import { setNightShiftManifestForTests } from '../src/features/nightShift/nightShiftManifest.js';
import { resetNightShiftForTests } from '../src/features/nightShift/nightShiftStore.js';
import { sitDown } from '../src/state/officeViewModeStore.js';
import { STORAGE_KEY } from '../src/state/runGamificationStore.js';
import { renderFloor, resetOfficeFloorTestState } from './helpers/officeFloorTestUtils.jsx';
import { NIGHT_FIXTURE } from './helpers/nightShiftFixture.js';

let originalMatchMedia;

beforeEach(() => {
  originalMatchMedia = window.matchMedia;
  window.matchMedia = (query) => ({
    matches: query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {}
  });
  window.localStorage.clear();
  setNightShiftManifestForTests(NIGHT_FIXTURE);
  resetNightShiftForTests();
});

afterEach(() => {
  resetOfficeFloorTestState();
  resetBuildingForTests();
  setNightShiftManifestForTests(null);
  window.matchMedia = originalMatchMedia;
});

function openDoorsUpstairs() {
  fireEvent.click(screen.getByTestId('office-floor-elevator-call'));
  expect(screen.getByTestId('office-floor-elevator').dataset.open).toBe('true');
}

async function rideTo(floorId) {
  fireEvent.click(screen.getByTestId(`office-floor-elevator-go-${floorId}`));
  await waitFor(() => expect(getBuildingSnapshot()).toMatchObject({ floor: floorId, ride: null }));
}

describe('the elevator in reception', () => {
  it('walks you over and opens the doors on the panel', () => {
    renderFloor();
    expect(screen.getByTestId('office-floor-elevator').dataset.open).toBe('false');

    openDoorsUpstairs();
    const card = screen.getByTestId('office-floor-elevator-card');
    expect(card.textContent).toContain('Which floor?');
    expect(screen.getByTestId('office-floor-elevator-go-basement').disabled).toBe(false);
    expect(screen.getByTestId('office-floor-elevator-go-office').dataset.state).toBe('current');
    // A new hire's badge does not open the leadership floor.
    expect(screen.getByTestId('office-floor-elevator-go-leadership').dataset.state).toBe('locked');
  });

  it('reads your HR level from the progress the level-up panel saves', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 3, xp: 1800 }));
    renderFloor();
    openDoorsUpstairs();
    expect(screen.getByTestId('office-floor-elevator-go-leadership').dataset.state).toBe('fitOut');
  });

  it('lets the car go when you close the doors', () => {
    renderFloor();
    openDoorsUpstairs();
    fireEvent.click(screen.getByTestId('office-floor-elevator-close'));
    expect(screen.getByTestId('office-floor-elevator').dataset.open).toBe('false');
    expect(screen.queryByTestId('office-floor-elevator-card')).toBeNull();
  });
});

describe('floor B1, the Machine Room', () => {
  it('takes you down, keeps the open plan mounted but off screen, and lights the racks', async () => {
    renderFloor();
    openDoorsUpstairs();
    await rideTo('basement');

    expect(screen.getByTestId('machine-room')).toBeTruthy();
    expect(
      screen.getByTestId('office-floor').querySelector('[data-building-floor]').dataset
        .buildingFloor
    ).toBe('basement');
    // Upstairs is still there — the cast carries on without you.
    expect(screen.getByRole('button', { name: /Chad/ })).toBeTruthy();

    // The racks read the same columns the kanban does.
    expect(screen.getByTestId('machine-room-rack-office-life').dataset.column).toBe('shipped');
    expect(screen.getByTestId('machine-room-rack-resolve').dataset.column).toBe('checked');
    expect(screen.getByTestId('machine-room-rack-prune').dataset.column).toBe('noShow');
    expect(screen.getByTestId('machine-room-rack-canvas-graph-edit').dataset.column).toBe(
      'onLeave'
    );

    expect(screen.getByTestId('office-floor-elevator-card').textContent).toContain(
      'Where the night crew works'
    );
  });

  it('walks you up to a rack and reads you its night', async () => {
    renderFloor();
    openDoorsUpstairs();
    await rideTo('basement');

    fireEvent.click(screen.getByTestId('machine-room-rack-office-life'));
    const readout = screen.getByTestId('machine-room-readout');
    expect(readout.dataset.crew).toBe('office-life');
    expect(readout.textContent).toContain('Queue 0 — a new step');
    expect(readout.querySelector('a').getAttribute('href')).toMatch(/\/pull\/958$/);

    fireEvent.click(screen.getByRole('button', { name: 'Step back' }));
    expect(screen.queryByTestId('machine-room-readout')).toBeNull();
  });

  it('rides you back up from the card', async () => {
    renderFloor();
    openDoorsUpstairs();
    await rideTo('basement');

    fireEvent.click(screen.getByTestId('office-floor-elevator-call-card'));
    expect(screen.getByTestId('office-floor-elevator-card').textContent).toContain('Which floor?');
    await rideTo('office');
    expect(screen.queryByTestId('machine-room')).toBeNull();
    expect(screen.queryByTestId('office-floor-elevator-card')).toBeNull();
  });

  it('is forgotten when you sit down: standing up puts you at your desk', async () => {
    renderFloor();
    openDoorsUpstairs();
    await rideTo('basement');

    act(() => sitDown());
    await waitFor(() => expect(screen.queryByTestId('office-floor')).toBeNull());
    expect(getBuildingSnapshot().floor).toBe('office');
  });

  it('sends Escape home via the elevator rather than walking you upstairs unseen', async () => {
    renderFloor();
    openDoorsUpstairs();
    await rideTo('basement');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(getBuildingSnapshot().floor).toBe('office');
    expect(screen.queryByTestId('machine-room')).toBeNull();
  });
});

describe('summoned upstairs', () => {
  it('comes back up for a set piece you accepted', async () => {
    const view = renderFloor();
    openDoorsUpstairs();
    await rideTo('basement');

    view.rerender(
      <OfficeFloor
        coffee={{
          id: 'c1',
          accepted: true,
          lines: [{ speakerId: 'intern', text: 'Is the machine meant to make that noise?' }]
        }}
      />
    );
    expect(getBuildingSnapshot().floor).toBe('office');
  });
});
