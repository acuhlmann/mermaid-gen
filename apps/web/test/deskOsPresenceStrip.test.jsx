// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  _resetOfficeMessengerUiForTests,
  getOfficeMessengerUi
} from '../src/state/officeMessengerUiStore.js';
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
  _resetOfficeMessengerUiForTests();
});

afterEach(() => {
  cleanup();
  _resetForTests();
  _resetOfficeViewModeForTests();
  _resetOfficeMessengerUiForTests();
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

  // Floor-native presence still stands you up; the accessible name leads with
  // the visible caption so the press reads as a verb, not only a status.
  it('stands you up when the floor is where the presence lives', () => {
    render(<DeskOsPresenceStrip />);
    const strip = screen.getByTestId('desk-os-presence');

    expect(strip.dataset.follow).toBe('standUp');
    expect(strip.getAttribute('aria-label')).toBe(formatLocale(copy.aria, { status: copy.quiet }));
    // Native title carries the status too — recovery path when the in-bar
    // caption is ellipsized or demoted away on a phone.
    expect(strip.getAttribute('title')).toBe(`${copy.quiet} — ${copy.title}`);

    fireEvent.click(strip);
    expect(getOfficeViewMode()).toBe('floor');
  });

  // Unread IMs are a desk medium — standing up to read a chat is the wrong room.
  it('opens Slop Chat for unread talk instead of standing up', () => {
    render(<DeskOsPresenceStrip />);
    act(() => pushOfficeImPing({ colleagueId: 'intern', body: 'quick q' }));

    const strip = screen.getByTestId('desk-os-presence');
    const status = formatLocale(copy.talk, { name: firstName('intern') });
    expect(strip.dataset.follow).toBe('messenger');
    expect(strip.getAttribute('aria-label')).toBe(formatLocale(copy.ariaChat, { status }));

    const before = getOfficeMessengerUi().openNonce;
    fireEvent.click(strip);
    expect(getOfficeViewMode()).toBe('desk');
    expect(getOfficeMessengerUi()).toEqual({
      openNonce: before + 1,
      colleagueId: 'intern'
    });
  });

  // Pairing is already at your screen — the strip should not yank you onto the
  // floor away from the huddle overlay.
  it('stays put for a huddle already at your screen', () => {
    render(<DeskOsPresenceStrip />);
    act(() => startOfficeHuddle(['jared'], { mode: 'pair' }));

    const strip = screen.getByTestId('desk-os-presence');
    expect(strip.dataset.follow).toBe('stay');
    fireEvent.click(strip);
    expect(getOfficeViewMode()).toBe('desk');
    expect(getOfficeMessengerUi().openNonce).toBe(0);
  });

  it('peeks the full caption on hover, and a long-press does not stand you up', () => {
    render(<DeskOsPresenceStrip />);
    const strip = screen.getByTestId('desk-os-presence');

    fireEvent.pointerEnter(strip, { pointerType: 'mouse' });
    const peek = screen.getByTestId('desk-os-presence-peek');
    expect(peek.textContent).toContain(copy.quiet);

    fireEvent.pointerLeave(strip, { pointerType: 'mouse' });
    expect(screen.queryByTestId('desk-os-presence-peek')).toBeNull();

    // Touch: hold to read, release without standing up — tap still stands up.
    vi.useFakeTimers();
    fireEvent.pointerDown(strip, { pointerType: 'touch' });
    act(() => {
      vi.advanceTimersByTime(420);
    });
    expect(screen.getByTestId('desk-os-presence-peek').textContent).toContain(copy.quiet);
    fireEvent.pointerUp(strip, { pointerType: 'touch' });
    fireEvent.click(strip);
    expect(getOfficeViewMode()).toBe('desk');
    vi.useRealTimers();
  });

  it('sits beside Stand up in the taskbar, not instead of it', () => {
    render(<DeskOsTaskbar />);
    const strip = screen.getByTestId('desk-os-presence');

    expect(screen.getByTestId('desk-standup-button')).toBeTruthy();
    expect(strip.closest('.desk-os-taskbar-lead')).toBeTruthy();
  });
});
