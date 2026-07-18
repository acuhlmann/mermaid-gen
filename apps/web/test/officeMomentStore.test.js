// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetForTests,
  acceptOfficeBattle,
  acceptOfficeCoffee,
  dismissOfficeBattle,
  dismissOfficeCoffee,
  dismissOfficeImPing,
  dismissOfficeMeetingInvite,
  dismissOfficeWalkBy,
  getOfficeSnapshot,
  hasActiveOfficeSurface,
  IM_PING_MAX_VISIBLE,
  IM_PING_TTL_MS,
  markAllOfficeEmailsRead,
  markOfficeEmailRead,
  pushOfficeBattleInvite,
  pushOfficeCoffeeInvite,
  pushOfficeEmail,
  pushOfficeImPing,
  pushOfficeMeetingInvite,
  pushOfficeWalkBy,
  setOfficeFocusTime,
  subscribe,
  voteOfficeBattle,
  WALKBY_TTL_MS
} from '../src/state/officeMomentStore.js';
import { OFFICE_FOCUS_TIME_STORAGE_KEY } from '../src/utils/officeAmbienceStorage.js';

beforeEach(() => {
  vi.useFakeTimers();
  _resetForTests();
});

afterEach(() => {
  _resetForTests();
  vi.useRealTimers();
  window.localStorage.clear();
});

describe('officeMomentStore', () => {
  it('tracks inbox unread counts through read-marking', () => {
    pushOfficeEmail({ colleagueId: 'facilities', subject: 'FRIDGE', body: 'Friday.' });
    const second = pushOfficeEmail({ colleagueId: 'hr', subject: 'Card', body: 'Sign it.' });
    expect(getOfficeSnapshot().unreadCount).toBe(2);
    markOfficeEmailRead(second);
    expect(getOfficeSnapshot().unreadCount).toBe(1);
    markAllOfficeEmailsRead();
    expect(getOfficeSnapshot().unreadCount).toBe(0);
    expect(getOfficeSnapshot().emails).toHaveLength(2);
  });

  it('caps visible IM pings and expires them on TTL', () => {
    pushOfficeImPing({ colleagueId: 'intern', body: 'one' });
    pushOfficeImPing({ colleagueId: 'intern', body: 'two' });
    pushOfficeImPing({ colleagueId: 'intern', body: 'three' });
    expect(getOfficeSnapshot().imPings).toHaveLength(IM_PING_MAX_VISIBLE);
    vi.advanceTimersByTime(IM_PING_TTL_MS + 10);
    expect(getOfficeSnapshot().imPings).toHaveLength(0);
  });

  it('dismisses an IM ping manually without touching its siblings', () => {
    const first = pushOfficeImPing({ colleagueId: 'intern', body: 'one' });
    pushOfficeImPing({ colleagueId: 'greybeard', body: 'two' });
    dismissOfficeImPing(first);
    expect(getOfficeSnapshot().imPings.map((p) => p.body)).toEqual(['two']);
  });

  it('replaces an active walk-by and auto-expires it', () => {
    pushOfficeWalkBy({ colleagueId: 'scrumMaster', body: 'spike!' });
    pushOfficeWalkBy({ colleagueId: 'greybeard', body: '2009.' });
    expect(getOfficeSnapshot().walkBy.body).toBe('2009.');
    vi.advanceTimersByTime(WALKBY_TTL_MS + 10);
    expect(getOfficeSnapshot().walkBy).toBeNull();
  });

  it('ignores a stale walk-by dismiss id', () => {
    pushOfficeWalkBy({ colleagueId: 'scrumMaster', body: 'spike!' });
    dismissOfficeWalkBy('walkby-does-not-exist');
    expect(getOfficeSnapshot().walkBy).not.toBeNull();
    dismissOfficeWalkBy(getOfficeSnapshot().walkBy.id);
    expect(getOfficeSnapshot().walkBy).toBeNull();
  });

  it('runs the coffee invite → accepted → dismissed lifecycle', () => {
    pushOfficeCoffeeInvite({ lines: [{ speakerId: 'facilities', text: 'New machine.' }] });
    expect(getOfficeSnapshot().coffee.accepted).toBe(false);
    acceptOfficeCoffee();
    expect(getOfficeSnapshot().coffee.accepted).toBe(true);
    dismissOfficeCoffee();
    expect(getOfficeSnapshot().coffee).toBeNull();
  });

  it('runs the battle invite → accepted → voted → dismissed lifecycle', () => {
    pushOfficeBattleInvite({
      topic: 'Tabs vs. spaces',
      lines: [
        { speakerId: 'greybeard', text: 'Tabs.' },
        { speakerId: 'intern', text: 'spaces!!' }
      ],
      verdicts: { greybeard: 'Tabs it is.', intern: 'spaces win!!' }
    });
    expect(getOfficeSnapshot().battle.accepted).toBe(false);
    expect(hasActiveOfficeSurface()).toBe(true);

    // Voting before entering the arena is ignored.
    voteOfficeBattle('greybeard');
    expect(getOfficeSnapshot().battle.votedFor).toBeNull();

    acceptOfficeBattle();
    expect(getOfficeSnapshot().battle.accepted).toBe(true);

    // Unknown sides are ignored; the first valid vote settles it for good.
    voteOfficeBattle('hr');
    expect(getOfficeSnapshot().battle.votedFor).toBeNull();
    voteOfficeBattle('intern');
    expect(getOfficeSnapshot().battle.votedFor).toBe('intern');
    voteOfficeBattle('greybeard');
    expect(getOfficeSnapshot().battle.votedFor).toBe('intern');

    dismissOfficeBattle();
    expect(getOfficeSnapshot().battle).toBeNull();
    expect(hasActiveOfficeSurface()).toBe(false);
  });

  it('blocks another battle invite immediately after the user walks away', () => {
    pushOfficeBattleInvite({
      topic: 'Tabs vs. spaces',
      lines: [{ speakerId: 'greybeard', text: 'Tabs.' }],
      verdicts: { greybeard: 'Tabs it is.' }
    });
    dismissOfficeBattle();
    const second = pushOfficeBattleInvite({
      topic: 'Monorepo vs. polyrepo',
      lines: [{ speakerId: 'intern', text: 'polyrepo!!' }],
      verdicts: { intern: 'polyrepo wins!!' }
    });
    expect(second).toBeNull();
    expect(getOfficeSnapshot().battle).toBeNull();
  });

  it('reports active office surfaces so the director can hold fire', () => {
    expect(hasActiveOfficeSurface()).toBe(false);
    pushOfficeMeetingInvite({
      colleagueId: 'scrumMaster',
      title: 'WG',
      body: 'sync',
      attendees: ['scrumMaster', 'exec', 'intern']
    });
    expect(hasActiveOfficeSurface()).toBe(true);
    dismissOfficeMeetingInvite();
    expect(hasActiveOfficeSurface()).toBe(false);
  });

  it('persists Focus Time and notifies subscribers', () => {
    const seen = vi.fn();
    const unsubscribe = subscribe(seen);
    setOfficeFocusTime(true);
    expect(getOfficeSnapshot().focusTime).toBe(true);
    expect(window.localStorage.getItem(OFFICE_FOCUS_TIME_STORAGE_KEY)).toBe('1');
    expect(seen).toHaveBeenCalled();
    setOfficeFocusTime(false);
    expect(window.localStorage.getItem(OFFICE_FOCUS_TIME_STORAGE_KEY)).toBeNull();
    unsubscribe();
  });
});
