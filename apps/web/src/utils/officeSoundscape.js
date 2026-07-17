/**
 * Pure scheduler brain for the office soundscape (docs/office-parody.md) —
 * decides WHEN a room-tone cue plays and WHICH one it is, mirroring
 * officeCadence.js: no timers, no audio, no store access. The
 * useOfficeSoundscape hook ticks and calls `pickNextSoundscapeCue`.
 *
 * Anti-annoyance policy: a brief quiet opening, a denser warm-up window (the
 * room "fades in" while the user settles), then a jittered multi-ten-second
 * cruise gap, and no back-to-back set pieces (the printer, espresso machine,
 * desk phone, watercooler, chair squeak, vending machine, and elevator are
 * events; only the desk textures — keyboard clatter, mouse clicks, and paper
 * shuffles — may repeat).
 */

export const SOUNDSCAPE_FIRST_CUE_MIN_MS = 6_000;
/** While the session is younger than this, cues arrive on the warm-up gap so
 * the soundscape establishes itself quickly, then settles to the cruise gap. */
export const SOUNDSCAPE_WARMUP_WINDOW_MS = 120_000;
export const SOUNDSCAPE_WARMUP_MIN_GAP_MS = 12_000;
export const SOUNDSCAPE_WARMUP_GAP_JITTER_MS = 14_000;
export const SOUNDSCAPE_MIN_GAP_MS = 35_000;
export const SOUNDSCAPE_GAP_JITTER_MS = 40_000;

/** Relative frequency of each cue — typing is the office's heartbeat. */
const CUE_WEIGHTS = [
  ['keyboard', 4],
  ['mouse', 2.5],
  ['paper', 2],
  ['printer', 1.5],
  ['chair', 1.3],
  ['phone', 1.2],
  ['watercooler', 1],
  ['espresso', 1],
  ['vending', 0.8],
  ['elevator', 0.7]
];

export const SOUNDSCAPE_CUES = CUE_WEIGHTS.map(([cue]) => cue);

/** Desk textures that may play twice in a row; everything else is a set piece. */
const REPEATABLE_CUES = new Set(['keyboard', 'mouse', 'paper']);

/**
 * @param {{
 *   now: number,
 *   sessionStartedAt: number,
 *   lastPlayedAt: number,
 *   lastCue?: string | null,
 *   random?: () => number
 * }} args
 * @returns {'keyboard'|'mouse'|'paper'|'printer'|'chair'|'phone'|'watercooler'|'espresso'|'vending'|'elevator'|null}
 */
export function pickNextSoundscapeCue({
  now,
  sessionStartedAt,
  lastPlayedAt,
  lastCue = null,
  random = Math.random
}) {
  if (now - sessionStartedAt < SOUNDSCAPE_FIRST_CUE_MIN_MS) return null;
  const warmingUp = now - sessionStartedAt < SOUNDSCAPE_WARMUP_WINDOW_MS;
  const requiredGap = warmingUp
    ? SOUNDSCAPE_WARMUP_MIN_GAP_MS + random() * SOUNDSCAPE_WARMUP_GAP_JITTER_MS
    : SOUNDSCAPE_MIN_GAP_MS + random() * SOUNDSCAPE_GAP_JITTER_MS;
  if (lastPlayedAt > 0 && now - lastPlayedAt < requiredGap) return null;

  const eligible = CUE_WEIGHTS.filter(([cue]) => REPEATABLE_CUES.has(cue) || cue !== lastCue);
  const total = eligible.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [cue, weight] of eligible) {
    roll -= weight;
    if (roll <= 0) return cue;
  }
  return eligible[eligible.length - 1][0];
}
