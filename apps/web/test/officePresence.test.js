import { afterEach, describe, expect, it } from 'vitest';
import {
  _resetOfficePresenceForTests,
  officeNextOf,
  officePresenceOf,
  officeStatusOf,
  podSeatIds,
  presenceFollowOf
} from '../src/utils/officePresence.js';
import {
  _resetForTests,
  getOfficeSnapshot,
  pushOfficeEmail,
  pushOfficeImPing,
  pushOfficeWalkBy,
  pushOfficeErrand,
  startOfficeHuddle
} from '../src/state/officeMomentStore.js';

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

  it('leaves leadership behind the glass out of it', () => {
    expect(podSeatIds()).not.toContain('belson');
    expect(podSeatIds()).not.toContain('barker');
  });

  it('is stable across calls', () => {
    expect(podSeatIds()).toEqual(podSeatIds());
  });
});

describe('officeNextOf', () => {
  it('is absent when nothing expects you', () => {
    expect(officeNextOf({})).toBeNull();
    expect(officeNextOf(null)).toBeNull();
    expect(officeNextOf(undefined)).toBeNull();
  });

  it('hides while a huddle already has the screen', () => {
    expect(
      officeNextOf({
        huddle: { mode: 'pair', attendees: ['jared'] },
        walkBy: { colleagueId: 'erlich' }
      })
    ).toBeNull();
  });

  it('ignores ambient battle and coffee scenes', () => {
    const battle = { lines: [{ speakerId: 'gilfoyle' }, { speakerId: 'dinesh' }] };
    const coffee = { lines: [{ speakerId: 'intern' }, { speakerId: 'scrumMaster' }] };
    expect(officeNextOf({ battle })).toBeNull();
    expect(officeNextOf({ coffee })).toBeNull();
  });

  it('reads a walk-by first', () => {
    expect(officeNextOf({ walkBy: { colleagueId: 'erlich' } })).toEqual({
      kind: 'walkby',
      ids: ['erlich']
    });
    const next = officeNextOf({
      walkBy: { colleagueId: 'erlich' },
      imHistory: [{ colleagueId: 'intern', read: false }]
    });
    expect(next?.kind).toBe('walkby');
  });

  it('counts unread inbound IMs, newest first', () => {
    const imHistory = [
      { colleagueId: 'intern', read: false },
      { colleagueId: 'greybeard', read: false },
      { colleagueId: 'intern', read: false }
    ];
    expect(officeNextOf({ imHistory })).toEqual({
      kind: 'talk',
      ids: ['intern', 'greybeard']
    });
  });

  it('ignores read messages, your own replies, and talk-channel speech', () => {
    const imHistory = [
      { colleagueId: 'intern', read: true },
      { colleagueId: 'greybeard', outbound: true, read: true },
      { colleagueId: 'gilfoyle', read: false, channel: 'talk' }
    ];
    expect(officeNextOf({ imHistory })).toBeNull();
  });

  it('leads a meeting with its convener, then the room, deduped', () => {
    const meetingInvite = {
      colleagueId: 'scrumMaster',
      attendees: ['scrumMaster', 'jared', 'you']
    };
    expect(officeNextOf({ meetingInvite })).toEqual({
      kind: 'meeting',
      ids: ['scrumMaster', 'jared']
    });
  });

  it('surfaces an active errand after a meeting invite loses', () => {
    expect(
      officeNextOf({
        errand: { fromId: 'hr', colleagueId: 'chad' },
        imHistory: [{ colleagueId: 'intern', read: false }]
      })?.kind
    ).toBe('talk');
    expect(
      officeNextOf({
        errand: { fromId: 'hr', colleagueId: 'chad' }
      })
    ).toEqual({
      kind: 'errand',
      ids: ['chad'],
      meta: { fromId: 'hr' }
    });
  });

  it('reads actionable unread mail last', () => {
    const emails = [
      { id: 'e1', colleagueId: 'hr', read: false, training: 1 },
      { id: 'e2', colleagueId: 'linda', read: true, actionPrompt: 'Do it' }
    ];
    expect(officeNextOf({ emails })).toEqual({
      kind: 'email',
      ids: ['hr'],
      meta: { emailId: 'e1' }
    });
  });

  it('ignores unread mail without a CTA marker', () => {
    const emails = [{ id: 'e1', colleagueId: 'hr', read: false, subject: 'FYI' }];
    expect(officeNextOf({ emails })).toBeNull();
  });

  it('never lists you among the people shown', () => {
    const next = officeNextOf({
      meetingInvite: { colleagueId: 'you', attendees: ['you', 'jared'] }
    });
    expect(next?.ids).toEqual(['jared']);
  });
});

