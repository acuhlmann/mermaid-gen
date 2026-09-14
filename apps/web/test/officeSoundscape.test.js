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

  it('biases toward desk textures while you are at your screen', () => {
    const counts = { keyboard: 0, mouse: 0, paper: 0, other: 0 };
    for (let i = 0; i < 500; i += 1) {
      const cue = pickNextSoundscapeCue({ ...BASE, atDesk: true, random: Math.random });
      if (cue === 'keyboard' || cue === 'mouse' || cue === 'paper') counts[cue] += 1;
      else if (cue) counts.other += 1;
    }
    const textures = counts.keyboard + counts.mouse + counts.paper;
    expect(textures).toBeGreaterThan(counts.other * 2);
    expect(counts.keyboard).toBeGreaterThan(80);
  });

  it('gives kitchen and printer set pieces more air on the floor', () => {
    let setPiecesAtDesk = 0;
    let setPiecesOnFloor = 0;
    for (let i = 0; i < 400; i += 1) {
      const desk = pickNextSoundscapeCue({ ...BASE, atDesk: true, random: Math.random });
      const floor = pickNextSoundscapeCue({ ...BASE, atDesk: false, random: Math.random });
      if (desk && !['keyboard', 'mouse', 'paper'].includes(desk)) setPiecesAtDesk += 1;
      if (floor && !['keyboard', 'mouse', 'paper'].includes(floor)) setPiecesOnFloor += 1;
    }
    expect(setPiecesOnFloor).toBeGreaterThan(setPiecesAtDesk);
  });

  it('only returns known cues', () => {
    for (let i = 0; i < 200; i += 1) {
      const cue = pickNextSoundscapeCue({ ...BASE, random: Math.random });
      if (cue) expect(SOUNDSCAPE_CUES).toContain(cue);
    }
  });

  it('schedules the two cues that used to be diegetic-only', () => {
    // Both assets were baked for a single walk-up moment — the whiteboard for
    // standing at it, the door for the Day One check-in — so a returning user
    // who skipped both heard neither, ever. An ambient row is what makes a
    // paid sample part of the room rather than part of one gesture.
    const seen = new Set();
    for (let i = 0; i < 600; i += 1) {
      const cue = pickNextSoundscapeCue({ ...BASE, atDesk: false, random: Math.random });
      if (cue) seen.add(cue);
    }
    expect(seen).toContain('whiteboard');
    expect(seen).toContain('door');
  });

  it('never plays a set piece twice in a row', () => {
    for (const setPiece of [
      'printer',
      'espresso',
      'phone',
      'watercooler',
      'chair',
      'vending',
      'elevator',
      'whiteboard',
      'door'
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

describe('zone-biased cues (the cheap half of per-room beds)', () => {
  /**
   * Sample the picker across the whole roll space, so the assertion is about
   * the weight table rather than about one lucky `random()`.
   */
  function distribution(args) {
    const counts = new Map();
    for (let i = 0; i < 400; i += 1) {
      const roll = i / 400;
      const cue = pickNextSoundscapeCue({ ...BASE, ...args, random: () => roll });
      if (cue) counts.set(cue, (counts.get(cue) ?? 0) + 1);
    }
    return counts;
  }

  it('plays the fridge far more often while you stand in the kitchen', () => {
    const neutral = distribution({ atDesk: false, zone: 'neutral' });
    const kitchen = distribution({ atDesk: false, zone: 'kitchen' });
    expect(kitchen.get('fridge') ?? 0).toBeGreaterThan(neutral.get('fridge') ?? 0);
  });

  it('lifts the rest of the kitchen with it', () => {
    const neutral = distribution({ atDesk: false, zone: 'neutral' });
    const kitchen = distribution({ atDesk: false, zone: 'kitchen' });
    for (const cue of ['espresso', 'watercooler', 'vending']) {
      expect(kitchen.get(cue) ?? 0, `${cue} should rise in the kitchen`).toBeGreaterThan(
        neutral.get(cue) ?? 0
      );
    }
  });

  it('ignores the zone at your desk — a stale standing position is not a room', () => {
    const atDesk = distribution({ atDesk: true, zone: 'kitchen' });
    const atDeskNeutral = distribution({ atDesk: true, zone: 'neutral' });
    expect([...atDesk.entries()].sort()).toEqual([...atDeskNeutral.entries()].sort());
  });

  it('an unknown zone is simply no bias, never a crash', () => {
    expect(() => pickNextSoundscapeCue({ ...BASE, atDesk: false, zone: 'nowhere' })).not.toThrow();
  });
});

describe('an office with fewer people in it (queue 8)', () => {
  /** Same whole-roll-space sweep the zone block uses, so the claim is about the
   *  weight table rather than about one lucky `random()`. */
  function distribution(args) {
    const counts = new Map();
    for (let i = 0; i < 400; i += 1) {
      const roll = i / 400;
      const cue = pickNextSoundscapeCue({ ...BASE, ...args, random: () => roll });
      if (cue) counts.set(cue, (counts.get(cue) ?? 0) + 1);
    }
    return counts;
  }

  const shareOf = (counts, cues) => {
    const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
    const named = cues.reduce((sum, cue) => sum + (counts.get(cue) ?? 0), 0);
    return named / total;
  };

  /*
   * A full room has to be byte-for-byte what the office played before this dial
   * existed: the tables are the busy floor's, and `occupancy` only ever thins
   * them. Without this, adding the dial is a global retune nobody asked for.
   */
  it('changes nothing at all in a full room', () => {
    const tuned = distribution({ atDesk: false });
    const full = distribution({ atDesk: false, occupancy: 1 });
    expect([...full.entries()].sort()).toEqual([...tuned.entries()].sort());
    const deskTuned = distribution({ atDesk: true });
    const deskFull = distribution({ atDesk: true, occupancy: 1 });
    expect([...deskFull.entries()].sort()).toEqual([...deskTuned.entries()].sort());
  });

  it('waits longer between cues when the building is empty', () => {
    // A gap that is enough for a busy office is not enough for an empty one.
    const lastPlayedAt = BASE.now - SOUNDSCAPE_MIN_GAP_MS - 1;
    expect(
      pickNextSoundscapeCue({ ...BASE, lastPlayedAt, occupancy: 1, random: () => 0 })
    ).not.toBeNull();
    expect(
      pickNextSoundscapeCue({ ...BASE, lastPlayedAt, occupancy: 0.15, random: () => 0 })
    ).toBeNull();
    // ...and it is a stretch rather than a mute: wait long enough and it fires.
    const muchEarlier = BASE.now - SOUNDSCAPE_MIN_GAP_MS * 4;
    expect(
      pickNextSoundscapeCue({
        ...BASE,
        lastPlayedAt: muchEarlier,
        occupancy: 0.15,
        random: () => 0
      })
    ).not.toBeNull();
  });

  /*
   * The whole point of the slice, stated as the thing a listener would notice:
   * the machines keep running after everybody goes home, so they stop being a
   * rounding error in the mix and become most of what the room is.
   */
  it('leaves the building running when the people go home', () => {
    const busy = distribution({ atDesk: false, occupancy: 1 });
    const empty = distribution({ atDesk: false, occupancy: 0.15 });
    const machines = ['fridge', 'serverRack'];
    expect(shareOf(empty, machines)).toBeGreaterThan(shareOf(busy, machines) * 3);
    // Absolute counts, not only share — a share can rise because everything
    // fell, and these two must not have fallen at all.
    for (const cue of machines) {
      expect(empty.get(cue) ?? 0, `${cue} should not thin out`).toBeGreaterThanOrEqual(
        busy.get(cue) ?? 0
      );
    }
  });

  it('thins out the cues that need a person to make them', () => {
    const busy = distribution({ atDesk: false, occupancy: 1 });
    const empty = distribution({ atDesk: false, occupancy: 0.15 });
    for (const cue of ['keyboard', 'laugh', 'cough', 'printer', 'door']) {
      expect(empty.get(cue) ?? 0, `${cue} should thin out`).toBeLessThan(busy.get(cue) ?? 0);
    }
  });

  /*
   * Occupancy is about how many other people are in the building, which is just
   * as true with your back to the room — unlike the zone, which is about where
   * you are standing and is deliberately ignored at the desk.
   */
  it('applies at the desk too, where the zone does not', () => {
    const busy = distribution({ atDesk: true, occupancy: 1 });
    const empty = distribution({ atDesk: true, occupancy: 0.15 });
    expect(empty.get('keyboard') ?? 0).toBeLessThan(busy.get('keyboard') ?? 0);
  });

  it('still plays something in an empty room, and only known cues', () => {
    const empty = distribution({ atDesk: false, occupancy: 0 });
    expect([...empty.values()].reduce((sum, n) => sum + n, 0)).toBeGreaterThan(0);
    for (const cue of empty.keys()) expect(SOUNDSCAPE_CUES).toContain(cue);
  });

  it('treats a nonsense occupancy as a full room rather than a silent one', () => {
    const full = distribution({ atDesk: false, occupancy: 1 });
    for (const bogus of [Number.NaN, undefined]) {
      expect([...distribution({ atDesk: false, occupancy: bogus }).entries()].sort()).toEqual(
        [...full.entries()].sort()
      );
    }
    expect(() => pickNextSoundscapeCue({ ...BASE, occupancy: -3 })).not.toThrow();
    expect(() => pickNextSoundscapeCue({ ...BASE, occupancy: 9 })).not.toThrow();
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
