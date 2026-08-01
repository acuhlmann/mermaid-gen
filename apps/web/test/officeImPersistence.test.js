// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OFFICE_IM_HISTORY_STORAGE_KEY,
  readOfficeImHistory,
  writeOfficeImHistory
} from '../src/utils/officeAmbienceStorage.js';

/**
 * Slop Chat scrollback across a reload (docs/office-parody.md §10 item 18's
 * follow-up). jsdom, because "does it come back" is the whole question.
 *
 * Each case re-imports the store so it exercises the real module-load
 * hydration rather than `_resetForTests`, which deliberately opens an empty
 * office.
 */

async function freshStore() {
  vi.resetModules();
  return import('../src/state/officeMomentStore.js');
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('Slop Chat scrollback', () => {
  it('comes back after a reload, with unread counts intact', async () => {
    const first = await freshStore();
    first.pushOfficeImPing({ colleagueId: 'intern', body: 'quick q' });
    first.pushOfficeImReply({ colleagueId: 'intern', body: 'go on' });

    const second = await freshStore();
    const snapshot = second.getOfficeSnapshot();
    expect(snapshot.imHistory.map((m) => m.body)).toEqual(['quick q', 'go on']);
    expect(snapshot.imUnreadCount).toBe(1);
  });

  it('remembers what you had already read', async () => {
    const first = await freshStore();
    first.pushOfficeImPing({ colleagueId: 'intern', body: 'quick q' });
    first.markOfficeImsRead('intern');

    const second = await freshStore();
    expect(second.getOfficeSnapshot().imUnreadCount).toBe(0);
  });

  /**
   * Speech is not scrollback. `talk` lines never rendered in the messenger, and
   * a remark somebody made at your desk on Tuesday should not surface as a chat
   * message on Thursday.
   */
  it('does not restore things that were said out loud', async () => {
    const first = await freshStore();
    first.pushOfficeImPing({ colleagueId: 'gilfoyle', body: 'out loud', channel: 'talk' });
    first.pushOfficeImPing({ colleagueId: 'gilfoyle', body: 'typed' });

    const second = await freshStore();
    expect(second.getOfficeSnapshot().imHistory.map((m) => m.body)).toEqual(['typed']);
  });

  /**
   * Ids are `im-<n>` from a counter that restarts every load. Without resuming
   * it past the restored thread, the first new message of the session collides
   * with a restored one and React gets two children with the same key.
   */
  it('does not reissue an id that came back from storage', async () => {
    const first = await freshStore();
    first.pushOfficeImPing({ colleagueId: 'intern', body: 'one' });
    first.pushOfficeImPing({ colleagueId: 'intern', body: 'two' });

    const second = await freshStore();
    second.pushOfficeImPing({ colleagueId: 'intern', body: 'three' });
    const ids = second.getOfficeSnapshot().imHistory.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('opens an empty office when storage is corrupt', async () => {
    window.localStorage.setItem(OFFICE_IM_HISTORY_STORAGE_KEY, 'not json');
    const store = await freshStore();
    expect(store.getOfficeSnapshot().imHistory).toEqual([]);
  });

  it('drops malformed messages and honours the cap', () => {
    writeOfficeImHistory(
      [
        { id: 'im-1', colleagueId: 'intern', body: 'keep' },
        { id: 'im-2', colleagueId: 'intern' },
        null,
        { colleagueId: 'intern', body: 'no id' }
      ],
      10
    );
    expect(readOfficeImHistory(10)).toEqual([{ id: 'im-1', colleagueId: 'intern', body: 'keep' }]);
  });
});
