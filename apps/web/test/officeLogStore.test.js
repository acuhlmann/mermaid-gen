// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OFFICE_LOG_ENTRY_CAP,
  OFFICE_LOG_STORAGE_KEY,
  readOfficeLog,
  writeOfficeLog
} from '../src/utils/officeAmbienceStorage.js';

/**
 * jsdom, because the whole point of these is what survives a reload.
 *
 * The store is imported fresh per test (`vi.resetModules` + dynamic import) so
 * each case exercises the real module-load hydration path rather than a reset
 * hook that could quietly diverge from it.
 */

const at = (hour, minute) => new Date(2026, 7, 1, hour, minute).getTime();

async function freshStore() {
  vi.resetModules();
  return import('../src/state/officeLogStore.js');
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('officeLogStore', () => {
  it('records entries and renders them as a digest', async () => {
    const { getOfficeLogDigest, recordOfficeLogEntry } = await freshStore();
    recordOfficeLogEntry('run', { now: at(9, 0), detail: 'mermaid' });
    recordOfficeLogEntry('walkby', { now: at(9, 5), colleagueId: 'gilfoyle' });
    expect(getOfficeLogDigest()).toEqual([
      '09:00 you shipped a mermaid diagram',
      '09:05 gilfoyle stopped by your desk'
    ]);
  });

  it('ignores a nameless kind rather than storing a blank entry', async () => {
    const { getOfficeLogSnapshot, recordOfficeLogEntry } = await freshStore();
    recordOfficeLogEntry('');
    recordOfficeLogEntry(undefined);
    expect(getOfficeLogSnapshot()).toEqual([]);
  });

  /**
   * Eight replies in one thread is one conversation, not eight lines — and a
   * digest is small enough that a burst would evict the rest of the day.
   */
  it('collapses a burst in the same thread into one line', async () => {
    const { getOfficeLogDigest, recordOfficeLogEntry } = await freshStore();
    recordOfficeLogEntry('chat', { now: at(10, 0), colleagueId: 'dinesh' });
    recordOfficeLogEntry('chat', { now: at(10, 0) + 20_000, colleagueId: 'dinesh' });
    recordOfficeLogEntry('chat', { now: at(10, 0) + 50_000, colleagueId: 'dinesh' });
    expect(getOfficeLogDigest()).toHaveLength(1);
  });

  it('keeps separate lines for different people, and for a later return', async () => {
    const { getOfficeLogDigest, recordOfficeLogEntry } = await freshStore();
    recordOfficeLogEntry('chat', { now: at(10, 0), colleagueId: 'dinesh' });
    recordOfficeLogEntry('chat', { now: at(10, 0) + 5_000, colleagueId: 'jared' });
    recordOfficeLogEntry('chat', { now: at(10, 30), colleagueId: 'dinesh' });
    expect(getOfficeLogDigest()).toHaveLength(3);
  });

  it('caps what it keeps so storage cannot grow all session', async () => {
    const { getOfficeLogSnapshot, recordOfficeLogEntry } = await freshStore();
    for (let i = 0; i < OFFICE_LOG_ENTRY_CAP + 10; i += 1) {
      recordOfficeLogEntry('run', { now: at(9, 0) + i * 120_000, detail: `t${i}` });
    }
    expect(getOfficeLogSnapshot()).toHaveLength(OFFICE_LOG_ENTRY_CAP);
  });

  it('survives a reload on the same day', async () => {
    const first = await freshStore();
    first.recordOfficeLogEntry('coffee', { now: Date.now() });
    const second = await freshStore();
    expect(second.getOfficeLogDigest()).toHaveLength(1);
  });
});

describe('office log day stamping', () => {
  /**
   * A reload should not cost the office its morning; a log recounted the next
   * day would have characters confidently referring to things that did not
   * happen today. Yesterday is discarded, not migrated.
   */
  it('discards a log written on another day', () => {
    const yesterday = new Date(2026, 6, 31, 9, 0).getTime();
    const today = new Date(2026, 7, 1, 9, 0).getTime();
    writeOfficeLog([{ at: yesterday, kind: 'coffee' }], yesterday);
    expect(readOfficeLog(yesterday)).toHaveLength(1);
    expect(readOfficeLog(today)).toEqual([]);
  });

  it('survives corrupt storage without throwing', () => {
    window.localStorage.setItem(OFFICE_LOG_STORAGE_KEY, '{not json');
    expect(readOfficeLog(Date.now())).toEqual([]);
  });

  it('drops malformed entries from an otherwise valid log', () => {
    const now = Date.now();
    writeOfficeLog([{ at: now, kind: 'coffee' }, { kind: 'run' }, { at: now }, null], now);
    expect(readOfficeLog(now)).toEqual([{ at: now, kind: 'coffee' }]);
  });
});
