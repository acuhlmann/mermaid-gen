// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OFFICE_CAPTIONS_STORAGE_KEY,
  OFFICE_HEADPHONES_STORAGE_KEY,
  OFFICE_NARRATION_STORAGE_KEY,
  OFFICE_SOUNDSCAPE_STORAGE_KEY,
  OFFICE_USER_NAME_STORAGE_KEY,
  officeDayStamp,
  readOfficeCaptionsEnabled,
  readOfficeHeadphones,
  readOfficeNarrationEnabled,
  readOfficeSoundscapeEnabled,
  reconcileOfficeCalendarDay,
  reconcileOfficeHeadphonesPosture,
  USER_NAME_MAX_LENGTH,
  writeOfficeCaptionsEnabled,
  writeOfficeHeadphones,
  writeOfficeNarrationEnabled,
  writeOfficeSoundscapeEnabled,
  writeUserName
} from '../src/utils/officeAmbienceStorage.js';

function clearHeadphonesStorage() {
  for (const key of [
    OFFICE_HEADPHONES_STORAGE_KEY,
    OFFICE_NARRATION_STORAGE_KEY,
    OFFICE_SOUNDSCAPE_STORAGE_KEY,
    OFFICE_CAPTIONS_STORAGE_KEY,
    OFFICE_USER_NAME_STORAGE_KEY
  ]) {
    window.localStorage.removeItem(key);
  }
}

beforeEach(() => {
  clearHeadphonesStorage();
});

afterEach(() => {
  clearHeadphonesStorage();
});

describe('reconcileOfficeHeadphonesPosture', () => {
  it('returns sound-first defaults when storage is empty', () => {
    expect(reconcileOfficeHeadphonesPosture()).toEqual({
      headphones: false,
      narration: true,
      soundscape: true,
      captions: false
    });
    expect(readOfficeNarrationEnabled()).toBe(true);
    expect(readOfficeSoundscapeEnabled()).toBe(true);
    expect(readOfficeCaptionsEnabled()).toBe(false);
  });

  it('forces narration and soundscape off and captions on when headphones are on', () => {
    writeOfficeHeadphones(true);
    writeOfficeNarrationEnabled(true);
    writeOfficeSoundscapeEnabled(true);
    writeOfficeCaptionsEnabled(false);

    expect(reconcileOfficeHeadphonesPosture()).toEqual({
      headphones: true,
      narration: false,
      soundscape: false,
      captions: true
    });
    expect(readOfficeNarrationEnabled()).toBe(false);
    expect(readOfficeSoundscapeEnabled()).toBe(false);
    expect(readOfficeCaptionsEnabled()).toBe(true);
  });

  it('is idempotent when headphones posture is already consistent', () => {
    writeOfficeHeadphones(true);
    writeOfficeNarrationEnabled(false);
    writeOfficeSoundscapeEnabled(false);
    writeOfficeCaptionsEnabled(true);

    expect(reconcileOfficeHeadphonesPosture()).toEqual({
      headphones: true,
      narration: false,
      soundscape: false,
      captions: true
    });
    expect(window.localStorage.getItem(OFFICE_NARRATION_STORAGE_KEY)).toBe('0');
    expect(window.localStorage.getItem(OFFICE_SOUNDSCAPE_STORAGE_KEY)).toBe('0');
    expect(window.localStorage.getItem(OFFICE_CAPTIONS_STORAGE_KEY)).toBe('1');
  });

  it('re-enables narration and soundscape when headphones are off but legacy Voice keys were cleared', () => {
    writeOfficeHeadphones(false);
    writeOfficeNarrationEnabled(false);
    writeOfficeSoundscapeEnabled(false);

    expect(reconcileOfficeHeadphonesPosture()).toEqual({
      headphones: false,
      narration: true,
      soundscape: true,
      captions: false
    });
    expect(readOfficeNarrationEnabled()).toBe(true);
    expect(readOfficeSoundscapeEnabled()).toBe(true);
  });

  it('leaves captions on when headphones are off — floor CC nudge is independent', () => {
    writeOfficeHeadphones(false);
    writeOfficeCaptionsEnabled(true);

    expect(reconcileOfficeHeadphonesPosture()).toEqual({
      headphones: false,
      narration: true,
      soundscape: true,
      captions: true
    });
    expect(readOfficeCaptionsEnabled()).toBe(true);
  });
});

describe('writeUserName', () => {
  it('truncates pasted names at USER_NAME_MAX_LENGTH', () => {
    const long = 'a'.repeat(USER_NAME_MAX_LENGTH + 12);
    writeUserName(`  ${long}  `);
    expect(window.localStorage.getItem(OFFICE_USER_NAME_STORAGE_KEY)).toHaveLength(
      USER_NAME_MAX_LENGTH
    );
  });

  it('removes the key when the trimmed name is empty', () => {
    writeUserName('   ');
    expect(window.localStorage.getItem(OFFICE_USER_NAME_STORAGE_KEY)).toBeNull();
  });
});

describe('readOfficeHeadphones', () => {
  it('defaults off and only stores the opt-in', () => {
    expect(readOfficeHeadphones()).toBe(false);
    writeOfficeHeadphones(true);
    expect(readOfficeHeadphones()).toBe(true);
    writeOfficeHeadphones(false);
    expect(readOfficeHeadphones()).toBe(false);
    expect(window.localStorage.getItem(OFFICE_HEADPHONES_STORAGE_KEY)).toBeNull();
  });
});

describe('reconcileOfficeCalendarDay', () => {
  it('returns the same day and skips clear when still today', () => {
    const at = new Date(2026, 7, 1, 9, 0).getTime();
    vi.setSystemTime(at);
    let cleared = 0;
    const loaded = officeDayStamp(at);
    const next = reconcileOfficeCalendarDay(loaded, () => {
      cleared += 1;
    });
    expect(next).toBe(loaded);
    expect(cleared).toBe(0);
    vi.useRealTimers();
  });

  it('clears payload and returns today when the calendar day rolled over', () => {
    const yesterday = new Date(2026, 6, 31, 23, 0).getTime();
    vi.setSystemTime(yesterday);
    const loaded = officeDayStamp(yesterday);
    vi.setSystemTime(new Date(2026, 7, 1, 0, 5).getTime());
    let cleared = 0;
    const next = reconcileOfficeCalendarDay(loaded, () => {
      cleared += 1;
    });
    expect(cleared).toBe(1);
    expect(next).toBe(officeDayStamp());
    vi.useRealTimers();
  });
});