describe('officeNextOf over the real store', () => {
  it('tracks live moment state through the store API', () => {
    expect(officeNextOf(getOfficeSnapshot())).toBeNull();

    pushOfficeImPing({ colleagueId: 'intern', body: 'quick q' });
    expect(officeNextOf(getOfficeSnapshot())).toEqual({ kind: 'talk', ids: ['intern'] });

    pushOfficeWalkBy({ colleagueId: 'erlich', body: 'hear me out' });
    expect(officeNextOf(getOfficeSnapshot())).toEqual({ kind: 'walkby', ids: ['erlich'] });

    startOfficeHuddle(['jared'], { mode: 'pair' });
    expect(officeNextOf(getOfficeSnapshot())).toBeNull();
  });
});

describe('officePresenceOf', () => {
  it('is an alias of officeNextOf', () => {
    const snapshot = { walkBy: { colleagueId: 'erlich' } };
    expect(officePresenceOf(snapshot)).toEqual(officeNextOf(snapshot));
  });
});

describe('officeStatusOf', () => {
  it('answers "available" for anyone nothing has claimed', () => {
    expect(officeStatusOf(getOfficeSnapshot(), 'gilfoyle')).toBe('available');
    expect(officeStatusOf(null, 'gilfoyle')).toBe('available');
    expect(officeStatusOf(getOfficeSnapshot(), '')).toBe('available');
  });

  it('reports what one person is doing, not what the strip shows', () => {
    startOfficeHuddle(['jared'], { mode: 'pair' });
    pushOfficeWalkBy({ colleagueId: 'erlich', body: 'hear me out' });

    expect(officeNextOf(getOfficeSnapshot())).toBeNull();
    expect(officeStatusOf(getOfficeSnapshot(), 'jared')).toBe('huddle');
    expect(officeStatusOf(getOfficeSnapshot(), 'erlich')).toBe('desk');
    expect(officeStatusOf(getOfficeSnapshot(), 'dinesh')).toBe('available');
  });

  it('reads scene participants out of a battle and a coffee break', () => {
    expect(
      officeStatusOf(
        { battle: { lines: [{ speakerId: 'dinesh' }, { speakerId: 'gilfoyle' }] } },
        'gilfoyle'
      )
    ).toBe('battle');
    expect(officeStatusOf({ coffee: { lines: [{ speakerId: 'hr' }] } }, 'hr')).toBe('coffee');
  });

  it('counts both the convener and the attendees of a pending invite', () => {
    const snapshot = { meetingInvite: { colleagueId: 'scrumMaster', attendees: ['ciso'] } };
    expect(officeStatusOf(snapshot, 'scrumMaster')).toBe('meeting');
    expect(officeStatusOf(snapshot, 'ciso')).toBe('meeting');
  });
});

describe('presenceFollowOf', () => {
  it('opens Slop Chat for unread talk, aimed at the newest sender', () => {
    expect(presenceFollowOf({ kind: 'talk', ids: ['intern', 'greybeard'] })).toEqual({
      action: 'messenger',
      colleagueId: 'intern'
    });
  });

  it('opens the inbox for actionable mail', () => {
    expect(
      presenceFollowOf({
        kind: 'email',
        ids: ['hr'],
        meta: { emailId: 'email-1' }
      })
    ).toEqual({
      action: 'inbox',
      colleagueId: 'hr',
      emailId: 'email-1'
    });
  });

  it('focuses a meeting invite instead of standing up', () => {
    expect(presenceFollowOf({ kind: 'meeting', ids: ['scrumMaster'] }).action).toBe('invite');
  });

  it('stands you up for floor-native obligations', () => {
    for (const kind of ['walkby', 'errand']) {
      expect(presenceFollowOf({ kind, ids: ['jared'] }).action).toBe('standUp');
    }
  });
});
