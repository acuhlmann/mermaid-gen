import { afterEach, describe, expect, it } from 'vitest';
import {
  _resetOfficePresenceForTests,
  officePresenceOf,
  podSeatIds,
  presenceFollowOf
} from '../src/utils/officePresence.js';
import {
  _resetForTests,
  getOfficeSnapshot,
  pushOfficeImPing,
  pushOfficeWalkBy,
  startOfficeHuddle
} from '../src/state/officeMomentStore.js';

/**
 * Node environment: the derivation is pure, and keeping it that way is what
 * lets the strip claim it produces nothing.
 */

afterEach(() => {
  _resetForTests();
  _resetOfficePresenceForTests();
});

describe('podSeatIds', () => {
  it('is the desks adjoining yours, and never you', () => {
    const pod = podSeatIds();
    expect(pod).toContain('gilfoyle');
    expect(pod).toContain('jared');
    expect(pod).not.toContain('you');
  });

  // The glass row is the reason this is the pod and not the whole roster: from
  // your chair you cannot see leadership, and they never leave that room.
  it('leaves leadership behind the glass out of it', () => {
    expect(podSeatIds()).not.toContain('belson');
    expect(podSeatIds()).not.toContain('barker');
  });

  it('is stable across calls, so the idle strip never reshuffles', () => {
    expect(podSeatIds()).toEqual(podSeatIds());
  });
});

describe('officePresenceOf', () => {
  it('falls back to your pod when the office is quiet', () => {
    expect(officePresenceOf({})).toEqual({ kind: 'quiet', ids: podSeatIds() });
  });

  // The one kind that is never empty — a taskbar resident that vanished on a
  // quiet office would flicker in and out all session.
  it('answers for a missing snapshot rather than throwing', () => {
    expect(officePresenceOf(null).kind).toBe('quiet');
    expect(officePresenceOf(undefined).ids.length).toBeGreaterThan(0);
  });

  it('separates a pair from a mob by the huddle mode', () => {
    expect(officePresenceOf({ huddle: { mode: 'pair', attendees: ['jared'] } })).toEqual({
      kind: 'pair',
      ids: ['jared']
    });
    expect(officePresenceOf({ huddle: { mode: 'mob', attendees: ['jared', 'gilfoyle'] } })).toEqual(
      { kind: 'mob', ids: ['jared', 'gilfoyle'] }
    );
  });

  it('puts whoever is at your screen above whoever is at your desk', () => {
    const presence = officePresenceOf({
      huddle: { mode: 'mob', attendees: ['jared', 'dinesh'] },
      walkBy: { colleagueId: 'erlich' }
    });
    expect(presence.kind).toBe('mob');
  });

  it('reads a walk-by when nobody is gathered', () => {
    expect(officePresenceOf({ walkBy: { colleagueId: 'erlich' } })).toEqual({
      kind: 'walkby',
      ids: ['erlich']
    });
  });

  it('names both sides of a holy war, in speaking order', () => {
    const battle = {
      lines: [
        { speakerId: 'gilfoyle', text: 'no' },
        { speakerId: 'dinesh', text: 'yes' },
        { speakerId: 'gilfoyle', text: 'still no' }
      ]
    };
    expect(officePresenceOf({ battle })).toEqual({
      kind: 'battle',
      ids: ['gilfoyle', 'dinesh']
    });
  });

  // A one-sided fight has no caption — better to fall through than to render
  // "Gilfoyle vs ".
  it('ignores a battle that somehow has only one side', () => {
    const battle = { lines: [{ speakerId: 'gilfoyle', text: 'no' }] };
    expect(officePresenceOf({ battle }).kind).toBe('quiet');
  });

  it('reads the coffee scene cast', () => {
    const coffee = { lines: [{ speakerId: 'intern' }, { speakerId: 'scrumMaster' }] };
    expect(officePresenceOf({ coffee })).toEqual({
      kind: 'coffee',
      ids: ['intern', 'scrumMaster']
    });
  });

  it('leads a meeting with its convener, then the room, deduped', () => {
    const meetingInvite = {
      colleagueId: 'scrumMaster',
      attendees: ['scrumMaster', 'jared', 'you']
    };
    expect(officePresenceOf({ meetingInvite })).toEqual({
      kind: 'meeting',
      ids: ['scrumMaster', 'jared']
    });
  });

  it('counts unread inbound IMs, newest first', () => {
    const imHistory = [
      { colleagueId: 'intern', read: false },
      { colleagueId: 'greybeard', read: false },
      { colleagueId: 'intern', read: false }
    ];
    expect(officePresenceOf({ imHistory })).toEqual({
      kind: 'talk',
      ids: ['intern', 'greybeard']
    });
  });

  it('ignores read messages and your own replies', () => {
    const imHistory = [
      { colleagueId: 'intern', read: true },
      { colleagueId: 'greybeard', outbound: true, read: true }
    ];
    expect(officePresenceOf({ imHistory }).kind).toBe('quiet');
  });

  // The strip answers "who is around *you*", so the viewer is the one wrong
  // answer it can give.
  it('never lists you among the people who are around', () => {
    const presence = officePresenceOf({
      huddle: { mode: 'mob', attendees: ['you', 'jared', 'jared'] }
    });
    expect(presence.ids).toEqual(['jared']);
  });
});

describe('officePresenceOf over the real store', () => {
  // The plain-object cases above are readable; this one is the contract. If a
  // moment-store field is renamed, the strip goes quiet and only this notices.
  it('tracks live moment state through the store API', () => {
    expect(officePresenceOf(getOfficeSnapshot()).kind).toBe('quiet');

    pushOfficeImPing({ colleagueId: 'intern', body: 'quick q' });
    expect(officePresenceOf(getOfficeSnapshot())).toEqual({ kind: 'talk', ids: ['intern'] });

    pushOfficeWalkBy({ colleagueId: 'erlich', body: 'hear me out' });
    expect(officePresenceOf(getOfficeSnapshot())).toEqual({ kind: 'walkby', ids: ['erlich'] });

    startOfficeHuddle(['jared'], { mode: 'pair' });
    expect(officePresenceOf(getOfficeSnapshot())).toEqual({ kind: 'pair', ids: ['jared'] });
  });
});

describe('presenceFollowOf', () => {
  // Unread IMs are a desk medium — standing up to read a chat is the wrong room.
  it('opens Slop Chat for unread talk, aimed at the newest sender', () => {
    expect(presenceFollowOf({ kind: 'talk', ids: ['intern', 'greybeard'] })).toEqual({
      action: 'messenger',
      colleagueId: 'intern'
    });
  });

  // Pair / mob / meeting invite are already on the desk surface.
  it('stays put when the presence is already at your screen', () => {
    expect(presenceFollowOf({ kind: 'pair', ids: ['jared'] }).action).toBe('stay');
    expect(presenceFollowOf({ kind: 'mob', ids: ['jared', 'dinesh'] }).action).toBe('stay');
    expect(presenceFollowOf({ kind: 'meeting', ids: ['scrumMaster'] }).action).toBe('stay');
  });

  it('stands you up for floor-native presence', () => {
    for (const kind of ['walkby', 'battle', 'coffee', 'quiet']) {
      expect(presenceFollowOf({ kind, ids: ['jared'] }).action).toBe('standUp');
    }
  });
});
