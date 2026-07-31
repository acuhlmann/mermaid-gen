// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import DeskOsPresenceStrip from '../src/components/DeskOsPresenceStrip.jsx';
import DeskOsTaskbar from '../src/components/DeskOsTaskbar.jsx';
import {
  _resetForTests,
  pushOfficeImPing,
  pushOfficeWalkBy,
  startOfficeHuddle
} from '../src/state/officeMomentStore.js';
import {
  _resetOfficeViewModeForTests,
  getOfficeViewMode
} from '../src/state/officeViewModeStore.js';
import { _resetOfficePresenceForTests, podSeatIds } from '../src/utils/officePresence.js';
import { OFFICE_CHROME_COPY, officeSenderInfo } from '../src/utils/officeCast.js';
import { formatLocale } from '../src/i18n/formatLocale.js';

/** Copy comes from the real bundle — a relabel must not need a test edit. */
const copy = OFFICE_CHROME_COPY.osTray.presence;

const firstName = (id) => officeSenderInfo(id).name.split(' ')[0];

beforeEach(() => {
  _resetForTests();
  _resetOfficeViewModeForTests();
  _resetOfficePresenceForTests();
});

afterEach(() => {
  cleanup();
  _resetForTests();
  _resetOfficeViewModeForTests();
});

describe('DeskOsPresenceStrip', () => {
  it('shows your pod and says so when the office is quiet', () => {
    render(<DeskOsPresenceStrip />);
    const strip = screen.getByTestId('desk-os-presence');

    expect(strip.dataset.kind).toBe('quiet');
    expect(strip.textContent).toContain(copy.quiet);
    // Three of six shown, the rest as a count.
    expect(strip.querySelectorAll('[data-persona-face]')).toHaveLength(3);
    expect(strip.textContent).toContain(
      formatLocale(copy.overflow, { count: podSeatIds().length - 3 })
    );
  });

  it('names whoever is at your desk', () => {
    render(<DeskOsPresenceStrip />);
    act(() => pushOfficeWalkBy({ colleagueId: 'erlich', body: 'hear me out' }));

    const strip = screen.getByTestId('desk-os-presence');
    expect(strip.dataset.kind).toBe('walkby');
    expect(strip.textContent).toContain(formatLocale(copy.walkby, { name: firstName('erlich') }));
  });

  it('names your pairing partner', () => {
    render(<DeskOsPresenceStrip />);
    act(() => startOfficeHuddle(['jared'], { mode: 'pair' }));

    const strip = screen.getByTestId('desk-os-presence');
    expect(strip.dataset.kind).toBe('pair');
    expect(strip.textContent).toContain(formatLocale(copy.pair, { name: firstName('jared') }));
  });

  it('counts a mob rather than listing it', () => {
    render(<DeskOsPresenceStrip />);
    act(() => startOfficeHuddle(['jared', 'gilfoyle', 'dinesh', 'erlich']));

    const strip = screen.getByTestId('desk-os-presence');
    expect(strip.dataset.kind).toBe('mob');
    expect(strip.textContent).toContain(formatLocale(copy.mob, { count: 4 }));
    expect(strip.querySelectorAll('[data-persona-face]')).toHaveLength(3);
  });

  it('switches between the one-sender and many-sender talk captions', () => {
    render(<DeskOsPresenceStrip />);
    act(() => pushOfficeImPing({ colleagueId: 'intern', body: 'quick q' }));
    expect(screen.getByTestId('desk-os-presence').textContent).toContain(
      formatLocale(copy.talk, { name: firstName('intern') })
    );

    act(() => pushOfficeImPing({ colleagueId: 'greybeard', body: 'we tried that in 79' }));
    expect(screen.getByTestId('desk-os-presence').textContent).toContain(
      formatLocale(copy.talkMany, { count: 2 })
    );
  });

  // ADR-0011 rule 3: the strip is the diegetic duplicate of Stand up, so it has
  // to actually be a way onto the floor, and it has to say so out loud — the
  // caption alone reads as a status rather than as something you can press.
  it('stands you up, and its accessible name leads with the visible caption', () => {
    render(<DeskOsPresenceStrip />);
    const strip = screen.getByTestId('desk-os-presence');

    expect(strip.getAttribute('aria-label')).toBe(formatLocale(copy.aria, { status: copy.quiet }));

    fireEvent.click(strip);
    expect(getOfficeViewMode()).toBe('floor');
  });

  it('sits beside Stand up in the taskbar, not instead of it', () => {
    render(<DeskOsTaskbar />);
    const strip = screen.getByTestId('desk-os-presence');

    expect(screen.getByTestId('desk-standup-button')).toBeTruthy();
    expect(strip.closest('.desk-os-taskbar-lead')).toBeTruthy();
  });
});
