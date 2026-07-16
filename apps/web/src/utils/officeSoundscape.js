/**
 * Pure scheduler brain for the office soundscape (docs/office-parody.md) —
 * decides WHEN a room-tone cue plays and WHICH one it is, mirroring
 * officeCadence.js: no timers, no audio, no store access. The
 * useOfficeSoundscape hook ticks and calls `pickNextSoundscapeCue`.
 *
 * Anti-annoyance policy: a quiet opening stretch, a jittered multi-ten-second
 * gap, and no back-to-back set pieces (the printer and the espresso machine
 * are events; only keyboard clatter may repeat).
 */

export const SOUNDSCAPE_FIRST_CUE_MIN_MS = 45_000;
export const SOUNDSCAPE_MIN_GAP_MS = 35_000;
export const SOUNDSCAPE_GAP_JITTER_MS = 40_000;

/** Relative frequency of each cue — typing is the office's heartbeat. */
const CUE_WEIGHTS = [
  ['keyboard', 4],
  ['printer', 1.5],
  ['espresso', 1]
];

export const SOUNDSCAPE_CUES = CUE_WEIGHTS.map(([cue]) => cue);

/**
 * @param {{
 *   now: number,
 *   sessionStartedAt: number,
 *   lastPlayedAt: number,
 *   lastCue?: string | null,
 *   random?: () => number
 * }} args
 * @returns {'keyboard'|'printer'|'espresso'|null}
 */
export function pickNextSoundscapeCue({
  now,
  sessionStartedAt,
  lastPlayedAt,
  lastCue = null,
  random = Math.random
}) {
  if (now - sessionStartedAt < SOUNDSCAPE_FIRST_CUE_MIN_MS) return null;
  const requiredGap = SOUNDSCAPE_MIN_GAP_MS + random() * SOUNDSCAPE_GAP_JITTER_MS;
  if (lastPlayedAt > 0 && now - lastPlayedAt < requiredGap) return null;

  const eligible = CUE_WEIGHTS.filter(([cue]) => cue === 'keyboard' || cue !== lastCue);
  const total = eligible.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [cue, weight] of eligible) {
    roll -= weight;
    if (roll <= 0) return cue;
  }
  return eligible[eligible.length - 1][0];
}
