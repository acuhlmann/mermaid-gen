// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetForTests,
  acceptOfficeBattle,
  acceptOfficeCoffee,
  dismissOfficeBattle,
  dismissOfficeCoffee,
  dismissOfficeImPing,
  clearOfficeImPings,
  dismissOfficeMeetingInvite,
  dismissOfficeWalkBy,
  getOfficeSnapshot,
  hasActiveOfficeSurface,
  IM_HISTORY_MAX,
  IM_PING_MAX_VISIBLE,
  IM_PING_TTL_MS,
  markAllOfficeEmailsRead,
  markOfficeEmailRead,
  markOfficeImsRead,
  pushOfficeBattleInvite,
  pushOfficeCoffeeInvite,
  pushOfficeEmail,
  pushOfficeImPing,
  pushOfficeImReply,
  pushOfficeMeetingInvite,
  pushOfficeWalkBy,
  endOfficeHuddle,
  setOfficeFocusTime,
  setOfficeHeadphones,
  setOfficeHuddleBeats,
  startOfficeHuddle,
  subscribe,
  voteOfficeBattle,
  WALKBY_TTL_MS
} from '../src/state/officeMomentStore.js';
import {
  OFFICE_CAPTIONS_STORAGE_KEY,
  OFFICE_FOCUS_TIME_STORAGE_KEY,
  OFFICE_HEADPHONES_STORAGE_KEY,
  OFFICE_NARRATION_STORAGE_KEY,
  OFFICE_SOUNDSCAPE_STORAGE_KEY
} from '../src/utils/officeAmbienceStorage.js';

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

  it('keeps IM history after the toasts cap out and expire', () => {
    pushOfficeImPing({ colleagueId: 'intern', body: 'one' });
    pushOfficeImPing({ colleagueId: 'intern', body: 'two' });
    pushOfficeImPing({ colleagueId: 'greybeard', body: 'three' });
    // Toasts are capped; history is not.
    expect(getOfficeSnapshot().imPings).toHaveLength(IM_PING_MAX_VISIBLE);
    expect(getOfficeSnapshot().imHistory.map((m) => m.body)).toEqual(['one', 'two', 'three']);

    vi.advanceTimersByTime(IM_PING_TTL_MS + 10);
    expect(getOfficeSnapshot().imPings).toHaveLength(0);
    // The whole point of the messenger: expiry must not erase the log.
    expect(getOfficeSnapshot().imHistory).toHaveLength(3);
    expect(getOfficeSnapshot().imUnreadCount).toBe(3);
  });

  it('dismissing a toast leaves its message in history', () => {
    const id = pushOfficeImPing({ colleagueId: 'intern', body: 'still here' });
    dismissOfficeImPing(id);
    expect(getOfficeSnapshot().imPings).toHaveLength(0);
    expect(getOfficeSnapshot().imHistory.map((m) => m.body)).toEqual(['still here']);
  });

  it('clearOfficeImPings drops toasts without touching history', () => {
    pushOfficeImPing({ colleagueId: 'intern', body: 'ping one' });
    pushOfficeImPing({ colleagueId: 'greybeard', body: 'ping two' });
    clearOfficeImPings();
    expect(getOfficeSnapshot().imPings).toHaveLength(0);
    expect(getOfficeSnapshot().imHistory.map((m) => m.body)).toEqual(['ping one', 'ping two']);
  });

  it('records outbound replies without counting them as unread', () => {
    pushOfficeImPing({ colleagueId: 'intern', body: 'standup?' });
    pushOfficeImReply({ colleagueId: 'intern', body: 'on my way' });
    const { imHistory, imUnreadCount } = getOfficeSnapshot();
    expect(imHistory.map((m) => m.body)).toEqual(['standup?', 'on my way']);
    expect(imHistory[1].outbound).toBe(true);
    // Only the colleague's message is unread — your own reply never is.
    expect(imUnreadCount).toBe(1);
    // Empty / whitespace replies are dropped rather than logged.
    expect(pushOfficeImReply({ colleagueId: 'intern', body: '   ' })).toBeNull();
    expect(getOfficeSnapshot().imHistory).toHaveLength(2);
  });

  it('marks IMs read per colleague, then globally', () => {
    pushOfficeImPing({ colleagueId: 'intern', body: 'a' });
    pushOfficeImPing({ colleagueId: 'greybeard', body: 'b' });
    expect(getOfficeSnapshot().imUnreadCount).toBe(2);
    markOfficeImsRead('intern');
    expect(getOfficeSnapshot().imUnreadCount).toBe(1);
    markOfficeImsRead();
    expect(getOfficeSnapshot().imUnreadCount).toBe(0);
    expect(getOfficeSnapshot().imHistory).toHaveLength(2);
  });

  it('caps IM history so a long session cannot grow it without bound', () => {
    for (let i = 0; i < IM_HISTORY_MAX + 12; i += 1) {
      pushOfficeImPing({ colleagueId: 'intern', body: `msg-${i}` });
    }
    const { imHistory } = getOfficeSnapshot();
    expect(imHistory).toHaveLength(IM_HISTORY_MAX);
    // Oldest are dropped, newest retained.
    expect(imHistory[imHistory.length - 1].body).toBe(`msg-${IM_HISTORY_MAX + 11}`);
    expect(imHistory[0].body).toBe('msg-12');
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
      attendees: ['scrumMaster', 'barker', 'intern']
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

  // Headphones is a macro over the three flags that already existed, not a
  // fifth flag: every consumer keeps reading exactly what it read before.
  it('headphones on makes the office readable — silent, captions up', () => {
    setOfficeHeadphones(true);
    const snap = getOfficeSnapshot();
    expect(snap.headphones).toBe(true);
    expect(snap.narration).toBe(false);
    expect(snap.soundscape).toBe(false);
    expect(snap.captions).toBe(true);
    expect(window.localStorage.getItem(OFFICE_HEADPHONES_STORAGE_KEY)).toBe('1');
    expect(window.localStorage.getItem(OFFICE_NARRATION_STORAGE_KEY)).toBe('0');
    expect(window.localStorage.getItem(OFFICE_SOUNDSCAPE_STORAGE_KEY)).toBe('0');
    expect(window.localStorage.getItem(OFFICE_CAPTIONS_STORAGE_KEY)).toBe('1');
  });

  it('headphones off makes the office audible — voice, room tone, no subtitles', () => {
    setOfficeHeadphones(true);
    setOfficeHeadphones(false);
    const snap = getOfficeSnapshot();
    expect(snap.headphones).toBe(false);
    expect(snap.narration).toBe(true);
    expect(snap.soundscape).toBe(true);
    expect(snap.captions).toBe(false);
    expect(window.localStorage.getItem(OFFICE_HEADPHONES_STORAGE_KEY)).toBeNull();
  });

  it('seats a huddle, scripts it, and tears it down', () => {
    const id = startOfficeHuddle(['gilfoyle', 'dinesh']);
    expect(id).toBeTruthy();
    expect(getOfficeSnapshot().huddle.phase).toBe('gathering');
    setOfficeHuddleBeats(id, [{ speakerId: 'gilfoyle', text: 'It is wrong.' }]);
    expect(getOfficeSnapshot().huddle.phase).toBe('speaking');
    endOfficeHuddle(id);
    expect(getOfficeSnapshot().huddle).toBeNull();
  });

  it('refuses a huddle of one — that is a walk-by', () => {
    expect(startOfficeHuddle(['gilfoyle'])).toBeNull();
    expect(getOfficeSnapshot().huddle).toBeNull();
  });

  it('ignores a script meant for a huddle that already ended', () => {
    const id = startOfficeHuddle(['gilfoyle', 'dinesh']);
    endOfficeHuddle(id);
    setOfficeHuddleBeats(id, [{ speakerId: 'gilfoyle', text: 'Too late.' }]);
    expect(getOfficeSnapshot().huddle).toBeNull();
  });

  it('counts a running huddle as an active surface', () => {
    expect(hasActiveOfficeSurface()).toBe(false);
    startOfficeHuddle(['gilfoyle', 'dinesh']);
    expect(hasActiveOfficeSurface()).toBe(true);
    endOfficeHuddle();
    expect(hasActiveOfficeSurface()).toBe(false);
  });
});
