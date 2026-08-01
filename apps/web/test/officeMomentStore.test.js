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
  shouldHoldAmbientOfficeMoments,
  IM_HISTORY_MAX,
  DESK_ARRIVAL_MAX_VISIBLE,
  DESK_ARRIVAL_TTL_MS,
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
  pauseOfficeHuddleForWatching,
  resumeOfficeHuddleSpeaking,
  setOfficeFocusTime,
  setOfficeHeadphones,
  setOfficeHuddleBeats,
  startOfficeHuddle,
  subscribe,
  upsertOfficeHuddleBeat,
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

  it('caps visible desk arrivals and expires them on TTL', () => {
    pushOfficeImPing({ colleagueId: 'intern', body: 'one' });
    pushOfficeImPing({ colleagueId: 'intern', body: 'two' });
    pushOfficeImPing({ colleagueId: 'intern', body: 'three' });
    expect(getOfficeSnapshot().deskArrivals).toHaveLength(DESK_ARRIVAL_MAX_VISIBLE);
    vi.advanceTimersByTime(DESK_ARRIVAL_TTL_MS + 10);
    expect(getOfficeSnapshot().deskArrivals).toHaveLength(0);
  });

  it('dismisses a desk arrival manually without touching its siblings', () => {
    pushOfficeImPing({ colleagueId: 'intern', body: 'one' });
    pushOfficeImPing({ colleagueId: 'greybeard', body: 'two' });
    const firstArrival = getOfficeSnapshot().deskArrivals[0];
    dismissOfficeImPing(firstArrival.id);
    expect(getOfficeSnapshot().deskArrivals.map((a) => a.colleagueId)).toEqual(['greybeard']);
  });

  it('keeps IM history after arrivals cap out and expire', () => {
    pushOfficeImPing({ colleagueId: 'intern', body: 'one' });
    pushOfficeImPing({ colleagueId: 'intern', body: 'two' });
    pushOfficeImPing({ colleagueId: 'greybeard', body: 'three' });
    expect(getOfficeSnapshot().deskArrivals).toHaveLength(DESK_ARRIVAL_MAX_VISIBLE);
    expect(getOfficeSnapshot().imHistory.map((m) => m.body)).toEqual(['one', 'two', 'three']);

    vi.advanceTimersByTime(DESK_ARRIVAL_TTL_MS + 10);
    expect(getOfficeSnapshot().deskArrivals).toHaveLength(0);
    expect(getOfficeSnapshot().imHistory).toHaveLength(3);
    expect(getOfficeSnapshot().imUnreadCount).toBe(3);
  });

  it('dismissing an arrival leaves its message in history', () => {
    pushOfficeImPing({ colleagueId: 'intern', body: 'still here' });
    dismissOfficeImPing(getOfficeSnapshot().deskArrivals[0].id);
    expect(getOfficeSnapshot().deskArrivals).toHaveLength(0);
    expect(getOfficeSnapshot().imHistory.map((m) => m.body)).toEqual(['still here']);
  });

  it('clearOfficeImPings drops arrivals without touching history', () => {
    pushOfficeImPing({ colleagueId: 'intern', body: 'ping one' });
    pushOfficeImPing({ colleagueId: 'greybeard', body: 'ping two' });
    clearOfficeImPings();
    expect(getOfficeSnapshot().deskArrivals).toHaveLength(0);
    expect(getOfficeSnapshot().imHistory.map((m) => m.body)).toEqual(['ping one', 'ping two']);
  });

  it('creates email desk arrivals that expire without clearing unread mail', () => {
    pushOfficeEmail({ colleagueId: 'hr', subject: 'Welcome', body: 'Hi' });
    expect(getOfficeSnapshot().deskArrivals).toHaveLength(1);
    expect(getOfficeSnapshot().deskArrivals[0].kind).toBe('email');
    vi.advanceTimersByTime(DESK_ARRIVAL_TTL_MS + 10);
    expect(getOfficeSnapshot().deskArrivals).toHaveLength(0);
    expect(getOfficeSnapshot().unreadCount).toBe(1);
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

  // Emails and walk-bys have always carried a pitch; IMs dropping theirs made
  // the talk channel the one place a colleague could have an idea and no way to
  // hand it over. Storing it is not running it (ADR-0010).
  it('keeps a pitch on an inbound IM, and omits the key when there is none', () => {
    pushOfficeImPing({
      colleagueId: 'gilfoyle',
      body: 'Auth is doing two jobs.',
      actionPrompt: 'Split Auth into Authentication and Authorization'
    });
    pushOfficeImPing({ colleagueId: 'intern', body: 'anyone seen the fridge email' });

    const [pitched, plain] = getOfficeSnapshot().imHistory;
    expect(pitched.actionPrompt).toBe('Split Auth into Authentication and Authorization');
    expect('actionPrompt' in plain).toBe(false);
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
    pushOfficeWalkBy({ colleagueId: 'greybeard', body: '1979.' });
    expect(getOfficeSnapshot().walkBy.body).toBe('1979.');
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

  it('boot heals a stale Voice-off key so headphones-off actually speaks', () => {
    // Pre-macro (or half-cleared) storage: menu would show headphones off while
    // narration stayed muted — huddle/walk-bys rendered speech bubbles forever.
    window.localStorage.removeItem(OFFICE_HEADPHONES_STORAGE_KEY);
    window.localStorage.setItem(OFFICE_NARRATION_STORAGE_KEY, '0');
    window.localStorage.setItem(OFFICE_SOUNDSCAPE_STORAGE_KEY, '0');
    _resetForTests();
    const snap = getOfficeSnapshot();
    expect(snap.headphones).toBe(false);
    expect(snap.narration).toBe(true);
    expect(snap.soundscape).toBe(true);
    expect(window.localStorage.getItem(OFFICE_NARRATION_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(OFFICE_SOUNDSCAPE_STORAGE_KEY)).toBeNull();
  });

  it('boot keeps headphones-on read-first even if narration drifted on', () => {
    window.localStorage.setItem(OFFICE_HEADPHONES_STORAGE_KEY, '1');
    window.localStorage.removeItem(OFFICE_NARRATION_STORAGE_KEY);
    window.localStorage.removeItem(OFFICE_SOUNDSCAPE_STORAGE_KEY);
    window.localStorage.removeItem(OFFICE_CAPTIONS_STORAGE_KEY);
    _resetForTests();
    const snap = getOfficeSnapshot();
    expect(snap.headphones).toBe(true);
    expect(snap.narration).toBe(false);
    expect(snap.soundscape).toBe(false);
    expect(snap.captions).toBe(true);
  });

  it('boot leaves floor CC on when headphones are off', () => {
    window.localStorage.removeItem(OFFICE_HEADPHONES_STORAGE_KEY);
    window.localStorage.removeItem(OFFICE_NARRATION_STORAGE_KEY);
    window.localStorage.setItem(OFFICE_CAPTIONS_STORAGE_KEY, '1');
    _resetForTests();
    const snap = getOfficeSnapshot();
    expect(snap.headphones).toBe(false);
    expect(snap.narration).toBe(true);
    expect(snap.captions).toBe(true);
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

  it('pauses for watching and resumes speaking without dissolving the ring', () => {
    const id = startOfficeHuddle(['gilfoyle', 'dinesh']);
    setOfficeHuddleBeats(id, [{ speakerId: 'gilfoyle', text: 'hi' }]);
    pauseOfficeHuddleForWatching(id);
    expect(getOfficeSnapshot().huddle.phase).toBe('watching');
    expect(getOfficeSnapshot().huddle.beats).toHaveLength(1);
    resumeOfficeHuddleSpeaking(id);
    expect(getOfficeSnapshot().huddle.phase).toBe('speaking');
  });

  it('stores on-spot suggestions beside the spoken queue', () => {
    const id = startOfficeHuddle(['gilfoyle', 'dinesh']);
    setOfficeHuddleBeats(id, [{ speakerId: 'gilfoyle', text: 'hi' }]);
    upsertOfficeHuddleBeat(
      id,
      { speakerId: 'dinesh', text: 'Ask me later.', actionPrompt: 'Ask me later.' },
      { pacing: false }
    );
    const snap = getOfficeSnapshot().huddle;
    expect(snap.beats).toHaveLength(1);
    expect(snap.suggestions.dinesh.text).toBe('Ask me later.');
  });

  it('refuses a huddle of one — that is a walk-by', () => {
    expect(startOfficeHuddle(['gilfoyle'])).toBeNull();
    expect(getOfficeSnapshot().huddle).toBeNull();
  });

  // The floor was never "two people", it was "enough people to script a scene
  // for". Pairing brings a script written for one voice, so it brings its own.
  it('seats a pair of exactly one, and refuses a pair of several', () => {
    expect(startOfficeHuddle(['gilfoyle'], { mode: 'pair' })).toBeTruthy();
    expect(getOfficeSnapshot().huddle.mode).toBe('pair');
    expect(getOfficeSnapshot().huddle.attendees).toEqual(['gilfoyle']);

    endOfficeHuddle();
    expect(startOfficeHuddle(['gilfoyle', 'dinesh'], { mode: 'pair' })).toBeNull();
    expect(getOfficeSnapshot().huddle).toBeNull();
  });

  it('tags an unqualified huddle as a mob so every existing caller is one', () => {
    startOfficeHuddle(['gilfoyle', 'dinesh']);
    expect(getOfficeSnapshot().huddle.mode).toBe('mob');
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

  it('treats a single IM desk arrival as an active surface', () => {
    pushOfficeImPing({ colleagueId: 'intern', body: 'ping' });
    expect(hasActiveOfficeSurface()).toBe(true);
    expect(shouldHoldAmbientOfficeMoments()).toBe(true);
  });

  it('does not treat email desk arrivals as an active surface', () => {
    pushOfficeEmail({ colleagueId: 'hr', subject: 'Welcome', body: 'Hi' });
    expect(getOfficeSnapshot().deskArrivals).toHaveLength(1);
    expect(hasActiveOfficeSurface()).toBe(false);
    expect(shouldHoldAmbientOfficeMoments()).toBe(false);
  });

  it('does not hold ambient moments solely for unread inbox or Slop Chat backlog', () => {
    pushOfficeEmail({
      colleagueId: 'hr',
      subject: 'Welcome',
      body: 'Hi'
    });
    vi.advanceTimersByTime(DESK_ARRIVAL_TTL_MS + 10);
    expect(hasActiveOfficeSurface()).toBe(false);
    expect(shouldHoldAmbientOfficeMoments()).toBe(false);
    expect(getOfficeSnapshot().unreadCount).toBe(1);
    pushOfficeImPing({ colleagueId: 'intern', body: 'ping' });
    markOfficeImsRead();
    dismissOfficeImPing(getOfficeSnapshot().deskArrivals[0].id);
    expect(shouldHoldAmbientOfficeMoments()).toBe(false);
  });
});
