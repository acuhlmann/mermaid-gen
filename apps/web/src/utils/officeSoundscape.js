/**
 * Pure scheduler brain for the office soundscape (docs/office-parody.md) —
 * decides WHEN a room-tone cue plays and WHICH one it is, mirroring
 * officeCadence.js: no timers, no audio, no store access. The
 * useOfficeSoundscape hook ticks and calls `pickNextSoundscapeCue`.
 *
 * Anti-annoyance policy: a brief quiet opening, a denser warm-up window (the
 * room "fades in" while the user settles), then a jittered cruise gap, and no
 * back-to-back set pieces (the printer, espresso machine, desk phone,
 * watercooler, chair squeak, vending machine, and elevator are events; only
 * the desk textures — keyboard clatter, mouse clicks, and paper shuffles —
 * may repeat).
 *
 * Cadence is deliberately denser than a "background music" bed: a corporate-IT
 * office is keyboards all day. At the desk, typing/mouse/paper are heavily
 * preferred; on the floor, kitchen/printer set pieces get a fairer share.
 */

export const SOUNDSCAPE_FIRST_CUE_MIN_MS = 4_000;
/** While the session is younger than this, cues arrive on the warm-up gap so
 * the soundscape establishes itself quickly, then settles to the cruise gap. */
export const SOUNDSCAPE_WARMUP_WINDOW_MS = 120_000;
export const SOUNDSCAPE_WARMUP_MIN_GAP_MS = 7_000;
export const SOUNDSCAPE_WARMUP_GAP_JITTER_MS = 8_000;
/** Cruise: roughly one cue every ~18–38 s — present without becoming a loop. */
export const SOUNDSCAPE_MIN_GAP_MS = 18_000;
export const SOUNDSCAPE_GAP_JITTER_MS = 20_000;

/**
 * Relative frequency of each cue. Keyboard is the office's heartbeat — weight
 * 7 means it lands ~3× more often than a set piece even before the at-desk bias.
 */
const CUE_WEIGHTS = [
  ['keyboard', 7],
  ['mouse', 2.5],
  ['paper', 2],
  ['printer', 1.5],
  ['chair', 1.2],
  ['phone', 1.1],
  ['watercooler', 0.9],
  ['espresso', 1.2],
  ['vending', 0.7],
  ['elevator', 0.6]
];

/** Desk textures get this multiplier while you are sitting at your screen. */
const AT_DESK_TEXTURE_BOOST = 2.4;
/** Set pieces thin out a bit at the desk — they happen down the hall. */
const AT_DESK_SET_PIECE_SCALE = 0.55;
/** On the floor, set pieces (kitchen, printer) step forward. */
const ON_FLOOR_SET_PIECE_BOOST = 1.6;

export const SOUNDSCAPE_CUES = CUE_WEIGHTS.map(([cue]) => cue);

/** Desk textures that may play twice in a row; everything else is a set piece. */
const REPEATABLE_CUES = new Set(['keyboard', 'mouse', 'paper']);

/**
 * @param {string} cue
 * @param {boolean} atDesk
 * @returns {number}
 */
function weightFor(cue, base, atDesk) {
  const deskTexture = REPEATABLE_CUES.has(cue);
  if (atDesk) {
    return deskTexture ? base * AT_DESK_TEXTURE_BOOST : base * AT_DESK_SET_PIECE_SCALE;
  }
  return deskTexture ? base : base * ON_FLOOR_SET_PIECE_BOOST;
}

/**
 * @param {{
 *   now: number,
 *   sessionStartedAt: number,
 *   lastPlayedAt: number,
 *   lastCue?: string | null,
 *   atDesk?: boolean,
 *   random?: () => number
 * }} args
 * @returns {'keyboard'|'mouse'|'paper'|'printer'|'chair'|'phone'|'watercooler'|'espresso'|'vending'|'elevator'|null}
 */
export function pickNextSoundscapeCue({
  now,
  sessionStartedAt,
  lastPlayedAt,
  lastCue = null,
  atDesk = true,
  random = Math.random
}) {
  if (now - sessionStartedAt < SOUNDSCAPE_FIRST_CUE_MIN_MS) return null;
  const warmingUp = now - sessionStartedAt < SOUNDSCAPE_WARMUP_WINDOW_MS;
  const requiredGap = warmingUp
    ? SOUNDSCAPE_WARMUP_MIN_GAP_MS + random() * SOUNDSCAPE_WARMUP_GAP_JITTER_MS
    : SOUNDSCAPE_MIN_GAP_MS + random() * SOUNDSCAPE_GAP_JITTER_MS;
  if (lastPlayedAt > 0 && now - lastPlayedAt < requiredGap) return null;

  const eligible = CUE_WEIGHTS.filter(([cue]) => REPEATABLE_CUES.has(cue) || cue !== lastCue).map(
    ([cue, base]) => /** @type {[string, number]} */ ([cue, weightFor(cue, base, atDesk)])
  );
  const total = eligible.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [cue, weight] of eligible) {
    roll -= weight;
    if (roll <= 0) return cue;
  }
  return eligible[eligible.length - 1][0];
}
