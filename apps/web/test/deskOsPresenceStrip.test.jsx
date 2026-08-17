// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import DeskOsPresenceStrip from '../src/components/DeskOsPresenceStrip.jsx';
import DeskOsTaskbar from '../src/components/DeskOsTaskbar.jsx';
import {
  _resetForTests,
  pushOfficeEmail,
  pushOfficeImPing,
  pushOfficeWalkBy,
  pushOfficeErrand,
  pushOfficeMeetingInvite,
  startOfficeHuddle
} from '../src/state/officeMomentStore.js';
import { _resetDeskCommsUiForTests, getDeskCommsUi } from '../src/state/deskCommsUiStore.js';
import {
  _resetOfficeMessengerUiForTests,
  getOfficeMessengerUi
} from '../src/state/officeMessengerUiStore.js';
import {
  _resetOfficeViewModeForTests,
  getOfficeViewMode
} from '../src/state/officeViewModeStore.js';
import { _resetOfficePresenceForTests } from '../src/utils/officePresence.js';
import { OFFICE_CHROME_COPY, officeSenderInfo } from '../src/utils/officeCast.js';
import { formatLocale } from '../src/i18n/formatLocale.js';

const copy = OFFICE_CHROME_COPY.osTray.presence;

const firstName = (id) => officeSenderInfo(id).name.split(' ')[0];

beforeEach(() => {
  _resetForTests();
  _resetOfficeViewModeForTests();
  _resetOfficePresenceForTests();
  _resetOfficeMessengerUiForTests();
  _resetDeskCommsUiForTests();
});

afterEach(() => {
  cleanup();
  _resetForTests();
  _resetOfficeViewModeForTests();
  _resetOfficeMessengerUiForTests();
  _resetDeskCommsUiForTests();
});

describe('DeskOsPresenceStrip', () => {
  it('is absent when nothing expects you', () => {
    render(<DeskOsPresenceStrip />);
    expect(screen.queryByTestId('desk-os-presence')).toBeNull();
  });

  it('names whoever is at your desk', () => {
    render(<DeskOsPresenceStrip />);
    act(() => pushOfficeWalkBy({ colleagueId: 'erlich', body: 'hear me out' }));

    const strip = screen.getByTestId('desk-os-presence');
    expect(strip.dataset.kind).toBe('walkby');
    expect(strip.textContent).toContain(formatLocale(copy.walkby, { name: firstName('erlich') }));
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

  it('stands you up when somebody is at your desk', () => {
    render(<DeskOsPresenceStrip />);
    act(() => pushOfficeWalkBy({ colleagueId: 'erlich', body: 'hear me out' }));

    const strip = screen.getByTestId('desk-os-presence');
    expect(strip.dataset.follow).toBe('standUp');
    fireEvent.click(strip);
    expect(getOfficeViewMode()).toBe('floor');
  });

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

  it('opens the inbox for actionable mail', () => {
    render(<DeskOsPresenceStrip />);
    act(() =>
      pushOfficeEmail({
        colleagueId: 'hr',
        subject: 'Training',
        body: 'Module 1',
        training: 1
      })
    );

    const strip = screen.getByTestId('desk-os-presence');
    expect(strip.dataset.kind).toBe('email');
    fireEvent.click(strip);
    expect(getDeskCommsUi().activePanel).toBe('inbox');
    expect(getDeskCommsUi().inboxEmailId).toMatch(/^email-/);
  });

  it('names an errand target', () => {
    render(<DeskOsPresenceStrip />);
    act(() => pushOfficeErrand({ fromId: 'hr', colleagueId: 'chad' }));

    const strip = screen.getByTestId('desk-os-presence');
    expect(strip.dataset.kind).toBe('errand');
    expect(strip.textContent).toContain(
      formatLocale(copy.errand, { name: firstName('chad'), from: firstName('hr') })
    );
  });

  it('hides during a huddle already on screen', () => {
    render(<DeskOsPresenceStrip />);
    act(() => startOfficeHuddle(['jared'], { mode: 'pair' }));
    expect(screen.queryByTestId('desk-os-presence')).toBeNull();
  });

  it('names a meeting convener', () => {
    render(<DeskOsPresenceStrip />);
    act(() =>
      pushOfficeMeetingInvite({
        colleagueId: 'scrumMaster',
        title: 'Stand-ish',
        body: 'Mandatory fun',
        attendees: ['jared']
      })
    );

    const strip = screen.getByTestId('desk-os-presence');
    expect(strip.dataset.kind).toBe('meeting');
    expect(strip.dataset.follow).toBe('invite');
    expect(strip.textContent).toContain(
      formatLocale(copy.meeting, { name: firstName('scrumMaster') })
    );
  });

  it('peeks the full caption on hover, and a long-press does not stand you up', () => {
    render(<DeskOsPresenceStrip />);
    act(() => pushOfficeImPing({ colleagueId: 'intern', body: 'quick q' }));

    const strip = screen.getByTestId('desk-os-presence');
    const status = formatLocale(copy.talk, { name: firstName('intern') });

    fireEvent.pointerEnter(strip, { pointerType: 'mouse' });
    const peek = screen.getByTestId('desk-os-presence-peek');
    expect(peek.textContent).toContain(status);

    fireEvent.pointerLeave(strip, { pointerType: 'mouse' });
    expect(screen.queryByTestId('desk-os-presence-peek')).toBeNull();

    vi.useFakeTimers();
    fireEvent.pointerDown(strip, { pointerType: 'touch' });
    act(() => {
      vi.advanceTimersByTime(420);
    });
    expect(screen.getByTestId('desk-os-presence-peek').textContent).toContain(status);
    fireEvent.pointerUp(strip, { pointerType: 'touch' });
    fireEvent.click(strip);
    expect(getOfficeViewMode()).toBe('desk');
    vi.useRealTimers();
  });

  it('sits beside Stand up in the taskbar when an obligation exists', () => {
    render(<DeskOsTaskbar />);
    expect(screen.queryByTestId('desk-os-presence')).toBeNull();

    act(() => pushOfficeImPing({ colleagueId: 'intern', body: 'quick q' }));
    cleanup();
    render(<DeskOsTaskbar />);

    const strip = screen.getByTestId('desk-os-presence');
    expect(screen.getByTestId('desk-standup-button')).toBeTruthy();
    expect(strip.closest('.desk-os-taskbar-lead')).toBeTruthy();
  });
});
