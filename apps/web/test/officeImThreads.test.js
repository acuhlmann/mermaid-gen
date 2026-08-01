import { describe, expect, it } from 'vitest';
import { groupImThreads, isSlopChatMessage } from '../src/utils/officeImThreads.js';

describe('isSlopChatMessage', () => {
  it('treats unmarked and im-channel lines as Slop Chat', () => {
    expect(isSlopChatMessage({ colleagueId: 'intern' })).toBe(true);
    expect(isSlopChatMessage({ colleagueId: 'intern', channel: 'im' })).toBe(true);
  });

  it('excludes physical talk-channel speech from Slop Chat', () => {
    expect(isSlopChatMessage({ colleagueId: 'gilfoyle', channel: 'talk' })).toBe(false);
  });
});

describe('groupImThreads', () => {
  it('keeps typed IM threads and drops talk-channel speech', () => {
    const threads = groupImThreads([
      {
        id: '1',
        colleagueId: 'gilfoyle',
        body: 'said out loud',
        channel: 'talk',
        createdAt: 1,
        read: false
      },
      {
        id: '2',
        colleagueId: 'gilfoyle',
        body: 'typed in Slop Chat',
        createdAt: 2,
        read: false
      },
      {
        id: '3',
        colleagueId: 'intern',
        body: 'only said out loud',
        channel: 'talk',
        createdAt: 3,
        read: false
      }
    ]);

    expect(threads).toHaveLength(1);
    expect(threads[0].colleagueId).toBe('gilfoyle');
    expect(threads[0].messages.map((m) => m.body)).toEqual(['typed in Slop Chat']);
    expect(threads[0].unread).toBe(1);
  });
});
