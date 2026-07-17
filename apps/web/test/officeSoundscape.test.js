// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  pickNextSoundscapeCue,
  SOUNDSCAPE_CUES,
  SOUNDSCAPE_FIRST_CUE_MIN_MS,
  SOUNDSCAPE_MIN_GAP_MS,
  SOUNDSCAPE_WARMUP_GAP_JITTER_MS,
  SOUNDSCAPE_WARMUP_MIN_GAP_MS,
  SOUNDSCAPE_WARMUP_WINDOW_MS
} from '../src/utils/officeSoundscape.js';
import {
  readOfficeSoundscapeEnabled,
  writeOfficeSoundscapeEnabled,
  OFFICE_SOUNDSCAPE_STORAGE_KEY
} from '../src/utils/officeAmbienceStorage.js';

// Well past the warm-up window — cruise-gap behavior.
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
  it('stays quiet during the (brief) opening stretch of a session', () => {
    expect(
      pickNextSoundscapeCue({ ...BASE, now: SOUNDSCAPE_FIRST_CUE_MIN_MS - 1, sessionStartedAt: 0 })
    ).toBeNull();
    expect(
      pickNextSoundscapeCue({ ...BASE, now: SOUNDSCAPE_FIRST_CUE_MIN_MS + 1, sessionStartedAt: 0 })
    ).not.toBeNull();
  });

  it('uses the short warm-up gap inside the warm-up window', () => {
    const now = SOUNDSCAPE_WARMUP_WINDOW_MS - 1;
    const tooRecent = now - SOUNDSCAPE_WARMUP_MIN_GAP_MS + 1;
    expect(
      pickNextSoundscapeCue({ ...BASE, now, lastPlayedAt: tooRecent, random: () => 0 })
    ).toBeNull();
    const justPastWarmupGap = now - SOUNDSCAPE_WARMUP_MIN_GAP_MS - 1;
    expect(
      pickNextSoundscapeCue({ ...BASE, now, lastPlayedAt: justPastWarmupGap, random: () => 0 })
    ).not.toBeNull();
  });

  it('settles to the longer cruise gap after the warm-up window', () => {
    // A gap that satisfied warm-up (even with max jitter) no longer does...
    const warmupAgo =
      BASE.now - (SOUNDSCAPE_WARMUP_MIN_GAP_MS + SOUNDSCAPE_WARMUP_GAP_JITTER_MS) - 1;
    expect(pickNextSoundscapeCue({ ...BASE, lastPlayedAt: warmupAgo, random: () => 0 })).toBeNull();
    // ...only the cruise gap is enough.
    const cruiseAgo = BASE.now - SOUNDSCAPE_MIN_GAP_MS - 1;
    expect(
      pickNextSoundscapeCue({ ...BASE, lastPlayedAt: cruiseAgo, random: () => 0 })
    ).not.toBeNull();
  });

  it('only returns known cues', () => {
    for (let i = 0; i < 200; i += 1) {
      const cue = pickNextSoundscapeCue({ ...BASE, random: Math.random });
      if (cue) expect(SOUNDSCAPE_CUES).toContain(cue);
    }
  });

  it('never plays a set piece twice in a row', () => {
    for (const setPiece of [
      'printer',
      'espresso',
      'phone',
      'watercooler',
      'chair',
      'vending',
      'elevator'
    ]) {
      for (let i = 0; i < 200; i += 1) {
        const cue = pickNextSoundscapeCue({ ...BASE, lastCue: setPiece, random: Math.random });
        expect(cue).not.toBe(setPiece);
      }
    }
  });

  it('allows the desk textures to repeat — typing and paper are the room tone', () => {
    for (const texture of ['keyboard', 'mouse', 'paper']) {
      let sawRepeat = false;
      for (let i = 0; i < 400; i += 1) {
        if (pickNextSoundscapeCue({ ...BASE, lastCue: texture, random: Math.random }) === texture) {
          sawRepeat = true;
          break;
        }
      }
      expect(sawRepeat, `${texture} should be able to repeat`).toBe(true);
    }
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
