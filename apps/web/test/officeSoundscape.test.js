// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  pickNextSoundscapeCue,
  SOUNDSCAPE_CUES,
  SOUNDSCAPE_FIRST_CUE_MIN_MS,
  SOUNDSCAPE_MIN_GAP_MS
} from '../src/utils/officeSoundscape.js';
import {
  readOfficeSoundscapeEnabled,
  writeOfficeSoundscapeEnabled,
  OFFICE_SOUNDSCAPE_STORAGE_KEY
} from '../src/utils/officeAmbienceStorage.js';

const BASE = {
  now: 1_000_000,
  sessionStartedAt: 0,
  lastPlayedAt: 0,
  lastCue: null,
  random: () => 0.5
};

afterEach(() => {
  window.localStorage.clear();
});

describe('pickNextSoundscapeCue', () => {
  it('stays quiet during the opening stretch of a session', () => {
    expect(
      pickNextSoundscapeCue({ ...BASE, now: SOUNDSCAPE_FIRST_CUE_MIN_MS - 1, sessionStartedAt: 0 })
    ).toBeNull();
    expect(
      pickNextSoundscapeCue({ ...BASE, now: SOUNDSCAPE_FIRST_CUE_MIN_MS + 1, sessionStartedAt: 0 })
    ).not.toBeNull();
  });

  it('respects the jittered minimum gap between cues', () => {
    const lastPlayedAt = BASE.now - SOUNDSCAPE_MIN_GAP_MS + 1;
    expect(pickNextSoundscapeCue({ ...BASE, lastPlayedAt, random: () => 0 })).toBeNull();
    const longAgo = BASE.now - SOUNDSCAPE_MIN_GAP_MS * 3;
    expect(
      pickNextSoundscapeCue({ ...BASE, lastPlayedAt: longAgo, random: () => 0 })
    ).not.toBeNull();
  });

  it('only returns known cues', () => {
    for (let i = 0; i < 200; i += 1) {
      const cue = pickNextSoundscapeCue({ ...BASE, random: Math.random });
      if (cue) expect(SOUNDSCAPE_CUES).toContain(cue);
    }
  });

  it('never plays the printer or espresso machine twice in a row', () => {
    for (const setPiece of ['printer', 'espresso']) {
      for (let i = 0; i < 200; i += 1) {
        const cue = pickNextSoundscapeCue({ ...BASE, lastCue: setPiece, random: Math.random });
        expect(cue).not.toBe(setPiece);
      }
    }
  });

  it('allows keyboard clatter to repeat — typing is the room tone', () => {
    let sawKeyboard = false;
    for (let i = 0; i < 200; i += 1) {
      if (
        pickNextSoundscapeCue({ ...BASE, lastCue: 'keyboard', random: Math.random }) === 'keyboard'
      ) {
        sawKeyboard = true;
        break;
      }
    }
    expect(sawKeyboard).toBe(true);
  });
});

describe('office soundscape storage', () => {
  it('defaults ON and only persists the opt-out', () => {
    expect(readOfficeSoundscapeEnabled()).toBe(true);
    writeOfficeSoundscapeEnabled(false);
    expect(readOfficeSoundscapeEnabled()).toBe(false);
    expect(window.localStorage.getItem(OFFICE_SOUNDSCAPE_STORAGE_KEY)).toBe('0');
    writeOfficeSoundscapeEnabled(true);
    expect(readOfficeSoundscapeEnabled()).toBe(true);
    expect(window.localStorage.getItem(OFFICE_SOUNDSCAPE_STORAGE_KEY)).toBeNull();
  });
});
